<script lang="ts">
  import type { ClientResponseError, RecordModel } from 'pocketbase';
  import { tick } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fade } from 'svelte/transition';
  import { SvelteSet } from 'svelte/reactivity';
  import Brand from './Brand.svelte';
  import EventDialog from './EventDialog.svelte';
  import Grid from './Grid.svelte';
  import { addDays, ALL, byStart, dayName, HIDDEN_BY_DEFAULT, hours, istDay, kind, label, monday, overlaps, time, type Category, type Ev } from './lib/cal';
  import { read, write } from './lib/local';
  import { avatar, cacheKey, fail, fetchUpcoming, fetchWeek, pb, refreshUser, signOut } from './lib/pb.svelte';

  let { user }: { user: RecordModel } = $props();
  const iris = import.meta.env.IRIS_URL;
  const face = $derived(avatar(user));

  let now = $state(new Date());
  const today = $derived(istDay(now));
  $effect(() => {
    const t = setInterval(() => (now = new Date()), 60_000);
    return () => clearInterval(t);
  });

  const start = monday(istDay(new Date()));
  let week = $state(start);
  const days = $derived(Array.from({ length: 7 }, (_, i) => addDays(week, i)));
  const thisWeek = $derived(week === monday(today));

  // Last-known weeks and upcoming list, kept between visits: shown at once, then refreshed from the server.
  // svelte-ignore state_referenced_locally (Root remounts App for each student)
  const key = cacheKey(user.id);
  const cached = read<{ weeks: Record<string, Ev[]>; upcoming: Ev[] }>(key, { weeks: {}, upcoming: [] });
  const weeks = new Map(Object.entries(cached.weeks));
  const fresh = new Set<string>(); // weeks already fetched this visit
  let events = $state<Ev[]>([]);
  let upcoming = $state(cached.upcoming);
  let loaded = $state(false);
  const persist = () => write(key, { weeks: Object.fromEntries(weeks), upcoming });

  const hidden = new SvelteSet<Category>(read('hidden', HIDDEN_BY_DEFAULT));
  const shown = $derived(events.filter((e) => !hidden.has(e.category)));
  const families = $derived([...new Set(ALL.filter((c) => !hidden.has(c)).map(kind))]);
  const count = (c: Category) => events.filter((e) => e.category === c).length;
  function toggle(c: Category) {
    if (!hidden.delete(c)) hidden.add(c);
    write('hidden', [...hidden]);
  }

  // Fast clicks start overlapping fetches and transitions; only the last week asked for may land.
  let latest = '';
  // Which button is waiting on the server ('prev', 'next', 'today'), '' when none.
  let busy = $state('');
  // Steps from the last week asked for, so quick clicks add up even before the grid catches up.
  const step = (dir: 1 | -1) => go(addDays(latest || week, dir * 7), dir, dir < 0 ? 'prev' : 'next');

  async function go(target: string, dir = 0, by = '') {
    latest = target;
    const known = weeks.get(target);
    if (known) show(target, known, dir);
    if (fresh.has(target)) return;
    if (!known) {
      busy = by;
      // Held arrow keys or fast clicks fetch only the week they stop on.
      if (dir) {
        await new Promise((r) => setTimeout(r, 250));
        if (latest !== target) return;
      }
    }
    const rows = await fetchWeek(target).catch((err) => (latest === target && fail(err, LOAD_FAILED), null));
    if (rows) {
      fresh.add(target);
      weeks.set(target, rows);
      persist();
    }
    if (latest !== target) return;
    busy = '';
    if (rows) show(target, rows, known ? 0 : dir);
    else loaded = true;
  }

  function show(target: string, rows: Ev[], dir: number) {
    const apply = () => {
      if (latest !== target) return;
      week = target;
      events = rows;
      loaded = true;
    };
    if (!dir || !document.startViewTransition) return apply();
    document.documentElement.style.setProperty('--dir', String(dir));
    document.startViewTransition(async () => { apply(); await tick(); }).ready.catch(() => {});
  }

  async function loadUpcoming() {
    const rows = await fetchUpcoming(today).catch((err) => (fail(err, LOAD_FAILED), null));
    if (!rows) return;
    upcoming = rows;
    persist();
  }

  const LOAD_FAILED = 'Could not load your events. Check your connection and reload.';
  const IRIS_FAILED = 'Could not connect to Iris. Try connecting again.';
  go(start);
  loadUpcoming();

  const range = $derived.by(() => {
    const [a, b] = [days[0], days[6]];
    const year = a.slice(0, 4) !== today.slice(0, 4) ? ` ${b.slice(0, 4)}` : '';
    return a.slice(0, 7) === b.slice(0, 7)
      ? `${+a.slice(8)}–${dayName(b, { day: 'numeric', month: 'long' })}${year}`
      : `${dayName(a, { day: 'numeric', month: 'short' })} – ${dayName(b, { day: 'numeric', month: 'short' })}${year}`;
  });

  // Coming up: everything not over yet, this week and next, whatever week the grid shows.
  const nextWeek = $derived(addDays(monday(today), 7));
  const soon = $derived(upcoming.filter((e) =>
    !hidden.has(e.category) && istDay(e.start) < addDays(nextWeek, 7) && (new Date(e.end ?? e.start) >= now || (e.allDay && istDay(e.start) >= today))));
  const soonLists = $derived([['This week', soon.filter((e) => istDay(e.start) < nextWeek)], ['Next week', soon.filter((e) => istDay(e.start) >= nextWeek)]] as const);

  // Phones see one day at a time.
  let picked = $state<string | null>(null);
  const day = $derived(picked && days.includes(picked) ? picked : thisWeek ? today : days[0]);
  const ofDay = (d: string) => shown.filter((e) => overlaps(e, d));

  let dialog = $state<EventDialog>();
  /** Puts a saved event (or drops a deleted one, row undefined) everywhere it is shown or cached. */
  function change(id: string, row?: Ev) {
    const inWeek = (w: string) => !!row && overlaps(row, w, addDays(w, 6));
    const put = (list: Ev[], keep: boolean) => [...list.filter((e) => e.id !== id), ...(keep ? [row!] : [])].sort(byStart);
    for (const [w, list] of weeks) weeks.set(w, put(list, inWeek(w)));
    events = put(events, inWeek(week));
    upcoming = put(upcoming, !!row);
    persist();
  }

  function keys(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]') || (e.target as Element).closest?.('input, select, textarea')) return;
    if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'n') dialog?.open(null);
  }

  const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  // First click on the avatar flips it to a sign-out face, a second click confirms. It flips back on its own.
  let out = $state(false);
  let outTimer: ReturnType<typeof setTimeout>;
  function avatarClick() {
    if (out) return signOut();
    out = true;
    clearTimeout(outTimer);
    outTimer = setTimeout(() => (out = false), 3000);
  }

  // Sends the student to Iris to accept the plugin; Iris sends them back with ?code=…&status=accepted|denied.
  let connecting = $state(false);
  async function connect() {
    connecting = true;
    const body = await pb.send<{ url?: string; linked?: boolean }>('/api/invite', { method: 'POST' }).catch((err) => (fail(err, IRIS_FAILED), null));
    if (body?.url) return location.assign(body.url);
    connecting = false;
    if (body?.linked) return refreshUser();
    if (body) fail(null, IRIS_FAILED);
  }
  {
    const q = new URLSearchParams(location.search);
    const code = q.get('code');
    if (code) {
      history.replaceState(null, '', location.pathname + location.hash);
      if (q.get('status') === 'accepted') {
        connecting = true;
        pb.send<{ linked: boolean }>(`/api/invite/${encodeURIComponent(code)}`, { method: 'POST' }).then(
          (body) => {
            connecting = false;
            if (body.linked) refreshUser();
            else fail(null, IRIS_FAILED);
          },
          // 400 (not your link) and 409 (Iris account taken) carry a message meant for the student.
          (err: ClientResponseError) => {
            connecting = false;
            fail(err, err.status === 400 || err.status === 409 ? err.response.message : IRIS_FAILED);
          },
        );
      }
    }
  }
