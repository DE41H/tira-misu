<script lang="ts">
  import { fly } from 'svelte/transition';
  import Brand from './Brand.svelte';
  import { fail, pb } from './lib/pb.svelte';

  let signingIn = $state(false);

  async function signIn() {
    signingIn = true;
    // Google opens in a popup; closing it rejects with no status, which just resets the button.
    await pb.collection('users').authWithOAuth2({ provider: 'google' }).catch((err) => err.status && fail(err));
    signingIn = false;
  }
</script>

<main class="welcome">
  <div class="inner" in:fly={{ y: 12, duration: 500 }}>
    <Brand />
    <h1>Your BITS week, filled in from your inbox.</h1>
    <p class="lede">Quizzes, deadlines, talks and club meets arrive as mail. Tiramisu reads them through Iris and puts each one on your timetable.</p>
    <button class="btn solid big" aria-busy={signingIn || undefined} onclick={signIn}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.5-1.7 4.4-5.35 4.4-3.22 0-5.85-2.67-5.85-5.96S8.78 6.56 12 6.56c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 4 14.55 3 12 3 6.98 3 3 7.03 3 12s3.98 9 9 9c5.2 0 8.64-3.65 8.64-8.8 0-.6-.07-1.04-.29-1.1Z"/></svg>
      Sign in with Google
    </button>
  </div>
</main>

<style>
  /* A fresh booklet page. */
  .welcome {
    display: grid;
    align-items: center;
    height: 100dvh;
    padding: 1.5rem 1.5rem 1.5rem calc(min(14vw, 9rem) + 1.75rem);
    background:
      linear-gradient(var(--margin), var(--margin)) no-repeat min(14vw, 9rem) 0 / 2px 100%,
      repeating-linear-gradient(transparent 0 calc(2rem - 1px), var(--rule) calc(2rem - 1px) 2rem);
  }
  .inner { max-width: 34rem; }
  h1 {
    margin: 1.25rem 0 1rem;
    font-size: clamp(2.25rem, 5.5vw, 3.75rem);
    font-weight: 800;
    font-stretch: 118%;
    line-height: 1.02;
    letter-spacing: -0.025em;
    text-wrap: balance;
  }
  .lede { max-width: 30rem; margin: 0 0 2rem; color: var(--soft); font-size: 1.0625rem; line-height: 1.6; text-wrap: pretty; }
  .big { height: 2.875rem; padding: 0 1.375rem; font-size: 0.9375rem; }
  svg { width: 1.05rem; }
</style>
