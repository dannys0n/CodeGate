<script lang="ts">
    import { page } from '$app/stores';

    $: accepted = $page.url.searchParams.get('outcome') === 'accepted';
</script>

<svelte:head><title>CodeGate released</title></svelte:head>

<main class="released" data-testid="gate-released">
    <section>
        <p class="eyebrow">CodeGate</p>
        <h1>{accepted ? 'Challenge accepted' : 'Session released'}</h1>
        <p>{accepted ? 'All official tests passed.' : 'You gave up this session.'}</p>
        <a href="/">Continue to CoJudge</a>
    </section>
</main>

<style>
    .released { min-height: 100vh; display: grid; place-items: center; padding: 2rem; background: var(--color-bg); color: var(--color-text); }
    section { width: min(32rem, 100%); padding: 2.5rem; border: 1px solid var(--color-border); border-radius: 1rem; background: var(--color-surface); text-align: center; }
    .eyebrow { text-transform: uppercase; letter-spacing: .14em; color: var(--color-text-secondary); font-size: .75rem; font-weight: 700; }
    h1 { margin: .5rem 0; }
    a { display: inline-block; margin-top: 1rem; padding: .7rem 1rem; border-radius: .5rem; color: var(--color-primary-text); background: var(--color-primary); text-decoration: none; }
</style>
