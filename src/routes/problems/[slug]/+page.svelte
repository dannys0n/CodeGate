<script lang="ts">
    import SaveStatus from '$lib/components/SaveStatus.svelte';
    import { page } from '$app/stores';
    import ExecutionPanel from '$lib/components/ExecutionPanel.svelte';
    import ShareModal from '$lib/components/ShareModal.svelte';
    import GameResultPopup from '$lib/components/GameResultPopup.svelte';
    import GameHistoryPopup from '$lib/components/GameHistoryPopup.svelte';
    import GameModePopup from '$lib/components/GameModePopup.svelte';
    import Tooltip from '$lib/components/Tooltip.svelte';
    import { initFirebase, ensureAuthenticated } from '$lib/firebase';
    import codeStore from '$lib/stores/codeStore.js';
    import fileStore, { type FileEntry } from '$lib/stores/fileStore.js';
    import { leftPaneWidthStore } from '$lib/stores/layoutStore';
    import userSettingsStorage, { type ThemeChoice } from '$lib/stores/userSettingsStorage';
    import userStore from '$lib/stores/userStore';
    import { getDifficultyClass, type ProgrammingLanguage } from '$lib/utils/util.js';
    import { doc, setDoc } from 'firebase/firestore';
    import { renderMarkdown } from '$lib/utils/markdown';
    import QRCode from 'qrcode';
    import { onMount, tick } from 'svelte';
    import { v4 as uuidv4 } from 'uuid';
    import gameResultsStore, { computeGameResult } from '$lib/stores/gameResultsStore';
    import { gateLanguages, leetcodeDifficultyLevels, type DifficultyLevel, type GateLanguage, type LeetcodeDifficulty } from '$lib/codegate/types';
    import { consumeAiStream } from '$lib/codegate/ai-stream';

    export let data;
    const problemId = data.problem.id;
    const isCodeGate = Boolean(data.codegate);
    let isMac = false;
    let isGameMode = false;
    let gameStartTime = 0;
    let showGameResult = false;
    let gameResultStats: { runCount: number; submitCount: number; timeSpent: number } | null = null;
    let showGameHistory = false;
    let showGameStartPopup = false;

    $: problemResults = $gameResultsStore?.[problemId] || [];
    $: bestRank = (() => {
        const rankOrder: Record<string, number> = { S: 4, A: 3, B: 2, C: 1 };
        let best = '';
        let bestVal = 0;
        for (const r of problemResults) {
            const v = rankOrder[r.rank] ?? 0;
            if (v > bestVal) { bestVal = v; best = r.rank; }
        }
        return best;
    })();
    let CodeEditor: any = null;
    let language: ProgrammingLanguage = data.codegate?.selected.language ?? $userSettingsStorage.preferredLanguage ?? 'java';
    let difficulty: DifficultyLevel = data.codegate?.selected.difficulty ?? '99';
    let selectedLeetcodeDifficulties: LeetcodeDifficulty[] = data.codegate?.leetcodeDifficulties ?? [...leetcodeDifficultyLevels];
    let showLeetcodeDifficultyFilter = false;
    let leetcodeDifficultyFilterContainer: HTMLElement | null = null;
    let problemNumberMin: number | null = data.codegate?.problemNumberRange?.min ?? null;
    let problemNumberMax: number | null = data.codegate?.problemNumberRange?.max ?? null;
    let showProblemNumberFilter = false;
    let problemNumberFilterContainer: HTMLElement | null = null;
    type ProblemCatalogEntry = { problemId: string; number: number; title: string; leetcodeDifficulty: LeetcodeDifficulty };
    let codegateWorkspaceTab: 'editor' | 'catalogue' | 'ai-drill' = 'editor';
    type SyntaxDrillPayload = {
        problem: any;
        language: GateLanguage;
        source: string;
    };
    let syntaxDrill: SyntaxDrillPayload | null = null;
    let syntaxDrillCode = '';
    let syntaxDrillLanguage: GateLanguage = language as GateLanguage;
    let syntaxDrillState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
    let syntaxDrillStatus = '';
    let syntaxDrillProblemPreview = '';
    let syntaxDrillController: AbortController | null = null;
    type SyntaxDrillPreview = { title: string; statement: string; info: string[] };
    function parseSyntaxDrillPreview(raw: string): SyntaxDrillPreview {
        const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        const titleMatch = cleaned.match(/^#\s+(.+)$/m);
        const infoHeading = cleaned.match(/^##\s+Info\s*(?:\r?\n|$)/im);
        const infoText = infoHeading?.index === undefined
            ? ''
            : cleaned.slice(infoHeading.index + infoHeading[0].length);
        const info = infoText.split(/\r?\n/)
            .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
            .filter(Boolean)
            .slice(0, 2);
        let statement = cleaned.replace(titleMatch?.[0] ?? '', '').trim();
        const headingInStatement = statement.search(/^##\s+Info\s*(?:\r?\n|$)/im);
        if (headingInStatement >= 0) statement = statement.slice(0, headingInStatement).trim();
        return { title: titleMatch?.[1]?.trim() ?? '', statement, info };
    }
    $: syntaxDrillPreview = parseSyntaxDrillPreview(syntaxDrillProblemPreview);
    $: activeWorkspaceLanguage = codegateWorkspaceTab === 'ai-drill' ? syntaxDrillLanguage : language;
    $: activeWorkspaceProblem = codegateWorkspaceTab === 'ai-drill' && syntaxDrill ? syntaxDrill.problem : data.problem;
    let problemCatalog: ProblemCatalogEntry[] = [];
    let problemCatalogSearch = '';
    let problemCatalogLoading = false;
    let problemCatalogError = '';
    let loadedProblemCatalogKey = '';
    $: visibleProblemCatalog = problemCatalog.filter((entry) => {
        const query = problemCatalogSearch.trim().toLowerCase();
        return !query || String(entry.number).includes(query) || entry.title.toLowerCase().includes(query);
    });
    let gateSessionId = isCodeGate ? $page.url.searchParams.get('sessionId') ?? '' : '';
    let gateChallengeId = isCodeGate ? $page.url.searchParams.get('challengeId') ?? '' : '';
    let gateActionPending = false;
    const gateLanguageLabels: Record<GateLanguage, string> = {
        java: 'Java', python: 'Python 3', cpp: 'C++', csharp: 'C#', rust: 'Rust', go: 'Go', typescript: 'TypeScript'
    };
    const gateAvailableLanguages: GateLanguage[] = isCodeGate
        ? Array.from(new Set((data.codegate?.available ?? []).map((variant: { language: GateLanguage }) => variant.language)))
        : [];
    $: gateBinding = isCodeGate ? { sessionId: gateSessionId, challengeId: gateChallengeId, difficulty } : null;
    $: activeGateBinding = codegateWorkspaceTab === 'ai-drill' ? null : gateBinding;
    $: activeSyntaxDrillBinding = codegateWorkspaceTab === 'ai-drill' && syntaxDrill
        ? { sessionId: gateSessionId, challengeId: gateChallengeId, syntaxDrillId: syntaxDrill.problem.id }
        : null;
    const fileKey = () => `${problemId}`;
    const codeKey = () => `${problemId}:${language}`;

    // Tabs are grouped by fileId (language-agnostic)
    type TabMeta = { fileId: string; fileName: string };

    function getFiles(): FileEntry[] {
        try {
            return JSON.parse($fileStore[fileKey()] || '[]') as FileEntry[];
        } catch (err) {
            return [];
        }
    }

    function getInitialTabs(): TabMeta[] {
        const files = getFiles();
        if (!files.length) {
            // Create a default tab; the language-specific entry will be created lazily
            return [{ fileId: uuidv4(), fileName: 'Solution' }];
        }
        const groups = new Map<string, { fileId: string; fileName: string; order: number | null; firstIndex: number }>();
        files.forEach((f, idx) => {
            const existing = groups.get(f.fileId);
            const orderVal = (typeof f.order === 'number') ? f.order : null;
            if (!existing) {
                groups.set(f.fileId, {
                    fileId: f.fileId,
                    fileName: f.fileName || 'Solution',
                    order: orderVal,
                    firstIndex: idx
                });
            } else {
                if (orderVal !== null) {
                    if (existing.order === null || orderVal < existing.order) existing.order = orderVal;
                }
            }
        });
        const list = Array.from(groups.values());
        list.sort((a, b) => {
            const ao = a.order; const bo = b.order;
            if (ao !== null && bo !== null) return ao - bo;
            if (ao !== null) return -1;
            if (bo !== null) return 1;
            // Fallback to first appearance order in stored array
            return a.firstIndex - b.firstIndex;
        });
        return list.map((g) => ({ fileId: g.fileId, fileName: g.fileName }));
    }

    // Ensure an entry exists for current tab+language, optionally with initial content
    function ensureEntry(fileId: string, lang: ProgrammingLanguage, initialContent: string) {
        const fkey = fileKey();
        fileStore.update((s) => {
            let files = JSON.parse(s[fkey] || '[]') as FileEntry[];
            const existing = files.find((x) => x.fileId === fileId && x.language === lang);
            if (!existing) {
                const tabIndex = tabs.findIndex((t) => t.fileId === fileId);
                files = [
                    ...files,
                    {
                        fileId,
                        fileName: (tabs.find((t) => t.fileId === fileId)?.fileName) || 'Solution',
                        language: lang,
                        content: initialContent,
                        viewState: null,
                        isActive: false,
                        order: tabIndex >= 0 ? tabIndex : undefined
                    } as FileEntry
                ];
            }
            return { ...s, [fkey]: JSON.stringify(files) };
        });
    }

    let suppressSave = false; // prevent save during programmatic loads

    let isFirebaseAvailable = false;
    let showShareModal = false;
    let shareUrl = '';
    let qrCodeDataUrl = '';

    async function loadOrInitFile(lang: ProgrammingLanguage) {
        if (isCodeGate) {
            const gateData = data.codegate;
            const selected = gateData?.selected;
            if (!selected || selected.language !== lang || selected.difficulty !== difficulty) return;
            const draftKey = `codegate:draft:${problemId}:${lang}:${difficulty}`;
            suppressSave = true;
            code = typeof localStorage !== 'undefined' ? localStorage.getItem(draftKey) ?? gateData.source : gateData.source;
            currentViewState = null;
            await tick();
            suppressSave = false;
            return;
        }
        if (activeTabId < 0 || activeTabId >= tabs.length) return;
        const currentId = tabs[activeTabId].fileId;
        const files = getFiles();
        const entry = files.find((x) => x.fileId === currentId && x.language === lang);
        suppressSave = true;
        if (entry) {
            code = entry.content;
            currentViewState = entry.viewState ?? null;
        } else {
            const starter = $codeStore[codeKey()] ?? data.problem.starterCode?.[lang] ?? '';
            code = starter;
            currentViewState = null;
            ensureEntry(currentId, lang, starter);
        }
        await tick();
        suppressSave = false;
    }

    let code: string;
    let currentViewState: string | null = null;
    let editorComponent: any;
    let isResizing = false;
    let workspaceElement: HTMLElement;
    let openedHints = new Set<number>([]);
    let aiHintOpen = false;
    let aiHintState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
    let aiHintText = '';
    let aiHintController: AbortController | null = null;
    let aiExplainController: AbortController | null = null;
    let executionPanelComponent: any;
    let aiSettingsBusy = false;
    let aiSettingsStatus = '';
    let aiSettingsError = '';
    let viewMode: 'statement' | 'solution' = 'statement';

    let showSettings = false;
    let settingsContainer: HTMLElement | null = null;
    let settingsButton: HTMLButtonElement | null = null;
    let settingsDropdown: HTMLElement | null = null;
    let settingsLeft = 0;
    let settingsTop = 0;
    let hasDesktopStartupControls = false;
    let startupEvents: { logon: boolean; unlock: boolean; resume: boolean } | null = null;
    let startupEventsBusy = false;
    let startupEventsError = '';
    const fontSizes: number[] = Array.from({ length: 13 }, (_, i) => 12 + i); // 12..24
    let fontSize: number = $userSettingsStorage.editorFontSize ?? 14;
    let theme: ThemeChoice = $userSettingsStorage.theme ?? 'dark';
    let vimMode: 'off' | 'on' = $userSettingsStorage.vimMode ?? 'off';

    let tabs: TabMeta[] = getInitialTabs();
    let activeTabId: number = 0;
    let editingTabId: string | null = null;
    let editingName = '';
    let renameInputEl: HTMLInputElement | null = null;

    function startRename(fileId: string, currentName: string) {
        editingTabId = fileId;
        editingName = currentName;
        // Focus the input on next tick
        tick().then(() => {
            renameInputEl?.focus();
            renameInputEl?.select();
        });
    }

    function applyRename() {
        if (!editingTabId) return;
        const newName = editingName.trim();
        const targetId = editingTabId;
        const oldName = tabs.find(t => t.fileId === targetId)?.fileName || 'Solution';
        const finalName = newName || oldName;
        // Update tabs
        tabs = tabs.map(t => t.fileId === targetId ? { ...t, fileName: finalName } : t);
        // Update all store entries for this fileId
        const fkey = fileKey();
        fileStore.update((s) => {
            let files = JSON.parse(s[fkey] || '[]') as FileEntry[];
            for (const f of files) {
                if (f.fileId === targetId) f.fileName = finalName;
            }
            return { ...s, [fkey]: JSON.stringify(files) };
        });
        editingTabId = null;
        editingName = '';
        renameInputEl = null;
    }

    function cancelRename() {
        editingTabId = null;
        editingName = '';
        renameInputEl = null;
    }

    // New tab state (simple add button)
    async function addNewTab(customName: string = '', customContent: string = '', customLang: ProgrammingLanguage | null = null, customViewState: string | null = null) {
        const targetLang = customLang || language;
        const newTabName = customName || `Solution-${tabs.length + 1}`;
        const nextId = uuidv4();
        const fileName = newTabName;
        tabs = [...tabs, { fileId: nextId, fileName }];
        const newCode = customContent || (data.problem.starterCode?.[targetLang] ?? '');
        const fkey = fileKey();
        fileStore.update((s) => {
            let files = JSON.parse(s[fkey] || '[]') as FileEntry[];
            files = [
                ...files,
                {
                    fileId: nextId,
                    fileName,
                    language: targetLang,
                    content: newCode,
                    viewState: customViewState,
                    isActive: false,
                    order: tabs.length - 1
                } as FileEntry
            ];
            return { ...s, [fkey]: JSON.stringify(files) };
        });
        activeTabId = tabs.length - 1;
        if (customLang) language = customLang;
        await loadOrInitFile(language);
        persistTabOrder();
        if (!customName) {
            startRename(nextId, fileName);
        }
    }

    function persistTabOrder() {
        const fkey = fileKey();
        const orderById = new Map<string, number>();
        tabs.forEach((t, idx) => orderById.set(t.fileId, idx));
        fileStore.update((s) => {
            let files = JSON.parse(s[fkey] || '[]') as FileEntry[];
            for (const f of files) {
                const idx = orderById.get(f.fileId);
                if (idx !== undefined) f.order = idx;
            }
            return { ...s, [fkey]: JSON.stringify(files) };
        });
    }

    function moveTab(sourceId: string, targetId: string) {
        if (sourceId === targetId) return;
        const from = tabs.findIndex((t) => t.fileId === sourceId);
        const to = tabs.findIndex((t) => t.fileId === targetId);
        if (from < 0 || to < 0) return;
        const activeFileId = tabs[activeTabId]?.fileId;
        const updated = [...tabs];
        const [moved] = updated.splice(from, 1);
        updated.splice(to, 0, moved);
        tabs = updated;
        // Recompute activeTabId by locating current active fileId
        if (activeFileId) {
            const newIdx = tabs.findIndex((t) => t.fileId === activeFileId);
            if (newIdx !== -1) activeTabId = newIdx;
        }
        persistTabOrder();
    }

    let draggingId: string | null = null;
    function handleDragStart(e: DragEvent, fileId: string) {
        draggingId = fileId;
        try { e.dataTransfer?.setData('text/plain', fileId); } catch {}
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    }
    function handleDragOver(e: DragEvent, _fileId: string) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    }
    function handleDrop(e: DragEvent, targetId: string) {
        e.preventDefault();
        const source = draggingId || e.dataTransfer?.getData('text/plain') || '';
        if (source) moveTab(source, targetId);
        draggingId = null;
    }
    function handleDragEnd() {
        draggingId = null;
    }
    $: if (!suppressSave && code !== undefined && codegateWorkspaceTab !== 'ai-drill') {
        if (isCodeGate && typeof localStorage !== 'undefined') {
            localStorage.setItem(`codegate:draft:${problemId}:${language}:${difficulty}`, code);
        } else {
        const fkey = fileKey();
        const latestViewState = editorComponent?.getViewState?.() || currentViewState;
        fileStore.update((s) => {
            let files = JSON.parse(s[fkey] || '[]') as FileEntry[];
            if (activeTabId < 0 || activeTabId >= tabs.length) return s;
            const existingFile = files.find(x => 
                x.fileId === tabs[activeTabId].fileId &&
                x.language === language
            );
            if (existingFile) {
                existingFile.content = code;
                existingFile.viewState = latestViewState;
            } else {
                files = [...files, {
                    fileId: tabs[activeTabId].fileId,
                    fileName: tabs[activeTabId].fileName,
                    language: language,
                    content: code,
                    viewState: latestViewState,
                    isActive: false
                } as FileEntry];
            }
            return {...s, [fkey]: JSON.stringify(files)};
        });
        }
    }

    $: if (language && codegateWorkspaceTab === 'editor') {
        loadOrInitFile(language);
    }

    function closeTab(fileId: string) {
        if (tabs.length <= 1) return;
        if (!confirm("Are you sure you want to remove this file? This action cannot be undone")) return;
        const idx = tabs.findIndex((t) => t.fileId === fileId);
        if (idx === -1) return;
        if (activeTabId === idx) {
            activateTab(tabs.find(x => x.fileId !== fileId)?.fileId);
        }
        const fkey = fileKey();
        fileStore.update((s) => {
            let files = JSON.parse(s[fkey] || '[]') as FileEntry[];
            files = files.filter((f) => f.fileId !== fileId);
            return { ...s, [fkey]: JSON.stringify(files) };
        });
        // Update tabs list
        const newTabs = tabs.filter((t) => t.fileId !== fileId);
        tabs = newTabs;
        // Re-number orders after removal
        persistTabOrder();
    }

    function handleMouseDown(event: MouseEvent) {
        isResizing = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }

    function handleMouseMove(event: MouseEvent) {
        if (!isResizing || !workspaceElement) return;
        const workspaceRect = workspaceElement.getBoundingClientRect();
        const newWidth = event.clientX - workspaceRect.left;
        let newPercentage = (newWidth / workspaceRect.width) * 100;
        const constrainedPercentage = Math.min(90, newPercentage);
        $leftPaneWidthStore = constrainedPercentage;
        updateSettingsPosition();
    }

    function handleMouseUp() {
        isResizing = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }

    onMount(async () => {
        hasDesktopStartupControls = Boolean(window.codegateDesktop?.startupEventsStatus);
        const module = await import('$lib/components/CodeEditor.svelte');
        CodeEditor = module.default;
        if (isCodeGate && $userSettingsStorage.aiEnabled) void runAiLifecycle('warm');

        const fb = initFirebase();
        if (fb) isFirebaseAvailable = true;

        // Check for tabs and game mode in URL params
        const urlParams = new URLSearchParams(window.location.search);

        // Check for game mode
        if (urlParams.get('gameMode') === '1') {
            isGameMode = true;
            gameStartTime = Date.now();
            // Force fresh starter code, ignore saved
            suppressSave = true;
            code = data.problem.starterCode?.[language] ?? '';
            await tick();
            suppressSave = false;
        }

        const tabsParam = urlParams.get('tabs');
        if (tabsParam) {
            try {
                const requestedTabs = JSON.parse(decodeURIComponent(tabsParam)) as { name: string, lang: ProgrammingLanguage, content?: string }[];
                if (requestedTabs.length > 0) {
                    suppressSave = true;
                    for (const rt of requestedTabs) {
                        await addNewTab(rt.name, rt.content || '', rt.lang);
                    }
                    if (requestedTabs.length > 0) {
                        window.history.replaceState({}, '', window.location.pathname);
                        suppressSave = false;
                        return;
                    }
                }
            } catch (e) {
                console.error('Failed to parse tabs from URL', e);
            }
        }

        const forkData = ($page.state as any).forkData as { content: string; language: ProgrammingLanguage; viewState?: string; fileName: string } | undefined;
        
        if (forkData) {
            if (forkData.language) {
                language = forkData.language;
                await tick();
            }
            
            code = forkData.content;
            currentViewState = forkData.viewState ?? null;
            
            if (forkData.fileName) {
                addNewTab(`Fork of ${forkData.fileName}`, forkData.content, language, currentViewState);
            }
        }
    });

    onMount(() => {
        isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const handleDocClick = (e: MouseEvent) => {
            if (showSettings && settingsContainer && !settingsContainer.contains(e.target as Node)) {
                showSettings = false;
            }
            if (showLeetcodeDifficultyFilter && leetcodeDifficultyFilterContainer && !leetcodeDifficultyFilterContainer.contains(e.target as Node)) {
                showLeetcodeDifficultyFilter = false;
            }
            if (showProblemNumberFilter && problemNumberFilterContainer && !problemNumberFilterContainer.contains(e.target as Node)) {
                showProblemNumberFilter = false;
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                showSettings = false;
                showLeetcodeDifficultyFilter = false;
                showProblemNumberFilter = false;
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
                e.preventDefault();
                toggleProblemPaneVisibility();
            }
        };
        const handleUnload = () => {
            saveCurrentViewState();
        };
        const handleOverlayMove = () => updateSettingsPosition();
        document.addEventListener('click', handleDocClick);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('scroll', handleOverlayMove, true);
        window.addEventListener('resize', handleOverlayMove);
        window.addEventListener('beforeunload', handleUnload);
        return () => {
            document.removeEventListener('click', handleDocClick);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('scroll', handleOverlayMove, true);
            window.removeEventListener('resize', handleOverlayMove);
            window.removeEventListener('beforeunload', handleUnload);
        };
    });

    function updateSettingsPosition() {
        if (!showSettings || !settingsButton || !settingsDropdown) return;
        const margin = 8;
        const gap = 8;
        const anchor = settingsButton.getBoundingClientRect();
        const popup = settingsDropdown.getBoundingClientRect();
        const maxLeft = Math.max(margin, window.innerWidth - popup.width - margin);
        settingsLeft = Math.min(maxLeft, Math.max(margin, anchor.right - popup.width));
        const below = anchor.bottom + gap;
        const above = anchor.top - popup.height - gap;
        const preferredTop = below + popup.height <= window.innerHeight - margin ? below : above;
        const maxTop = Math.max(margin, window.innerHeight - popup.height - margin);
        settingsTop = Math.min(maxTop, Math.max(margin, preferredTop));
    }

    async function toggleSettings() {
        showSettings = !showSettings;
        if (showSettings) {
            if (hasDesktopStartupControls && !startupEvents) await loadStartupEvents();
            await tick();
            updateSettingsPosition();
        }
    }

    async function loadStartupEvents() {
        if (!window.codegateDesktop?.startupEventsStatus || startupEventsBusy) return;
        startupEventsBusy = true;
        startupEventsError = '';
        try {
            startupEvents = await window.codegateDesktop.startupEventsStatus();
        } catch (error) {
            startupEventsError = error instanceof Error ? error.message : String(error);
        } finally {
            startupEventsBusy = false;
        }
    }

    async function updateStartupEvent(eventName: 'logon' | 'unlock' | 'resume', enabled: boolean) {
        if (!window.codegateDesktop?.setStartupEvents || !startupEvents || startupEventsBusy) return;
        const previous = startupEvents;
        const next = { ...startupEvents, [eventName]: enabled };
        startupEvents = next;
        startupEventsBusy = true;
        startupEventsError = '';
        try {
            startupEvents = await window.codegateDesktop.setStartupEvents(next);
        } catch (error) {
            startupEvents = previous;
            startupEventsError = error instanceof Error ? error.message : String(error);
        } finally {
            startupEventsBusy = false;
            await tick();
            updateSettingsPosition();
        }
    }

    function appendAiStatus(text: string) {
        aiSettingsStatus = `${aiSettingsStatus}${text}`.slice(-800);
    }

    async function runAiLifecycle(endpoint: 'provision' | 'warm' | 'unload') {
        aiSettingsBusy = true;
        aiSettingsStatus = '';
        aiSettingsError = '';
        try {
            const response = await fetch(`/api/codegate/ai/${endpoint}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ sessionId: gateSessionId, challengeId: gateChallengeId })
            });
            await consumeAiStream(response, (event) => {
                if ((event.type === 'status' || event.type === 'text') && event.text) appendAiStatus(event.text);
            });
        } catch (error) {
            aiSettingsError = error instanceof Error ? error.message : String(error);
        } finally {
            aiSettingsBusy = false;
            await tick();
            updateSettingsPosition();
        }
    }

    async function setAiEnabled(enabled: boolean) {
        userSettingsStorage.update((settings) => ({ ...settings, aiEnabled: enabled }));
        aiHintController?.abort();
        aiExplainController?.abort();
        syntaxDrillController?.abort();
        if (!enabled) {
            aiHintOpen = false;
            aiHintState = 'idle';
            aiHintText = '';
            if (codegateWorkspaceTab === 'ai-drill') await openEditorWorkspace();
        }
        await runAiLifecycle(enabled ? 'provision' : 'unload');
    }

    async function toggleAiHint() {
        aiHintOpen = !aiHintOpen;
        if (!aiHintOpen || aiHintState === 'ready' || aiHintState === 'loading') return;
        aiHintController?.abort();
        aiHintController = new AbortController();
        aiHintState = 'loading';
        aiHintText = 'Generating algorithm hint…';
        let output = '';
        try {
            const response = await fetch('/api/codegate/ai/algorithm-hint', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ sessionId: gateSessionId, challengeId: gateChallengeId }),
                signal: aiHintController.signal
            });
            await consumeAiStream(response, (event) => {
                if (event.type === 'status' && !output && event.text) aiHintText = event.text;
                if (event.type === 'text' && event.text) {
                    output += event.text;
                    aiHintText = output;
                }
            });
            if (!output.trim()) throw new Error('The local model returned an empty algorithm hint');
            aiHintState = 'ready';
        } catch (error) {
            if (aiHintController.signal.aborted) return;
            aiHintState = 'error';
            aiHintText = error instanceof Error ? error.message : String(error);
        }
    }

    function retryAiHint() {
        aiHintState = 'idle';
        aiHintOpen = false;
        void toggleAiHint();
    }

    async function explainSelection(event: CustomEvent<{ source: string; selection: string; startLine: number; endLine: number }>) {
        if (!$userSettingsStorage.aiEnabled || !isCodeGate) return;
        aiExplainController?.abort();
        aiExplainController = new AbortController();
        const { source, selection, startLine, endLine } = event.detail;
        const title = `AI Explanation — lines ${startLine}–${endLine}`;
        let output = '';
        executionPanelComponent?.showAiConsole(title, 'Explaining selected code…');
        try {
            const response = await fetch('/api/codegate/ai/explain-selection', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ sessionId: gateSessionId, challengeId: gateChallengeId, syntaxDrillId: codegateWorkspaceTab === 'ai-drill' ? syntaxDrill?.problem.id : undefined, source, selection, startLine, endLine }),
                signal: aiExplainController.signal
            });
            await consumeAiStream(response, (streamEvent) => {
                if (streamEvent.type === 'status' && !output && streamEvent.text) executionPanelComponent?.showAiConsole(title, streamEvent.text);
                if (streamEvent.type === 'text' && streamEvent.text) {
                    output += streamEvent.text;
                    executionPanelComponent?.showAiConsole(title, output);
                }
            });
        } catch (error) {
            if (aiExplainController.signal.aborted) return;
            const message = error instanceof Error ? error.message : String(error);
            executionPanelComponent?.showAiConsole(title, output ? `${output}\n\nError: ${message}` : `Error: ${message}`);
        }
    }

    function saveCurrentViewState() {
        if (codegateWorkspaceTab === 'ai-drill') return;
        if (!editorComponent || activeTabId < 0 || activeTabId >= tabs.length) return;
        const state = editorComponent.getViewState();
        if (!state) return;
        
        const fkey = fileKey();
        fileStore.update((s) => {
            let files = JSON.parse(s[fkey] || '[]') as FileEntry[];
            const existingFile = files.find(x => 
                x.fileId === tabs[activeTabId].fileId &&
                x.language === language
            );
            if (existingFile) {
                existingFile.viewState = state;
            }
            return {...s, [fkey]: JSON.stringify(files)};
        });
        currentViewState = state;
    }

    async function activateTab(fileId?: string) {
        if (!fileId) return;
        const idx = tabs.findIndex((t) => t.fileId === fileId);
        if (idx === -1) return;
        saveCurrentViewState();
        activeTabId = idx;
        await loadOrInitFile(language);
    }

    // Runtime image name (like in ExecutionPanel)
    let imageStatus: 'unknown' | 'present' | 'absent' = 'unknown';
    let imageName: string = '';
    // Problem pane visibility memory and toggle
    let lastNonZeroLeftWidth = 50; // default width percentage
    $: if ($leftPaneWidthStore && $leftPaneWidthStore > 0) {
        lastNonZeroLeftWidth = $leftPaneWidthStore;
    }
    function toggleProblemPaneVisibility() {
        const current = $leftPaneWidthStore === null ? 50 : $leftPaneWidthStore;
        if (current > 5) {
            lastNonZeroLeftWidth = current || lastNonZeroLeftWidth || 50;
            $leftPaneWidthStore = 0;
        } else {
            const restore = Math.max(10, Math.min(70, lastNonZeroLeftWidth || 50));
            $leftPaneWidthStore = restore;
        }
    }

    async function refreshImageStatus() {
        try {
            const res = await fetch(`/api/image/status?language=${encodeURIComponent(language)}`);
            if (!res.ok) throw new Error('status request failed');
            const body = await res.json();
            imageStatus = body.present ? 'present' : 'absent';
            imageName = body.image || '';
        } catch (e) {
            imageStatus = 'unknown';
            imageName = '';
        }
    }

    // Refresh image status on mount and when language changes
    onMount(refreshImageStatus);
    let lastLanguageChecked: string | null = null;
    $: if (language && language !== lastLanguageChecked) {
        lastLanguageChecked = language;
        imageStatus = 'unknown';
        imageName = '';
        refreshImageStatus();
    }

    // Reset code for the current problem + language
    function handleResetClick() {
        const confirmed = confirm('Are you sure you want to reset the code for this file? This action cannot be undone.');
        if (!confirmed) return;
        if (codegateWorkspaceTab === 'ai-drill' && syntaxDrill) {
            syntaxDrillCode = syntaxDrill.source;
            code = syntaxDrill.source;
            return;
        }
        if (isCodeGate) {
            localStorage.removeItem(`codegate:draft:${problemId}:${language}:${difficulty}`);
            code = data.codegate?.source ?? '';
            return;
        }
        const fkey = fileKey();
        fileStore.update((s) => {
            const files = JSON.parse(s[fkey] || '[]') as FileEntry[];
            const existingFile = files.find(x => x.fileId === tabs[activeTabId].fileId && x.language === language); 
            if (existingFile) {
                existingFile.content = data.problem.starterCode?.[language] ?? '';
            }
            return {...s, [fkey]: JSON.stringify(files)};
        });
        code = data.problem.starterCode?.[language] ?? '';
    }

    $: {
        const currentFontSize = $userSettingsStorage.editorFontSize;
        if (typeof fontSize === 'number' && currentFontSize !== fontSize) {
            userSettingsStorage.update((s) => ({ ...s, editorFontSize: fontSize }));
        }
    }

    $: {
        const currentTheme = $userSettingsStorage.theme;
        if (theme && currentTheme !== theme) {
            userSettingsStorage.update((s) => ({ ...s, theme }));
        }
    }

    $: {
        const currentVimMode = $userSettingsStorage.vimMode;
        if (vimMode && currentVimMode !== vimMode) {
            userSettingsStorage.update((s) => ({ ...s, vimMode }));
        }
    }

    function generateShortId(length: number = 4): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async function handleShare() {
        const fb = initFirebase();
        if (!fb || !fb.db) return;

        const shareId = generateShortId(4);
        
        // Get current file content
        const currentTab = tabs[activeTabId];
        const files = getFiles();
        const currentFile = files.find(f => f.fileId === currentTab.fileId && f.language === language);
        const content = currentFile ? currentFile.content : (data.problem.starterCode?.[language] ?? '');
        const viewState = currentFile ? currentFile.viewState : (editorComponent?.getViewState() || null);
        
        // Save to Firestore
        try {
            const user = await ensureAuthenticated();
            if (!user) throw new Error('Authentication failed');
            await setDoc(doc(fb.db, 'shares', shareId), {
                content,
                language,
                viewState,
                fileName: currentTab.fileName,
                createdAt: new Date(),
                problemId: data.problem.id,
                problemTitle: data.problem.title,
                ownerId: user.uid
            });
            
            shareUrl = `${window.location.origin}/p/${shareId}`;
            qrCodeDataUrl = await QRCode.toDataURL(shareUrl);
            showShareModal = true;
        } catch (e) {
            console.error('Error sharing:', e);
            alert('Failed to create share link');
        }
    }

    async function updateGateChallenge(
        action: 'refresh' | 'switch-variant',
        requestedLanguage: GateLanguage = language as GateLanguage,
        requestedDifficulty: DifficultyLevel = difficulty,
        requestedProblemId?: string
    ) {
        if (!isCodeGate || gateActionPending) return;
        gateActionPending = true;
        try {
            const response = await fetch('/api/codegate/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    sessionId: gateSessionId,
                    challengeId: gateChallengeId,
                    language: requestedLanguage,
                    difficulty: requestedDifficulty,
                    leetcodeDifficulties: selectedLeetcodeDifficulties,
                    problemNumberRange: { min: problemNumberMin, max: problemNumberMax },
                    problemId: requestedProblemId
                })
            });
            const session = await response.json();
            if (!response.ok) throw new Error(session.error ?? (action === 'refresh' ? 'Unable to replace challenge' : 'Unable to switch variant'));
            const selected = session.challenge.variant;
            userSettingsStorage.update((settings) => ({
                ...settings,
                codegateLanguage: selected.language,
                    solutionDifficulty: selected.difficulty,
                    leetcodeDifficulties: [...selectedLeetcodeDifficulties],
                    problemNumberMin,
                    problemNumberMax
            }));
            const target = new URL(`/problems/${selected.problemId}`, window.location.origin);
            target.searchParams.set('codegate', '1');
            target.searchParams.set('language', selected.language);
            target.searchParams.set('difficulty', selected.difficulty);
            target.searchParams.set('sessionId', session.id);
            target.searchParams.set('challengeId', session.challenge.id);
            window.location.assign(`${target.pathname}${target.search}`);
        } catch (error) {
            language = data.codegate?.selected.language ?? language;
            difficulty = data.codegate?.selected.difficulty ?? difficulty;
            alert(error instanceof Error ? error.message : String(error));
            gateActionPending = false;
        }
    }

    const replaceGateChallenge = () => updateGateChallenge('refresh');
    function handleLanguageChange(event: Event) {
        const requestedLanguage = (event.currentTarget as HTMLSelectElement).value as ProgrammingLanguage;
        if (codegateWorkspaceTab === 'ai-drill') {
            syntaxDrillLanguage = requestedLanguage as GateLanguage;
            syntaxDrill = null;
            syntaxDrillCode = '';
            void generateSyntaxDrill();
            return;
        }
        saveCurrentViewState();
        if (isCodeGate) {
            void updateGateChallenge('switch-variant', requestedLanguage as GateLanguage, difficulty);
            return;
        }
        language = requestedLanguage;
        userSettingsStorage.update((settings) => ({ ...settings, preferredLanguage: language }));
    }

    function handleDifficultyChange(event: Event) {
        const requestedDifficulty = (event.currentTarget as HTMLSelectElement).value as DifficultyLevel;
        void updateGateChallenge('switch-variant', language as GateLanguage, requestedDifficulty);
    }

    function toggleLeetcodeDifficulty(value: LeetcodeDifficulty) {
        if (selectedLeetcodeDifficulties.includes(value)) {
            if (selectedLeetcodeDifficulties.length === 1) return;
            selectedLeetcodeDifficulties = selectedLeetcodeDifficulties.filter((candidate) => candidate !== value);
        } else {
            selectedLeetcodeDifficulties = [...selectedLeetcodeDifficulties, value];
        }
        userSettingsStorage.update((settings) => ({ ...settings, leetcodeDifficulties: [...selectedLeetcodeDifficulties] }));
        if (codegateWorkspaceTab === 'catalogue') void loadProblemCatalog();
    }

    function updateProblemNumberRange(bound: 'min' | 'max', event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const parsed = input.value.trim() === '' ? null : Number(input.value);
        if (parsed !== null && (!Number.isSafeInteger(parsed) || parsed < 1)) {
            input.value = String(bound === 'min' ? problemNumberMin ?? '' : problemNumberMax ?? '');
            return;
        }
        if (bound === 'min') problemNumberMin = parsed;
        else problemNumberMax = parsed;
        if (problemNumberMin !== null && problemNumberMax !== null && problemNumberMin > problemNumberMax) {
            if (bound === 'min') problemNumberMax = problemNumberMin;
            else problemNumberMin = problemNumberMax;
        }
        userSettingsStorage.update((settings) => ({ ...settings, problemNumberMin, problemNumberMax }));
        if (codegateWorkspaceTab === 'catalogue') void loadProblemCatalog();
    }

    function clearProblemNumberRange() {
        problemNumberMin = null;
        problemNumberMax = null;
        userSettingsStorage.update((settings) => ({ ...settings, problemNumberMin, problemNumberMax }));
        if (codegateWorkspaceTab === 'catalogue') void loadProblemCatalog();
    }

    function problemCatalogKey() {
        return JSON.stringify([language, selectedLeetcodeDifficulties, problemNumberMin, problemNumberMax]);
    }

    async function loadProblemCatalog() {
        showLeetcodeDifficultyFilter = false;
        showProblemNumberFilter = false;
        const key = problemCatalogKey();
        if (loadedProblemCatalogKey === key) return;
        problemCatalogLoading = true;
        problemCatalogError = '';
        problemCatalogSearch = '';
        try {
            const query = new URLSearchParams({
                sessionId: gateSessionId,
                challengeId: gateChallengeId,
                language: language as GateLanguage,
                leetcodeDifficulties: selectedLeetcodeDifficulties.join(',')
            });
            if (problemNumberMin !== null) query.set('problemNumberMin', String(problemNumberMin));
            if (problemNumberMax !== null) query.set('problemNumberMax', String(problemNumberMax));
            const response = await fetch(`/api/codegate/catalog?${query}`);
            const body = await response.json();
            if (!response.ok) throw new Error(body.error ?? 'Unable to load problem catalogue');
            problemCatalog = body;
            loadedProblemCatalogKey = key;
        } catch (error) {
            problemCatalog = [];
            problemCatalogError = error instanceof Error ? error.message : String(error);
        } finally {
            problemCatalogLoading = false;
        }
    }

    function openProblemCatalogue() {
        if (codegateWorkspaceTab === 'ai-drill') syntaxDrillCode = code;
        codegateWorkspaceTab = 'catalogue';
        void loadProblemCatalog();
    }

    async function openEditorWorkspace() {
        if (codegateWorkspaceTab === 'ai-drill') syntaxDrillCode = code;
        codegateWorkspaceTab = 'editor';
        await loadOrInitFile(language);
    }

    async function openSyntaxDrill() {
        if (!$userSettingsStorage.aiEnabled || aiSettingsBusy) return;
        codegateWorkspaceTab = 'ai-drill';
        if (syntaxDrill) {
            suppressSave = true;
            code = syntaxDrillCode || syntaxDrill.source;
            currentViewState = null;
            await tick();
            suppressSave = false;
            return;
        }
        void generateSyntaxDrill();
    }

    async function generateSyntaxDrill() {
        if (!$userSettingsStorage.aiEnabled || syntaxDrillState === 'loading') return;
        syntaxDrillController?.abort();
        syntaxDrillController = new AbortController();
        syntaxDrillState = 'loading';
        syntaxDrillStatus = 'Generating a one-minute syntax drill…';
        syntaxDrillProblemPreview = '';
        syntaxDrillCode = '';
        if (codegateWorkspaceTab === 'ai-drill') code = '';
        let payload = '';
        try {
            const response = await fetch('/api/codegate/ai/syntax-drill', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    sessionId: gateSessionId,
                    challengeId: gateChallengeId,
                    language: syntaxDrillLanguage,
                }),
                signal: syntaxDrillController.signal
            });
            await consumeAiStream(response, (event) => {
                if (event.type === 'status' && event.text) syntaxDrillStatus = event.text;
                if (event.type === 'problem' && event.text) syntaxDrillProblemPreview += event.text;
                if (event.type === 'result' && event.text) payload += event.text;
            });
            syntaxDrill = JSON.parse(payload) as SyntaxDrillPayload;
            syntaxDrillCode = syntaxDrill.source;
            syntaxDrillState = 'ready';
            syntaxDrillStatus = '';
            if (codegateWorkspaceTab === 'ai-drill') {
                suppressSave = true;
                code = syntaxDrillCode;
                currentViewState = null;
                await tick();
                suppressSave = false;
            }
        } catch (error) {
            if (syntaxDrillController.signal.aborted) return;
            syntaxDrillState = 'error';
            syntaxDrillStatus = error instanceof Error ? error.message : String(error);
        }
    }

    function selectCatalogProblem(entry: ProblemCatalogEntry) {
        codegateWorkspaceTab = 'editor';
        void updateGateChallenge('refresh', language as GateLanguage, difficulty, entry.problemId);
    }

    async function giveUpGate() {
        if (!isCodeGate || gateActionPending || !confirm('Give up this CodeGate session? You will be released immediately.')) return;
        gateActionPending = true;
        try {
            const response = await fetch('/api/codegate/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'give-up', sessionId: gateSessionId, challengeId: gateChallengeId })
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error ?? 'Unable to give up');
            if (window.codegateDesktop) {
                await window.codegateDesktop.release('given-up');
                return;
            }
            window.location.assign('/gate/released?outcome=given-up');
        } catch (error) {
            alert(error instanceof Error ? error.message : String(error));
            gateActionPending = false;
        }
    }

    async function handleGateReleased() {
        if (window.codegateDesktop) {
            await window.codegateDesktop.release('accepted');
            return;
        }
        window.location.assign('/gate/released?outcome=accepted');
    }
</script>

<svelte:head>
    <title>{data.problem.title} - Cojudge</title>
</svelte:head>

<div
    class="workspace"
    bind:this={workspaceElement}
    style="grid-template-columns: {Math.max(0, $leftPaneWidthStore === null ? 50 : $leftPaneWidthStore)}% auto 1fr;"
>
    <!-- Left Pane: Problem Statement -->
    <div class="problem-pane" class:hide={($leftPaneWidthStore === null ? 50 : $leftPaneWidthStore) < 5}>
        <div class="prose">
            {#if !isCodeGate}<Tooltip text={'Back'} pos="bottom"> 
                {#if viewMode === 'solution'}
                    <button class="back-button" aria-label="Back" on:click={() => viewMode = 'statement'}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </button>
                {:else}
                    <a class="back-button" href="/" aria-label="Back">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </a>
                {/if}
            </Tooltip>{/if}
            <Tooltip text={isMac ? "Cmd + B" : "Ctrl + B"} pos="bottom">
                <button
                    class="back-button"
                    aria-label={($leftPaneWidthStore === null ? 50 : $leftPaneWidthStore) > 5 ? 'Hide problem pane' : 'Show problem pane'}
                    on:click={toggleProblemPaneVisibility}
                >
                    {#if ($leftPaneWidthStore === null ? 50 : $leftPaneWidthStore) > 5}
                        <!-- Eye icon (visible) -->
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" stroke="currentColor" stroke-width="2" fill="none"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
                        </svg>
                    {:else}
                        <!-- Eye-off icon (hidden) -->
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" stroke="currentColor" stroke-width="2" fill="none"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
                            <path d="M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    {/if}
                </button>
            </Tooltip>
            {#if codegateWorkspaceTab === 'ai-drill'}
                <div class="codegate-problem-actions">
                    <button class="btn gate-action" on:click={() => { syntaxDrill = null; syntaxDrillCode = ''; void generateSyntaxDrill(); }} disabled={syntaxDrillState === 'loading' || !$userSettingsStorage.aiEnabled}>New Drill</button>
                    <button class="btn gate-give-up" on:click={giveUpGate} disabled={gateActionPending}>Give Up</button>
                </div>
                {#if syntaxDrillState === 'loading'}
                    {#if syntaxDrillPreview.title}
                        <div class="title-row"><h1>{syntaxDrillPreview.title}</h1></div>
                        <div class="markdown-body">{@html renderMarkdown(syntaxDrillPreview.statement)}</div>
                        {#each syntaxDrillPreview.info as note, i}
                            <div class="hint-item">
                                <button class="hint-header" on:click={() => { const next = new Set(openedHints); if (next.has(i)) next.delete(i); else next.add(i); openedHints = next; }}>
                                    <span>Info {i + 1}</span><span class="chevron">{openedHints.has(i) ? "▼" : "▶"}</span>
                                </button>
                                {#if openedHints.has(i)}<div class="hint-body markdown-body">{@html renderMarkdown(note)}</div>{/if}
                            </div>
                        {/each}
                    {:else}
                    <div class="syntax-drill-empty syntax-drill-generating">
                        <h1>AI Syntax Drill ✦</h1>
                        <p>{syntaxDrillStatus}</p>
                    </div>
                    {/if}
                {:else if syntaxDrillState === 'error'}
                    <div class="syntax-drill-empty">
                        <h1>Unable to create a drill</h1>
                        <p>{syntaxDrillStatus}</p>
                        <button class="btn" on:click={generateSyntaxDrill}>Retry</button>
                    </div>
                {:else if syntaxDrill}
                    <div class="title-row"><h1>{syntaxDrill.problem.title}</h1></div>
                    <div class="markdown-body">{@html renderMarkdown(syntaxDrill.problem.statement)}</div>
                    {#each syntaxDrill.problem.examples as example}
                        <div class="example">
                            <pre class="example-input">{example.input}</pre>
                            <pre class="example-output">{example.output}</pre>
                        </div>
                    {/each}
                    {#each syntaxDrill.problem.info as note, i}
                        <div class="hint-item">
                            <button class="hint-header" on:click={() => { const next = new Set(openedHints); if (next.has(i)) next.delete(i); else next.add(i); openedHints = next; }}>
                                <span>Info {i + 1}</span><span class="chevron">{openedHints.has(i) ? "â–¾" : "â–¸"}</span>
                            </button>
                            {#if openedHints.has(i)}<div class="hint-body markdown-body">{@html renderMarkdown(note)}</div>{/if}
                        </div>
                    {/each}
                {/if}
            {:else}
            {#if isCodeGate}
                <div class="codegate-problem-actions">
                    <button class="btn gate-action" on:click={replaceGateChallenge} disabled={gateActionPending}>Different Problem</button>
                    <button class="btn gate-give-up" on:click={giveUpGate} disabled={gateActionPending}>Give Up</button>
                </div>
            {/if}
            <div class="title-row">
                <h1>{data.problem.title}</h1>
                {#if !isGameMode && $userStore && $userStore[fileKey()]}
                    <span class="solved-pill" title="You've solved this problem" aria-label="Solved" role="status">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Solved
                    </span>
                    {#if bestRank}
                        <button
                            class="game-rank-badge"
                            class:rank-s={bestRank === 'S'}
                            class:rank-a={bestRank === 'A'}
                            class:rank-b={bestRank === 'B'}
                            class:rank-c={bestRank === 'C'}
                            on:click={() => (showGameHistory = true)}
                            title="View game history"
                        >
                            {bestRank}
                        </button>
                    {/if}
                {/if}
            </div>
            <span class="badge {getDifficultyClass(data.problem.difficulty)}">
                LeetCode: {data.problem.difficulty}
            </span>
            {#if !isCodeGate}<a href={data.problem.link} target="_blank" rel="noopener noreferrer" class="external-link">↗</a>{/if}
            {#if viewMode === 'solution'}
                <!-- Solution content from problems/[slug]/solution.md -->
                <div class="markdown-body">
                    {@html renderMarkdown(data.problem.solution)}
                </div>
            {:else}
                <!-- Statement content is sourced from problems/[slug]/statement.md (attached on server as problem.statement) -->
                <div class="markdown-body">
                    {@html renderMarkdown(data.problem.statement)}
                </div>
                {#each data.problem.examples as example}
                    <div class="example">
                        <pre class="example-input">{example.input}</pre>
                        <pre class="example-output">{example.output}</pre>
                        {#if example.explanation}
                            <div class="markdown-body">
                                {@html renderMarkdown(example.explanation)}
                            </div>
                        {/if}
                    </div>
                {/each}

                {#if data.problem.hints && data.problem.hints.length}
                    {#each data.problem.hints as hint, i}
                        <div class="hint-item">
                            <button
                                class="hint-header"
                                on:click={() => {
                                    const next = new Set(openedHints);
                                    if (next.has(i)) next.delete(i); else next.add(i);
                                    openedHints = next; // reassign to trigger reactivity
                                }}
                            >
                                <span>Hint {i + 1}</span>
                                <span class="chevron">{openedHints.has(i) ? "▾" : "▸"}</span>
                            </button>
                            {#if openedHints.has(i)}
                                <div class="hint-body markdown-body">
                                    {@html renderMarkdown(hint)}
                                </div>
                            {/if}
                        </div>
                    {/each}
                {/if}

                {#if isCodeGate && $userSettingsStorage.aiEnabled}
                    <div class="hint-item ai-hint-item">
                        <button class="hint-header" disabled={aiSettingsBusy} on:click={toggleAiHint}>
                            <span>AI Algorithm Hint ✦</span>
                            <span class="chevron">{aiHintOpen ? "▾" : "▸"}</span>
                        </button>
                        {#if aiHintOpen}
                            <div class="hint-body ai-hint-body">
                                {aiHintText}
                                {#if aiHintState === 'error'}
                                    <button class="btn" on:click={retryAiHint}>Retry</button>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/if}

                {#if data.problem.solution && !isCodeGate}
                    <div class="hint-item">
                        <button
                            class="hint-header"
                            class:unsolved={!($userStore && $userStore[fileKey()])}
                            on:click={() => {
                                if ($userStore && $userStore[fileKey()]) {
                                    viewMode = 'solution';
                                } else if (confirm('Are you sure you want to view the solution? Try solving it yourself first!')) {
                                    viewMode = 'solution';
                                }
                            }}
                        >
                            <span>Reference Solution</span>
                            <span class="chevron">▸</span>
                        </button>
                    </div>
                {/if}
            {/if}
            {/if}
        </div>
    </div>

    <button class="resizer" aria-label="Resize panes" on:mousedown={handleMouseDown} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isResizing = true; } }}></button>

    <!-- Right Pane: Editor and Console -->
    <div class="editor-pane">
        {#if isCodeGate}
            <div class="codegate-workspace-tabs" role="tablist" aria-label="Code workspace">
                <button
                    type="button"
                    role="tab"
                    aria-selected={codegateWorkspaceTab === 'editor'}
                    class:active={codegateWorkspaceTab === 'editor'}
                    on:click={openEditorWorkspace}
                >
                    <svg class="workspace-tab-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="m7 5-5 5 5 5M13 5l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Editor
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={codegateWorkspaceTab === 'catalogue'}
                    class:active={codegateWorkspaceTab === 'catalogue'}
                    on:click={openProblemCatalogue}
                >
                    <svg class="workspace-tab-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M6.5 5h10M6.5 10h10M6.5 15h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                        <circle cx="3" cy="5" r="1" fill="currentColor"/><circle cx="3" cy="10" r="1" fill="currentColor"/><circle cx="3" cy="15" r="1" fill="currentColor"/>
                    </svg>
                    Catalogue
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={codegateWorkspaceTab === 'ai-drill'}
                    class:active={codegateWorkspaceTab === 'ai-drill'}
                    disabled={!$userSettingsStorage.aiEnabled || aiSettingsBusy}
                    aria-disabled={!$userSettingsStorage.aiEnabled || aiSettingsBusy}
                    title={$userSettingsStorage.aiEnabled ? 'Open AI Syntax Drill' : 'Enable the local AI helper in Settings first'}
                    on:click={openSyntaxDrill}
                >
                    <span class="workspace-tab-star" aria-hidden="true">✦</span>
                    AI Syntax Drill
                </button>
            </div>
        {/if}
        <div class="editor-header" class:codegate-header={isCodeGate} style="display:flex;flex-wrap:wrap;gap:var(--spacing-2);align-items:center;justify-content:space-between;padding:var(--spacing-2);border-bottom:1px solid var(--color-border);">
            <div class="lang-dropdown-tabs-container">
                <div style="display:flex;flex-wrap:wrap;gap:var(--spacing-2);align-items:center;">
                    <label for="language-select" style="font-size:0.9rem;color:var(--color-text-secondary);">Language</label>
                    <select
                        id="language-select"
                        value={activeWorkspaceLanguage}
                        disabled={isCodeGate && gateActionPending}
                        on:focus={() => (suppressSave = true)}
                        on:mousedown={() => (suppressSave = true)}
                        on:keydown={() => (suppressSave = true)}
                        on:change={handleLanguageChange}
                        on:blur={() => (suppressSave = false)}
                    >
                        {#if isCodeGate}
                            {#each codegateWorkspaceTab === 'ai-drill' ? gateLanguages : gateAvailableLanguages as gateLanguage}
                                <option value={gateLanguage}>{gateLanguageLabels[gateLanguage]}</option>
                            {/each}
                        {:else}
                            <option value="java">Java</option>
                            <option value="cpp">C++</option>
                            <option value="python">Python</option>
                            <option value="typescript">TypeScript</option>
                            <option value="csharp">C#</option>
                            <option value="rust">Rust</option>
                            <option value="go">Go</option>
                        {/if}
                    </select>
                    {#if isCodeGate && codegateWorkspaceTab !== 'ai-drill'}
                        <label for="difficulty-select" style="font-size:0.9rem;color:var(--color-text-secondary);">Solution difficulty</label>
                        <select id="difficulty-select" value={difficulty} on:change={handleDifficultyChange} disabled={gateActionPending}>
                            <option value="0">Original (0%)</option>
                            <option value="25">25%</option>
                            <option value="50">50%</option>
                            <option value="75">75%</option>
                            <option value="99">99% (One line missing)</option>
                            <option value="100">Solution (100%)</option>
                        </select>
                        <label for="leetcode-difficulty-select" style="font-size:0.9rem;color:var(--color-text-secondary);">LeetCode difficulty</label>
                        <div class="leetcode-filter" bind:this={leetcodeDifficultyFilterContainer}>
                            <button
                                id="leetcode-difficulty-select"
                                type="button"
                                class="leetcode-filter-trigger"
                                aria-haspopup="true"
                                aria-expanded={showLeetcodeDifficultyFilter}
                                disabled={gateActionPending}
                                on:click={() => showLeetcodeDifficultyFilter = !showLeetcodeDifficultyFilter}
                            >
                                {selectedLeetcodeDifficulties.length === leetcodeDifficultyLevels.length ? 'All' : selectedLeetcodeDifficulties.join(', ')}
                            </button>
                            {#if showLeetcodeDifficultyFilter}
                                <div class="leetcode-filter-menu">
                                    {#each leetcodeDifficultyLevels as level}
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={selectedLeetcodeDifficulties.includes(level)}
                                                disabled={gateActionPending || (selectedLeetcodeDifficulties.length === 1 && selectedLeetcodeDifficulties.includes(level))}
                                                on:change={() => toggleLeetcodeDifficulty(level)}
                                            />
                                            {level}
                                        </label>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                        <label for="problem-number-filter" style="font-size:0.9rem;color:var(--color-text-secondary);">Problem number</label>
                        <div class="leetcode-filter" bind:this={problemNumberFilterContainer}>
                            <button
                                id="problem-number-filter"
                                type="button"
                                class="leetcode-filter-trigger"
                                aria-haspopup="true"
                                aria-expanded={showProblemNumberFilter}
                                disabled={gateActionPending}
                                on:click={() => showProblemNumberFilter = !showProblemNumberFilter}
                            >
                                {problemNumberMin === null && problemNumberMax === null ? 'All' : `${problemNumberMin ?? 'Any'}–${problemNumberMax ?? 'Any'}`}
                            </button>
                            {#if showProblemNumberFilter}
                                <div class="leetcode-filter-menu problem-number-menu">
                                    <div class="problem-number-field">
                                        <label for="problem-number-min">Minimum</label>
                                        <input id="problem-number-min" type="number" min="1" step="1" placeholder="Any" value={problemNumberMin ?? ''} on:change={(event) => updateProblemNumberRange('min', event)} />
                                    </div>
                                    <div class="problem-number-field">
                                        <label for="problem-number-max">Maximum</label>
                                        <input id="problem-number-max" type="number" min="1" step="1" placeholder="Any" value={problemNumberMax ?? ''} on:change={(event) => updateProblemNumberRange('max', event)} />
                                    </div>
                                    <button type="button" class="problem-number-clear" on:click={clearProblemNumberRange}>Use all problems</button>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
                {#if !isCodeGate}<div class="tabs-container">
                    <div class="tab-bar" role="tablist" aria-label="Editor tabs">
                        {#each tabs as t}
                            <div
                                class="tab {t.fileId === tabs[activeTabId].fileId ? 'active' : ''}"
                                role="tab"
                                aria-selected={t.fileId === tabs[activeTabId].fileId}
                                tabindex={t.fileId === tabs[activeTabId].fileId ? 0 : -1}
                                on:click={() => activateTab(t.fileId)}
                                on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateTab(t.fileId); } }}
                                draggable={true}
                                on:dragstart={(e) => handleDragStart(e, t.fileId)}
                                on:dragover={(e) => handleDragOver(e, t.fileId)}
                                on:drop={(e) => handleDrop(e, t.fileId)}
                                on:dragend={handleDragEnd}
                                on:auxclick={(e) => { if (e.button === 1) { e.preventDefault(); e.stopPropagation(); closeTab(t.fileId); } }}
                            >
                                {#if editingTabId === t.fileId}
                                    <input
                                        class="tab-rename-input"
                                        type="text"
                                        bind:value={editingName}
                                        bind:this={renameInputEl}
                                        on:click|stopPropagation
                                        on:keydown|stopPropagation={(e) => {
                                            if (e.key === 'Enter') { e.preventDefault(); applyRename(); }
                                            else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
                                        }}
                                        on:blur={applyRename}
                                    />
                                {:else}
                                    <span class="tab-title">{t.fileName}</span>
                                {/if}
                                <button
                                    class="tab-rename"
                                    aria-label="Rename tab"
                                    title="Rename"
                                    on:click|stopPropagation={() => startRename(t.fileId, t.fileName)}
                                >
                                    <!-- Pencil icon -->
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" stroke="currentColor" stroke-width="1.5" fill="none"/>
                                        <path d="M14.06 6.19l3.75 3.75 1.69-1.69a1.5 1.5 0 000-2.12L17.87 4.5a1.5 1.5 0 00-2.12 0l-1.69 1.69z" stroke="currentColor" stroke-width="1.5" fill="none"/>
                                    </svg>
                                </button>
                                {#if tabs.length > 1}
                                    <button
                                        class="tab-close"
                                        aria-label="Close tab"
                                        title="Close"
                                        on:click|stopPropagation={() => closeTab(t.fileId)}
                                    >
                                        ×
                                    </button>
                                {/if}
                            </div>
                        {/each}
                        <button class="tab-add" aria-label="New tab" title="New tab" on:click={() => addNewTab()}>+</button>
                    </div>
                </div>{/if}
            </div>
            <div style="display:flex;align-items:center;gap:var(--spacing-2);">
                {#if !isGameMode && !isCodeGate}
                    <Tooltip text={"Start Game"} pos={"bottom"}>
                        <button class="icon-button game-start-btn" on:click={() => showGameStartPopup = true} title="Start Game">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6 4l13 8-13 8V4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </Tooltip>
                {/if}
                {#if !isCodeGate}<Tooltip text={"Share Code"} pos={"bottom"}>
                    <button class="icon-button" on:click={handleShare} title="Share Code">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <polyline points="16 6 12 2 8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <line x1="12" y1="2" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </Tooltip>{/if}
                <Tooltip text={"Reset Code"} pos={"bottom"}>
                    <button
                        class="icon-button"
                        title="Reset Code"
                        aria-label="Reset Code"
                        on:click={handleResetClick}
                    >
                        <!-- Reset icon -->
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M4 4v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M20 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M20 10a8 8 0 0 0-8-8 8 8 0 0 0-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M4 14a8 8 0 0 0 8 8 8 8 0 0 0 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </Tooltip>
                <div class="settings-wrapper" bind:this={settingsContainer}>
                    <Tooltip text={"Settings"} pos={"bottom"}>
                        <button
                            bind:this={settingsButton}
                            class="icon-button"
                            title="Editor Settings"
                            aria-label="Editor Settings"
                            on:click={toggleSettings}
                        >
                            <!-- Cog icon -->
                            <svg width="16px" height="16px" viewBox="0 0 32 32" id="Lager_100" data-name="Lager 100" xmlns="http://www.w3.org/2000/svg">
                                <path id="Path_78" data-name="Path 78" d="M30.329,13.721l-2.65-.441a11.922,11.922,0,0,0-1.524-3.653l1.476-2.066a1.983,1.983,0,0,0-.211-2.553l-.428-.428a1.983,1.983,0,0,0-2.553-.211L22.373,5.845A11.922,11.922,0,0,0,18.72,4.321l-.441-2.65A2,2,0,0,0,16.306,0h-.612a2,2,0,0,0-1.973,1.671l-.441,2.65A11.922,11.922,0,0,0,9.627,5.845L7.561,4.369a1.983,1.983,0,0,0-2.553.211l-.428.428a1.983,1.983,0,0,0-.211,2.553L5.845,9.627A11.922,11.922,0,0,0,4.321,13.28l-2.65.441A2,2,0,0,0,0,15.694v.612a2,2,0,0,0,1.671,1.973l2.65.441a11.922,11.922,0,0,0,1.524,3.653L4.369,24.439a1.983,1.983,0,0,0,.211,2.553l.428.428a1.983,1.983,0,0,0,2.553.211l2.066-1.476a11.922,11.922,0,0,0,3.653,1.524l.441,2.65A2,2,0,0,0,15.694,32h.612a2,2,0,0,0,1.973-1.671l.441-2.65a11.922,11.922,0,0,0,3.653-1.524l2.066,1.476a1.983,1.983,0,0,0,2.553-.211l.428-.428a1.983,1.983,0,0,0,.211-2.553l-1.476-2.066a11.922,11.922,0,0,0,1.524-3.653l2.65-.441A2,2,0,0,0,32,16.306v-.612A2,2,0,0,0,30.329,13.721ZM16,22a6,6,0,1,1,6-6A6,6,0,0,1,16,22Z" 
                                    fill="currentColor"/>
                            </svg>
                        </button>
                    </Tooltip>
                    {#if showSettings}
                        <div
                            class="settings-dropdown"
                            bind:this={settingsDropdown}
                            style={`top:${settingsTop}px;left:${settingsLeft}px`}
                            role="dialog"
                            aria-label="Editor settings"
                        >
                            <label for="font-size-select">Font size</label>
                            <select id="font-size-select" bind:value={fontSize}>
                                {#each fontSizes as size}
                                    <option value={size}>{size}px</option>
                                {/each}
                            </select>
                            <label for="theme-select">Theme</label>
                            <select id="theme-select" bind:value={theme}>
                                <option value="dark">Dark</option>
                                <option value="light">Light</option>
                            </select>
                            <label for="vim-mode-select">Key Bindings</label>
                            <select id="vim-mode-select" bind:value={vimMode}>
                                <option value="off">Standard</option>
                                <option value="on">Vim</option>
                            </select>
                            {#if isCodeGate}
                                <div class="settings-divider"></div>
                                <div class="settings-section-title">Local AI helper</div>
                                <label class="startup-event-option">
                                    <input
                                        type="checkbox"
                                        checked={$userSettingsStorage.aiEnabled}
                                        disabled={aiSettingsBusy}
                                        on:change={(event) => void setAiEnabled(event.currentTarget.checked)}
                                    />
                                    Enable the AI model
                                </label>
                                <div class="settings-note">Enabling downloads about 2–3 GB and turns on Docker Model Runner.</div>
                                {#if aiSettingsBusy || aiSettingsStatus}
                                    <pre class="settings-ai-status">{aiSettingsStatus || 'Preparing local AI…'}</pre>
                                {/if}
                                {#if aiSettingsError}<div class="settings-error">{aiSettingsError}</div>{/if}
                            {/if}
                            {#if hasDesktopStartupControls}
                                <div class="settings-divider"></div>
                                <div class="settings-section-title">Open CodeGate when Windows:</div>
                                {#if startupEvents}
                                    <label class="startup-event-option">
                                        <input type="checkbox" checked={startupEvents.logon} disabled={startupEventsBusy} on:change={(event) => updateStartupEvent('logon', event.currentTarget.checked)} />
                                        Signs in
                                    </label>
                                    <label class="startup-event-option">
                                        <input type="checkbox" checked={startupEvents.unlock} disabled={startupEventsBusy} on:change={(event) => updateStartupEvent('unlock', event.currentTarget.checked)} />
                                        Unlocks
                                    </label>
                                    <label class="startup-event-option">
                                        <input type="checkbox" checked={startupEvents.resume} disabled={startupEventsBusy} on:change={(event) => updateStartupEvent('resume', event.currentTarget.checked)} />
                                        Resumes from sleep
                                    </label>
                                {:else if startupEventsBusy}
                                    <div class="settings-note">Loading startup settings…</div>
                                {:else}
                                    <button class="btn" on:click={loadStartupEvents}>Retry</button>
                                {/if}
                                {#if startupEventsError}<div class="settings-error">{startupEventsError}</div>{/if}
                            {/if}
                        </div>
                    {/if}
                </div>
                <div style="font-size:0.85rem;color:var(--color-text-secondary);">{codegateWorkspaceTab === 'ai-drill' ? activeWorkspaceLanguage.toUpperCase() : imageName || activeWorkspaceLanguage.toUpperCase()}</div>
            </div>
        </div>

        {#if !isCodeGate || codegateWorkspaceTab === 'editor' || (codegateWorkspaceTab === 'ai-drill' && (syntaxDrill || syntaxDrillState === 'loading'))}
        <div class="editor-container">
            {#if CodeEditor}
                <svelte:component 
                    this={CodeEditor} 
                    bind:this={editorComponent}
                    bind:value={code} 
                    language={activeWorkspaceLanguage}
                    {fontSize} 
                    {theme} 
                    {vimMode} 
                    viewState={currentViewState}
                    enableAiExplain={isCodeGate && $userSettingsStorage.aiEnabled && !aiSettingsBusy}
                    on:explainSelection={explainSelection}
                />
            {:else}
                Loading...
            {/if}
        </div>
        <ExecutionPanel
            bind:this={executionPanelComponent}
            problem={activeWorkspaceProblem}
            {code}
            language={activeWorkspaceLanguage}
            gameMode={isGameMode}
            gameStartTime={gameStartTime}
            gateBinding={activeGateBinding}
            syntaxDrillBinding={activeSyntaxDrillBinding}
            on:gateReleased={handleGateReleased}
            on:gameSubmitSuccess={(e) => {
                const { runCount, submitCount, timeSpent } = e.detail;
                const result = computeGameResult(runCount, submitCount, timeSpent, code, language);
                gameResultsStore.update((prev) => ({
                    ...prev,
                    [problemId]: [...(prev[problemId] || []), result],
                }));
                gameResultStats = { runCount, submitCount, timeSpent };
                showGameResult = true;
            }}
        />
        {:else if codegateWorkspaceTab === 'ai-drill'}
            <section class="syntax-drill-editor-empty" aria-live="polite">
                <span class="workspace-tab-star" aria-hidden="true">✦</span>
                <p>{syntaxDrillStatus || 'Open the local AI helper to create a syntax drill.'}</p>
            </section>
        {:else}
            <section class="problem-catalog-pane" aria-label="Problem catalogue">
                <div class="problem-catalog-heading">
                    <div>
                        <h2>Problem catalogue</h2>
                        <p>Choose a problem matching the active language and filters.</p>
                    </div>
                </div>
                <input
                    class="problem-catalog-search"
                    type="search"
                    placeholder="Search number or title"
                    aria-label="Search problem catalogue"
                    bind:value={problemCatalogSearch}
                />
                {#if problemCatalogLoading}
                    <div class="problem-catalog-message">Loading catalogue…</div>
                {:else if problemCatalogError}
                    <div class="problem-catalog-message error">{problemCatalogError}</div>
                {:else}
                    <div class="problem-catalog-count">{visibleProblemCatalog.length} of {problemCatalog.length} problems</div>
                    <div class="problem-catalog-list">
                        {#each visibleProblemCatalog as entry}
                            <button
                                type="button"
                                class:current={entry.problemId === problemId}
                                disabled={entry.problemId === problemId || gateActionPending}
                                on:click={() => selectCatalogProblem(entry)}
                            >
                                <span>#{entry.number} {entry.title}</span>
                                <small class="badge {getDifficultyClass(entry.leetcodeDifficulty)}">{entry.leetcodeDifficulty}</small>
                            </button>
                        {/each}
                        {#if visibleProblemCatalog.length === 0}
                            <div class="problem-catalog-message">No matching problems</div>
                        {/if}
                    </div>
                {/if}
            </section>
        {/if}
    </div>

    {#if showShareModal}
        <ShareModal 
            url={shareUrl} 
            {qrCodeDataUrl} 
            {code}
            on:close={() => showShareModal = false} 
        />
    {/if}

    {#if showGameStartPopup}
        <GameModePopup
            currentProblemId={problemId}
            on:close={() => showGameStartPopup = false}
        />
    {/if}

    {#if showGameResult && gameResultStats}
        <GameResultPopup
            runCount={gameResultStats.runCount}
            submitCount={gameResultStats.submitCount}
            timeSpent={gameResultStats.timeSpent}
        />
    {/if}

    {#if showGameHistory}
        <GameHistoryPopup
            problemTitle={data.problem.title}
            results={$gameResultsStore?.[problemId] || []}
            on:close={() => showGameHistory = false}
        />
    {/if}
</div>

<style>
    .workspace {
        display: grid;
        gap: var(--spacing-1);
        height: 100vh;
        padding: var(--spacing-3);
        background-color: var(--color-bg); /* Use the main background */
    }

    .problem-pane, .editor-pane {
        background-color: var(--color-surface); /* Floating surface */
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-lg);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .hide {
        opacity: 0;
    }

    .problem-pane {
        padding: var(--spacing-4);
        overflow: auto;
    }

    .codegate-problem-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--spacing-2);
        margin-bottom: var(--spacing-3);
    }
    .codegate-problem-actions .btn {
        padding: 7px 11px;
        border-color: var(--color-border);
        background: var(--color-bg);
        color: var(--color-text);
        box-shadow: 0 1px 3px rgba(0,0,0,0.16);
    }
    .codegate-problem-actions .btn:hover:not(:disabled) {
        border-color: var(--color-border-active);
        background: color-mix(in srgb, var(--color-bg) 88%, white);
    }
    .codegate-problem-actions .btn:disabled {
        opacity: 0.6;
        cursor: default;
    }
    .problem-catalog-pane {
        display: grid;
        grid-template-rows: auto auto auto minmax(0, 1fr);
        gap: var(--spacing-3);
        flex: 1;
        min-height: 0;
        padding: var(--spacing-4);
        overflow: hidden;
    }
    .problem-catalog-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--spacing-3);
    }
    .problem-catalog-heading h2 {
        margin: 0;
    }
    .problem-catalog-heading p {
        margin: var(--spacing-1) 0 0;
        color: var(--color-text-secondary);
        font-size: 0.85rem;
    }

    .codegate-workspace-tabs {
        display: flex;
        gap: 6px;
        padding: 8px 10px;
        border-bottom: 1px solid var(--color-border);
        background: color-mix(in srgb, var(--color-surface) 88%, var(--color-bg));
    }
    .codegate-workspace-tabs button {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 7px 12px;
        border: 1px solid transparent;
        border-radius: 8px;
        background: transparent;
        color: var(--color-text-secondary);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
    }
    .codegate-workspace-tabs button:hover {
        background: rgba(255,255,255,0.04);
        color: var(--color-text);
    }
    .codegate-workspace-tabs button.active {
        border-color: var(--color-border-active);
        background: rgba(255,255,255,0.07);
        color: var(--color-text);
        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
    }
    .workspace-tab-icon {
        display: block;
        width: 18px;
        height: 18px;
        flex: 0 0 18px;
        color: var(--color-text);
        opacity: 0.9;
    }
    .workspace-tab-star {
        display: inline-grid;
        place-items: center;
        width: 18px;
        height: 18px;
        flex: 0 0 18px;
        font-size: 15px;
        line-height: 1;
    }
    .codegate-workspace-tabs button.active .workspace-tab-icon {
        color: var(--color-border-active);
        opacity: 1;
    }
    .syntax-drill-empty {
        display: grid;
        justify-items: start;
        gap: var(--spacing-3);
        padding: var(--spacing-4) 0;
    }
    .syntax-drill-empty h1,
    .syntax-drill-empty p {
        margin: 0;
    }
    .syntax-drill-empty p {
        color: var(--color-text-secondary);
    }
    .syntax-drill-editor-empty {
        flex: 1;
        display: grid;
        place-content: center;
        justify-items: center;
        gap: var(--spacing-2);
        color: var(--color-text-secondary);
        text-align: center;
        padding: var(--spacing-5);
    }
    .syntax-drill-editor-empty .workspace-tab-star {
        width: 28px;
        height: 28px;
        font-size: 24px;
    }

    /* Prose styling for the dark theme */
    .prose h1 { font-size: 1.75rem; margin-bottom: var(--spacing-3); }
    .title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-2);
    }
    .title-row h1 {
        margin: 0 0 var(--spacing-3) 0;
        flex: 1 1 auto;
        min-width: 0;
    }
    
    .back-button {
        border: 0;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: transparent;
        color: var(--color-text-secondary);
        text-decoration: none;
        transition: background-color 0.12s ease, color 0.12s ease;
    }

    .back-button:hover {
        background-color: rgba(255,255,255,0.03);
        color: var(--color-text);
    }
    .pane-toggle { margin-left: 4px; }
    
    /* Right Pane Layout */
    .editor-pane {
        padding: 0; /* No padding on the pane itself */
    }

    .editor-container {
        flex-grow: 1;
        min-height: 0;
        padding: var(--spacing-1); /* Padding around the editor */
        display: flex;
        flex-direction: column;
    }

    /* --- Browser-like Tabs --- */
    .tab-bar {
        display: flex;
        align-items: flex-end;
        gap: 6px;
        padding: 0 var(--spacing-1) var(--spacing-1) var(--spacing-1);
        overflow-x: auto;
        scrollbar-width: thin;
        flex: 1;
        min-width: 0;
        flex-wrap: nowrap;
    }
    /* Compact the tab bar when shown inside the header */
    .editor-header .tab-bar {
        padding: 0;
    }
    .tab-add {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 1px solid var(--color-border);
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        margin-left: 4px;
        flex-shrink: 0;
    }
    .tab-add:hover {
        background: rgba(255,255,255,0.06);
        color: var(--color-text);
    }
    .tab {
        display: inline-flex;
        align-items: center;
        padding: 6px 10px;
        border: 1px solid var(--color-border);
        background: rgba(255,255,255,0.02);
        color: var(--color-text);
        border-radius: 10px 10px 0 0;
        font-size: 0.85rem;
        line-height: 1;
        user-select: none;
    }
    .tab.active {
        background-color: var(--color-surface);
        border-bottom-color: var(--color-highlight);
        box-shadow: 0 -1px 0 var(--color-surface), 0 1px 0 var(--color-surface);
    }
    .tab-favicon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border-radius: 4px;
        font-weight: 700;
        font-size: 0.7rem;
        color: var(--color-primary-text);
        background: var(--color-border-active);
    }
    .tab-title {
        white-space: nowrap;
        max-width: 24ch;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .tab:hover {
        background: rgba(255,255,255,0.06);
        color: var(--color-text);
        cursor: pointer;
    }

    .tab-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 4px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        line-height: 1;
        font-size: 12px;
        padding: 0;
        visibility: hidden;
        opacity: 0;
        transition: opacity 0.12s ease-in-out;
    }
    .tab-close:hover {
        background: rgba(255,255,255,0.06);
        color: var(--color-text);
    }

    .tab-rename {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin-left: 4px;
        border-radius: 4px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        line-height: 1;
        font-size: 12px;
        padding: 0;
        visibility: hidden;
        opacity: 0;
        transition: opacity 0.12s ease-in-out;
    }
    .tab-rename:hover {
        background: rgba(255,255,255,0.06);
        color: var(--color-text);
    }

    .tab:hover .tab-rename,
    .tab:hover .tab-close,
    .tab.active .tab-rename,
    .tab.active .tab-close {
        visibility: visible;
        opacity: 1;
    }

    .tab-rename-input {
        background: rgba(0,0,0,0.2);
        border: 1px solid var(--color-border);
        color: var(--color-text);
        border-radius: 4px;
        padding: 2px 4px;
        font-size: 0.85rem;
        max-width: 18ch;
    }

    .badge {
        display: inline-block;
        padding: var(--spacing-1) var(--spacing-2);
        font-size: 0.8rem;
        font-weight: 700;
        line-height: 1;
        border-radius: 999px; /* Pill shape */
        color: var(--color-primary-text);
    }

    .difficulty-easy { background-color: var(--color-easy); }
    .difficulty-medium { background-color: var(--color-medium); }
    .difficulty-hard { background-color: var(--color-hard); color: #fff; }

    .solved-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: var(--spacing-1) var(--spacing-2);
        font-size: 0.8rem;
        font-weight: 700;
        line-height: 1;
        border-radius: 999px;
        background-color: var(--color-easy);
        color: var(--color-primary-text);
        margin-left: var(--spacing-1);
        margin-bottom: var(--spacing-2);
        flex: 0 0 auto;
    }

    .game-rank-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        font-size: 0.7rem;
        font-weight: 800;
        color: #fff;
        border: none;
        cursor: pointer;
        margin-left: 6px;
        margin-bottom: var(--spacing-2);
        vertical-align: middle;
        transition: transform 0.15s, box-shadow 0.15s;
        line-height: 1;
        padding: 0;
    }
    .game-rank-badge:hover {
        transform: scale(1.2);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .game-rank-badge.rank-s {
        background: linear-gradient(135deg, #ffd700, #f59e0b);
    }
    .game-rank-badge.rank-a {
        background: linear-gradient(135deg, #34d399, #059669);
    }
    .game-rank-badge.rank-b {
        background: linear-gradient(135deg, #60a5fa, #2563eb);
    }
    .game-rank-badge.rank-c {
        background: linear-gradient(135deg, #9ca3af, #4b5563);
    }

    .external-link {
        color: var(--color-text-secondary);
        font-size: 0.8em;
        margin-left: var(--spacing-1);
    }

    .resizer {
        width: 10px; /* The clickable area is still 10px wide */
        cursor: col-resize;
        position: relative;
        background-color: transparent; /* Make the bar itself invisible */
        appearance: none;
        border: none;
        padding: 0;
        margin: 0;
    }

    /* This is the small, darker "grip" indicator */
    .resizer::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 4px;
        height: 32px;
        border-radius: 4px;
        transition: background-color 0.2s ease-in-out;
    }

    /* On hover, we make the grip indicator more prominent */
    .resizer:hover::before {
        background-color: #b0b0b0; /* A darker grey for emphasis */
    }

    /* Example block styling */
    .example {
        margin-top: var(--spacing-4);
        background-color: rgba(255,255,255,0.02);
        padding: var(--spacing-3);
        border-radius: var(--border-radius-md);
    }

    .example pre {
        background: var(--color-second-bg);
        color: var(--color-text);
        padding: var(--spacing-2);
        border-radius: 6px;
        overflow: auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace;
        font-size: 0.9rem;
        margin: var(--spacing-2) 0;
    }

    .example-input::before { content: 'Input: '; font-weight: 700; }
    .example-output::before { content: 'Output: '; font-weight: 700; }

    /* Small, subtle icon button */
    .icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        background: transparent;
        color: var(--color-text-secondary);
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
    }

    .icon-button:hover {
        transform: translateY(-2px);
    }

    .game-start-btn:hover {
        color: var(--color-text);
        background: rgba(255, 255, 255, 0.05);
    }

    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: grid;
        place-items: center;
        z-index: 50;
    }
    .modal {
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-lg);
        width: min(420px, calc(100vw - 32px));
        box-shadow: 0 16px 48px rgba(0,0,0,0.4);
        overflow: hidden;
    }
    .modal-body {
        display: grid;
        gap: 8px;
        padding: 16px;
    }
    .modal-label {
        font-size: 0.85rem;
        color: var(--color-text-secondary);
    }
    .modal-input {
        background: transparent;
        color: var(--color-text);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: 6px 8px;
        font-family: inherit;
    }
    .modal-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        padding: 12px 16px 16px;
    }
    .btn {
        padding: 6px 10px;
        border-radius: 6px;
        border: 1px solid var(--color-border);
        background: transparent;
        color: var(--color-text);
        cursor: pointer;
        font: inherit;
    }
    .btn.primary {
        border-color: var(--color-border-active);
        background: rgba(255,255,255,0.06);
    }

    /* Settings dropdown */
    .settings-wrapper {
        position: relative;
        display: inline-block;
    }
    .settings-dropdown {
        position: fixed;
        border: 1px solid var(--color-border);
        background-color: var(--color-bg);
        border-radius: var(--border-radius-md);
        padding: var(--spacing-2);
        box-shadow: 0 8px 24px rgba(0,0,0,0.25);
        z-index: 1000;
        min-width: 220px;
        max-width: calc(100vw - 16px);
        max-height: calc(100vh - 16px);
        overflow-y: auto;
        box-sizing: border-box;
        display: grid;
        gap: var(--spacing-1);
    }
    .settings-dropdown label {
        font-size: 0.85rem;
        color: var(--color-text-secondary);
    }
    .settings-dropdown select, #language-select, #difficulty-select, .leetcode-filter-trigger {
        background: var(--color-bg);
        color: var(--color-text);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: 6px 28px 6px 8px;
        font-family: inherit;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 8px center;
    }
    .leetcode-filter {
        position: relative;
    }
    .leetcode-filter-trigger {
        min-width: 72px;
        text-align: left;
        white-space: nowrap;
        cursor: pointer;
    }
    .leetcode-filter-trigger:disabled {
        cursor: default;
        opacity: 0.6;
    }
    .leetcode-filter-menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        z-index: 1100;
        min-width: 130px;
        padding: 8px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-bg);
        box-shadow: 0 8px 24px rgba(0,0,0,0.25);
        display: grid;
        gap: 8px;
    }
    .leetcode-filter-menu label {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--color-text);
        cursor: pointer;
        white-space: nowrap;
    }
    .problem-number-menu {
        min-width: 210px;
    }
    .problem-number-field {
        display: grid;
        grid-template-columns: 1fr 90px;
        align-items: center;
        gap: 10px;
    }
    .problem-number-field input {
        min-width: 0;
        width: 90px;
        box-sizing: border-box;
        padding: 5px 7px;
        border: 1px solid var(--color-border);
        border-radius: 5px;
        background: var(--color-bg);
        color: var(--color-text);
        font: inherit;
    }
    .problem-number-clear {
        padding: 5px 7px;
        border: 1px solid var(--color-border);
        border-radius: 5px;
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
    }
    .problem-catalog-search {
        width: 100%;
        box-sizing: border-box;
        padding: 7px 9px;
        border: 1px solid var(--color-border);
        border-radius: 5px;
        background: var(--color-bg);
        color: var(--color-text);
        font: inherit;
    }
    .problem-catalog-count, .problem-catalog-message {
        color: var(--color-text-secondary);
        font-size: 0.8rem;
    }
    .problem-catalog-message {
        padding: 8px;
        text-align: center;
    }
    .problem-catalog-message.error {
        color: var(--color-error, #ef4444);
    }
    .problem-catalog-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
        align-content: start;
        gap: 6px;
        min-height: 0;
        overflow-y: auto;
    }
    .problem-catalog-list button {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 11px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background: rgba(255,255,255,0.015);
        color: var(--color-text);
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .problem-catalog-list button:hover:not(:disabled) {
        border-color: var(--color-border-active);
        background: rgba(255,255,255,0.05);
    }
    .problem-catalog-list button.current {
        color: var(--color-text-secondary);
        cursor: default;
    }
    .problem-catalog-list button span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .problem-catalog-list button small {
        flex: 0 0 auto;
    }

    /* Hints section */
    .hint-item {
        margin-top: var(--spacing-3);
        background-color: rgba(255,255,255,0.02);
        border-radius: var(--border-radius-md);
        overflow: hidden;
    }
    .hint-header {
        width: 100%;
        background: transparent;
        color: var(--color-text);
        text-align: left;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-2);
        padding: var(--spacing-2) var(--spacing-3);
        border: none;
        cursor: pointer;
        font-weight: 700;
    }
    .hint-header.unsolved {
        opacity: 0.5;
    }
    .chevron {
        font-size: 1rem;
        opacity: 0.8;
    }
    .hint-body {
        padding: 0 var(--spacing-3) var(--spacing-3);
    }
    .ai-hint-item {
        border: 1px solid color-mix(in srgb, var(--color-border-active) 55%, transparent);
    }
    .ai-hint-body {
        white-space: pre-wrap;
        line-height: 1.5;
    }
    .ai-hint-body .btn {
        display: block;
        margin-top: var(--spacing-2);
    }

    .lang-dropdown-tabs-container {
        display: flex;
        gap: var(--spacing-2);
        flex: 1;
        min-width: 0;
    }
    .settings-divider {
        border-top: 1px solid var(--color-border);
        margin: var(--spacing-1) 0;
    }
    .settings-section-title {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--color-text);
    }
    .settings-dropdown .startup-event-option {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--color-text);
        cursor: pointer;
    }
    .settings-note {
        font-size: 0.8rem;
        color: var(--color-text-secondary);
    }
    .settings-error {
        max-width: 260px;
        font-size: 0.78rem;
        color: var(--color-error, #ef4444);
    }
    .settings-ai-status {
        max-width: 280px;
        max-height: 110px;
        overflow: auto;
        margin: 0;
        padding: 6px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        white-space: pre-wrap;
        font-size: 0.72rem;
        color: var(--color-text-secondary);
    }
    .editor-header.codegate-header > .lang-dropdown-tabs-container {
        flex-basis: 100%;
    }
    
    .tabs-container {
        display: flex;
        gap: var(--spacing-2);
        align-items: center;
        flex: 1;
        min-width: 0;
    }
</style>
