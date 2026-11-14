<script lang="ts">
  import { addDays, ALL, at, dayName, fmt, hours, istDay, kind, label, type Category, type Ev } from './lib/cal';
  import { events, fail, pb, toEv } from './lib/pb.svelte';

  /** Called with the saved event, or with no event after a delete. */
  let { onchange }: { onchange: (id: string, row?: Ev) => void } = $props();

  let dialog: HTMLDialogElement;
  let ev = $state<Ev | null>(null);
  let editing = $state(false);
  let busy = $state(false);

  function blank(day: string, h = +hm(new Date()).slice(0, 2) % 24) {
    const start = `${String(h).padStart(2, '0')}:00`, end = h < 23 ? `${String(h + 1).padStart(2, '0')}:00` : '23:59';
    return { title: '', category: 'other_event' as Category, day, start, end, allDay: false, place: '', course: '', link: '', cancelled: false };
  }
  const hm = (d: Date | string) => fmt(d, { hour: '2-digit', minute: '2-digit', hour12: false });
  let f = $state(blank(istDay(new Date())));
  // The date and times as opened, so an edit that leaves them alone never rewrites start and end.
  const when = () => JSON.stringify([f.day, f.allDay, f.start, f.end]);
  let opened = '';

  /** Shows an event, or the empty form for a new one on `day`, starting at hour `h` (default: this hour). */
  export function open(e: Ev | null, day = istDay(new Date()), h?: number) {
    ev = e;
    editing = !e;
    f = e
      ? { title: e.title, category: e.category, day: istDay(e.start), start: e.allDay ? '09:00' : hm(e.start), end: e.end && !e.allDay ? hm(e.end) : '',
          allDay: e.allDay, place: e.place ?? '', course: e.course ?? '', link: e.link ?? '', cancelled: e.cancelled }
      : blank(day, h);
    opened = when();
    dialog.showModal();
  }

  async function save(submit: SubmitEvent) {
    submit.preventDefault();
    busy = true;
    const data: Record<string, unknown> = {
      title: f.title.trim(), category: f.category, place: f.place.trim(), course: f.course.trim(), link: f.link.trim(), allDay: f.allDay, cancelled: f.cancelled,
    };
    if (!ev || when() !== opened) {
      data.start = at(f.day, f.allDay ? '00:00' : f.start);
      // An end before the start runs past midnight ("10 PM to 1 AM").
      data.end = !f.allDay && f.end ? at(f.end < f.start ? addDays(f.day, 1) : f.day, f.end) : '';
    }
    try {
      const row = toEv(ev ? await events.update(ev.id, data) : await events.create({ ...data, user: pb.authStore.record!.id, audience: 'me', manual: true }));
      onchange(row.id, row);
      dialog.close();
    } catch (err) {
      fail(err);
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!ev) return;
    busy = true;
    // Already gone (404) counts as deleted.
    const failed = await events.delete(ev.id).then(() => false, (err) => err.status !== 404 && (fail(err, 'Could not delete this event. Try again.'), true));
    busy = false;
    if (failed) return;
    onchange(ev.id);
    dialog.close();
  }
</script>

