import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import type { GateLanguage } from '$lib/codegate/types';
import { isIntellisenseLanguage } from '$lib/codegate/intellisense';

type ServerDescriptor = {
    image: string;
    languageId: string;
    extension: string;
    command: string[];
    memoryMb: number;
    startupDelayMs?: number;
    initializationOptions?: Record<string, unknown>;
};

export const languageServerDescriptors: Record<GateLanguage, ServerDescriptor> = {
    cpp: {
        image: 'codegate-intellisense-cpp:1', languageId: 'cpp', extension: 'cpp', memoryMb: 512,
        command: ['--background-index=false', '--clang-tidy=false', '--completion-style=detailed', '--header-insertion=never', '--log=error'],
        initializationOptions: { fallbackFlags: ['-std=c++2b', '-xc++'] }
    },
    python: { image: 'codegate-intellisense-python:1', languageId: 'python', extension: 'py', memoryMb: 512, command: [] },
    java: { image: 'codegate-intellisense-java:1', languageId: 'java', extension: 'java', memoryMb: 1024, command: [] },
    csharp: { image: 'codegate-intellisense-csharp:1', languageId: 'csharp', extension: 'cs', memoryMb: 1024, command: ['--loglevel', 'error'] },
    rust: { image: 'codegate-intellisense-rust:1', languageId: 'rust', extension: 'rs', memoryMb: 768, startupDelayMs: 1_500, command: [] },
    go: { image: 'codegate-intellisense-go:1', languageId: 'go', extension: 'go', memoryMb: 512, command: ['serve'] },
    typescript: { image: 'codegate-intellisense-typescript:1', languageId: 'typescript', extension: 'ts', memoryMb: 512, command: ['--stdio', '--log-level', '1'] }
};

type PendingRequest = {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
    signal?: AbortSignal;
    abort?: () => void;
};

type DocumentState = { uri: string; version: number };

export class ContentLengthDecoder {
    private buffer = Buffer.alloc(0);

    push(chunk: Buffer | string): any[] {
        this.buffer = Buffer.concat([this.buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
        const messages: any[] = [];
        while (true) {
            const headerEnd = this.buffer.indexOf('\r\n\r\n');
            if (headerEnd < 0) break;
            const header = this.buffer.subarray(0, headerEnd).toString('ascii');
            const match = /(?:^|\r\n)Content-Length:\s*(\d+)/i.exec(header);
            if (!match) throw new Error('Language server returned an invalid protocol message');
            const length = Number(match[1]);
            const bodyStart = headerEnd + 4;
            if (this.buffer.length < bodyStart + length) break;
            const body = this.buffer.subarray(bodyStart, bodyStart + length).toString('utf8');
            this.buffer = this.buffer.subarray(bodyStart + length);
            messages.push(JSON.parse(body));
        }
        return messages;
    }
}

function dockerCommand() {
    return process.platform === 'win32' ? 'docker.exe' : 'docker';
}

function assetRoot() {
    return process.env.CODEGATE_ASSET_ROOT || process.cwd();
}

function runCommand(command: string, args: string[], timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        const timeout = setTimeout(() => {
            child.kill();
            reject(new Error(`${command} timed out`));
        }, timeoutMs);
        child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-4_000); });
        child.once('error', (error) => { clearTimeout(timeout); reject(error); });
        child.once('exit', (code) => {
            clearTimeout(timeout);
            if (code === 0) resolve();
            else reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
        });
    });
}

const provisioning = new Map<GateLanguage, Promise<void>>();

export async function ensureLanguageServerImage(language: GateLanguage) {
    const running = provisioning.get(language);
    if (running) return running;
    const descriptor = languageServerDescriptors[language];
    const task = (async () => {
        try {
            await runCommand(dockerCommand(), ['image', 'inspect', descriptor.image], 15_000);
            return;
        } catch {}
        const context = path.join(assetRoot(), 'docker', 'intellisense', language);
        await runCommand(dockerCommand(), ['build', '--tag', descriptor.image, context], 15 * 60_000);
    })().finally(() => provisioning.delete(language));
    provisioning.set(language, task);
    return task;
}

class LanguageServerClient {
    private child: ChildProcessWithoutNullStreams | null = null;
    private decoder = new ContentLengthDecoder();
    private nextId = 1;
    private starting: Promise<void> | null = null;
    private pending = new Map<number, PendingRequest>();
    private documents = new Map<string, DocumentState>();
    private lastError = '';

