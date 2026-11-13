<script lang="ts">
  import { auth } from './lib/pb.svelte';
  import Toasts from './Toasts.svelte';
  import Welcome from './Welcome.svelte';
</script>

{#if auth.user}
  <!-- The timetable is its own chunk, so the sign-in page never downloads it. -->
  {#await import('./App.svelte') then { default: App }}
    {#key auth.user.id}<App user={auth.user} />{/key}
  {/await}
{:else}
  <Welcome />
{/if}
<Toasts />
