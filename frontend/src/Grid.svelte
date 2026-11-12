<script lang="ts">
  import { scale } from 'svelte/transition';
  import { dayName, istDay, istMinutes, kind, overlaps, place, time, type Ev } from './lib/cal';

  let { days, events, today, now, onopen, onnew }: {
    days: string[]; events: Ev[]; today: string; now: Date; onopen: (e: Ev) => void; onnew: (day: string, hour: number) => void;
  } = $props();

  // A click on empty ruling starts a new event at that hour.
  function blankClick(ev: MouseEvent, day: string) {
    if (ev.target !== ev.currentTarget) return;
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    onnew(day, Math.min(23, from + Math.floor(((ev.clientY - r.top) / r.height) * (to - from))));
  }

  const timed = $derived(events.filter((e) => !e.allDay));
  // The hour window stretches to fit the week, never below 8 am to 6 pm.
  const from = $derived(Math.min(8, ...timed.map((e) => Math.floor(istMinutes(e.start) / 60))));
  const to = $derived(Math.max(18, ...timed.map((e) => {
    const end = e.end && istDay(e.end) === istDay(e.start) ? istMinutes(e.end) : istMinutes(e.start) + 60;
    return Math.min(24, Math.ceil(end / 60));
  })));
  const hours = $derived(Array.from({ length: to - from }, (_, i) => from + i));

  const allDay = (day: string) => events.filter((e) => e.allDay && overlaps(e, day));
  const nowAt = $derived(((istMinutes(now) - from * 60) / ((to - from) * 60)) * 100);
  const label = (h: number) => (h % 12 || 12) + (h < 12 ? ' am' : ' pm');
</script>