</script>

<svelte:window onkeydown={keys} />

<div class="sheet">
  <header class="top">
    <div class="bar">
      <Brand />
      <h1 class="range">{range}</h1>
      <nav class="nav" aria-label="Weeks">
        <button class="btn icon" onclick={() => step(-1)} aria-label="Previous week" title="Previous week (←)" aria-busy={busy === 'prev' || undefined}>‹</button>
        <button class="btn" onclick={() => go(monday(today), week < monday(today) ? 1 : -1, 'today')} disabled={thisWeek} title="This week" aria-busy={busy === 'today' || undefined}>Today</button>
        <button class="btn icon" onclick={() => step(1)} aria-label="Next week" title="Next week (→)" aria-busy={busy === 'next' || undefined}>›</button>
        <button class="btn cats-btn" popovertarget="cats" aria-label="Categories shown: {ALL.length - hidden.size} of {ALL.length}">
          <span class="swatches" aria-hidden="true">{#each families as k (k)}<i data-k={k}></i>{/each}</span>
          <span class="cats-label">Categories</span>
          <span class="n">{ALL.length - hidden.size}/{ALL.length}</span>
          <svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
        </button>
      </nav>
    </div>
    <div class="me">
      {#if user.irisId}
        <a class="btn iris" href={`${iris}/subscriptions/`} target="_blank" rel="noopener" title="Manage your subscription in Iris">
          <span class="label">Connected</span>
          <svg class="tick" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" /></svg>
          <svg class="go" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5" /></svg>
        </a>
      {:else}
        <button class="btn status connect-btn" onclick={connect} disabled={connecting} aria-busy={connecting || undefined}>Connect</button>
      {/if}
      <a class="btn icon gh" href="https://github.com/DE41H/tira-misu" target="_blank" rel="noopener" aria-label="Source on GitHub" title="Source on GitHub">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg>
      </a>
      <button class="avatar" onclick={avatarClick} onblur={() => (out = false)} data-out={out || undefined} 
        aria-label={out ? 'Confirm sign out' : `Sign out ${user.name}`} title={out ? 'Click again to sign out' : `Sign out ${user.email}`}>
        <span class="card">
          <span class="face">{#if face}<img src={face} alt="" />{:else}{initials(user.name || user.email)}{/if}</span>
          <span class="face back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h10" /></svg></span>
        </span>
      </button>
    </div>
  </header>

  <div id="cats" popover>
    <ul>
      {#each ALL as c (c)}
        {@const n = count(c)}
        <li>
          <label data-k={kind(c)}>
            <input type="checkbox" checked={!hidden.has(c)} onchange={() => toggle(c)} />
            <span class="name">{label(c)}</span>
            {#if n}<span class="n">{n}</span>{/if}
          </label>
        </li>
      {/each}
    </ul>
  </div>


  <main class="layout">
    <Grid {days} events={shown} {today} {now} onopen={(e) => dialog?.open(e)} onnew={(d, h) => dialog?.open(null, d, h)} />


    <section class="phone" aria-label="Day">
      <div class="strip">
        {#each days as d (d)}
          <button aria-pressed={d === day} data-today={d === today || undefined} onclick={() => (picked = d)}>
            <span class="dow">{dayName(d, { weekday: 'narrow' })}</span>
            <span class="dnum">{dayName(d, { day: 'numeric' })}</span>
            <span class="dots">{#each ofDay(d).slice(0, 4) as e (e.id)}<i data-k={kind(e.category)}></i>{/each}</span>
          </button>
        {/each}
      </div>
      {#key day}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
        <ul class="list agenda" in:fade={{ duration: 180 }} onclick={(ev) => ev.target === ev.currentTarget && dialog?.open(null, day)}>
          {#each ofDay(day) as e (e.id)}
            <li>
              <button class="row" data-k={kind(e.category)} data-cancelled={e.cancelled || undefined} onclick={() => dialog?.open(e)}>
                <span class="when">{e.allDay ? 'All day' : time(e.start)}</span>
                <span class="what">{e.title}</span>
                {#if e.place || e.course}<span class="where">{[e.course, e.place].filter(Boolean).join(', ')}</span>{/if}
              </button>
            </li>
          {:else}
            <li class="empty">Nothing on {dayName(day, { weekday: 'long' })}.</li>
          {/each}
        </ul>
      {/key}
    </section>
  </main>

    <aside class="side" aria-labelledby="soon-title">
      <h2 id="soon-title">Coming up</h2>
      {#if !loaded}
        <ul class="list skeleton" aria-busy="true">{#each [1, 2, 3, 4] as i (i)}<li></li>{/each}</ul>
      {:else if soon.length}
        <div class="list">
          {#each soonLists as [title, list] (title)}
            {#if list.length}
              <h3>{title}</h3>
              <ul>
                {#each list as e (e.id)}
                  <li animate:flip={{ duration: 220 }} transition:fade={{ duration: 150 }}>
                    <button class="row" data-k={kind(e.category)} data-cancelled={e.cancelled || undefined} onclick={() => dialog?.open(e)}>
                      <span class="when">{dayName(istDay(e.start), { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                      <span class="what">{e.title}</span>
                      <span class="where">{hours(e, '–')}{#if e.course} · {e.course}{/if}{#if e.place} · <span class="place">{e.place}</span>{/if}</span>
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          {/each}
        </div>
      {:else}
        <p class="empty">Nothing here...</p>
      {/if}
    </aside>
</div>
<EventDialog bind:this={dialog} onchange={change} />

<style>
  svg { fill: none; stroke: var(--ink); stroke-width: 2.5; stroke-linecap: round; }

  /* One screen: the sheet is the viewport, and only the grid's hours and the lists give way. */
  /* Two columns, the week and the margin, split by one line from top to bottom. */
  .sheet {
    --side: clamp(14rem, 20vw, 18rem);
    --pad: clamp(1rem, 1.6vw, 1.5rem);
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--side);
    grid-template-rows: auto auto minmax(0, 1fr);
    column-gap: clamp(1rem, 2vw, 2rem);
    height: 100dvh;
    max-width: 100rem;
    margin: 0 auto;
    padding: 1.125rem clamp(1rem, 2vw, 1.75rem) 1.25rem;
    animation: arrive 360ms var(--ease) both;
  }
  @keyframes arrive { from { opacity: 0; } }

  .top { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; }
  .bar { display: flex; align-items: center; gap: 0.75rem; padding-bottom: 0.875rem; }
  /* The left column is narrower now; drop words before buttons spill past the line. */
  @media (max-width: 1200px) { .bar :global(.brand) { display: none; } }
  @media (max-width: 1000px) { .cats-label { display: none; } }
  .me { margin-top: -1.125rem; padding: 1.125rem 0 0.875rem var(--pad); border-left: 2px solid var(--margin); }
  .range {
    margin: 0 auto 0 0.25rem;
    font-size: clamp(1.5rem, 2.6vw, 2.25rem);
    font-weight: 800;
    font-stretch: 122%;
    line-height: 1;
    letter-spacing: -0.02em;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    view-transition-name: title;
  }
  .nav, .me { display: flex; align-items: center; gap: 0.375rem; }
  .avatar {
    position: relative;
    flex: none;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    perspective: 10rem;
    font-size: 0.75rem;
    font-weight: 700;
  }
  /* Two faces back to back; the card turns over with a small overshoot. */
  .card { display: grid; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform 500ms cubic-bezier(0.3, 1.45, 0.5, 1); }
  .avatar[data-out] .card { transform: rotateY(180deg); }
  .face { grid-area: 1 / 1; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--rule-strong); border-radius: 50%; background: var(--raised); backface-visibility: hidden; }
  .face.back { transform: rotateY(180deg); border-color: var(--danger); color: var(--danger); }
  .face.back svg { width: 1rem; stroke: currentColor; stroke-width: 2; }
  .avatar:hover:not([data-out]) .card { transform: rotateY(-12deg); }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }

  /* The categories popup hangs off its button and shares the paper of the dialog. */
  [popover] {
    margin: 0;
    padding: 1rem 1.125rem;
    border: 1px solid var(--rule-strong);
    border-radius: 12px;
    background: var(--raised);
    color: var(--ink);
    box-shadow: var(--shadow);
  }
  #cats { position: fixed; inset: 4rem auto auto 30%; width: 16rem; padding: 0.5rem; }
  @media (min-width: 761px) {
    @supports (position-area: bottom) {
      #cats { position-anchor: --cats; position-area: bottom span-left; inset: auto; margin-top: 0.5rem; }
    }
  }
  [popover]:popover-open { animation: drop 160ms var(--ease); }
  @keyframes drop { from { opacity: 0; translate: 0 -4px; } }

  .cats-btn { anchor-name: --cats; gap: 0.5rem; margin-left: 0.5rem; }
  .swatches { display: flex; }
  .swatches i { width: 0.6rem; height: 0.6rem; margin-left: -0.2rem; border: 1.5px solid var(--raised); border-radius: 50%; background: var(--k); }
  .swatches i:first-child { margin-left: 0; }
  .chev { width: 0.75rem; stroke-width: 1.75; stroke: var(--soft); }
  #cats ul { margin: 0; padding: 0; list-style: none; }
  #cats label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.5rem;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
  }
  #cats label:hover { background: color-mix(in srgb, var(--k) 8%, transparent); }
  #cats input {
    appearance: none;
    flex: none;
    width: 0.95rem;
    height: 0.95rem;
    margin: 0;
    border: 1.5px solid var(--k);
    border-radius: 4px;
    background: transparent;
    transition: background-color 150ms;
  }
  #cats input:checked { background: var(--k) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.2 5 8.5l4.5-5' fill='none' stroke='white' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 100%; }
  #cats input:focus-visible { outline: 2px solid var(--k); outline-offset: 2px; }
  #cats input:not(:checked) ~ .name { color: var(--soft); }
  #cats .name { flex: 1; }

  .status { display: flex; align-items: center; gap: 0.4rem; }
  /* Sits against the margin line, avatar pushed to the far end; the arrow says it leads out to Iris. */
  .iris, .connect-btn { min-width: 0; }
  .gh { margin-left: auto; color: var(--soft); }
  .gh:hover { color: var(--ink); }
  .gh svg { width: 1.05rem; fill: currentColor; stroke: none; }
  .iris { justify-content: flex-start; gap: 0.3rem; padding: 0 0.65rem; border-color: color-mix(in srgb, var(--k-club) 45%, transparent); background: color-mix(in srgb, var(--k-club) 9%, transparent); font-size: 0.8125rem; }
  .iris:hover { border-color: var(--k-club); background: color-mix(in srgb, var(--k-club) 16%, transparent); }
  .iris .label { overflow: hidden; text-overflow: ellipsis; }
  .iris svg { flex: none; stroke: currentColor; stroke-width: 2; }
  .iris .tick { width: 0.85rem; stroke: var(--k-club); stroke-width: 2.25; }
  .iris .go { width: 0.75rem; margin-left: auto; opacity: 0.6; transition: translate 150ms var(--ease), opacity 150ms; }
  .iris:hover .go { opacity: 1; translate: 1px -1px; }
  .status::before { content: ''; width: 0.45rem; height: 0.45rem; border-radius: 50%; background: var(--k-due); }


  .n { color: var(--soft); font-size: 0.75rem; font-variant-numeric: tabular-nums; }

  .layout { grid-column: 1; grid-row: 3; min-height: 0; display: grid; }

  /* The booklet's red margin line: the week on the page, what's next noted in the margin. */
  .side { grid-column: 2; grid-row: 2 / 4; display: flex; flex-direction: column; min-height: 0; margin-bottom: -1.25rem; padding: 0 0 1.25rem var(--pad); border-left: 2px solid var(--margin); }
  h3 { margin: 0.875rem 0 0; color: var(--soft); font-size: 0.8125rem; font-weight: 600; }
  h3:first-child { margin-top: 0; }
  .list ul { margin: 0; padding: 0; list-style: none; }
  h2 { margin: 0 0 0.375rem; font-size: 1.0625rem; font-weight: 700; font-stretch: 112%; }
  #soon-title { margin-bottom: 0.625rem; font-size: 1.375rem; letter-spacing: -0.01em; }

  .list {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-y: auto;
    scrollbar-width: none;
    /* Fades out instead of cutting off when the week is long. */
    mask-image: linear-gradient(black calc(100% - 2.5rem), transparent);
  }
  .row {
    display: grid;
    gap: 0.1rem;
    width: 100%;
    padding: 0.55rem 0 0.55rem 0.75rem;
    border: 0;
    border-bottom: 1px solid var(--rule);
    background: linear-gradient(var(--k), var(--k)) no-repeat 0 0.7rem / 3px calc(100% - 1.4rem);
    text-align: left;
    transition: background-color 150ms, padding 200ms var(--ease);
  }
  .row:hover { padding-left: 1rem; }
  .when { color: var(--soft); font-size: 0.8125rem; font-stretch: 90%; }
  .what { font-weight: 600; line-height: 1.3; }
  .where { color: var(--soft); font-size: 0.8125rem; }
  .place { color: color-mix(in srgb, var(--margin) 75%, var(--soft)); font-weight: 600; }
  [data-cancelled] .what { text-decoration: line-through; }
  .empty { margin: 0; color: var(--soft); }

  .skeleton li {
    height: 3.6rem;
    margin-bottom: 0.5rem;
    border-radius: 6px;
    background: linear-gradient(90deg, var(--rule) 0 40%, color-mix(in srgb, var(--rule) 40%, transparent) 50%, var(--rule) 60%) 0 0 / 300% 100%;
    animation: shimmer 1.4s linear infinite;
  }
  @keyframes shimmer { to { background-position: -150% 0; } }

  .phone { display: none; }

  @media (max-width: 760px) {
    .sheet { display: flex; flex-direction: column; gap: 0.75rem; padding: 0.875rem 1rem; }
    .top { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
    .bar { display: contents; }
    .me { margin: 0; padding: 0; border: 0; }
    .top :global(.brand) { display: none; }
    .range { order: -1; width: 100%; margin: 0; font-size: 1.625rem; }
    .nav { margin-right: auto; }
    .cats-btn { margin-left: 0.25rem; }
    .cats-label { display: none; }
    #cats { inset: 6.5rem 1rem auto auto; max-height: calc(100dvh - 7.5rem); overflow-y: auto; }
    .layout { flex: 1; }
    .layout > :global(.grid), .side { display: none; }
    .phone { display: flex; flex-direction: column; gap: 0.5rem; min-height: 0; }
    .strip { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.25rem; }
    .strip button {
      display: grid;
      justify-items: center;
      gap: 0.1rem;
      padding: 0.375rem 0 0.4rem;
      border: 1px solid transparent;
      border-radius: 10px;
      background: none;
      transition: background-color 150ms, border-color 150ms;
    }
    .strip button[aria-pressed='true'] { border-color: var(--rule-strong); background: var(--raised); }
    .strip [data-today] .dow { color: var(--margin); font-weight: 700; }
    .dow { color: var(--soft); font-size: 0.75rem; }
    .dnum { font-weight: 700; font-size: 1.0625rem; }
    .dots { display: flex; gap: 2px; height: 5px; }
    .dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--k); }
    .agenda { border-top: 1px solid var(--rule-strong); }
    .agenda .empty { padding: 1rem 0; }
  }
</style>
