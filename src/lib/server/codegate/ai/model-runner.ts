import { spawn } from 'node:child_process';

export const codeGateModel = 'hf.co/jica98/qwen3.5-4B-super-coder:Q4_0';
export const modelRunnerBaseUrl = 'http://127.0.0.1:12434';
const codeGateModelContextTokens = 8192;
const codeGateModelKeepAlive = '1h';
const modelWakeFreshMs = 60_000;

type StreamEvent = (type: 'status' | 'text' | 'reasoning' | 'problem' | 'output' | 'result', text: string) => void;
type ModelStreamEvent = (type: 'status' | 'text' | 'reasoning' | 'problem' | 'output' | 'result', text: string) => void | boolean;
type ModelRequestOptions = { seed?: number; temperature?: number; topP?: number; maxTokens?: number; frequencyPenalty?: number; includeReasoning?: boolean; endpoint?: string };
type EndpointTarget = { key: string; chatUrl: string; modelsUrl: string };
const endpointModels = new Map<string, string>();

function customEndpoint(value: unknown): string {
    return typeof value === 'string' ? value.trim().slice(0, 2_048) : '';
}

function endpointTarget(value: string): EndpointTarget {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('The custom AI endpoint is not a valid URL'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('The custom AI endpoint must use HTTP or HTTPS');
    url.hash = '';
    url.search = '';
    const path = url.pathname.replace(/\/+$/, '');
    let apiRoot: string;
    if (/\/chat\/completions$/i.test(path)) apiRoot = path.replace(/\/chat\/completions$/i, '');
    else if (/\/v1$/i.test(path)) apiRoot = path;
    else apiRoot = `${path}/v1`.replace(/\/+/g, '/');
    const origin = `${url.protocol}//${url.host}`;
    return {
        key: `${origin}${apiRoot}`,
        chatUrl: `${origin}${apiRoot}/chat/completions`,
        modelsUrl: `${origin}${apiRoot}/models`
    };
}

async function discoverEndpointModel(target: EndpointTarget, signal?: AbortSignal): Promise<string> {
    const cached = endpointModels.get(target.key);
    if (cached) return cached;
    const response = await fetch(target.modelsUrl, { signal });
    if (!response.ok) throw new Error(`Custom AI endpoint model discovery returned ${response.status}`);
    const payload = await response.json().catch(() => ({}));
    const models = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
    const selected = models.find((model: any) => model?.state === 'loaded' && typeof model?.id === 'string')
        ?? models.find((model: any) => typeof model?.id === 'string' || typeof model?.name === 'string');
    const model = typeof selected?.id === 'string' ? selected.id : typeof selected?.name === 'string' ? selected.name : '';
    if (!model) throw new Error('The custom AI endpoint did not report an available model');
    endpointModels.set(target.key, model);
    return model;
}

export function requestedAiEndpoint(body: Record<string, unknown>): string {
    return customEndpoint(body.aiEndpoint);
}

export async function warmCustomAiEndpoint(endpoint: string, onEvent: StreamEvent = () => {}, signal?: AbortSignal) {
    onEvent('status', 'Custom endpoint selected; unloading the CodeGate Docker model if it is running...\n');
    await unloadCodeGateModel(onEvent, signal);
    const target = endpointTarget(endpoint);
    endpointModels.delete(target.key);
    onEvent('status', 'Connecting to the custom AI endpoint...\n');
    await discoverEndpointModel(target, signal);
    onEvent('status', 'Custom AI endpoint is ready.\n');
}

function dockerCommand() {
    return process.platform === 'win32' ? 'docker.exe' : 'docker';
}

function runDockerModelCommand(args: string[], onEvent: StreamEvent, signal?: AbortSignal, timeoutMs = 120_000): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(dockerCommand(), args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        let settled = false;
        const emit = (chunk: Buffer | string) => {
            const text = String(chunk).replace(/\r/g, '');
            if (text) onEvent('status', text);
        };
        child.stdout.on('data', emit);
        child.stderr.on('data', (chunk) => {
            stderr += String(chunk);
            emit(chunk);
        });
        const finish = (operation: () => void) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            signal?.removeEventListener('abort', abort);
            operation();
        };
        const abort = () => child.kill();
        const timeout = setTimeout(() => {
            child.kill();
            finish(() => reject(new Error(`docker ${args.slice(0, 2).join(' ')} timed out`)));
        }, timeoutMs);
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        child.once('error', (error) => finish(() => reject(error)));
        child.once('close', (code) => {
            if (signal?.aborted) return finish(() => reject(new Error('Operation cancelled')));
            if (code === 0) finish(resolve);
            else finish(() => reject(new Error(stderr.trim() || `docker ${args.join(' ')} exited with code ${code}`)));
        });
    });
}

