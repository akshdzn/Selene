<script>
  import { onMount, onDestroy } from 'svelte';
  import { calculateCelestialPositions, calculateOptimalValue } from './ephemeris.js';
  import Scritto from "@scritto/svelte";
  import SubmitButton from './SubmitButton.svelte';

  let {
    lunarPositions = null,
    lunarPositionsS2 = null,
    mode = 'single',
    onTimeChange = null,
    hoveredCoords = null,
    showSubmit = false,
    onSubmit = () => {},
    optimalSample = null
  } = $props();

  // Reactive state
  let currentPlayheadIndex = $state(240);
  let currentPlayheadTime = $state('');
  let isDragging = $state(false);
  let trackElement = $state(null);
  let scrollViewport = $state(null);
  let timelineScale = $state(1);
  let previousScale = 1;
  let lastDatasetRef = null;

  // Derived datasets
  let dataset = $derived(lunarPositions?.dataset);
  let sunList = $derived(dataset?.sun || []);
  let earthList = $derived(dataset?.earth || []);
  let totalSteps = $derived(sunList.length || 481);

  let datasetS2 = $derived(lunarPositionsS2?.dataset);
  let sunListS2 = $derived(datasetS2?.sun || []);
  let earthListS2 = $derived(datasetS2?.earth || []);

  // Initialize playhead when dataset is first loaded or changes
  $effect(() => {
    if (dataset && dataset !== lastDatasetRef) {
      lastDatasetRef = dataset;
      const idx = typeof lunarPositions.currentIndex === 'number' ? lunarPositions.currentIndex : 240;
      currentPlayheadIndex = Math.min(idx, totalSteps - 1);
      currentPlayheadTime = sunList[currentPlayheadIndex]?.time || '';
    }
  });

  // Optimal value calculations for Compare Mode
  let sample1OptimalValue = $derived(
    calculateOptimalValue(sunList, earthList)
  );
  let sample2OptimalValue = $derived(
    calculateOptimalValue(sunListS2, earthListS2)
  );

  // Variable called Optimal Sample which gets input from the higher Optimal value between the two samples
  let derivedOptimalSample = $derived.by(() => {
    if (mode !== 'compare') return null;
    if (!lunarPositions || !lunarPositionsS2) return null;
    const v1 = sample1OptimalValue;
    const v2 = sample2OptimalValue;
    if (v1 <= 0 && v2 <= 0) return null;
    // Check which sample is the optimal sample
    return v1 >= v2 ? 1 : 2;
  });

  let activeOptimalSample = $derived(optimalSample ?? derivedOptimalSample);
  let OptimalSample = $derived(activeOptimalSample);
  let higherOptimalValue = $derived(
    mode === 'compare' ? Math.max(sample1OptimalValue, sample2OptimalValue) : 0
  );

  // Calculate contiguous intervals for each category
  function computeIntervals(sunArr, earthArr) {
    if (!sunArr?.length || !earthArr?.length) return { optimal: [], power: [], comms: [], dark: [] };

    const n = Math.min(sunArr.length, earthArr.length);

    const isPowerAt = (i) => (sunArr[i]?.elevation ?? -15) > 0;
    const isCommsAt = (i) => (earthArr[i]?.elevation ?? -15) > 2;
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
  }

  let intervals = $derived(computeIntervals(sunList, earthList));
  let intervalsS2 = $derived(computeIntervals(sunListS2, earthListS2));

  function hasOverlap(runA, listB) {
    if (!listB) return false;
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

  function formatRangeDateText(type, start, end, sunArr) {
    if (!sunArr || !sunArr.length) return `${type} | STEP ${start} – ${end}`;
    const startEntry = sunArr[start];
    const endEntry = sunArr[Math.min(end, sunArr.length - 1)];
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

  function computeStackedBadges(intvs, sunArr, totalStepsCount, currentScale, prefix = '') {
    const list = [];
    const totalDuration = Math.max(1, totalStepsCount - 1);

    const formatBadgeText = (type, start, end) => {
      const hours = Math.max(1, end - start);
      const pctVal = +((hours / totalDuration) * 100).toFixed(1);
      const pctStr = pctVal % 1 === 0 ? `${pctVal.toFixed(0)}%` : `${pctVal}%`;
      return `${type} | ${hours}h | ${pctStr}`;
    };

    for (const r of intvs.dark) {
      if (r.end - r.start > 12) {
        const key = `${prefix}DARK-${r.start}-${r.end}`;
        list.push({
          key,
          type: 'DARK',
          start: r.start,
          end: r.end,
          rank: 0,
          statsText: formatBadgeText('DARK', r.start, r.end),
          dateText: formatRangeDateText('DARK', r.start, r.end, sunArr),
          className: 'badge-dark'
        });
      }
    }
    for (const r of intvs.power) {
      const key = `${prefix}POWER-${r.start}-${r.end}`;
      list.push({
        key,
        type: 'POWER',
        start: r.start,
        end: r.end,
        rank: 0,
        statsText: formatBadgeText('POWER', r.start, r.end),
        dateText: formatRangeDateText('POWER', r.start, r.end, sunArr),
        className: 'badge-power'
      });
    }
    for (const r of intvs.comms) {
      const key = `${prefix}COMMS-${r.start}-${r.end}`;
      list.push({
        key,
        type: 'COMMS',
        start: r.start,
        end: r.end,
        rank: 1,
        statsText: formatBadgeText('COMMS', r.start, r.end),
        dateText: formatRangeDateText('COMMS', r.start, r.end, sunArr),
        className: 'badge-comms'
      });
    }
    for (const r of intvs.optimal) {
      const key = `${prefix}OPTIMAL-${r.start}-${r.end}`;
      list.push({
        key,
        type: 'OPTIMAL',
        start: r.start,
        end: r.end,
        rank: 2,
        statsText: formatBadgeText('OPTIMAL', r.start, r.end),
        dateText: formatRangeDateText('OPTIMAL', r.start, r.end, sunArr),
        className: 'badge-optimal'
      });
    }

    list.sort((a, b) => a.start - b.start || a.rank - b.rank);

    const thresholdSteps = Math.max(10, Math.round(45 / currentScale));
    for (let i = 0; i < list.length; i++) {
      let stackLevel = 0;
      for (let j = 0; j < i; j++) {
        if (Math.abs(list[i].start - list[j].start) < thresholdSteps) {
          stackLevel = Math.max(stackLevel, list[j].stackLevel + 1);
        }
      }
      list[i].stackLevel = stackLevel;
      list[i].leftPct = (list[i].start / (totalStepsCount - 1)) * 100;
      list[i].bottomOffset = 2 + stackLevel * 28;
    }

    return list;
  }

  function computeStackedEndIndicators(intvs, totalStepsCount, currentScale) {
    const list = [];

    for (const r of intvs.dark) {
      if (r.end - r.start > 12) {
        list.push({ type: 'DARK', start: r.start, end: r.end, rank: 0, tickClass: 'tick-dark' });
      }
    }
    for (const r of intvs.power) {
      list.push({ type: 'POWER', start: r.start, end: r.end, rank: 0, tickClass: 'tick-power' });
    }
    for (const r of intvs.comms) {
      list.push({ type: 'COMMS', start: r.start, end: r.end, rank: 1, tickClass: 'tick-comms' });
    }
    for (const r of intvs.optimal) {
      list.push({ type: 'OPTIMAL', start: r.start, end: r.end, rank: 2, tickClass: 'tick-optimal' });
    }

    list.sort((a, b) => a.end - b.end || a.rank - b.rank);

    const thresholdSteps = Math.max(8, Math.round(35 / currentScale));
    for (let i = 0; i < list.length; i++) {
      let stackLevel = 0;
      for (let j = 0; j < i; j++) {
        if (Math.abs(list[i].end - list[j].end) < thresholdSteps) {
          stackLevel = Math.max(stackLevel, list[j].stackLevel + 1);
        }
      }
      list[i].stackLevel = stackLevel;
      list[i].endPct = (list[i].end / (totalStepsCount - 1)) * 100;
      list[i].bottomOffset = 2 + stackLevel * 28;
    }

    return list;
  }

  let stackedBadges = $derived(computeStackedBadges(intervals, sunList, totalSteps, timelineScale, 'S1-'));
  let stackedEndIndicators = $derived(computeStackedEndIndicators(intervals, totalSteps, timelineScale));

  let stackedBadgesS2 = $derived(computeStackedBadges(intervalsS2, sunListS2, totalSteps, timelineScale, 'S2-'));
  let stackedEndIndicatorsS2 = $derived(computeStackedEndIndicators(intervalsS2, totalSteps, timelineScale));

  function formatDisplayTime(sunArr, index, fallbackTime = '') {
    const activeEntry = sunArr?.[index];
    const timeStr = activeEntry?.time || fallbackTime;

    if (!timeStr) {
      const now = new Date();
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const dateStr = `${months[now.getMonth()]} ${String(now.getDate()).padStart(2, '0')} ${now.getFullYear()}`;
      let h = now.getHours();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return { dateStr, timeStr: `${String(h).padStart(2, '0')}:00 ${ampm}` };
    }

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
  }

  let formattedTime = $derived(formatDisplayTime(sunList, currentPlayheadIndex, currentPlayheadTime));
  let formattedTimeS2 = $derived(formatDisplayTime(sunListS2, currentPlayheadIndex, ''));

  function getRangeDateStr(sunArr) {
    if (!sunArr || !sunArr.length) return '';
    const first = sunArr[0]?.time;
    const last = sunArr[sunArr.length - 1]?.time;
    if (!first || !last) return '';
    const parsePart = (str) => {
      const m = str.trim().match(/^(\d{4})-([A-Za-z0-9]+)-(\d{1,2})/);
      if (!m) return str;
      let month = m[2].toUpperCase();
      if (/^\d+$/.test(month)) {
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        month = months[parseInt(month, 10) - 1] || month;
      }
      return `${month} ${m[3].padStart(2, '0')}, ${m[1]}`;
    };
    return `${parsePart(first)} – ${parsePart(last)}`;
  }

  let s1DateRangeStr = $derived(getRangeDateStr(sunList));
  let s2DateRangeStr = $derived(getRangeDateStr(sunListS2) || 'AWAITING CALCULATION');

  function keepPlayheadInView() {
    if (!scrollViewport || !trackElement || timelineScale <= 1) return;
    const pct = currentPlayheadIndex / Math.max(1, totalSteps - 1);
    const playheadPx = pct * trackElement.offsetWidth;
    const viewLeft = scrollViewport.scrollLeft;
    const viewWidth = scrollViewport.clientWidth;
    const margin = 80;
    if (playheadPx < viewLeft + margin) {
      scrollViewport.scrollLeft = Math.max(0, playheadPx - margin);
    } else if (playheadPx > viewLeft + viewWidth - margin) {
      scrollViewport.scrollLeft = playheadPx - viewWidth + margin;
    }
  }

  $effect(() => {
    const currentScale = timelineScale;
    if (scrollViewport && currentScale !== previousScale) {
      const playheadRatio = currentPlayheadIndex / Math.max(1, totalSteps - 1);
      const viewportWidth = scrollViewport.clientWidth;
      const newTotalWidth = viewportWidth * currentScale;
      const targetScroll = playheadRatio * newTotalWidth - viewportWidth / 2;
      scrollViewport.scrollLeft = Math.max(0, targetScroll);
      previousScale = currentScale;
    }
  });

  function handleTimelineWheel(e) {
    if (timelineScale > 1 && scrollViewport) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        return;
      }
      if (e.deltaY !== 0) {
        e.preventDefault();
        scrollViewport.scrollLeft += e.deltaY;
      }
    }
  }

  function setPlayheadIndex(targetIndex) {
    const idx = Math.min(totalSteps - 1, Math.max(0, targetIndex));
    if (idx === currentPlayheadIndex && currentPlayheadTime) return;

    currentPlayheadIndex = idx;
    const sunEntry = sunList[idx];
    const earthEntry = earthList[idx];
    currentPlayheadTime = sunEntry?.time || '';

    keepPlayheadInView();

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
    keepPlayheadInView();
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

{#snippet trackContent(intvs)}
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
  {#each intvs.dark as darkRun}
    {@const left = (darkRun.start / (totalSteps - 1)) * 100}
    {@const width = ((darkRun.end - darkRun.start) / (totalSteps - 1)) * 100}
    {@const overlapsComms = hasOverlap(darkRun, intvs.comms)}
    <div
      class="range-rect range-dark {overlapsComms ? 'is-bottom-half' : 'is-full'}"
      style="left: {left}%; width: {width}%;"
    ></div>
  {/each}

  <!-- 2. POWER Intervals (Yellow #FFD900: bottom half if overlapping with COMMS) -->
  {#each intvs.power as powerRun}
    {@const left = (powerRun.start / (totalSteps - 1)) * 100}
    {@const width = ((powerRun.end - powerRun.start) / (totalSteps - 1)) * 100}
    {@const overlapsComms = hasOverlap(powerRun, intvs.comms)}
    <div
      class="range-rect range-power {overlapsComms ? 'is-bottom-half' : 'is-full'}"
      style="left: {left}%; width: {width}%;"
    ></div>
  {/each}

  <!-- 3. COMMS Intervals (Blue #00B2FF: top half if overlapping with POWER or DARK) -->
  {#each intvs.comms as commsRun}
    {@const left = (commsRun.start / (totalSteps - 1)) * 100}
    {@const width = ((commsRun.end - commsRun.start) / (totalSteps - 1)) * 100}
    {@const overlapsPowerOrDark = hasOverlap(commsRun, intvs.power) || hasOverlap(commsRun, intvs.dark)}
    <div
      class="range-rect range-comms {overlapsPowerOrDark ? 'is-top-half' : 'is-full'}"
      style="left: {left}%; width: {width}%;"
    ></div>
  {/each}

  <!-- 4. OPTIMAL (OVERALL) Intervals: Always top layer, full height (40px, never changes height) -->
  {#each intvs.optimal as optRun}
    {@const left = (optRun.start / (totalSteps - 1)) * 100}
    {@const width = ((optRun.end - optRun.start) / (totalSteps - 1)) * 100}
    <div
      class="range-rect range-optimal is-full"
      style="left: {left}%; width: {width}%;"
    ></div>
  {/each}

  <!-- Draggable Snapping Playhead -->
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
      <g class="playhead-decorative">
        <rect width="21" height="28" fill="#FF2600" />
        <path d="M0 28H21L10.5 38.5L0 28Z" fill="#FF2600" />
      </g>
      <rect class="playhead-needle" x="8" y="28" width="5" height="40" fill="#FF2600" />
    </svg>
  </div>
{/snippet}

{#snippet badgesContent(bList, endList, isCompare = false)}
  <div class="badges-row {isCompare ? 'compare-badges-row' : ''}">
    {#each bList as b (b.key)}
      {@const isUnderPlayhead = currentPlayheadIndex >= b.start && currentPlayheadIndex <= b.end}
      {@const isExpanded = expandedBadgeKeys.has(b.key)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="badge-item {b.className} {isUnderPlayhead ? 'is-under-playhead' : 'is-outside-playhead'}"
        style="left: {b.leftPct}%; bottom: {b.bottomOffset}px; opacity: {isUnderPlayhead ? 1 : 0.5}; {b.leftPct > 80 ? 'transform: translateX(-100%);' : ''}"
        onclick={(e) => {
          e.stopPropagation();
          toggleBadge(b.key);
        }}
        title="Click to toggle start and end dates"
      >
        <span class="badge-text">
          <Scritto value={isExpanded ? b.dateText : b.statsText} />
        </span>
      </div>
    {/each}

    {#each endList as item}
      {@const isUnderPlayhead = currentPlayheadIndex >= item.start && currentPlayheadIndex <= item.end}
      <div
        class="end-tick {item.tickClass}"
        style="left: {item.endPct}%; bottom: {item.bottomOffset}px; opacity: {isUnderPlayhead ? 1 : 0.5};"
      ></div>
    {/each}
  </div>
{/snippet}

<div class="timeline-wrapper {mode === 'compare' ? 'is-compare-wrapper' : ''}">
  <!-- Centered Calculate Submit Button directly above timeline -->
  {#if showSubmit}
    <div class="timeline-calculate-container">
      <SubmitButton
        label="CALCULATE"
        onclick={onSubmit}
      />
    </div>
  {/if}

  <!-- Scrollable viewport for scalable timeline contents -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="timeline-scroll-viewport"
    bind:this={scrollViewport}
    onwheel={handleTimelineWheel}
  >
    <div
      class="timeline-scalable-content {mode === 'compare' ? 'is-compare' : ''}"
      style="width: {timelineScale * 100}%;"
    >
      {#if mode === 'compare'}
        <!-- UPPER TIMELINE: SAMPLE 2 -->
        <div class="timeline-track-block s2-block">
          <div class="track-block-header">
            <div class="track-tag-wrap">
              <span class="track-tag s2-tag">SAMPLE 2</span>
              {#if activeOptimalSample === 2}
                <span class="optimal-sample-badge">OPTIMAL SAMPLE</span>
              {/if}
            </div>
            <span class="track-date-range">{s2DateRangeStr}</span>
          </div>
          {@render badgesContent(stackedBadgesS2, stackedEndIndicatorsS2, true)}
          <div
            class="timeline-track"
            tabindex="0"
            role="slider"
            aria-label="Mission Timeline - Sample 2"
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
            {@render trackContent(intervalsS2)}
          </div>
        </div>

        <!-- LOWER TIMELINE: SAMPLE 1 -->
        <div class="timeline-track-block s1-block">
          <div class="track-block-header">
            <div class="track-tag-wrap">
              <span class="track-tag s1-tag">SAMPLE 1</span>
              {#if activeOptimalSample === 1}
                <span class="optimal-sample-badge">OPTIMAL SAMPLE</span>
              {/if}
            </div>
            <span class="track-date-range">{s1DateRangeStr}</span>
          </div>
          {@render badgesContent(stackedBadges, stackedEndIndicators, true)}
          <div
            class="timeline-track"
            bind:this={trackElement}
            tabindex="0"
            role="slider"
            aria-label="Mission Timeline - Sample 1"
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
            {@render trackContent(intervals)}
          </div>
        </div>
      {:else}
        <!-- SINGLE MODE: Original Timeline -->
        {@render badgesContent(stackedBadges, stackedEndIndicators, false)}
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
          {@render trackContent(intervals)}
        </div>
      {/if}
    </div>
  </div>

  <!-- Bottom Info Row (below track bar) -->
  <div class="bottom-info-row">
    <div class="bottom-left-group">
      {#if mode === 'compare'}
        <div class="bottom-left-time compare-times">
          <div class="compare-time-pill s1-pill" class:is-optimal-pill={activeOptimalSample === 1}>
            <span class="pill-label">S1</span>
            {#if activeOptimalSample === 1}
              <span class="pill-optimal-tag">★ OPTIMAL</span>
            {/if}
            <span>{formattedTime.dateStr}</span>
            <span>{formattedTime.timeStr}</span>
          </div>
          <div class="compare-time-pill s2-pill" class:is-optimal-pill={activeOptimalSample === 2}>
            <span class="pill-label">S2</span>
            {#if activeOptimalSample === 2}
              <span class="pill-optimal-tag">★ OPTIMAL</span>
            {/if}
            <span>{formattedTimeS2.dateStr}</span>
            <span>{formattedTimeS2.timeStr}</span>
          </div>
        </div>
      {:else}
        <div class="bottom-left-time">
          <span>{formattedTime.dateStr}</span>
          <span>{formattedTime.timeStr}</span>
        </div>
      {/if}

      <div class="timeline-scale-control" title="Adjust timeline scale (zoom in/out)">
        <span class="scale-label">SCALE</span>
        <input
          type="range"
          class="scale-slider"
          min="1"
          max="12"
          step="0.1"
          bind:value={timelineScale}
          onpointerdown={(e) => e.stopPropagation()}
          aria-label="Timeline zoom scale"
        />
        <button
          type="button"
          class="scale-val"
          onclick={() => (timelineScale = 1)}
          title="Click to reset scale to 1.0x"
        >
          {timelineScale.toFixed(1)}x
        </button>
      </div>
    </div>

    <div class="bottom-right-hint {hoveredCoords ? 'is-coords' : ''}">
      {hoveredCoords ? (hoveredCoords.full || `${hoveredCoords.latStr}, ${hoveredCoords.lonStr}`) : 'Drag to rotate the Moon | Scroll to zoom'}
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

  /* Centered Calculate Submit Button positioned directly above timeline badges */
  .timeline-calculate-container {
    position: absolute;
    bottom: calc(100% + 14px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 25;
    pointer-events: auto;
  }

  /* Scrollable Viewport & Scalable Content */
  .timeline-scroll-viewport {
    position: relative;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
  }

  .timeline-scroll-viewport::-webkit-scrollbar {
    height: 4px;
  }

  .timeline-scroll-viewport::-webkit-scrollbar-track {
    background: transparent;
  }

  .timeline-scroll-viewport::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.25);
    border-radius: 2px;
  }

  .timeline-scroll-viewport::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
  }

  .timeline-scalable-content {
    position: relative;
    min-width: 100%;
  }

  /* Top Badges Row: Auto height to fit vertically stacked overlapping badges and end ticks */
  .badges-row {
    position: relative;
    height: 86px;
    width: 100%;
    z-index: 25;
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
    line-height: 1.2;
    letter-spacing: 0.5px;
    border-radius: 1px;
    white-space: nowrap;
    z-index: 25;
    cursor: pointer;
    pointer-events: auto;
    transition: bottom 0.15s ease-out, opacity 0.2s ease;
    box-sizing: border-box;
  }

  .badge-text {
    display: inline-flex;
    align-items: center;
    line-height: 1.2;
    overflow: visible;
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

  .bottom-left-group {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    pointer-events: auto;
  }

  .bottom-left-time {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background-color: #ff2600;
    color: #ffffff;
    padding: 0 8px;
    height: 22px;
    box-sizing: border-box;
    border-radius: 1px;
    font-size: 13px;
    font-weight: 700;
    line-height: 22px;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  /* Timeline Scale / Zoom Slider Control (Matches height of .bottom-left-time) */
  .timeline-scale-control {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 22px;
    padding: 0 8px;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 1px;
    box-sizing: border-box;
    pointer-events: auto;
    user-select: none;
  }

  .scale-label {
    color: rgba(255, 255, 255, 0.6);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    line-height: 1;
    white-space: nowrap;
  }

  .scale-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 70px;
    height: 4px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
    margin: 0;
    padding: 0;
    border: none;
    transition: background 0.15s ease;
  }

  .scale-slider:hover {
    background: rgba(255, 255, 255, 0.4);
  }

  .scale-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 8px;
    height: 12px;
    background: #ff2600;
    border-radius: 1px;
    cursor: pointer;
    box-shadow: 0 0 4px rgba(255, 38, 0, 0.5);
    transition: transform 0.1s ease, background 0.15s ease;
  }

  .scale-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
    background: #ff3d1a;
  }

  .scale-slider::-moz-range-thumb {
    width: 8px;
    height: 12px;
    background: #ff2600;
    border: none;
    border-radius: 1px;
    cursor: pointer;
    box-shadow: 0 0 4px rgba(255, 38, 0, 0.5);
  }

  .scale-slider::-moz-range-track {
    height: 4px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 2px;
    border: none;
  }

  .scale-val {
    background: none;
    border: none;
    color: #ffffff;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    min-width: 28px;
    text-align: right;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    margin: 0;
    transition: color 0.15s ease;
  }

  .scale-val:hover {
    color: #ff2600;
  }

  .info-date,
  .info-time {
    line-height: 1;
  }

  .bottom-right-hint {
    color: rgba(255, 255, 255, 0.5);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.2px;
    transition: color 0.15s ease;
  }

  .bottom-right-hint.is-coords {
    color: #ffffff;
    letter-spacing: 0.5px;
  }

  /* Compare Mode Layout & Track Blocks */
  .timeline-scalable-content.is-compare {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .timeline-track-block {
    position: relative;
    width: 100%;
    z-index: 10;
  }

  .track-block-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .track-tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 1px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.8px;
    line-height: 1;
  }

  .track-tag.s1-tag {
    background: rgba(255, 140, 0, 0.2);
    color: #ff9d00;
    border: 1px solid rgba(255, 140, 0, 0.5);
  }

  .track-tag.s2-tag {
    background: rgba(0, 178, 255, 0.2);
    color: #00b2ff;
    border: 1px solid rgba(0, 178, 255, 0.5);
  }

  .track-date-range {
    color: rgba(255, 255, 255, 0.5);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  /* Compare Mode: Range labels only show when hovered */
  .badges-row.compare-badges-row {
    height: 86px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease-in-out;
  }

  .timeline-track-block:hover .badges-row.compare-badges-row,
  .timeline-track-block:focus-within .badges-row.compare-badges-row,
  .timeline-scalable-content.is-compare:hover .badges-row.compare-badges-row {
    opacity: 1;
    pointer-events: auto;
  }

  /* Compare Times in Bottom Row */
  .bottom-left-time.compare-times {
    background: transparent;
    padding: 0;
    gap: 6px;
  }

  .compare-time-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px;
    height: 22px;
    border-radius: 1px;
    font-size: 12px;
    font-weight: 700;
    line-height: 22px;
    white-space: nowrap;
  }

  .compare-time-pill.s1-pill {
    background-color: #ff8c00;
    color: #000000;
  }

  .compare-time-pill.s2-pill {
    background-color: #00b2ff;
    color: #000000;
  }

  .compare-time-pill .pill-label {
    font-size: 10px;
    font-weight: 900;
    opacity: 0.85;
  }

  .track-tag-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .optimal-sample-badge {
    font-family: 'Jersey 25', sans-serif;
    font-size: 13px;
    letter-spacing: 1.2px;
    color: #4ade80;
    background: rgba(74, 222, 128, 0.18);
    border: 1px solid rgba(74, 222, 128, 0.6);
    border-radius: 2px;
    padding: 1px 7px;
    text-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
    box-shadow: 0 0 10px rgba(74, 222, 128, 0.25);
    white-space: nowrap;
    animation: fadeIn 0.25s ease-out;
  }

  .compare-time-pill.is-optimal-pill {
    box-shadow: 0 0 10px rgba(74, 222, 128, 0.45);
    border: 1px solid #ffffff;
  }

  .pill-optimal-tag {
    font-size: 9.5px;
    font-weight: 900;
    letter-spacing: 0.5px;
    background: rgba(0, 0, 0, 0.35);
    color: #ffffff;
    padding: 0px 4px;
    border-radius: 2px;
  }
</style>