<dialog bind:this={dialog} closedby="any" aria-labelledby="ev-title" data-k={kind(f.category)}>
  {#if editing}
    <form class="body" onsubmit={save}>
      <h2 id="ev-title">{ev ? 'Edit event' : 'New event'}</h2>
      <label class="wide">
        <span>Title</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input bind:value={f.title} required maxlength="200" autofocus placeholder="Quiz III" />
      </label>
      <label>
        <span>Category</span>
        <select bind:value={f.category}>
          {#each ALL as c (c)}<option value={c}>{label(c)}</option>{/each}
        </select>
      </label>
      <label>
        <span>Course</span>
        <input bind:value={f.course} maxlength="32" placeholder="MATH F212" />
      </label>
      <label>
        <span>Date</span>
        <input type="date" bind:value={f.day} required />
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={f.allDay} />
        <span>All day</span>
      </label>
      {#if !f.allDay}
        <label>
          <span>Starts</span>
          <input type="time" bind:value={f.start} required />
        </label>
        <label>
          <span>Ends</span>
          <input type="time" bind:value={f.end} />
        </label>
      {/if}
      <label class="wide">
        <span>Place</span>
        <input bind:value={f.place} maxlength="200" placeholder="1227" />
      </label>
      <label class="wide">
        <span>Link</span>
        <input type="url" bind:value={f.link} maxlength="500" pattern="https?://.+" placeholder="https://meet.google.com/*" />
      </label>
      {#if ev}
        <label class="check wide">
          <input type="checkbox" bind:checked={f.cancelled} />
          <span>Cancelled</span>
        </label>
      {/if}
      <div class="actions wide">
        <button class="btn solid" disabled={busy} aria-busy={busy || undefined}>{ev ? 'Save changes' : 'Add event'}</button>
        <button type="button" class="btn" onclick={() => (ev ? (editing = false) : dialog.close())}>Cancel</button>
      </div>
    </form>
  {:else if ev}
    <div class="body">
      <button class="btn icon close" onclick={() => dialog.close()} aria-label="Close">×</button>
      <p class="kind">
        <span class="tag">{label(ev.category)}</span>
        {#if ev.course}<span>{ev.course}</span>{/if}
        {#if ev.cancelled}<span class="flag">Cancelled</span>{/if}
      </p>
      <h2 id="ev-title" class:struck={ev.cancelled}>{ev.title}</h2>
      <dl>
        <dt>Date</dt><dd>{dayName(istDay(ev.start), { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
        <dt>Day</dt><dd>{dayName(istDay(ev.start), { weekday: 'long' })}</dd>
        <dt>Time</dt><dd>{hours(ev, ' – ')}</dd>
        {#if ev.place}<dt>Where</dt><dd>{ev.place}</dd>{/if}
        {#if ev.link}<dt>Link</dt><dd><a href={ev.link} target="_blank" rel="noopener">{new URL(ev.link).host}</a></dd>{/if}
      </dl>
      <div class="actions">
        <button class="btn solid" onclick={() => (editing = true)}>Edit</button>
        <button class="btn danger" onclick={remove} disabled={busy} aria-busy={busy || undefined}>Delete</button>
      </div>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    width: min(30rem, calc(100vw - 2rem));
    margin: auto;
    border-radius: 14px;
    overflow: hidden;
  }

  /* Phones: a bottom sheet that slides up from the thumb's edge. */
  @media (max-width: 760px) {
    dialog {
      width: 100%;
      max-width: 100%;
      max-height: 92dvh;
      margin: auto 0 0;
      overflow-y: auto;
      border-radius: 16px 16px 0 0;
      transform: translateY(100%);
    }
    dialog[open] { transform: none; }
    @starting-style {
      dialog[open] { transform: translateY(100%); }
    }
    dialog .body { padding-bottom: max(1.25rem, env(safe-area-inset-bottom)); }
  }

  .body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem 1rem;
    padding: 1.375rem 1.5rem 1.25rem 1.75rem;
    border-left: 5px solid var(--k);
    transition: border-color 200ms;
  }
  div.body { display: block; position: relative; }
  .close { position: absolute; top: 0.875rem; right: 0.875rem; border-color: transparent; color: var(--soft); }
  .close:hover { color: var(--ink); }

  h2 {
    grid-column: 1 / -1;
    margin: 0 0 0.25rem;
    font-size: 1.5rem;
    font-weight: 750;
    font-stretch: 108%;
    line-height: 1.15;
    letter-spacing: -0.01em;
  }
  .struck { text-decoration: line-through; text-decoration-thickness: 2px; }
  .wide { grid-column: 1 / -1; }

  label { display: grid; gap: 0.25rem; min-width: 0; }
  label span { color: var(--soft); font-size: 0.8125rem; }
  input:not([type='checkbox']), select {
    width: 100%;
    height: 2.375rem;
    padding: 0 0.625rem;
    border: 1px solid var(--rule-strong);
    border-radius: 8px;
    background: var(--paper);
    transition: border-color 150ms, box-shadow 150ms;
  }
  input:focus, select:focus { outline: none; border-color: var(--k); box-shadow: 0 0 0 3px color-mix(in srgb, var(--k) 20%, transparent); }
  input:user-invalid { border-color: var(--danger); }
  .check { display: flex; align-items: center; gap: 0.5rem; align-self: end; height: 2.375rem; }
  .check span { color: var(--ink); font-size: 0.875rem; }
  input[type='checkbox'] { width: 1rem; height: 1rem; margin: 0; accent-color: var(--k); }

  .kind { padding-right: 2.5rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.625rem; margin: 0 0 0.375rem; color: var(--soft); font-size: 0.8125rem; }
  .tag { display: inline-flex; align-items: center; gap: 0.35rem; color: color-mix(in srgb, var(--k) 70%, var(--ink)); font-weight: 600; }
  .tag::before { content: ''; width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--k); }
  .flag { padding: 0 0.4rem; border: 1px solid currentColor; border-radius: 4px; color: var(--danger); font-weight: 600; font-size: 0.75rem; }

  dl { display: grid; grid-template-columns: 4rem 1fr; gap: 0.4rem 1rem; margin: 0.75rem 0 1.125rem; }
  dt { color: var(--soft); font-size: 0.875rem; }
  dd { margin: 0; }

  .actions { display: flex; gap: 0.5rem; padding-top: 0.25rem; }
</style>
