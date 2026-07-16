import { spawn } from 'node:child_process';

export const codeGateModel = 'hf.co/Qwen/Qwen3-4B-GGUF:Q4_K_M';
export const modelRunnerBaseUrl = 'http://127.0.0.1:12434';
export const codeGateModelContextTokens = 8192;

type StreamEvent = (type: 'status' | 'text', text: string) => void;

function dockerCommand() {
    return process.platform === 'win32' ? 'docker.exe' : 'docker';
}

export function runDockerModelCommand(args: string[], onEvent: StreamEvent, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(dockerCommand(), args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        const emit = (chunk: Buffer | string) => {
            const text = String(chunk).replace(/\r/g, '');
            if (text) onEvent('status', text);
        };
        child.stdout.on('data', emit);
        child.stderr.on('data', (chunk) => {
            stderr += String(chunk);
            emit(chunk);
        });
        const abort = () => child.kill();
        signal?.addEventListener('abort', abort, { once: true });
        child.once('error', reject);
        child.once('close', (code) => {
            signal?.removeEventListener('abort', abort);
            if (signal?.aborted) return reject(new Error('Operation cancelled'));
            if (code === 0) resolve();
            else reject(new Error(stderr.trim() || `docker ${args.join(' ')} exited with code ${code}`));
        });
    });
}

async function commandSucceeds(args: string[]): Promise<boolean> {
    try {
        await runDockerModelCommand(args, () => {});
        return true;
    } catch {
        return false;
    }
}

async function ensureDockerReady(onEvent: StreamEvent, signal?: AbortSignal) {
    if (await commandSucceeds(['info', '--format', '{{.ServerVersion}}'])) return;
    if (process.platform !== 'win32') throw new Error('Docker is unavailable');
    onEvent('status', 'Starting Docker Desktop...\n');
    await runDockerModelCommand(['desktop', 'start', '--timeout', '60'], onEvent, signal);
}

export async function provisionCodeGateModel(onEvent: StreamEvent, signal?: AbortSignal) {
    await ensureDockerReady(onEvent, signal);
    if (process.platform === 'win32') {
        onEvent('status', 'Enabling Docker Model Runner with GPU acceleration...\n');
        try {
            await runDockerModelCommand(
                ['desktop', 'enable', 'model-runner', '--gpu=enable', '--tcp=12434'],
                onEvent,
                signal
            );
        } catch {
            onEvent('status', 'A compatible GPU is unavailable; continuing with CPU inference.\n');
            await runDockerModelCommand(['desktop', 'enable', 'model-runner', '--tcp=12434'], onEvent, signal);
        }
    } else if (!(await commandSucceeds(['model', 'status']))) {
        throw new Error('Docker Model Runner is not installed');
    }
    onEvent('status', `Downloading ${codeGateModel}...\n`);
    await runDockerModelCommand(['model', 'pull', codeGateModel], onEvent, signal);
    onEvent('status', 'Configuring the model for one independent request at a time...\n');
    await runDockerModelCommand([
        'model', 'configure', '--context-size', String(codeGateModelContextTokens), codeGateModel,
        '--', '--parallel', '1', '--no-cache-prompt', '--cache-ram', '0'
    ], onEvent, signal);
    await warmCodeGateModel(onEvent, signal);
}

export async function warmCodeGateModel(onEvent: StreamEvent = () => {}, signal?: AbortSignal) {
    await ensureDockerReady(onEvent, signal);
    onEvent('status', 'Loading the CodeGate AI model into memory...\n');
    await runDockerModelCommand(['model', 'run', '--detach', codeGateModel], onEvent, signal);
    onEvent('status', 'Local AI helper is ready.\n');
}

export async function unloadCodeGateModel(onEvent: StreamEvent = () => {}, signal?: AbortSignal) {
    if (!(await commandSucceeds(['model', 'status']))) return;
    try {
        await runDockerModelCommand(['model', 'unload', codeGateModel], onEvent, signal);
    } catch {
        // An enabled but already-unloaded model requires no further action.
    }
}

type ChatMessage = { role: 'system' | 'user'; content: string };
let inferenceActive = false;

export async function streamModelText(messages: ChatMessage[], onEvent: StreamEvent, signal?: AbortSignal) {
    if (inferenceActive) throw new Error('Another local AI explanation is already running');
    inferenceActive = true;
    try {
        const response = await fetch(`${modelRunnerBaseUrl}/engines/v1/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                model: codeGateModel,
                messages,
                stream: true,
                temperature: 0.15
            }),
            signal
        });
        if (!response.ok || !response.body) {
            const detail = await response.text().catch(() => '');
            throw new Error(detail.trim() || `Docker Model Runner returned ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let emitted = false;
        while (true) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (!data || data === '[DONE]') continue;
                try {
                    const payload = JSON.parse(data);
                    const text = payload.choices?.[0]?.delta?.content;
                    if (typeof text === 'string' && text) {
                        emitted = true;
                        onEvent('text', text);
                    }
                } catch {
                    // Ignore keepalive and non-chat events from compatible backends.
                }
            }
            if (done) break;
        }
        if (!emitted) throw new Error('The local model returned no explanation text');
    } finally {
        inferenceActive = false;
    }
}

export function eventStream(operation: (emit: StreamEvent, signal: AbortSignal) => Promise<void>, requestSignal?: AbortSignal) {
    const encoder = new TextEncoder();
    const controller = new AbortController();
    const abort = () => controller.abort();
    requestSignal?.addEventListener('abort', abort, { once: true });
    return new Response(new ReadableStream({
        start(stream) {
            const emit: StreamEvent = (type, text) => stream.enqueue(encoder.encode(`data: ${JSON.stringify({ type, text })}\n\n`));
            void operation(emit, controller.signal).then(() => {
                stream.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            }).catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                stream.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', text: message })}\n\n`));
            }).finally(() => {
                requestSignal?.removeEventListener('abort', abort);
                try { stream.close(); } catch {}
            });
        },
        cancel() { controller.abort(); }
    }), {
        headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache, no-transform',
            connection: 'keep-alive'
        }
    });
}
