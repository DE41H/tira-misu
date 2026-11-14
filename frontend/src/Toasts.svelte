<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import { dismiss, toasts } from './lib/pb.svelte';

  // A manual popover sits in the top layer, so slips show above an open event dialog too.
  let stack: HTMLElement;
  let shown = 0;
  // It stays open when empty (an empty list takes no room), so the last slip can animate out.
  $effect(() => {
    const n = toasts.length;
    // Re-open on each new slip to come back above a dialog opened since.
    if (n > shown) {
      stack.hidePopover();
      stack.showPopover();
    }
    shown = n;
  });

  /** Hides a slip after a while; hovering or focusing it holds it. */
  function autohide(node: HTMLElement, id: number) {
    let t: ReturnType<typeof setTimeout>;
    const run = () => {
      clearTimeout(t);
      t = setTimeout(() => dismiss(id), 7000);
    };
    const hold = () => clearTimeout(t);
    const events = [['pointerenter', hold], ['focusin', hold], ['pointerleave', run], ['focusout', run]] as const;
    for (const [e, f] of events) node.addEventListener(e, f);
    run();
    return { destroy: hold };
  }

  const title = (code?: number) => (code === 0 ? 'Offline' : code ? `Error ${code}` : 'Error');
</script>

<ol class="toasts" popover="manual" bind:this={stack} aria-label="Errors">
  {#each toasts as t (t.id)}
    <li role="alert" use:autohide={t.id} animate:flip={{ duration: 200 }} in:fly={{ y: 12, duration: 220 }} out:fly={{ x: 24, duration: 180 }}>
      <strong>{title(t.code)}</strong>
      <p>{t.text}</p>
      <button onclick={() => dismiss(t.id)} aria-label="Dismiss">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3 3 9" /></svg>
      </button>
    </li>
  {/each}
</ol>

<style>
  /* A stack of correction slips pinned to the corner of the page. */
  .toasts {
    inset: auto 1.25rem 1.25rem auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: min(22rem, calc(100vw - 2rem));
    margin: 0;
    padding: 0;
    overflow: visible;
    list-style: none;
    background: none;
    box-shadow: none;
    transform: none;
    opacity: 1;
  }
  li {
    position: relative;
    padding: 0.7rem 2.5rem 0.75rem 1rem;
    border: 1px solid var(--rule-strong);
    border-left: 3px solid var(--danger);
    border-radius: 10px;
    background: var(--raised);
    box-shadow: var(--shadow);
  }
  strong { display: block; color: var(--danger); font-size: 0.8125rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  p { margin: 0.1rem 0 0; font-size: 0.875rem; line-height: 1.4; text-wrap: pretty; }
  button {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--soft);
  }
  button:hover { background: var(--rule); color: var(--ink); }
  svg { width: 0.75rem; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; }
  @media (max-width: 760px) { .toasts { inset: auto 1rem 1rem; width: auto; } }
</style>
