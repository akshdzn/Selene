<script>
  import { onMount } from 'svelte';
  import Globe from './lib/Globe.svelte';
  import LandingPage from './lib/landing.svelte';
  import Timeline from './lib/Timeline.svelte';
  import { fetchCurrentLunarPositions } from './lib/ephemeris.js';

  let showLanding = $state(true);
  let showGlobe = $state(false);
  let landingOpacity = $state(1);

  // Apollo 15 landing site (Hadley-Apennine region: 26.1322°N, 3.6339°E)
  let lat = $state(26.1322);
  let lon = $state(3.6339);
  let lunarPositions = $state(null);
  let activeLunarPositions = $state(null);
  let ephemerisLoaded = $state(false);
  let isCalculatingEphemeris = $state(false);
  let currentPlayheadTime = $state('');
  let hoveredCoords = $state(null);
  let customDateRange = $state(null);

  onMount(async () => {
    lunarPositions = await fetchCurrentLunarPositions(lat, lon);
    activeLunarPositions = lunarPositions;
    currentPlayheadTime = lunarPositions?.sunEntry?.time || '';
    ephemerisLoaded = true;
  });

  async function handleCoordinateSelect(coords) {
    if (isCalculatingEphemeris) return;
    lat = Number(coords.lat.toFixed(4));
    lon = Number(coords.lon.toFixed(4));
    isCalculatingEphemeris = true;

    try {
      const newPositions = await fetchCurrentLunarPositions(lat, lon, customDateRange);
      lunarPositions = newPositions;
      activeLunarPositions = newPositions;
      currentPlayheadTime = newPositions?.sunEntry?.time || '';
    } catch (err) {
      console.error('Failed to calculate ephemeris for chosen coordinates:', err);
    } finally {
      isCalculatingEphemeris = false;
    }
  }

  async function handleDateRangeChange(range) {
    if (isCalculatingEphemeris) return;
    customDateRange = range;
    isCalculatingEphemeris = true;

    try {
      const newPositions = await fetchCurrentLunarPositions(lat, lon, customDateRange);
      lunarPositions = newPositions;
      activeLunarPositions = newPositions;
      currentPlayheadTime = newPositions?.sunEntry?.time || '';
    } catch (err) {
      console.error('Failed to calculate ephemeris for date range:', err);
    } finally {
      isCalculatingEphemeris = false;
    }
  }

  function handlePlayheadChange(event) {
    currentPlayheadTime = event.time;
    activeLunarPositions = {
      ...lunarPositions,
      ...event.celestialPositions,
      sunEntry: event.sunEntry,
      earthEntry: event.earthEntry,
      time: event.time,
      currentIndex: event.index,
      hour: event.index % 24
    };
  }

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
      <Globe
        lunarPositions={activeLunarPositions || lunarPositions}
        selectedCoords={{ lat, lon }}
        onCoordinateSelect={handleCoordinateSelect}
        onHoverCoords={(coords) => (hoveredCoords = coords)}
        isCalculating={isCalculatingEphemeris}
      />
    </div>

    {#if isCalculatingEphemeris}
      <div class="ephemeris-loading-hud">
        <div class="loader"></div>
        <span>ACQUIRING LUNAR EPHEMERIS FROM HORIZONS...</span>
      </div>
    {:else}
      <Timeline
        {lunarPositions}
        onTimeChange={handlePlayheadChange}
        onDateRangeChange={handleDateRangeChange}
        {hoveredCoords}
      />
    {/if}
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

  /* Loading HUD shown when calculating new ephemeris after double clicking coordinate */
  .ephemeris-loading-hud {
    position: absolute;
    bottom: 50px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 30px;
    padding: 14px 28px;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: rgba(255, 255, 255, 0.85);
    font-family: 'Space Grotesk', sans-serif;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.5px;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    z-index: 10;
    pointer-events: none;
    user-select: none;
  }
  .loader {
    width: 60px;
    aspect-ratio: 1;
    display: flex;
    transform: scale(0.35);
    margin: 0 -16px;
    --c: #ff5500;
  }
  .loader:before,
  .loader:after {
    content: "";
    flex: 1;
    aspect-ratio: 1;
    --g: conic-gradient(from -90deg at 10px 10px, var(--c) 90deg, #0000 0);
    background: var(--g), var(--g), var(--g);
    filter: drop-shadow(30px 30px 0 var(--c));
    animation: l20 1s infinite;
  }
  .loader:after {
    transform: scaleX(-1);
  }
  @keyframes l20 {
    0%   {background-position:0     0, 10px 10px, 20px 20px}
    33%  {background-position:10px  10px}
    66%  {background-position:0    20px,10px 10px,20px 0   }
    100% {background-position:0     0, 10px 10px, 20px 20px}
  }
</style>
