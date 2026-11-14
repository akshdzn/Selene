<script>
  import { onMount, onDestroy } from 'svelte';
  import { calculateCelestialPositions } from './ephemeris.js';

  let {
    lunarPositions = null,
    onTimeChange = null
  } = $props();

  // Reactive state
  let currentPlayheadIndex = $state(240);
  let currentPlayheadTime = $state('');
  let isDragging = $state(false);
  let trackElement = $state(null);
  let lastDatasetRef = null;

  // Derived dataset
  let dataset = $derived(lunarPositions?.dataset);
  let sunList = $derived(dataset?.sun || []);
  let earthList = $derived(dataset?.earth || []);
  let totalSteps = $derived(sunList.length || 481);

  // Initialize playhead when dataset is first loaded or changes
  $effect(() => {
    if (dataset && dataset !== lastDatasetRef) {
      lastDatasetRef = dataset;
      const idx = typeof lunarPositions.currentIndex === 'number' ? lunarPositions.currentIndex : 240;
      currentPlayheadIndex = Math.min(idx, totalSteps - 1);
      currentPlayheadTime = sunList[currentPlayheadIndex]?.time || '';
    }
  });

  // Calculate contiguous intervals for each category
  let intervals = $derived.by(() => {
    if (!sunList.length || !earthList.length) return { optimal: [], power: [], comms: [], dark: [] };

    const n = Math.min(sunList.length, earthList.length);

    const isPowerAt = (i) => (sunList[i]?.elevation ?? -15) > 0;
    const isCommsAt = (i) => (earthList[i]?.elevation ?? -15) > 2;
    const isOptimalAt = (i) => isPowerAt(i) && isCommsAt(i);
    const isDarkAt = (i) => !isPowerAt(i);

    const getRuns = (predicate, type) => {
      const runs = [];
      let cur = null;
      for (let i = 0; i < n; i++) {
        const val = predicate(i);
        if (val) {
          if (!cur) cur = { start: i, end: i, type };
          else cur.end = i;
        } else if (cur) {
          runs.push(cur);
          cur = null;
        }
      }
      if (cur) runs.push(cur);
      return runs;
    };

    const darkRuns = getRuns(isDarkAt, 'DARK');
    const powerRuns = getRuns(isPowerAt, 'POWER');
    const commsRuns = getRuns(isCommsAt, 'COMMS');
    const optimalRuns = getRuns(isOptimalAt, 'OPTIMAL');

    // Seamlessly bridge complementary adjacent runs so there is zero pixel gap at sunrise/sunset
    for (const d of darkRuns) {
      for (const p of powerRuns) {
        if (d.end + 1 === p.start) {
          d.end = p.start;
        } else if (p.end + 1 === d.start) {
          p.end = d.start;
        }
      }
    }

    return {
      optimal: optimalRuns,
      power: powerRuns,
      comms: commsRuns,
      dark: darkRuns
    };
  });

  function hasOverlap(runA, listB) {
    return listB.some((b) => Math.max(runA.start, b.start) <= Math.min(runA.end, b.end));
  }

  let expandedBadgeKeys = $state(new Set());

  function toggleBadge(badgeKey) {
    const updated = new Set(expandedBadgeKeys);
    if (updated.has(badgeKey)) {
      updated.delete(badgeKey);
    } else {
      updated.add(badgeKey);
    }
    expandedBadgeKeys = updated;
  }

  function formatRangeDateText(type, start, end) {
    const startEntry = sunList[start];
    const endEntry = sunList[Math.min(end, sunList.length - 1)];
    const startTimeStr = startEntry?.time || '';
    const endTimeStr = endEntry?.time || '';

    const parseDate = (str) => {
      if (!str) return null;
      const m = str.trim().match(/^(\d{4})-([A-Za-z0-9]+)-(\d{1,2})/);
      if (!m) return null;
      const year = m[1];
      let month = m[2].toUpperCase();
      const day = m[3].padStart(2, '0');
      if (/^\d+$/.test(month)) {
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        month = months[parseInt(month, 10) - 1] || month;
      }
      return { year, month, day, str: `${month} ${day}` };
    };

    const d1 = parseDate(startTimeStr);
    const d2 = parseDate(endTimeStr);

    if (d1 && d2) {
      return `${type} | ${d1.str} ${d1.year} – ${d2.str} ${d2.year}`;
    }

    return `${type} | STEP ${start} – ${end}`;
  }

  // Calculate stacked start badges above the timeline track
  let stackedBadges = $derived.by(() => {
    const list = [];
    const totalDuration = Math.max(1, totalSteps - 1);

    const formatBadgeText = (type, start, end) => {
      const hours = Math.max(1, end - start);
      const pctVal = +((hours / totalDuration) * 100).toFixed(1);
      const pctStr = pctVal % 1 === 0 ? `${pctVal.toFixed(0)}%` : `${pctVal}%`;
      return `${type} | ${hours}h | ${pctStr}`;
    };

    for (const r of intervals.dark) {
      if (r.end - r.start > 12) {
        const key = `DARK-${r.start}-${r.end}`;
        list.push({
          key,
          type: 'DARK',
          start: r.start,
          end: r.end,
          rank: 0,
          statsText: formatBadgeText('DARK', r.start, r.end),
          dateText: formatRangeDateText('DARK', r.start, r.end),
          className: 'badge-dark'
        });
      }
    }
    for (const r of intervals.power) {
      const key = `POWER-${r.start}-${r.end}`;
      list.push({
        key,
        type: 'POWER',
        start: r.start,
        end: r.end,
        rank: 0,
        statsText: formatBadgeText('POWER', r.start, r.end),
        dateText: formatRangeDateText('POWER', r.start, r.end),
        className: 'badge-power'
      });
    }
    for (const r of intervals.comms) {
      const key = `COMMS-${r.start}-${r.end}`;
      list.push({
        key,
        type: 'COMMS',
        start: r.start,
        end: r.end,
        rank: 1,
        statsText: formatBadgeText('COMMS', r.start, r.end),
        dateText: formatRangeDateText('COMMS', r.start, r.end),
        className: 'badge-comms'
      });
    }
    for (const r of intervals.optimal) {
      const key = `OPTIMAL-${r.start}-${r.end}`;
      list.push({
        key,
        type: 'OPTIMAL',
        start: r.start,
        end: r.end,
        rank: 2,
        statsText: formatBadgeText('OPTIMAL', r.start, r.end),
        dateText: formatRangeDateText('OPTIMAL', r.start, r.end),
        className: 'badge-optimal'
      });
    }

    list.sort((a, b) => a.start - b.start || a.rank - b.rank);

    const thresholdSteps = 45;
    for (let i = 0; i < list.length; i++) {
      let stackLevel = 0;
      for (let j = 0; j < i; j++) {
        if (Math.abs(list[i].start - list[j].start) < thresholdSteps) {
          stackLevel = Math.max(stackLevel, list[j].stackLevel + 1);
        }
      }
      list[i].stackLevel = stackLevel;
      list[i].leftPct = (list[i].start / (totalSteps - 1)) * 100;
      list[i].bottomOffset = 2 + stackLevel * 28;
    }

    return list;
  });

  // Calculate stacked end indicators (same stacking rule: higher rank on top of bottom one)
  let stackedEndIndicators = $derived.by(() => {
    const list = [];

    for (const r of intervals.dark) {
      if (r.end - r.start > 12) {
        list.push({ type: 'DARK', start: r.start, end: r.end, rank: 0, tickClass: 'tick-dark' });
      }
    }
    for (const r of intervals.power) {
      list.push({ type: 'POWER', start: r.start, end: r.end, rank: 0, tickClass: 'tick-power' });
    }
    for (const r of intervals.comms) {
      list.push({ type: 'COMMS', start: r.start, end: r.end, rank: 1, tickClass: 'tick-comms' });
    }
    for (const r of intervals.optimal) {
      list.push({ type: 'OPTIMAL', start: r.start, end: r.end, rank: 2, tickClass: 'tick-optimal' });
    }

    list.sort((a, b) => a.end - b.end || a.rank - b.rank);

    const thresholdSteps = 35;
    for (let i = 0; i < list.length; i++) {
      let stackLevel = 0;
      for (let j = 0; j < i; j++) {
        if (Math.abs(list[i].end - list[j].end) < thresholdSteps) {
          stackLevel = Math.max(stackLevel, list[j].stackLevel + 1);
        }
      }
      list[i].stackLevel = stackLevel;
      list[i].endPct = (list[i].end / (totalSteps - 1)) * 100;
      list[i].bottomOffset = 2 + stackLevel * 28;
    }

    return list;
  });

  // Date and Time formatting for bottom-left display (parses ephemeris time strings accurately)
  let formattedTime = $derived.by(() => {
    const activeEntry = sunList[currentPlayheadIndex];
    const timeStr = activeEntry?.time || currentPlayheadTime;

    if (!timeStr) {
      const now = new Date();
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const dateStr = `${months[now.getMonth()]} ${String(now.getDate()).padStart(2, '0')} ${now.getFullYear()}`;
      let h = now.getHours();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return { dateStr, timeStr: `${String(h).padStart(2, '0')}:00 ${ampm}` };
    }

    // Match "YYYY-Mon-DD HH:MM" or "YYYY-MM-DD HH:MM"
    const m = timeStr.trim().match(/^(\d{4})-([A-Za-z0-9]+)-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
    if (m) {
      const year = m[1];
      let month = m[2].toUpperCase();
      const day = m[3].padStart(2, '0');
      let hourNum = parseInt(m[4], 10);
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      hourNum = hourNum % 12 || 12;
      const hourStr = `${String(hourNum).padStart(2, '0')}:00 ${ampm}`;

      if (/^\d+$/.test(month)) {
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        month = months[parseInt(month, 10) - 1] || month;
      }
      return {
        dateStr: `${month} ${day} ${year}`,
        timeStr: hourStr
      };
    }

    return {
      dateStr: timeStr,
      timeStr: ''
    };
  });

  function setPlayheadIndex(targetIndex) {
    const idx = Math.min(totalSteps - 1, Math.max(0, targetIndex));
    if (idx === currentPlayheadIndex && currentPlayheadTime) return;

    currentPlayheadIndex = idx;
    const sunEntry = sunList[idx];
    const earthEntry = earthList[idx];
    currentPlayheadTime = sunEntry?.time || '';

    if (onTimeChange && sunEntry && earthEntry) {
      const siteLat = dataset?.coordinates?.latitude ?? 0;
      const siteLon = dataset?.coordinates?.longitude ?? 0;
      const celestialPositions = calculateCelestialPositions(sunEntry, earthEntry, siteLat, siteLon);
      onTimeChange({
        index: idx,
        time: currentPlayheadTime,
        sunEntry,
        earthEntry,
        celestialPositions
      });
    }
  }

  function updatePlayheadFromPointer(clientX) {
    if (!trackElement) return;
    const rect = trackElement.getBoundingClientRect();
    const clampedX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const fraction = rect.width > 0 ? clampedX / rect.width : 0;
    const targetIndex = Math.min(totalSteps - 1, Math.max(0, Math.round(fraction * (totalSteps - 1))));
    setPlayheadIndex(targetIndex);
  }

  let isMovingKeys = $state(false);
  let keyMoveTimeout = null;

  function triggerKeyMovement() {
    isMovingKeys = true;
    if (keyMoveTimeout) clearTimeout(keyMoveTimeout);
    keyMoveTimeout = setTimeout(() => {
      isMovingKeys = false;
    }, 400);
  }

  function handleKeyDown(e) {
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPlayheadIndex(currentPlayheadIndex + 1);
      triggerKeyMovement();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPlayheadIndex(currentPlayheadIndex - 1);
      triggerKeyMovement();
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      setPlayheadIndex(currentPlayheadIndex + 24);
      triggerKeyMovement();
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      setPlayheadIndex(currentPlayheadIndex - 24);
      triggerKeyMovement();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setPlayheadIndex(0);
      triggerKeyMovement();
    } else if (e.key === 'End') {
      e.preventDefault();
      setPlayheadIndex(totalSteps - 1);
      triggerKeyMovement();
    }
  }

  function handlePointerDown(e) {
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    try {
      trackElement?.setPointerCapture(e.pointerId);
    } catch {}
    updatePlayheadFromPointer(e.clientX);
  }

  function handlePointerMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    updatePlayheadFromPointer(e.clientX);
  }

  function handlePointerUp(e) {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    isDragging = false;
    try {
      trackElement?.releasePointerCapture(e.pointerId);
    } catch {}
  }

  function handlePointerCancel() {
    isDragging = false;
  }

  onMount(() => {
    const onWinMove = (e) => {
      if (isDragging) {
        e.preventDefault();
        updatePlayheadFromPointer(e.clientX);
      }
    };
    const onWinUp = (e) => {
      if (isDragging) {
        isDragging = false;
      }
    };
    window.addEventListener('pointermove', onWinMove, { passive: false });
    window.addEventListener('pointerup', onWinUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointermove', onWinMove);
      window.removeEventListener('pointerup', onWinUp);
      window.removeEventListener('keydown', handleKeyDown);
      if (keyMoveTimeout) clearTimeout(keyMoveTimeout);
    };
  });

  // Calculate step tick marks: one step mark for every hour in the dataset (matching hour count)
  let tickMarks = $derived.by(() => {
    const marks = [];
    const count = Math.max(1, totalSteps - 1);
    for (let i = 0; i <= count; i++) {
      marks.push({
        pct: (i / count) * 100,
        isDay: i % 24 === 0,
        isHalfDay: i % 12 === 0
      });
    }
    return marks;
  });
