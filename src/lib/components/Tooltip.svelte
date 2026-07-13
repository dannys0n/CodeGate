<script lang='ts'>
  import { onMount, tick } from 'svelte';

  export let text = '';
  export let pos: 'top' | 'bottom' = 'top';
  let show = false;
  let element: HTMLDivElement;
  let tooltip: HTMLDivElement;
  let top = 0;
  let left = 0;

  function updatePosition() {
    if (!show || !element || !tooltip) return;
    const margin = 8;
    const gap = 6;
    const anchor = element.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    const maxLeft = Math.max(margin, window.innerWidth - box.width - margin);
    left = Math.min(maxLeft, Math.max(margin, anchor.left + anchor.width / 2 - box.width / 2));
    const preferredTop = pos === 'top' ? anchor.top - box.height - gap : anchor.bottom + gap;
    const alternateTop = pos === 'top' ? anchor.bottom + gap : anchor.top - box.height - gap;
    top = preferredTop >= margin && preferredTop + box.height <= window.innerHeight - margin
      ? preferredTop
      : Math.min(window.innerHeight - box.height - margin, Math.max(margin, alternateTop));
  }

  async function open() {
    show = true;
    await tick();
    updatePosition();
  }

  function close() {
    show = false;
  }

  onMount(() => {
    element.addEventListener('mouseenter', open);
    element.addEventListener('mouseleave', close);
    element.addEventListener('focusin', open);
    element.addEventListener('focusout', close);
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    return () => {
      element.removeEventListener('mouseenter', open);
      element.removeEventListener('mouseleave', close);
      element.removeEventListener('focusin', open);
      element.removeEventListener('focusout', close);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
    };
  });
</script>

<div class="tooltip-container" bind:this={element}>
  <slot />
  {#if show}
    <div class="tooltip-box" bind:this={tooltip} style={`top:${top}px;left:${left}px`}>{text}</div>
  {/if}
</div>

<style>
  .tooltip-container {
    position: relative;
    display: inline-block;
  }
  .tooltip-box {
    position: fixed;
    background-color: #333;
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    width: max-content;
    white-space: normal;
    max-width: calc(100vw - 16px);
    box-sizing: border-box;
    overflow-wrap: anywhere;
    z-index: 1000;
    pointer-events: none;
  }
</style>