    constructor(private language: GateLanguage, private descriptor: ServerDescriptor) {}

    private write(message: Record<string, unknown>) {
        if (!this.child?.stdin.writable) throw new Error(this.lastError || `${this.language} language server is unavailable`);
        const body = JSON.stringify(message);
        this.child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
    }

    private notify(method: string, params: unknown) {
        this.write({ jsonrpc: '2.0', method, params });
    }

    private request(method: string, params: unknown, timeoutMs = 8_000, signal?: AbortSignal): Promise<any> {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const abort = () => {
                const pending = this.pending.get(id);
                if (!pending) return;
                this.pending.delete(id);
                clearTimeout(pending.timeout);
                try { this.notify('$/cancelRequest', { id }); } catch {}
                const error = new Error('Language server request cancelled');
                error.name = 'AbortError';
                reject(error);
            };
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                signal?.removeEventListener('abort', abort);
                try { this.notify('$/cancelRequest', { id }); } catch {}
                reject(new Error(`${this.language} language server timed out while handling ${method}`));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timeout, signal, abort });
            signal?.addEventListener('abort', abort, { once: true });
            if (signal?.aborted) return abort();
            try {
                this.write({ jsonrpc: '2.0', id, method, params });
            } catch (error) {
                clearTimeout(timeout);
                this.pending.delete(id);
                signal?.removeEventListener('abort', abort);
                reject(error);
            }
        });
    }

    private respond(id: string | number, result: unknown) {
        this.write({ jsonrpc: '2.0', id, result });
    }

    private handleServerRequest(message: any) {
        if (message.method === 'workspace/configuration') {
            this.respond(message.id, Array.isArray(message.params?.items) ? message.params.items.map(() => null) : []);
        } else if (message.method === 'workspace/workspaceFolders') {
            this.respond(message.id, [{ uri: 'file:///workspace', name: 'CodeGate' }]);
        } else if (message.method === 'workspace/applyEdit') {
            this.respond(message.id, { applied: false });
        } else if (message.method === 'client/showDocument') {
            this.respond(message.id, { success: false });
        } else {
            this.respond(message.id, null);
        }
    }

    private handleMessage(message: any) {
        if ((typeof message?.id === 'number' || typeof message?.id === 'string') && message?.method) {
            this.handleServerRequest(message);
            return;
        }
        if (typeof message?.id !== 'number') return;
        const pending = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timeout);
        this.pending.delete(message.id);
        pending.signal?.removeEventListener('abort', pending.abort!);
        if (message.error) pending.reject(new Error(message.error.message || 'Language server request failed'));
        else pending.resolve(message.result);
    }

    private rejectPending(error: Error) {
        for (const request of this.pending.values()) {
            clearTimeout(request.timeout);
            request.signal?.removeEventListener('abort', request.abort!);
            request.reject(error);
        }
        this.pending.clear();
    }

    private async start() {
        if (this.starting) return this.starting;
        if (this.child) return;
        this.starting = (async () => {
            await ensureLanguageServerImage(this.language);
            this.lastError = '';
            this.decoder = new ContentLengthDecoder();
            const args = [
                'run', '--rm', '-i', '--network', 'none',
                '--memory', `${this.descriptor.memoryMb}m`, '--cpus', '1', '--pids-limit', '192',
                '--read-only', '--tmpfs', '/tmp:rw,size=256m', '--tmpfs', '/workspace:rw,size=128m',
                '--workdir', '/workspace', '--env', 'HOME=/tmp', '--env', 'XDG_CACHE_HOME=/tmp',
                '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
                '--label', 'codegate.intellisense=true', '--label', `codegate.intellisense.language=${this.language}`,
                this.descriptor.image, ...this.descriptor.command
            ];
            const child = spawn(dockerCommand(), args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
            this.child = child;
            child.stdout.on('data', (chunk) => {
                try {
                    for (const message of this.decoder.push(chunk)) this.handleMessage(message);
                } catch (error) {
                    this.stop(error instanceof Error ? error : new Error(String(error)));
                }
            });
            child.stderr.on('data', (chunk) => {
                const line = String(chunk).replace(/\r/g, '').trim();
                if (line) this.lastError = line.slice(-4_000);
            });
            child.once('error', (error) => this.stop(error));
            child.once('exit', (code) => this.stop(new Error(this.lastError || `${this.language} language server exited with code ${code}`)));
            await this.request('initialize', {
                processId: null,
                rootUri: 'file:///workspace',
                workspaceFolders: [{ uri: 'file:///workspace', name: 'CodeGate' }],
                capabilities: {
                    workspace: { configuration: true, workspaceFolders: true },
                    window: { workDoneProgress: true },
                    textDocument: {
                        synchronization: { dynamicRegistration: false, didSave: false },
                        completion: { completionItem: { snippetSupport: true, documentationFormat: ['markdown', 'plaintext'] } },
                        documentSymbol: { hierarchicalDocumentSymbolSupport: true }
                    }
                },
                initializationOptions: this.descriptor.initializationOptions ?? {}
            }, this.language === 'java' ? 60_000 : 20_000);
            this.notify('initialized', {});
            if (this.descriptor.startupDelayMs) {
                await new Promise((resolve) => setTimeout(resolve, this.descriptor.startupDelayMs));
            }
        })().catch((error) => {
            this.stop(error instanceof Error ? error : new Error(String(error)));
            throw error;
        }).finally(() => { this.starting = null; });
        return this.starting;
    }

    async sync(documentId: string, source: string) {
        await this.start();
        const current = this.documents.get(documentId);
        const state = current ?? {
            // rust-analyzer only treats files under the crate's source tree as project files.
            uri: this.language === 'rust'
                ? 'file:///workspace/src/lib.rs'
                : `file:///workspace/${documentId}/Solution.${this.descriptor.extension}`,
            version: 0
        };
        state.version++;
        if (!current) {
            this.notify('textDocument/didOpen', {
                textDocument: { uri: state.uri, languageId: this.descriptor.languageId, version: state.version, text: source }
            });
            this.documents.set(documentId, state);
        } else {
            this.notify('textDocument/didChange', {
                textDocument: { uri: state.uri, version: state.version }, contentChanges: [{ text: source }]
            });
        }
        try {
            await this.request('textDocument/documentSymbol', { textDocument: { uri: state.uri } }, this.language === 'java' ? 30_000 : 5_000);
        } catch (error) {
            if (error instanceof Error && /not supported|method not found/i.test(error.message)) return state.version;
            throw error;
        }
        return state.version;
    }

    async complete(documentId: string, line: number, character: number, signal?: AbortSignal) {
        await this.start();
        const state = this.documents.get(documentId);
        if (!state) throw new Error(`${this.language} document is not synchronized`);
        return this.request('textDocument/completion', {
            textDocument: { uri: state.uri }, position: { line, character }, context: { triggerKind: 1 }
        }, 10_000, signal);
    }

    close(documentId: string) {
        const state = this.documents.get(documentId);
        if (!state || !this.child) return;
        this.notify('textDocument/didClose', { textDocument: { uri: state.uri } });
        this.documents.delete(documentId);
        if (!this.documents.size) this.stop();
    }

    stop(error = new Error(`${this.language} language server stopped`)) {
        const child = this.child;
        this.child = null;
        this.documents.clear();
        this.rejectPending(error);
        if (child && !child.killed) child.kill();
    }
}

