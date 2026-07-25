<script lang="ts">
    import type * as Monaco from 'monaco-editor';
    import { intellisenseLanguages, isIntellisenseLanguage } from '$lib/codegate/intellisense';
    import type { GateLanguage } from '$lib/codegate/types';
    import { configureMonacoVim } from '$lib/utils/vimMode';
    import { createEventDispatcher, onMount } from 'svelte';
    export let value = '';
    export let language = 'javascript';
    export let fontSize: number = 14;
    export let theme: 'dark' | 'light' = 'dark';
    export let vimMode: 'off' | 'on' = 'off';
    export let readOnly: boolean = false;
    export let viewState: string | null = null;
    export let enableAiExplain = false;
    export let enableIntellisense = false;

    const dispatch = createEventDispatcher();

    let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
    let editorElement: HTMLDivElement;
    let monacoRef: any;
    let vimModeInstance: any = null;
    let initVimModeRef: ((editor: Monaco.editor.IStandaloneCodeEditor, statusbarNode?: HTMLElement | null) => any) | null = null;
    let vimStatusElement: HTMLDivElement;
    let aiAction: Monaco.IDisposable | null = null;
    let intellisenseProviders: Monaco.IDisposable[] = [];
    let intellisenseDocumentId = '';
    let intellisenseSyncTimer: ReturnType<typeof setTimeout> | null = null;
    let intellisenseSyncInFlight: Promise<void> | null = null;
    let intellisenseDesiredSnapshot: { source: string; version: number; language: GateLanguage } | null = null;
    let intellisenseSyncedModelVersion = 0;
    let intellisenseActiveLanguage: GateLanguage | null = null;
    let intellisenseRetryAfter = 0;
    let intellisenseLifecycleController: AbortController | null = null;
    let cleanupEditorInput: (() => void) | null = null;

    function disableVimMode() {
        if (!vimModeInstance) return;
        const instance = vimModeInstance;
        vimModeInstance = null;
        instance.dispose();
    }

    function syncVimMode() {
        if (!editor || !initVimModeRef) return;
        if (vimMode === 'on') {
            if (!vimModeInstance) vimModeInstance = initVimModeRef(editor, vimStatusElement);
            return;
        }
        disableVimMode();
        editor.updateOptions({ readOnly });
    }

    function recoverStandardInput(cancelTransientState = false) {
        if (!editor || vimMode !== 'off') return;
        disableVimMode();
        editor.updateOptions({ readOnly });
        if (cancelTransientState) editor.trigger('codegate.inputRecovery', 'editor.action.cancel', null);
        editor.focus();
    }

    function restoreEditorFocus() {
        if (!editor) return;
        if (vimMode === 'off') recoverStandardInput(true);
        else editor.focus();
    }

    function lspCompletionKind(monaco: typeof Monaco, kind: unknown) {
        const kinds: Record<number, Monaco.languages.CompletionItemKind> = {
            2: monaco.languages.CompletionItemKind.Method,
            3: monaco.languages.CompletionItemKind.Function,
            4: monaco.languages.CompletionItemKind.Constructor,
            5: monaco.languages.CompletionItemKind.Field,
            6: monaco.languages.CompletionItemKind.Variable,
            7: monaco.languages.CompletionItemKind.Class,
            8: monaco.languages.CompletionItemKind.Interface,
            9: monaco.languages.CompletionItemKind.Module,
            10: monaco.languages.CompletionItemKind.Property,
            13: monaco.languages.CompletionItemKind.Enum,
            14: monaco.languages.CompletionItemKind.Keyword,
            15: monaco.languages.CompletionItemKind.Snippet,
            20: monaco.languages.CompletionItemKind.EnumMember,
            21: monaco.languages.CompletionItemKind.Constant,
            22: monaco.languages.CompletionItemKind.Struct,
            24: monaco.languages.CompletionItemKind.Operator,
            25: monaco.languages.CompletionItemKind.TypeParameter
        };
        return typeof kind === 'number' ? kinds[kind] ?? monaco.languages.CompletionItemKind.Text : monaco.languages.CompletionItemKind.Text;
    }

    function stageIntellisenseSync(model: Monaco.editor.ITextModel) {
        const modelLanguage = model.getLanguageId();
        if (!enableIntellisense || !isIntellisenseLanguage(modelLanguage)) return false;
        const snapshot = { source: model.getValue(), version: model.getVersionId(), language: modelLanguage };
        if (!intellisenseDesiredSnapshot || intellisenseDesiredSnapshot.version <= snapshot.version || intellisenseDesiredSnapshot.language !== snapshot.language) {
            intellisenseDesiredSnapshot = snapshot;
        }
        return true;
    }

    async function closeIntellisenseDocument(language = intellisenseActiveLanguage) {
        if (!language || !intellisenseDocumentId) return;
        try {
            await fetch('/api/codegate/intellisense', {
                method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
                body: JSON.stringify({ action: 'close', language, documentId: intellisenseDocumentId })
            });
        } catch {}
        if (intellisenseActiveLanguage === language) intellisenseActiveLanguage = null;
    }

    async function runIntellisenseSync() {
        if (intellisenseSyncInFlight) return intellisenseSyncInFlight;
        intellisenseSyncInFlight = (async () => {
            while (intellisenseDesiredSnapshot) {
                const snapshot = intellisenseDesiredSnapshot;
                intellisenseDesiredSnapshot = null;
                if (intellisenseActiveLanguage === snapshot.language && snapshot.version <= intellisenseSyncedModelVersion) continue;
                try {
                    if (intellisenseActiveLanguage && intellisenseActiveLanguage !== snapshot.language) {
                        await closeIntellisenseDocument(intellisenseActiveLanguage);
                        intellisenseSyncedModelVersion = 0;
                    }
                    const response = await fetch('/api/codegate/intellisense', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                            action: 'sync',
                            language: snapshot.language,
                            documentId: intellisenseDocumentId,
                            source: snapshot.source
                        }),
                        signal: intellisenseLifecycleController?.signal
                    });
                    if (!response.ok) throw new Error(await response.text());
                    intellisenseActiveLanguage = snapshot.language;
                    intellisenseSyncedModelVersion = snapshot.version;
                    intellisenseRetryAfter = 0;
                } catch (error) {
                    const queued = intellisenseDesiredSnapshot as typeof snapshot | null;
                    if (!queued || queued.version < snapshot.version || queued.language !== snapshot.language) intellisenseDesiredSnapshot = snapshot;
                    intellisenseRetryAfter = Date.now() + 30_000;
                    throw error;
                }
            }
        })().finally(() => {
            intellisenseSyncInFlight = null;
        });
        return intellisenseSyncInFlight;
    }

    function scheduleIntellisenseSync(model: Monaco.editor.ITextModel, delay = 80) {
        if (intellisenseSyncTimer) clearTimeout(intellisenseSyncTimer);
        intellisenseSyncTimer = null;
        if (!stageIntellisenseSync(model)) {
            intellisenseDesiredSnapshot = null;
            if (!enableIntellisense) void closeIntellisenseDocument();
            return;
        }
        const retryDelay = Math.max(delay, intellisenseRetryAfter - Date.now());
        intellisenseSyncTimer = setTimeout(() => {
            intellisenseSyncTimer = null;
            void runIntellisenseSync().catch(() => {});
        }, retryDelay);
    }

    async function flushIntellisenseSync(model: Monaco.editor.ITextModel) {
        if (intellisenseSyncTimer) clearTimeout(intellisenseSyncTimer);
        intellisenseSyncTimer = null;
        if (!stageIntellisenseSync(model)) throw new Error('IntelliSense is disabled');
        const targetVersion = model.getVersionId();
        const targetLanguage = model.getLanguageId();
        if (Date.now() < intellisenseRetryAfter) throw new Error('IntelliSense is temporarily unavailable');
        while (intellisenseActiveLanguage !== targetLanguage || intellisenseSyncedModelVersion < targetVersion) await runIntellisenseSync();
    }

    function lspHoverContents(monaco: typeof Monaco, value: unknown): Monaco.IMarkdownString[] {
        const entries = Array.isArray(value) ? value : [value];
        return entries.flatMap((entry) => {
            let rendered = '';
            if (typeof entry === 'string') {
                if (!entry.trim()) return [];
                rendered = entry;
            } else if (entry && typeof entry === 'object' && 'value' in entry && typeof entry.value === 'string') {
                if (!entry.value.trim()) return [];
                if ('language' in entry && typeof entry.language === 'string') {
                    const fence = entry.value.includes('```') ? '````' : '```';
                    rendered = `${fence}${entry.language}\n${entry.value}\n${fence}`;
                } else if ('kind' in entry && entry.kind === 'plaintext') {
                    rendered = entry.value
                        .replace(/\\/g, '\\\\')
                        .replace(/([`*_{}[\]()<>#+.!|\-])/g, '\\$1')
                        .replace(/\r?\n/g, '  \n');
                } else {
                    rendered = entry.value;
                }
            } else {
                return [];
            }
            return [{ value: rendered, isTrusted: false, supportHtml: false }];
        });
    }

    function registerIntellisense(monaco: typeof Monaco) {
        const providers: Monaco.IDisposable[] = [];
        for (const providerLanguage of intellisenseLanguages) {
            providers.push(monaco.languages.registerCompletionItemProvider(providerLanguage, {
            triggerCharacters: ['.', '>', ':'],
            async provideCompletionItems(model, position, _context, token) {
                if (model !== editor?.getModel()) return { suggestions: [] };
                const controller = new AbortController();
                const cancellation = token.onCancellationRequested(() => controller.abort());
                try {
                    await flushIntellisenseSync(model);
                    if (token.isCancellationRequested) return { suggestions: [] };
                    const response = await fetch('/api/codegate/intellisense', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                            action: 'complete',
                            language: providerLanguage,
                            documentId: intellisenseDocumentId,
                            line: position.lineNumber - 1,
                            character: position.column - 1
                        }),
                        signal: controller.signal
                    });
                    if (!response.ok) throw new Error(await response.text());
                    if (token.isCancellationRequested) return { suggestions: [] };
                    const payload = await response.json();
                    const word = model.getWordUntilPosition(position);
                    const range = {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endColumn: word.endColumn
                    };
                    return {
                        suggestions: (Array.isArray(payload?.items) ? payload.items : []).map((entry: any) => ({
                            label: typeof entry.label === 'string' ? entry.label : entry.label?.label ?? '',
                            insertText: entry.textEdit?.newText ?? entry.insertText ?? entry.label?.label ?? entry.label ?? '',
                            detail: entry.detail,
                            documentation: entry.documentation,
                            filterText: entry.filterText,
                            sortText: entry.sortText,
                            kind: lspCompletionKind(monaco, entry.kind),
                            insertTextRules: entry.insertTextFormat === 2
                                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                                : undefined,
                            range
                        })).filter((entry: { label: string; insertText: string }) => entry.label && entry.insertText)
                    };
                } catch {
                    if (!token.isCancellationRequested) {
                        intellisenseSyncedModelVersion = 0;
                        intellisenseRetryAfter = Date.now() + 30_000;
                        scheduleIntellisenseSync(model);
                    }
                    return { suggestions: [] };
                } finally {
                    cancellation.dispose();
                }
            }
            }));
            providers.push(monaco.languages.registerHoverProvider(providerLanguage, {
                async provideHover(model, position, token) {
                    if (model !== editor?.getModel()) return null;
                    const controller = new AbortController();
                    const cancellation = token.onCancellationRequested(() => controller.abort());
                    try {
                        await flushIntellisenseSync(model);
                        if (token.isCancellationRequested) return null;
                        const response = await fetch('/api/codegate/intellisense', {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({
                                action: 'hover',
                                language: providerLanguage,
                                documentId: intellisenseDocumentId,
                                line: position.lineNumber - 1,
                                character: position.column - 1
                            }),
                            signal: controller.signal
                        });
                        if (!response.ok) throw new Error(await response.text());
                        if (token.isCancellationRequested) return null;
                        const result = (await response.json())?.hover;
                        const contents = lspHoverContents(monaco, result?.contents);
                        if (!contents.length) return null;
                        const start = result?.range?.start;
                        const end = result?.range?.end;
                        const range = Number.isInteger(start?.line)
                            && Number.isInteger(start?.character)
                            && Number.isInteger(end?.line)
                            && Number.isInteger(end?.character)
                            ? new monaco.Range(start.line + 1, start.character + 1, end.line + 1, end.character + 1)
                            : undefined;
                        return { contents, range };
                    } catch {
                        if (!token.isCancellationRequested) scheduleIntellisenseSync(model);
                        return null;
                    } finally {
                        cancellation.dispose();
                    }
                }
            }));
        }
        intellisenseProviders = providers;
    }

    export function getViewState() {
        if (!editor) return null;
        const state = editor.saveViewState();
        return state ? JSON.stringify(state) : null;
    }

    function updateAiAction() {
        if (!editor) return;
        if (!enableAiExplain) {
            aiAction?.dispose();
            aiAction = null;
            return;
        }
        if (aiAction) return;
        aiAction = editor.addAction({
            id: 'codegate.explainSelection',
            label: 'Explain selection with local AI ✦',
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 1.5,
            precondition: 'editorHasSelection',
            run: (activeEditor) => {
                const selection = activeEditor.getSelection();
                const model = activeEditor.getModel();
                if (!selection || !model || selection.isEmpty()) return;
                dispatch('explainSelection', {
                    source: model.getValue(),
                    selection: model.getValueInRange(selection),
                    startLine: selection.startLineNumber,
                    endLine: selection.endLineNumber
                });
            }
        });
    }

    onMount(() => {
        let disposed = false;
        intellisenseDocumentId = globalThis.crypto.randomUUID();
        intellisenseLifecycleController = new AbortController();
        Promise.all([
            import('monaco-editor'),
            import('monaco-vim')
        ]).then(([monaco, vim]) => {
            if (disposed) return;
            const { initVimMode, VimMode } = vim as any;
            initVimModeRef = initVimMode;
            monacoRef = monaco;
            configureMonacoVim(VimMode.Vim);
            registerIntellisense(monaco);
            
            monaco.editor.defineTheme('custom-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'comment', foreground: 'b2ff66' },
                    { token: 'keyword', foreground: 'd48f43' },
                    { token: 'number', foreground: '8aac55' },
                    { token: 'string', foreground: 'ce9178' },
                ],
                colors: {
                    'editor.background': '#3a302e',
                    'editor.foreground': '#f0f0f0',
                    'editorGutter.background': '#3a302e',
                    'editorLineNumber.foreground': '#858585',
                    'editorLineNumber.activeForeground': '#c5c5c5',
                    'editorCursor.foreground': '#42c882',
                    'editor.selectionBackground': '#ffffff20',
                    'editor.lineHighlightBackground': '#ffffff10',
                }
            });

            monaco.editor.defineTheme('custom-light', {
                base: 'vs',
                inherit: true,
                rules: [
                    { token: 'comment', foreground: '66cc00' },
                    { token: 'keyword', foreground: 'd48f43' },
                    { token: 'number', foreground: '047857' },
                    { token: 'string', foreground: 'b45309' },
                ],
                colors: {
                    'editor.background': '#f8fafc',
                    'editor.foreground': '#1f2937',
                    'editorGutter.background': '#f1f5f9',
                    'editorLineNumber.foreground': '#94a3b8',
                    'editorLineNumber.activeForeground': '#475569',
                    'editorCursor.foreground': '#d48f43',
                    'editor.selectionBackground': '#d48f4330',
                    'editor.lineHighlightBackground': '#f1f5f9',
                }
            });

            const themeId = theme === 'light' ? 'custom-light' : 'custom-dark';

            editor = monaco.editor.create(editorElement, {
                value,
                language,
                theme: themeId,
                automaticLayout: true,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize,
                readOnly,
                fixedOverflowWidgets: true,
                quickSuggestions: { other: true, comments: false, strings: false },
                suggestOnTriggerCharacters: true,
                minimap: {
                    enabled: false
                }
            });

            editor.onDidChangeModelContent(() => {
                if (!editor) return;
                value = editor.getValue();
                const model = editor.getModel();
                if (model) scheduleIntellisenseSync(model);
            });

            const model = editor.getModel();
            if (model) scheduleIntellisenseSync(model, 0);

            updateAiAction();

            syncVimMode();

            let restoreTextFocus = false;
            let inputRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
            const editorFocus = editor.onDidFocusEditorText(() => {
                restoreTextFocus = true;
                if (vimMode === 'off') recoverStandardInput();
            });
            const editorBlur = editor.onDidBlurEditorText(() => {
                if (document.hasFocus()) restoreTextFocus = false;
            });
            const editorKeyDown = editor.onKeyDown((event) => {
                const keyboardEvent = event.browserEvent;
                const isPlainTextKey = keyboardEvent.key.length === 1
                    && !keyboardEvent.ctrlKey
                    && !keyboardEvent.metaKey
                    && !keyboardEvent.altKey
                    && !keyboardEvent.isComposing;
                if (vimMode !== 'off' || readOnly || !isPlainTextKey) return;
                const activeModel = editor?.getModel();
                if (!activeModel) return;
                const versionBeforeKey = activeModel.getVersionId();
                if (inputRecoveryTimer) clearTimeout(inputRecoveryTimer);
                inputRecoveryTimer = setTimeout(() => {
                    inputRecoveryTimer = null;
                    if (editor?.hasTextFocus() && activeModel.getVersionId() === versionBeforeKey) {
                        recoverStandardInput(true);
                    }
                }, 0);
            });
            const handleWindowBlur = () => {
                restoreTextFocus = Boolean(editor?.hasTextFocus()) || restoreTextFocus;
            };
            const handleWindowFocus = () => {
                if (!restoreTextFocus) return;
                requestAnimationFrame(restoreEditorFocus);
            };
            const handleVisibilityChange = () => {
                if (document.visibilityState === 'hidden') {
                    restoreTextFocus = Boolean(editor?.hasTextFocus()) || restoreTextFocus;
                } else if (restoreTextFocus) {
                    requestAnimationFrame(restoreEditorFocus);
                }
            };
            window.addEventListener('blur', handleWindowBlur);
            window.addEventListener('focus', handleWindowFocus);
            document.addEventListener('visibilitychange', handleVisibilityChange);

            cleanupEditorInput = () => {
                editorFocus.dispose();
                editorBlur.dispose();
                editorKeyDown.dispose();
                window.removeEventListener('blur', handleWindowBlur);
                window.removeEventListener('focus', handleWindowFocus);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                if (inputRecoveryTimer) clearTimeout(inputRecoveryTimer);
            };

        });

        return () => {
            disposed = true;
            if (intellisenseSyncTimer) clearTimeout(intellisenseSyncTimer);
            intellisenseSyncTimer = null;
            intellisenseLifecycleController?.abort();
            intellisenseLifecycleController = null;
            void closeIntellisenseDocument();
            cleanupEditorInput?.();
            cleanupEditorInput = null;
            disableVimMode();
            initVimModeRef = null;
            aiAction?.dispose();
            intellisenseProviders.forEach((provider) => provider.dispose());
            intellisenseProviders = [];
            editor?.dispose();
        };
    });

    // Update language reactively
    $: if (editor && monacoRef) {
        const model = editor.getModel();
        if (model) {
            monacoRef.editor.setModelLanguage(model, language);
            intellisenseSyncedModelVersion = 0;
            scheduleIntellisenseSync(model, 0);
        }
    }

    $: if (editor && typeof enableIntellisense === 'boolean') {
        const model = editor.getModel();
        if (model) scheduleIntellisenseSync(model, 0);
    }

    $: if (editor && initVimModeRef && typeof vimMode === 'string') syncVimMode();

    $: if (editor && typeof fontSize === 'number') {
        editor.updateOptions({ fontSize });
    }

    $: if (editor && typeof readOnly === 'boolean') {
        editor.updateOptions({ readOnly });
    }

    $: if (editor && typeof enableAiExplain === 'boolean') {
        updateAiAction();
    }

    // Update editor content when `value` prop changes externally (e.g., language switch)
    $: if (editor && typeof value === 'string') {
        const current = editor.getValue();
        if (current !== value) {
            editor.setValue(value);
        }
    }

    // Restore viewState when the prop changes (e.g., switching files/tabs)
    $: if (editor && viewState !== undefined) {
        if (viewState) {
            try {
                editor.restoreViewState(JSON.parse(viewState));
            } catch (e) {
                console.error('Failed to restore view state', e);
            }
        } else {
            const model = editor.getModel();
            if (model) {
                editor.trigger('viewState', 'editor.unfoldAll', {});
            }
            editor.setScrollTop(0);
            editor.setPosition({ lineNumber: 1, column: 1 });
        }
    }

    $: if (monacoRef) {
        const themeId = theme === 'light' ? 'custom-light' : 'custom-dark';
        monacoRef.editor.setTheme(themeId);
    }
</script>

<div class="editor-container">
    <div class="code-editor" bind:this={editorElement}></div>
    <div class="vim-status" class:hidden={vimMode !== 'on'} bind:this={vimStatusElement}></div>
</div>

<style>
    .editor-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        overflow: hidden;
    }
    .code-editor {
        flex: 1;
        width: 100%;
        min-height: 0;
    }
    .vim-status {
        display: flex;
        align-items: center;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 11px;
        padding: 0 12px;
        height: 22px;
        background-color: var(--color-bg);
        border-top: 1px solid var(--color-border);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.05em;
    }
    .hidden {
        display: none;
    }
</style>
