<script>
  import { onMount } from 'svelte';
  import Globe from './lib/Globe.svelte';
  import LandingPage from './lib/landing.svelte';
  import { fetchCurrentLunarPositions } from './lib/ephemeris.js';

  let showLanding = $state(true);
  let showGlobe = $state(false);
  let landingOpacity = $state(1);

  let lat = $state(0);
  let lon = $state(0);
  let lunarPositions = $state(null);
  let ephemerisLoaded = $state(false);

  onMount(async () => {
    lunarPositions = await fetchCurrentLunarPositions(lat, lon);
    ephemerisLoaded = true;
  });

  function handleTransitionToMoon() {
    // 1. Mount Globe underneath LandingPage (LandingPage is still opacity: 1)
    showGlobe = true;

    // 2. Wait two frames for Globe's WebGL context, shaders, and first frame to render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // 3. Smoothly fade out LandingPage over 300ms, revealing Globe with zero black flicker
        landingOpacity = 0;
        setTimeout(() => {
          showLanding = false;
        }, 320);
      });
    });
  }
</script>

<main class="app-viewport">
  {#if showGlobe}
    <div class="view-layer globe-layer">
      <Globe {lunarPositions} />
    </div>
  {/if}

  {#if showLanding}
    <div
      class="view-layer landing-layer"
      style="opacity: {landingOpacity};"
    >
      <LandingPage
        {lunarPositions}
        isLoaded={ephemerisLoaded}
        onComplete={handleTransitionToMoon}
      />
    </div>
  {/if}
</main>

<style>
  .app-viewport {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: #000;
  }
  .view-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .landing-layer {
    transition: opacity 0.3s ease-in-out;
    z-index: 2;
  }
  .globe-layer {
    z-index: 1;
  }
</style>