const globalState = globalThis as typeof globalThis & { __codegateLanguageServers?: Map<GateLanguage, LanguageServerClient> };
const clients = globalState.__codegateLanguageServers ??= new Map();

function clientFor(language: GateLanguage) {
    let client = clients.get(language);
    if (!client) {
        client = new LanguageServerClient(language, languageServerDescriptors[language]);
        clients.set(language, client);
    }
    return client;
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
        for (const client of clients.values()) client.stop();
        process.exit(0);
    });
}
process.once('exit', () => { for (const client of clients.values()) client.stop(); });

export async function syncLanguageDocument(language: GateLanguage, documentId: string, source: string) {
    return clientFor(language).sync(documentId, source);
}

export async function completeLanguageDocument(language: GateLanguage, documentId: string, line: number, character: number, signal?: AbortSignal) {
    const result = await clientFor(language).complete(documentId, line, character, signal);
    return Array.isArray(result) ? result : Array.isArray(result?.items) ? result.items : [];
}

export function closeLanguageDocument(language: GateLanguage, documentId: string) {
    clientFor(language).close(documentId);
}

export function requireLanguage(value: unknown): GateLanguage {
    if (!isIntellisenseLanguage(value)) throw new Error('Unsupported IntelliSense language');
    return value;
}

export function stopLanguageServers() {
    for (const client of clients.values()) client.stop();
}
