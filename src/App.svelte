<script>
  import Globe from './lib/Globe.svelte';
  import getLunarData from '../backend/Lunarfunction';
  import LandingPage from './lib/landing.svelte';

  let showLanding = $state(true);
  let showGlobe = $state(false);
  let landingOpacity = $state(1);

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

  let lat = $state(-89.9);
  let lon = $state(0);
  let result = $state(null);
  let loading = $state(false);

  async function checkSite(targetLat, targetLon) {
    loading = true;
    try {
      result = await getLunarData(targetLat, targetLon);
      console.log('Site Analysis:', result);
    } catch (err) {
      console.error(err);
    } finally {
      loading = false;
    }
  }

  checkSite(23, 23);
</script>

<main class="app-viewport">
  {#if showGlobe}
    <div class="view-layer globe-layer">
      <Globe />
    </div>
  {/if}

  {#if showLanding}
    <div
      class="view-layer landing-layer"
      style="opacity: {landingOpacity};"
    >
      <LandingPage onComplete={handleTransitionToMoon} />
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
