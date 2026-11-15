<script>
  import { onMount } from 'svelte';
  import Globe from './lib/Globe.svelte';
  import LandingPage from './lib/landing.svelte';
  import Timeline from './lib/Timeline.svelte';
  import DatePicker from './lib/DatePicker.svelte';
  import LunarCoordsHUD from './lib/LunarCoordsHUD.svelte';
  import { fetchCurrentLunarPositions } from './lib/ephemeris.js';

  let showLanding = $state(true);
  let showGlobe = $state(false);
  let landingOpacity = $state(1);
  let mode = $state('single');

  // Apollo 15 landing site (Hadley-Apennine region: 26.1322°N, 3.6339°E)
  let lat = $state(26.1322);
  let lon = $state(3.6339);
  let selectedCoords = $state(null);
  let lunarPositions = $state(null);
  let lunarPositionsS2 = $state(null);
  let activeLunarPositions = $state(null);
  let ephemerisLoaded = $state(false);
  let isCalculatingEphemeris = $state(false);
  let currentPlayheadTime = $state('');
  let hoveredCoords = $state(null);
  let customDateRange = $state(null);

  // Active dates calculated in ephemeris (Sample 1)
  let activeStartDate = $state('');
  let activeEndDate = $state('');

  // Pending user-selected dates (Sample 1)
  let pendingStartDate = $state('');
  let pendingEndDate = $state('');

  // Sample 2 dates (Compare Mode)
  let activeS2StartDate = $state('');
  let activeS2EndDate = $state('');
  let pendingS2StartDate = $state('');
  let pendingS2EndDate = $state('');

  function formatDateToYMD(d) {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function getDaysDiff(startStr, endStr) {
    if (!startStr || !endStr) return 20;
    const s = new Date(startStr + 'T00:00:00');
    const e = new Date(endStr + 'T00:00:00');
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }

  function offsetDays(dateStr, days) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  let s1DurationDays = $derived(getDaysDiff(pendingStartDate, pendingEndDate));

  function handleS1StartChange(newVal) {
    pendingStartDate = newVal;
    if (mode === 'compare' && pendingEndDate && pendingStartDate) {
      const span = getDaysDiff(pendingStartDate, pendingEndDate);
      if (pendingS2StartDate) {
        pendingS2EndDate = offsetDays(pendingS2StartDate, span);
      }
    }
  }

  function handleS1EndChange(newVal) {
    pendingEndDate = newVal;
    if (mode === 'compare' && pendingStartDate && pendingEndDate) {
      const span = getDaysDiff(pendingStartDate, pendingEndDate);
      if (pendingS2StartDate) {
        pendingS2EndDate = offsetDays(pendingS2StartDate, span);
      }
    }
  }

  function handleS2StartChange(newVal) {
    pendingS2StartDate = newVal;
    const span = getDaysDiff(pendingStartDate, pendingEndDate);
    pendingS2EndDate = offsetDays(newVal, span);
  }

  function handleS2EndChange(newVal) {
    pendingS2EndDate = newVal;
    const span = getDaysDiff(pendingStartDate, pendingEndDate);
    pendingS2StartDate = offsetDays(newVal, -span);
  }

  async function fetchS2Ephemeris(start, end) {
    try {
      const res = await fetchCurrentLunarPositions(lat, lon, { startDate: start, endDate: end });
      lunarPositionsS2 = res;
      activeS2StartDate = start;
      activeS2EndDate = end;
    } catch (err) {
      console.error('Failed to load Sample 2 ephemeris:', err);
    }
  }

  $effect(() => {
    if (mode === 'compare') {
      const span = getDaysDiff(pendingStartDate, pendingEndDate);
      if (!pendingS2StartDate) {
        const defStart = pendingEndDate || offsetDays(pendingStartDate, span);
        pendingS2StartDate = defStart;
        pendingS2EndDate = offsetDays(defStart, span);
      }
      if (!lunarPositionsS2 && !isCalculatingEphemeris && pendingS2StartDate && pendingS2EndDate) {
        fetchS2Ephemeris(pendingS2StartDate, pendingS2EndDate);
      }
    }
  });

  $effect(() => {
    if (lunarPositions?.timeRange) {
      const start = formatDateToYMD(lunarPositions.timeRange.startDate);
      const end = formatDateToYMD(lunarPositions.timeRange.endDate);
      activeStartDate = start;
      activeEndDate = end;
      if (!pendingStartDate) pendingStartDate = start;
      if (!pendingEndDate) pendingEndDate = end;
    }
  });

  let hasDateChanged = $derived.by(() => {
    if (mode === 'compare') {
      const s1Valid = pendingStartDate && pendingEndDate && pendingStartDate <= pendingEndDate;
      const s2Valid = pendingS2StartDate && pendingS2EndDate && pendingS2StartDate <= pendingS2EndDate;
      const s1Changed = pendingStartDate !== activeStartDate || pendingEndDate !== activeEndDate;
      const s2Changed = pendingS2StartDate !== activeS2StartDate || pendingS2EndDate !== activeS2EndDate;
      return Boolean(s1Valid && s2Valid && (s1Changed || s2Changed || !lunarPositionsS2));
    }
    return Boolean(
      pendingStartDate &&
      pendingEndDate &&
      pendingStartDate <= pendingEndDate &&
      (pendingStartDate !== activeStartDate || pendingEndDate !== activeEndDate)
    );
  });

  async function handleSubmitDateRange() {
    if (!hasDateChanged || isCalculatingEphemeris) return;
    if (mode === 'compare') {
      isCalculatingEphemeris = true;
      try {
        const [newPositions1, newPositions2] = await Promise.all([
          fetchCurrentLunarPositions(lat, lon, { startDate: pendingStartDate, endDate: pendingEndDate }),
          fetchCurrentLunarPositions(lat, lon, { startDate: pendingS2StartDate, endDate: pendingS2EndDate })
        ]);
        lunarPositions = newPositions1;
        activeLunarPositions = newPositions1;
        lunarPositionsS2 = newPositions2;
        activeStartDate = pendingStartDate;
        activeEndDate = pendingEndDate;
        activeS2StartDate = pendingS2StartDate;
        activeS2EndDate = pendingS2EndDate;
      } catch (err) {
        console.error('Failed to calculate compare ephemeris:', err);
      } finally {
        isCalculatingEphemeris = false;
      }
    } else {
      await handleDateRangeChange({
        startDate: pendingStartDate,
        endDate: pendingEndDate
      });
    }
  }

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
    selectedCoords = { lat, lon, flyTo: Boolean(coords.flyTo), _ts: Date.now() };
    isCalculatingEphemeris = true;

    try {
      if (mode === 'compare' && pendingS2StartDate && pendingS2EndDate) {
        const [newPositions1, newPositions2] = await Promise.all([
          fetchCurrentLunarPositions(lat, lon, { startDate: pendingStartDate, endDate: pendingEndDate }),
          fetchCurrentLunarPositions(lat, lon, { startDate: pendingS2StartDate, endDate: pendingS2EndDate })
        ]);
        lunarPositions = newPositions1;
        activeLunarPositions = newPositions1;
        lunarPositionsS2 = newPositions2;
        currentPlayheadTime = newPositions1?.sunEntry?.time || '';
      } else {
        const newPositions = await fetchCurrentLunarPositions(lat, lon, customDateRange);
        lunarPositions = newPositions;
        activeLunarPositions = newPositions;
        currentPlayheadTime = newPositions?.sunEntry?.time || '';
      }
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
        selectedCoords={selectedCoords || { lat, lon }}
        onCoordinateSelect={handleCoordinateSelect}
        onHoverCoords={(coords) => (hoveredCoords = coords)}
        isCalculating={isCalculatingEphemeris}
      />
    </div>

    {#if mode === 'single'}
      <!-- Start Date Picker: 80px from left edge -->
      <div class="hud-date-picker start-picker">
        <DatePicker
          label="START DATE"
          value={pendingStartDate}
          max={pendingEndDate}
          align="left"
          disabled={isCalculatingEphemeris}
          onchange={(val) => { pendingStartDate = val; }}
          onsubmit={handleSubmitDateRange}
        />
      </div>

      <!-- End Date Picker: 80px from right edge -->
      <div class="hud-date-picker end-picker">
        <DatePicker
          label="END DATE"
          value={pendingEndDate}
          min={pendingStartDate}
          align="right"
          disabled={isCalculatingEphemeris}
          onchange={(val) => { pendingEndDate = val; }}
          onsubmit={handleSubmitDateRange}
        />
      </div>
    {:else}
      <!-- COMPARE MODE: Sample 1 on Left, Sample 2 on Right -->
      <div class="hud-date-picker start-picker compare-sample-card">
        <div class="compare-card-header">
          <span class="compare-tag s1-tag">SAMPLE 1</span>
          <span class="compare-duration">{s1DurationDays} DAYS</span>
        </div>
        <DatePicker
          label="START DATE"
          value={pendingStartDate}
          max={pendingEndDate}
          align="left"
          disabled={isCalculatingEphemeris}
          onchange={handleS1StartChange}
          onsubmit={handleSubmitDateRange}
        />
        <DatePicker
          label="END DATE"
          value={pendingEndDate}
          min={pendingStartDate}
          align="left"
          disabled={isCalculatingEphemeris}
          onchange={handleS1EndChange}
          onsubmit={handleSubmitDateRange}
        />
      </div>

      <div class="hud-date-picker end-picker compare-sample-card">
        <div class="compare-card-header align-right">
          <span class="compare-tag s2-tag">SAMPLE 2</span>
          <span class="compare-duration">{s1DurationDays} DAYS</span>
        </div>
        <DatePicker
          label="START DATE"
          value={pendingS2StartDate}
          align="right"
          disabled={isCalculatingEphemeris}
          onchange={handleS2StartChange}
          onsubmit={handleSubmitDateRange}
        />
        <DatePicker
          label="END DATE"
          value={pendingS2EndDate}
          align="right"
          disabled={true}
          onsubmit={handleSubmitDateRange}
        />
      </div>
    {/if}

    <!-- Lunar Coordinates HUD & Popdown with Tabs -->
    <LunarCoordsHUD
      {selectedCoords}
      {hoveredCoords}
      {lat}
      {lon}
      onCoordinateSelect={handleCoordinateSelect}
      bind:mode
    />

    {#if isCalculatingEphemeris}
      <div class="ephemeris-loading-hud">
        <div class="loader"></div>
        <span>ACQUIRING LUNAR EPHEMERIS FROM HORIZONS...</span>
      </div>
    {:else}
      <Timeline
        {lunarPositions}
        {lunarPositionsS2}
        {mode}
        onTimeChange={handlePlayheadChange}
        {hoveredCoords}
        showSubmit={hasDateChanged}
        onSubmit={handleSubmitDateRange}
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

  /* Date Pickers placed 80px from viewport edges at mid-height (equatorial level) */
  .hud-date-picker {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 20;
    pointer-events: auto;
  }

  .start-picker {
    left: 80px;
  }

  .end-picker {
    right: 80px;
  }

  /* Compare Mode Date Group Cards */
  .compare-sample-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(10, 14, 24, 0.65);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.16);
    padding: 14px;
    box-sizing: border-box;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  .compare-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  }

  .compare-card-header.align-right {
    flex-direction: row-reverse;
  }

  .compare-tag {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1.2px;
    padding: 3px 8px;
    text-transform: uppercase;
  }

  .s1-tag {
    background: #ff9500;
    color: #000000;
  }

  .s2-tag {
    background: #00b2ff;
    color: #000000;
  }

  .compare-duration {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.75);
    letter-spacing: 0.8px;
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
