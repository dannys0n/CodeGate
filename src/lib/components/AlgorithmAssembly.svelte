<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { AlgorithmAssemblyLesson, AlgorithmAssemblySession } from '$lib/codegate/algorithm-assembly';

    export let lesson: AlgorithmAssemblyLesson;
    export let session: AlgorithmAssemblySession;

    const dispatch = createEventDispatcher<{ complete: { hintsUsed: number } }>();
    $: blockById = new Map(lesson.blocks.map((block) => [block.id, block]));
</script>

<section class="assembly" aria-label="Algorithm assembly">
    <div class="assembly-content">
        <header class="assembly-heading">
        <div><h2>Algorithm Assembly</h2><p>Arrange up to five {lesson.language === 'cpp' ? 'C++' : 'Python'} blocks into a complete solution.</p></div>
        <span class="language-badge">{lesson.language === 'cpp' ? 'C++' : 'Python'}</span>
        </header>

        <div class="solution-frame" aria-label="C++ solution assembly">
            <pre>{lesson.fixedPrefix}</pre>
            <div class="answer-slots">
                {#each $session.assembly.slots as blockId, position}
                    <button type="button" class="answer-slot" class:filled={Boolean(blockId)} class:locked={$session.assembly.lockedPositions.has(position)} disabled={$session.completed || !blockId || $session.assembly.lockedPositions.has(position)} aria-label={blockId ? `Remove block ${position + 1}` : `Empty block ${position + 1}`} on:click={() => session.removeBlock(position)}>
                        <span class="slot-number">{position + 1}</span>
                        {#if blockId && blockById.get(blockId)}
                            <pre>{blockById.get(blockId)!.code}</pre>
                            {#if $session.assembly.lockedPositions.has(position)}<span class="lock-label">Revealed</span>{/if}
                        {:else}<span class="empty-label">Choose a block from the right panel</span>{/if}
                    </button>
                {/each}
            </div>
            <pre>{lesson.fixedSuffix}</pre>
        </div>
    </div>

    <footer class="assembly-actions">
        <div class="assembly-status" class:error={$session.statusKind === 'error'} class:success={$session.statusKind === 'success'} aria-live="polite">{$session.status}</div>
        <div class="action-buttons">
            <button type="button" class="btn" on:click={session.reset}>Reset</button>
            <button type="button" class="btn" on:click={session.revealNextBlock} disabled={$session.completed}>Reveal Next Block</button>
            {#if $session.completed}
                <button type="button" class="btn btn-primary" on:click={() => dispatch('complete', { hintsUsed: $session.hintsUsed })}>Complete Gate</button>
            {:else}<button type="button" class="btn btn-primary" on:click={session.checkOrder}>Check</button>{/if}
        </div>
    </footer>
</section>

<style>
    .assembly { flex: 1 1 0; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; display: grid; grid-template-rows: minmax(0, 1fr) auto; color: var(--color-text); }
    .assembly-content { min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding: var(--spacing-4); display: grid; grid-auto-rows: max-content; align-content: start; gap: var(--spacing-4); }
    .assembly-heading, .assembly-actions { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-3); }
    h2, p { margin: 0; }
    .assembly-heading p { margin-top: var(--spacing-1); color: var(--color-text-secondary); font-size: 0.85rem; }
    .language-badge { padding: 5px 9px; border: 1px solid var(--color-border-active); border-radius: 999px; color: var(--color-text); font-weight: 700; font-size: 0.8rem; }
    .solution-frame { min-width: 0; border: 1px solid var(--color-border); border-radius: var(--border-radius-md); background: var(--color-bg); overflow: hidden; }
    pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: 0.82rem/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; text-align: left; }
    .solution-frame > pre { padding: var(--spacing-3); }
    .answer-slots { display: grid; gap: 6px; padding: 0 var(--spacing-3); }
    .answer-slot { position: relative; width: 100%; border: 1px solid var(--color-border); border-radius: 8px; background: rgba(255,255,255,0.025); color: var(--color-text); padding: var(--spacing-3); cursor: pointer; }
    .answer-slot:not(:disabled):hover { border-color: var(--color-border-active); background: rgba(255,255,255,0.055); }
    .answer-slot:disabled { cursor: default; }
    .answer-slot.locked { border-color: var(--color-border-active); background: color-mix(in srgb, var(--color-bg) 88%, var(--color-border-active)); }
    .slot-number { position: absolute; top: 6px; right: 8px; color: var(--color-text-secondary); font-size: 0.72rem; font-weight: 800; }
    .empty-label { display: block; padding: var(--spacing-2); color: var(--color-text-secondary); text-align: center; font-size: 0.84rem; }
    .lock-label { display: block; margin-top: var(--spacing-2); color: var(--color-text-secondary); font-size: 0.72rem; font-weight: 700; text-align: right; }
    .assembly-actions { flex: 0 0 auto; display: flex; justify-content: flex-end; align-items: center; gap: var(--spacing-3); padding: var(--spacing-2) var(--spacing-3); background: var(--color-surface); border-top: 1px solid var(--color-border); flex-wrap: wrap; }
    .assembly-status { margin-right: auto; color: var(--color-text-secondary); font-size: 0.85rem; }
    .assembly-status.error { color: var(--color-error, #ef4444); }
    .assembly-status.success { color: var(--color-easy, #22c55e); }
    .action-buttons { display: flex; flex-wrap: wrap; gap: var(--spacing-2); }
    .btn { display: inline-flex; align-items: center; padding: var(--spacing-2) var(--spacing-4); border: none; background-color: var(--color-surface-hover); color: var(--color-text-primary); border-radius: var(--border-radius-sm); font: inherit; font-weight: 600; cursor: pointer; transition: all 0.2s ease-in-out; }
    .btn:hover { transform: translateY(-2px); }
    .btn:active { transform: translateY(-1px); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .btn-primary { background-color: var(--color-primary); color: var(--color-primary-text); }
</style>