async function commandSucceeds(args: string[]): Promise<boolean> {
    try {
        await runDockerModelCommand(args, () => {}, undefined, 10_000);
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
    await warmCodeGateModel(onEvent, signal);
}

export async function warmCodeGateModel(onEvent: StreamEvent = () => {}, signal?: AbortSignal) {
    await ensureDockerReady(onEvent, signal);
    onEvent('status', 'Configuring the model for one independent request and a one-hour idle keep-alive...\n');
    await runDockerModelCommand([
        'model', 'configure', '--context-size', String(codeGateModelContextTokens),
        '--keep-alive', codeGateModelKeepAlive, codeGateModel,
        '--', '--parallel', '1', '--no-cache-prompt', '--cache-ram', '0', '--reasoning-budget', '0'
    ], onEvent, signal);
    onEvent('status', 'Loading the CodeGate AI model into memory...\n');
    await runDockerModelCommand(['model', 'run', '--detach', codeGateModel], onEvent, signal);
    localModelReadyUntil = Date.now() + modelWakeFreshMs;
    onEvent('status', 'Local AI helper is ready.\n');
}

let localModelReadyUntil = 0;
let localModelWake: Promise<void> | null = null;

export async function ensureCodeGateModelLoaded(onEvent: StreamEvent = () => {}, signal?: AbortSignal) {
    if (Date.now() < localModelReadyUntil) return;
    if (localModelWake) return localModelWake;
    localModelWake = (async () => {
        await ensureDockerReady(onEvent, signal);
        onEvent('status', 'Waking the local AI model...\n');
        await runDockerModelCommand(['model', 'run', '--detach', codeGateModel], onEvent, signal);
        localModelReadyUntil = Date.now() + modelWakeFreshMs;
        onEvent('status', 'Local AI model is ready.\n');
    })().finally(() => { localModelWake = null; });
    return localModelWake;
}

export async function unloadCodeGateModel(onEvent: StreamEvent = () => {}, signal?: AbortSignal) {
    localModelReadyUntil = 0;
    if (!(await commandSucceeds(['model', 'status']))) return;
    try {
        await runDockerModelCommand(['model', 'unload', codeGateModel], onEvent, signal);
    } catch {
        // An enabled but already-unloaded model requires no further action.
    }
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
let inferenceActive = false;

export function extractModelDelta(payload: any) {
    const choice = payload?.choices?.[0];
    const delta = choice?.delta;
    return {
        content: typeof delta?.content === 'string'
            ? delta.content
            : typeof choice?.text === 'string' ? choice.text : '',
        reasoning: typeof delta?.reasoning_content === 'string'
            ? delta.reasoning_content
            : typeof delta?.reasoning === 'string' ? delta.reasoning : ''
    };
}

export async function streamModelText(messages: ChatMessage[], onEvent: ModelStreamEvent, signal?: AbortSignal, options: ModelRequestOptions = {}) {
    if (inferenceActive) throw new Error('Another local AI explanation is already running');
    inferenceActive = true;
    try {
        const endpoint = customEndpoint(options.endpoint);
        const target = endpoint ? endpointTarget(endpoint) : undefined;
        if (!target) await ensureCodeGateModelLoaded(onEvent, signal);
        const model = target ? await discoverEndpointModel(target, signal) : codeGateModel;
        const requestController = new AbortController();
        const cancelRequest = () => requestController.abort();
        signal?.addEventListener('abort', cancelRequest, { once: true });
        const responseTimeout = setTimeout(() => requestController.abort('AI response timeout'), 45_000);
        let response: Response;
        try {
            response = await fetch(target?.chatUrl ?? `${modelRunnerBaseUrl}/engines/v1/chat/completions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages,
                    stream: true,
                    temperature: options.temperature ?? 0.15,
                    ...(typeof options.topP === 'number' ? { top_p: options.topP } : {}),
                    ...(Number.isInteger(options.maxTokens) && options.maxTokens! > 0 ? { max_tokens: options.maxTokens } : {}),
                    ...(typeof options.frequencyPenalty === 'number' ? { frequency_penalty: options.frequencyPenalty } : {}),
                    ...(Number.isInteger(options.seed) ? { seed: options.seed } : {}),
                    ...(!target ? { chat_template_kwargs: { enable_thinking: false } } : {})
                }),
                signal: requestController.signal
            });
        } catch (error) {
            if (!signal?.aborted && requestController.signal.aborted) throw new Error('The AI model did not start responding in time');
            throw error;
        } finally {
            clearTimeout(responseTimeout);
        }
        try {
            if (!response.ok || !response.body) {
                const detail = await response.text().catch(() => '');
                if (target) endpointModels.delete(target.key);
                throw new Error(detail.trim() || `${target ? 'Custom AI endpoint' : 'Docker Model Runner'} returned ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let emitted = false;
            let reasoningFallback = '';
            while (true) {
                let idleTimeout: ReturnType<typeof setTimeout> | undefined;
                const stalled = new Promise<never>((_, reject) => {
                    idleTimeout = setTimeout(() => {
                        requestController.abort('AI stream timeout');
                        reject(new Error('The AI model stopped responding'));
                    }, 45_000);
                });
                const { done, value } = await Promise.race([reader.read(), stalled]).finally(() => clearTimeout(idleTimeout));
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
                        const { content, reasoning } = extractModelDelta(payload);
                        if (content) {
                            emitted = true;
                            if (onEvent('text', content) === false) {
                                await reader.cancel();
                                return;
                            }
                        }
                        if (reasoning) {
                            reasoningFallback += reasoning;
                            if (options.includeReasoning && onEvent('reasoning', reasoning) === false) {
                                await reader.cancel();
                                return;
                            }
                        }
                    } catch {
                        // Ignore keepalive and non-chat events from compatible backends.
                    }
                }
                if (done) break;
            }
            if (!emitted && reasoningFallback.trim() && !options.includeReasoning) {
                onEvent('text', reasoningFallback.replace(/<\/?think>/gi, '').trim());
                emitted = true;
            }
            if (!emitted) throw new Error('The local model returned no explanation text');
        } finally {
            signal?.removeEventListener('abort', cancelRequest);
        }
    } finally {
        inferenceActive = false;
    }
}

export function eventStream(operation: (emit: StreamEvent, signal: AbortSignal) => Promise<void>, requestSignal?: AbortSignal) {
    const encoder = new TextEncoder();
    const controller = new AbortController();
    let closed = false;
    const abort = () => {
        closed = true;
        controller.abort();
    };
    if (requestSignal?.aborted) abort();
    else requestSignal?.addEventListener('abort', abort, { once: true });
    return new Response(new ReadableStream({
        start(stream) {
            const enqueue = (payload: Record<string, string>) => {
                if (closed) return;
                try { stream.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)); }
                catch { abort(); }
            };
            const emit: StreamEvent = (type, text) => enqueue({ type, text });
            void operation(emit, controller.signal).then(() => {
                enqueue({ type: 'done' });
            }).catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                enqueue({ type: 'error', text: message });
            }).finally(() => {
                requestSignal?.removeEventListener('abort', abort);
                if (closed) return;
                closed = true;
                try { stream.close(); } catch {}
            });
        },
        cancel() { abort(); }
    }), {
        headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache, no-transform',
            connection: 'keep-alive'
        }
    });
}
