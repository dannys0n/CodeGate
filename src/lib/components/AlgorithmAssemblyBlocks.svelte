<script lang="ts">
    import type { AlgorithmAssemblyLesson, AlgorithmAssemblySession } from '$lib/codegate/algorithm-assembly';

    export let lesson: AlgorithmAssemblyLesson;
    export let session: AlgorithmAssemblySession;

    $: placed = new Set($session.assembly.slots.filter((blockId): blockId is string => Boolean(blockId)));
    $: blockById = new Map(lesson.blocks.map((block) => [block.id, block]));
    $: available = lesson.initialBlockOrder
        .filter((blockId) => !placed.has(blockId))
        .map((blockId) => blockById.get(blockId))
        .filter((block): block is NonNullable<typeof block> => Boolean(block));
</script>

<aside class="blocks-pane" aria-label="Available code blocks">
    <header>
        <div><h2>Available Blocks</h2><p>Select a block to place it in the next empty slot.</p></div>
        <span>{available.length} remaining</span>
    </header>
    <div class="available-blocks">
        {#each available as block}
            <button type="button" on:click={() => session.placeBlock(block.id)} disabled={$session.completed}>
                <pre>{block.displayCode}</pre>
            </button>
        {/each}
        {#if available.length === 0}<p>All blocks are placed. Check the order or remove an unlocked block.</p>{/if}
    </div>
</aside>

<style>
    .blocks-pane { height: 100%; min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: var(--spacing-4); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--border-radius-lg); color: var(--color-text); }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--spacing-3); margin-bottom: var(--spacing-3); }
    h2, p { margin: 0; }
    header p, header > span, .available-blocks > p { color: var(--color-text-secondary); font-size: 0.82rem; }
    header p { margin-top: var(--spacing-1); }
    header > span { flex: 0 0 auto; }
    .available-blocks { display: grid; gap: var(--spacing-2); }
    button { width: 100%; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-bg); color: var(--color-text); padding: var(--spacing-3); cursor: pointer; }
    button:not(:disabled):hover { border-color: var(--color-border-active); background: color-mix(in srgb, var(--color-bg) 92%, white); }
    button:disabled { cursor: default; opacity: 0.65; }
    pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: 0.82rem/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; text-align: left; }
</style>
