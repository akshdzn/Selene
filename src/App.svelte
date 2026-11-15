<script>
  import { onMount } from 'svelte';
  import Globe from './lib/Globe.svelte';
  import LandingPage from './lib/landing.svelte';
  import Timeline from './lib/Timeline.svelte';
  import DatePicker from './lib/DatePicker.svelte';
  import LunarCoordsHUD from './lib/LunarCoordsHUD.svelte';
  import { fetchCurrentLunarPositions, calculateOptimalValue } from './lib/ephemeris.js';
  import { findLandmarkByCoords } from './lib/places.js';

  let showLanding = $state(true);
  let showGlobe = $state(false);
  let landingOpacity = $state(1);
  let mode = $state('single');
  let compareType = $state('sites');
  let activeSiteSlot = $state(1);

  // Default sites: Apollo 15 (Site 1) and Apollo 11 (Site 2)
  let site1Coords = $state({ lat: 26.1322, lon: 3.6339, name: 'Apollo 15' });
  let site2Coords = $state({ lat: 0.6741, lon: 23.4730, name: 'Apollo 11' });

  let site1DisplayName = $derived(site1Coords?.name || '');
  let site2DisplayName = $derived(site2Coords?.name || '');

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

  let ephemerisRequestId = 0;

  async function fetchSitesCompareEphemeris(s1 = site1Coords, s2 = site2Coords, start = pendingStartDate, end = pendingEndDate) {
    const reqId = ++ephemerisRequestId;
    isCalculatingEphemeris = true;
    try {
      const [pos1, pos2] = await Promise.all([
        fetchCurrentLunarPositions(s1.lat, s1.lon, { startDate: start, endDate: end }),
        fetchCurrentLunarPositions(s2.lat, s2.lon, { startDate: start, endDate: end })
      ]);
      if (reqId !== ephemerisRequestId) return;
      lunarPositions = pos1;
      lunarPositionsS2 = pos2;
      activeLunarPositions = activeSiteSlot === 1 ? pos1 : pos2;
      activeStartDate = start;
      activeEndDate = end;
      currentPlayheadTime = pos1?.sunEntry?.time || '';
    } catch (err) {
      console.error('Failed to load sites compare ephemeris:', err);
    } finally {
      if (reqId === ephemerisRequestId) {
        isCalculatingEphemeris = false;
      }
    }
  }

  async function fetchTimelinesCompareEphemeris(start1 = pendingStartDate, end1 = pendingEndDate, start2 = pendingS2StartDate, end2 = pendingS2EndDate) {
    const reqId = ++ephemerisRequestId;
    isCalculatingEphemeris = true;
    try {
      const [pos1, pos2] = await Promise.all([
        fetchCurrentLunarPositions(lat, lon, { startDate: start1, endDate: end1 }),
        fetchCurrentLunarPositions(lat, lon, { startDate: start2, endDate: end2 })
      ]);
      if (reqId !== ephemerisRequestId) return;
      lunarPositions = pos1;
      activeLunarPositions = pos1;
      lunarPositionsS2 = pos2;
      activeStartDate = start1;
      activeEndDate = end1;
      activeS2StartDate = start2;
      activeS2EndDate = end2;
      currentPlayheadTime = pos1?.sunEntry?.time || '';
    } catch (err) {
      console.error('Failed to load timelines compare ephemeris:', err);
    } finally {
      if (reqId === ephemerisRequestId) {
        isCalculatingEphemeris = false;
      }
    }
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

  // Optimal value calculations for Compare Mode
  let sample1OptimalValue = $derived(
    calculateOptimalValue(lunarPositions?.dataset?.sun, lunarPositions?.dataset?.earth)
  );
  let sample2OptimalValue = $derived(
    calculateOptimalValue(lunarPositionsS2?.dataset?.sun, lunarPositionsS2?.dataset?.earth)
  );

  // Variable called Optimal Sample which gets input from the higher Optimal value between the two samples
  let OptimalSample = $derived.by(() => {
    if (mode !== 'compare' || isCalculatingEphemeris) return null;
    if (!lunarPositions || !lunarPositionsS2) return null;
    const v1 = sample1OptimalValue;
    const v2 = sample2OptimalValue;
    if (v1 <= 0 && v2 <= 0) return null;
    // Check which sample is the optimal sample
    return v1 >= v2 ? 1 : 2;
  });

  let optimalSample = $derived(OptimalSample);
  let optimalSampleNumber = $derived(OptimalSample);
  let higherOptimalValue = $derived(
    mode === 'compare' ? Math.max(sample1OptimalValue, sample2OptimalValue) : 0
  );

  $effect(() => {
    if (mode === 'compare') {
      if (compareType === 'timelines') {
        const span = getDaysDiff(pendingStartDate, pendingEndDate);
        if (!pendingS2StartDate) {
          const defStart = pendingEndDate || offsetDays(pendingStartDate, span);
          pendingS2StartDate = defStart;
          pendingS2EndDate = offsetDays(defStart, span);
        }
        if (!lunarPositionsS2 && !isCalculatingEphemeris && pendingS2StartDate && pendingS2EndDate) {
          fetchTimelinesCompareEphemeris(pendingStartDate, pendingEndDate, pendingS2StartDate, pendingS2EndDate);
        }
      } else if (compareType === 'sites') {
        if (!lunarPositionsS2 && !isCalculatingEphemeris && pendingStartDate && pendingEndDate) {
          fetchSitesCompareEphemeris(site1Coords, site2Coords, pendingStartDate, pendingEndDate);
        }
      }
    } else if (mode === 'single') {
      activeLunarPositions = lunarPositions;
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
      if (compareType === 'sites') {
        const sValid = pendingStartDate && pendingEndDate && pendingStartDate <= pendingEndDate;
        const sChanged = pendingStartDate !== activeStartDate || pendingEndDate !== activeEndDate;
        return Boolean(sValid && (sChanged || !lunarPositionsS2));
      }
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
      if (compareType === 'sites') {
        await fetchSitesCompareEphemeris(site1Coords, site2Coords, pendingStartDate, pendingEndDate);
      } else {
        await fetchTimelinesCompareEphemeris(pendingStartDate, pendingEndDate, pendingS2StartDate, pendingS2EndDate);
      }
    } else {
      await handleDateRangeChange({
        startDate: pendingStartDate,
        endDate: pendingEndDate
      });
    }
  }

  onMount(async () => {
    const reqId = ++ephemerisRequestId;
    isCalculatingEphemeris = true;
    try {
      const positions = await fetchCurrentLunarPositions(lat, lon);
      if (reqId !== ephemerisRequestId) return;
      lunarPositions = positions;
      activeLunarPositions = positions;
      currentPlayheadTime = positions?.sunEntry?.time || '';
      ephemerisLoaded = true;
    } catch (err) {
      console.error('Failed to load initial ephemeris:', err);
    } finally {
      if (reqId === ephemerisRequestId) {
        isCalculatingEphemeris = false;
      }
    }
  });

  async function handleCoordinateSelect(coords) {
    const selectedLat = Number(coords.lat.toFixed(4));
    const selectedLon = Number(coords.lon.toFixed(4));
    const recognizedLandmark = findLandmarkByCoords(selectedLat, selectedLon);
    const siteName = coords.name || recognizedLandmark?.name || null;

    lat = selectedLat;
    lon = selectedLon;
    selectedCoords = { lat: selectedLat, lon: selectedLon, name: siteName, flyTo: Boolean(coords.flyTo), _ts: Date.now() };

    if (mode === 'compare' && compareType === 'sites') {
      const targetSlot = coords.slot ?? activeSiteSlot;
      if (targetSlot === 1) {
        site1Coords = { lat: selectedLat, lon: selectedLon, name: siteName || null };
      } else {
        site2Coords = { lat: selectedLat, lon: selectedLon, name: siteName || null };
      }
      await fetchSitesCompareEphemeris(site1Coords, site2Coords, pendingStartDate, pendingEndDate);
      return;
    }

    site1Coords = { lat: selectedLat, lon: selectedLon, name: siteName || null };

    if (mode === 'compare' && compareType === 'timelines' && pendingS2StartDate && pendingS2EndDate) {
      await fetchTimelinesCompareEphemeris(pendingStartDate, pendingEndDate, pendingS2StartDate, pendingS2EndDate);
    } else {
      await handleDateRangeChange(customDateRange);
    }
  }

  function handleSelectSiteSlot(slot) {
    activeSiteSlot = slot;
    if (compareType === 'timelines') {
      activeLunarPositions = slot === 1 ? lunarPositions : lunarPositionsS2;
    } else {
      const targetSite = slot === 1 ? site1Coords : site2Coords;
      if (targetSite) {
        lat = targetSite.lat;
        lon = targetSite.lon;
        selectedCoords = { lat: targetSite.lat, lon: targetSite.lon, name: targetSite.name, flyTo: true, _ts: Date.now() };
        activeLunarPositions = slot === 1 ? lunarPositions : lunarPositionsS2;
      }
    }
  }

  async function handleCompareTypeChange(type) {
    compareType = type;
    if (mode === 'compare') {
      if (type === 'sites') {
        const activeSite = activeSiteSlot === 1 ? site1Coords : site2Coords;
        if (activeSite) {
          lat = activeSite.lat;
          lon = activeSite.lon;
          selectedCoords = { lat: activeSite.lat, lon: activeSite.lon, name: activeSite.name, flyTo: true, _ts: Date.now() };
        }
        await fetchSitesCompareEphemeris(site1Coords, site2Coords, pendingStartDate, pendingEndDate);
      } else if (type === 'timelines') {
        const span = getDaysDiff(pendingStartDate, pendingEndDate);
        if (!pendingS2StartDate) {
          const defStart = pendingEndDate || offsetDays(pendingStartDate, span);
          pendingS2StartDate = defStart;
          pendingS2EndDate = offsetDays(defStart, span);
        }
        await fetchTimelinesCompareEphemeris(pendingStartDate, pendingEndDate, pendingS2StartDate, pendingS2EndDate);
      }
    }
  }

  async function handleDateRangeChange(range) {
    customDateRange = range;
    const reqId = ++ephemerisRequestId;
    isCalculatingEphemeris = true;

    try {
      const newPositions = await fetchCurrentLunarPositions(lat, lon, customDateRange);
      if (reqId !== ephemerisRequestId) return;
      lunarPositions = newPositions;
      activeLunarPositions = newPositions;
      currentPlayheadTime = newPositions?.sunEntry?.time || '';
    } catch (err) {
      console.error('Failed to calculate ephemeris for date range:', err);
    } finally {
      if (reqId === ephemerisRequestId) {
        isCalculatingEphemeris = false;
      }
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

    {#if mode === 'single' || (mode === 'compare' && compareType === 'sites')}
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
      <!-- TIMELINES COMPARE MODE: Sample 1 on Left, Sample 2 on Right -->
      <div
        class="hud-date-picker start-picker compare-sample-card"
        class:is-optimal-card={optimalSample === 1}
        class:is-active-slot={activeSiteSlot === 1}
      >
        <button
          type="button"
          class="compare-card-header"
          onclick={() => handleSelectSiteSlot(1)}
          aria-label="Target Sample 1"
        >
          <div class="compare-tag-wrap">
            <span class="compare-tag s1-tag">SAMPLE 1</span>
            {#if optimalSample === 1}
              <span class="optimal-sample-badge">OPTIMAL SAMPLE</span>
            {/if}
          </div>
          <span class="compare-duration">{s1DurationDays} DAYS</span>
        </button>
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

      <div
        class="hud-date-picker end-picker compare-sample-card"
        class:is-optimal-card={optimalSample === 2}
        class:is-active-slot={activeSiteSlot === 2}
      >
        <button
          type="button"
          class="compare-card-header align-right"
          onclick={() => handleSelectSiteSlot(2)}
          aria-label="Target Sample 2"
        >
          <div class="compare-tag-wrap">
            {#if optimalSample === 2}
              <span class="optimal-sample-badge">OPTIMAL SAMPLE</span>
            {/if}
            <span class="compare-tag s2-tag">SAMPLE 2</span>
          </div>
          <span class="compare-duration">{s1DurationDays} DAYS</span>
        </button>
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
      bind:compareType
      bind:activeSiteSlot
      bind:site1Coords
      bind:site2Coords
      site1Name={site1DisplayName}
      site2Name={site2DisplayName}
      onSiteSlotSelect={handleSelectSiteSlot}
      onCompareTypeChange={handleCompareTypeChange}
      {lunarPositions}
      {lunarPositionsS2}
      {optimalSample}
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
        {compareType}
        site1Name={site1DisplayName}
        site2Name={site2DisplayName}
        onTimeChange={handlePlayheadChange}
        {hoveredCoords}
        showSubmit={hasDateChanged}
        onSubmit={handleSubmitDateRange}
        {optimalSample}
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
    -webkit-backdrop-filter: blur(24px);
    backdrop-filter: blur(24px);
    transform: translateZ(0);
    will-change: backdrop-filter;
    border: 1px solid rgba(255, 255, 255, 0.16);
    padding: 14px;
    box-sizing: border-box;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  .compare-card-header {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    width: 100%;
    box-sizing: border-box;
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

  .compare-tag-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .optimal-sample-badge {
    font-family: 'Jersey 25', sans-serif;
    font-size: 13px;
    letter-spacing: 1.2px;
    color: #4ade80;
    background: rgba(74, 222, 128, 0.16);
    border: 1px solid rgba(74, 222, 128, 0.6);
    border-radius: 2px;
    padding: 1px 7px;
    text-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
    box-shadow: 0 0 10px rgba(74, 222, 128, 0.25);
    white-space: nowrap;
    animation: fadeIn 0.25s ease-out;
  }

  .compare-sample-card.is-optimal-card {
    border-color: rgba(74, 222, 128, 0.5);
    box-shadow:
      0 12px 32px rgba(0, 0, 0, 0.6),
      0 0 16px rgba(74, 222, 128, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .compare-sample-card.is-active-slot {
    border-color: rgba(51, 229, 255, 0.6);
    box-shadow:
      0 12px 32px rgba(0, 0, 0, 0.6),
      0 0 16px rgba(51, 229, 255, 0.22),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .compare-sample-card.is-optimal-card.is-active-slot {
    border-color: rgba(74, 222, 128, 0.75);
    box-shadow:
      0 12px 32px rgba(0, 0, 0, 0.6),
      0 0 20px rgba(74, 222, 128, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
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
    transform: translateX(-50%) translateZ(0);
    will-change: backdrop-filter;
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
    -webkit-backdrop-filter: blur(20px);
    backdrop-filter: blur(20px);
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