<section class="grid" style:--hours={to - from} aria-label="Week">
  <div class="head">
    <span class="corner"></span>
    {#each days as day (day)}
      <div class="day" data-today={day === today || undefined} data-past={day < today || undefined}>
        <span class="dow">{dayName(day, { weekday: 'short' })}</span>
        <span class="dnum">{dayName(day, { day: 'numeric' })}</span>
      </div>
    {/each}
  </div>

  <div class="allday">
    <span class="corner">all day</span>
    {#each days as day (day)}
      <div class="cell">
        {#each allDay(day) as e (e.id)}
          <button class="chip" data-k={kind(e.category)} data-cancelled={e.cancelled || undefined}
            onclick={() => onopen(e)} out:scale={{ start: 0.9, duration: 160 }}>
            {e.title}
          </button>
        {/each}
      </div>
    {/each}
  </div>

  <div class="body">
    <div class="margin" aria-hidden="true">
      {#each hours as h (h)}<span>{label(h)}</span>{/each}
    </div>
    {#each days as day, d (day)}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="col" data-today={day === today || undefined} data-past={day < today || undefined} onclick={(ev) => blankClick(ev, day)}>
        {#each place(timed.filter((e) => istDay(e.start) === day), day, from, to) as p, i (p.e.id)}
          <button
            class="block"
            data-k={kind(p.e.category)}
            data-cancelled={p.e.cancelled || undefined}
            style:top="{p.top}%"
            style:height="{p.height}%"
            style:left="calc({p.left}% + 2px)"
            style:width="calc({p.width}% - 4px)"
            style:--i={d * 2 + i}
            onclick={() => onopen(p.e)}
            out:scale={{ start: 0.92, duration: 180 }}
          >
            <span class="in">
              <span class="title">{p.e.title}</span>
              <span class="meta">{time(p.e.start)}{p.e.place ? ` ${p.e.place}` : ''}</span>
            </span>
          </button>
        {/each}
        {#if day === today && nowAt >= 0 && nowAt <= 100}
          <div class="now" style:top="{nowAt}%"></div>
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  .grid {
    --margin-w: clamp(3rem, 4vw, 4rem);
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    view-transition-name: week;
  }

  .head, .allday, .body {
    display: grid;
    grid-template-columns: var(--margin-w) repeat(7, minmax(0, 1fr));
  }

  .head { border-bottom: 1px solid var(--rule-strong); }
  .corner { border-right: 2px solid var(--margin); }

  .day {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    padding: 0.25rem 0.625rem 0.5rem;
  }
  .dow { color: var(--soft); font-size: 0.8125rem; }
  .dnum { font-size: 1.375rem; font-weight: 700; font-stretch: 112%; line-height: 1.1; }
  .day[data-past] { opacity: 0.5; }
  .day[data-today] .dow { color: var(--margin); font-weight: 600; }
  .day[data-today] .dnum {
    padding: 0 0.45rem;
    border-radius: 999px;
    background: var(--margin);
    color: var(--paper);
  }

  .allday { border-bottom: 1px solid var(--rule-strong); }
  .allday .corner {
    padding: 0.4rem 0.5rem 0 0;
    color: var(--soft);
    font-size: 0.6875rem;
    font-stretch: 85%;
    text-align: right;
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    max-height: 3.5rem;
    min-height: 1.9rem;
    padding: 0.3rem 0.25rem;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .chip {
    flex: none;
    overflow: hidden;
    padding: 0.18rem 0.45rem;
    border: 0;
    border-radius: 4px;
    background: color-mix(in srgb, var(--k) 16%, transparent);
    font-size: 0.75rem;
    font-weight: 600;
    font-stretch: 85%;
    text-align: left;
    white-space: nowrap;
    text-overflow: ellipsis;
    transition: background-color 150ms;
  }
  .chip:hover { background: color-mix(in srgb, var(--k) 26%, transparent); }

  .body {
    position: relative;
    flex: 1;
    min-height: 0;
    /* The ruling: a line on every hour, a fainter one on the half. Hours share whatever height is left. */
    background-image:
      linear-gradient(var(--rule) 1px, transparent 1px),
      linear-gradient(color-mix(in srgb, var(--rule) 45%, transparent) 1px, transparent 1px);
    background-size: 100% calc(100% / var(--hours)), 100% calc(100% / var(--hours) / 2);
  }

  .margin {
    display: grid;
    grid-template-rows: repeat(var(--hours), 1fr);
    border-right: 2px solid var(--margin);
    background: var(--paper);
  }
  .margin span {
    min-height: 0;
    padding: 0.15rem 0.5rem 0 0;
    color: var(--soft);
    font-size: 0.6875rem;
    font-stretch: 85%;
    text-align: right;
    white-space: nowrap;
  }

  .col { position: relative; min-width: 0; border-left: 1px solid var(--rule); cursor: cell; }
  .col:nth-child(2) { border-left: 0; }
  .col[data-today] { background: color-mix(in srgb, var(--margin) var(--today), transparent); }

  .block {
    position: absolute;
    overflow: hidden;
    padding: 0;
    border: 0;
    /* Each block lays itself out by its own size: hour-long ones stack, short ones run on one line. */
    container-type: size;
    border-left: 3px solid var(--k);
    border-radius: 2px 6px 6px 2px;
    background: color-mix(in srgb, var(--k) var(--tint), var(--raised));
    box-shadow: 0 0 0 1.5px var(--paper);
    text-align: left;
    transition: background-color 150ms, transform 150ms var(--ease), box-shadow 150ms;
    animation: settle 420ms var(--ease) both;
    animation-delay: calc(var(--i) * 28ms);
  }
  .block:hover {
    z-index: 1;
    background: color-mix(in srgb, var(--k) calc(var(--tint) + 9%), var(--raised));
    box-shadow: 0 0 0 1.5px var(--paper), var(--shadow);
    transform: translateY(-1px);
  }
  .col[data-past] .block { opacity: 0.6; }

  /* The one orchestrated moment: the week's blocks settle onto the ruling, day by day. */
  @keyframes settle {
    from { opacity: 0; transform: translateY(6px); }
  }

  .in {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    height: 100%;
    padding: 0.25rem 0.375rem 0.25rem 0.5rem;
  }
  .title {
    display: -webkit-box;
    overflow: hidden;
    font-size: 0.8125rem;
    font-weight: 650;
    font-stretch: 85%;
    line-height: 1.2;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
  }
  .meta {
    overflow: hidden;
    color: color-mix(in srgb, var(--k) 55%, var(--ink));
    font-size: 0.6875rem;
    font-stretch: 85%;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* Not room for both: the title wins over the time, which the column already shows. */
  @container (height < 3.4rem) {
    .title { -webkit-line-clamp: 2; line-clamp: 2; }
    .meta { display: none; }
  }
  @container (height < 2.4rem) {
    .in { flex-direction: row; align-items: center; gap: 0.375rem; padding-block: 0; }
    .title { display: block; flex: 0 1 auto; white-space: nowrap; text-overflow: ellipsis; }
    .meta { display: block; flex: 0 1000 auto; min-width: 0; }
  }
  @container (width < 6.5rem) {
    .in { padding-inline: 0.3rem 0.25rem; }
    .title { font-size: 0.75rem; }
  }
  @container (height < 2.4rem) and (width < 9rem) {
    .meta { display: none; }
  }

  [data-cancelled].block, [data-cancelled].chip {
    background: repeating-linear-gradient(135deg, transparent 0 5px, color-mix(in srgb, var(--k) 12%, transparent) 5px 10px);
  }
  [data-cancelled] .title, [data-cancelled].chip { text-decoration: line-through; }

  .now {
    position: absolute;
    left: -2px;
    right: 0;
    z-index: 2;
    height: 2px;
    background: var(--margin);
    pointer-events: none;
  }
  .now::before {
    content: '';
    position: absolute;
    left: -4px;
    top: -4px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--margin);
    animation: pulse 2.4s ease-in-out infinite;
  }
  @keyframes pulse {
    50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--margin) 22%, transparent); }
  }
</style>