</script>

<div class="timeline-wrapper">
  <!-- Top Labels & Badges Row (Stacked dynamically so higher labels sit on top of bottom ones) -->
  <div class="badges-row">
    {#each stackedBadges as b (b.key)}
      {@const isUnderPlayhead = currentPlayheadIndex >= b.start && currentPlayheadIndex <= b.end}
      {@const isExpanded = expandedBadgeKeys.has(b.key)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="badge-item {b.className} {isUnderPlayhead ? 'is-under-playhead' : 'is-outside-playhead'}"
        style="left: {b.leftPct}%; bottom: {b.bottomOffset}px; opacity: {isUnderPlayhead ? 1 : 0.5};"
        onclick={(e) => {
          e.stopPropagation();
          toggleBadge(b.key);
        }}
        title="Click to toggle start and end dates"
      >
        <span class="badge-text">{isExpanded ? b.dateText : b.statsText}</span>
      </div>
    {/each}

    {#each stackedEndIndicators as item}
      {@const isUnderPlayhead = currentPlayheadIndex >= item.start && currentPlayheadIndex <= item.end}
      <div
        class="end-tick {item.tickClass}"
        style="left: {item.endPct}%; bottom: {item.bottomOffset}px; opacity: {isUnderPlayhead ? 1 : 0.5};"
      ></div>
    {/each}
  </div>

  <!-- Main Timeline Track Bar (height: 40px, snaps to hourly steps like a range slider) -->
  <div
    class="timeline-track"
    bind:this={trackElement}
    tabindex="0"
    role="slider"
    aria-label="Mission Timeline (Hourly Ephemeris)"
    aria-valuemin="0"
    aria-valuemax={totalSteps - 1}
    aria-valuenow={currentPlayheadIndex}
    aria-valuetext={currentPlayheadTime}
    onkeydown={handleKeyDown}
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerCancel}
  >
    <!-- Background Step Tick Lines (Matches hour count) -->
    <div class="steps-grid">
      {#each tickMarks as mark}
        <div
          class="step-line {mark.isDay ? 'is-day' : mark.isHalfDay ? 'is-half-day' : ''}"
          style="left: {mark.pct}%;"
        ></div>
      {/each}
    </div>

    <!-- 1. DARK Intervals -->
    {#each intervals.dark as darkRun}
      {@const left = (darkRun.start / (totalSteps - 1)) * 100}
      {@const width = ((darkRun.end - darkRun.start) / (totalSteps - 1)) * 100}
      {@const overlapsComms = hasOverlap(darkRun, intervals.comms)}
      <div
        class="range-rect range-dark {overlapsComms ? 'is-bottom-half' : 'is-full'}"
        style="left: {left}%; width: {width}%;"
      ></div>
    {/each}

    <!-- 2. POWER Intervals (Yellow #FFD900: bottom half if overlapping with COMMS) -->
    {#each intervals.power as powerRun}
      {@const left = (powerRun.start / (totalSteps - 1)) * 100}
      {@const width = ((powerRun.end - powerRun.start) / (totalSteps - 1)) * 100}
      {@const overlapsComms = hasOverlap(powerRun, intervals.comms)}
      <div
        class="range-rect range-power {overlapsComms ? 'is-bottom-half' : 'is-full'}"
        style="left: {left}%; width: {width}%;"
      ></div>
    {/each}

    <!-- 3. COMMS Intervals (Blue #00B2FF: top half if overlapping with POWER or DARK) -->
    {#each intervals.comms as commsRun}
      {@const left = (commsRun.start / (totalSteps - 1)) * 100}
      {@const width = ((commsRun.end - commsRun.start) / (totalSteps - 1)) * 100}
      {@const overlapsPowerOrDark = hasOverlap(commsRun, intervals.power) || hasOverlap(commsRun, intervals.dark)}
      <div
        class="range-rect range-comms {overlapsPowerOrDark ? 'is-top-half' : 'is-full'}"
        style="left: {left}%; width: {width}%;"
      ></div>
    {/each}

    <!-- 4. OPTIMAL (OVERALL) Intervals: Always top layer, full height (40px, never changes height) -->
    <!-- Semi-transparent luminous overlay with solid white framing so POWER and COMMS beneath remain clearly visible -->
    {#each intervals.optimal as optRun}
      {@const left = (optRun.start / (totalSteps - 1)) * 100}
      {@const width = ((optRun.end - optRun.start) / (totalSteps - 1)) * 100}
      <div
        class="range-rect range-optimal is-full"
        style="left: {left}%; width: {width}%;"
      ></div>
    {/each}

    <!-- Draggable Snapping Playhead (Group 4 from Figma #26:46) -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="playhead {isDragging || isMovingKeys ? 'is-dragging' : ''}"
      style="left: {(currentPlayheadIndex / (totalSteps - 1)) * 100}%;"
      onpointerdown={handlePointerDown}
    >
      <svg
        class="playhead-svg"
        viewBox="0 0 21 68"
        width="21"
        height="68"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Top Pin Marker Head & Downward triangle arrow (decorative part, transparent when idle) -->
        <g class="playhead-decorative">
          <rect width="21" height="28" fill="#FF2600" />
          <path d="M0 28H21L10.5 38.5L0 28Z" fill="#FF2600" />
        </g>
        <!-- Vertical needle line through the 40px track (y: 28 to 68) -->
        <rect class="playhead-needle" x="8" y="28" width="5" height="40" fill="#FF2600" />
      </svg>
    </div>
  </div>

  <!-- Bottom Info Row (below track bar) -->
  <div class="bottom-info-row">
    <div class="bottom-left-time">
      <span class="info-date">{formattedTime.dateStr}</span>
      <span class="info-time">{formattedTime.timeStr}</span>
    </div>
    <div class="bottom-right-hint">
      Drag to rotate the Moon | Scroll to zoom
    </div>
  </div>
</div>

<style>
  .timeline-wrapper {
    position: absolute;
    bottom: 50px;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    max-width: 1520px;
    z-index: 10;
    user-select: none;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    pointer-events: auto;
  }

  /* Top Badges Row: Auto height to fit vertically stacked overlapping badges and end ticks */
  .badges-row {
    position: relative;
    height: 86px;
    width: 100%;
    z-index: 5;
    pointer-events: none;
  }

  .badge-item {
    position: absolute;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 3px 8px;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.5px;
    border-radius: 1px;
    white-space: nowrap;
    z-index: 5;
    cursor: pointer;
    pointer-events: auto;
    transition: bottom 0.15s ease-out, opacity 0.2s ease;
  }

  .badge-item:hover {
    opacity: 1 !important;
  }

  .badge-optimal {
    background-color: #ffffff;
    color: #000000;
  }

  .badge-power {
    background-color: #ffd900;
    color: #000000;
  }

  .badge-comms {
    background-color: #00b2ff;
    color: #000000;
  }

  .badge-dark {
    background-color: #000838;
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  /* Vertical 4px line ticks at interval ends */
  .end-tick {
    position: absolute;
    width: 4px;
    height: 26px;
    transform: translateX(-100%);
    z-index: 4;
    transition: bottom 0.15s ease-out, opacity 0.2s ease;
  }

  .tick-optimal {
    background-color: #ffffff;
  }

  .tick-power {
    background-color: #ffd900;
  }

  .tick-comms {
    background-color: #00b2ff;
  }

  .tick-dark {
    background-color: #000838;
  }

  /* Main Track */
  .timeline-track {
    position: relative;
    width: 100%;
    height: 40px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-sizing: border-box;
    cursor: pointer;
    overflow: visible;
    touch-action: none;
    z-index: 20;
  }

  .timeline-track:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.4);
    outline-offset: 2px;
  }

  /* Step Lines */
  .steps-grid {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }

  .step-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background-color: rgba(255, 255, 255, 0.12);
  }

  .step-line.is-half-day {
    background-color: rgba(255, 255, 255, 0.25);
  }

  .step-line.is-day {
    background-color: rgba(255, 255, 255, 0.45);
  }

  /* Range Rectangles */
  .range-rect {
    position: absolute;
    box-sizing: border-box;
    pointer-events: none;
  }

  .range-rect.is-full {
    top: 0;
    height: 100%;
  }

  .range-rect.is-top-half {
    top: 0;
    height: 50%;
  }

  .range-rect.is-bottom-half {
    top: 50%;
    height: 50%;
  }

  /* OPTIMAL is on top layer (z-index: 3), takes full height (never changes height),
     with luminous overlay so COMMS (top half, blue) and POWER (bottom half, yellow)
     beneath it are clearly visible */
  .range-optimal {
    background-color: rgba(255, 255, 255, 0.35);
    border: 2px solid #ffffff;
    z-index: 3;
  }

  .range-comms {
    background-color: #00b2ff;
    z-index: 2;
  }

  .range-power {
    background-color: #ffd900;
    z-index: 1;
  }

  .range-dark {
    background-color: rgba(0, 8, 56, 0.7);
    z-index: 1;
  }

  /* Draggable Playhead */
  .playhead {
    position: absolute;
    top: -28px;
    width: 21px;
    height: 68px;
    transform: translateX(-50%);
    cursor: grab;
    z-index: 100; /* Highest priority on top of everything */
    touch-action: none;
    pointer-events: auto; /* Make playhead directly draggable */
  }

  .playhead:active,
  .playhead.is-dragging,
  .timeline-track:active .playhead {
    cursor: grabbing;
  }

  /* Decorative marker head & arrow are transparent when playhead is not moving/idle */
  .playhead-decorative {
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  /* Reveal decorative handle on hover or while dragging */
  .playhead:hover .playhead-decorative,
  .playhead.is-dragging .playhead-decorative {
    opacity: 1;
  }

  .playhead-svg {
    display: block;
  }

  /* Bottom Info Row */
  .bottom-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-top: 10px;
    pointer-events: none;
  }

  .bottom-left-time {
    display: flex;
    align-items: center;
    gap: 16px;
    color: #ffffff;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .info-date,
  .info-time {
    padding: 3px 0;
  }

  .bottom-right-hint {
    color: rgba(255, 255, 255, 0.5);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.2px;
  }
</style>
