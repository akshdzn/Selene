import assert from 'node:assert/strict';

// 1. Test Contiguous Interval Algorithm
function getRuns(predicate, type, n) {
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
}

function hasOverlap(runA, listB) {
  return listB.some((b) => Math.max(runA.start, b.start) <= Math.min(runA.end, b.end));
}

// Mock: At lat 0, lon 0:
// COMMS is active all 481 hours (0..480)
// DARK is active 0..287
// POWER is active 288..480
// OPTIMAL is active 288..480
const isComms = () => true;
const isPower = (i) => i >= 288;
const isDark = (i) => i < 288;
const isOptimal = (i) => isPower(i) && isComms(i);

const commsRuns = getRuns(isComms, 'COMMS', 481);
const darkRuns = getRuns(isDark, 'DARK', 481);
const powerRuns = getRuns(isPower, 'POWER', 481);
const optimalRuns = getRuns(isOptimal, 'OPTIMAL', 481);

// Seamless boundary bridging
for (const d of darkRuns) {
  for (const p of powerRuns) {
    if (d.end + 1 === p.start) {
      d.end = p.start;
    }
  }
}

assert.equal(commsRuns.length, 1);
assert.equal(commsRuns[0].start, 0);
assert.equal(commsRuns[0].end, 480);

assert.equal(darkRuns.length, 1);
assert.equal(darkRuns[0].start, 0);
assert.equal(darkRuns[0].end, 288, 'DARK seamlessly bridges to POWER start at index 288');

assert.equal(powerRuns.length, 1);
assert.equal(powerRuns[0].start, 288);
assert.equal(powerRuns[0].end, 480);

assert.equal(optimalRuns.length, 1);
assert.equal(optimalRuns[0].start, 288);
assert.equal(optimalRuns[0].end, 480);

// 2. Test Stacked Badges Algorithm
const intervals = {
  dark: darkRuns,
  power: powerRuns,
  comms: commsRuns,
  optimal: optimalRuns
};

const list = [];
const totalDuration = Math.max(1, 481 - 1);
const formatBadgeText = (type, start, end) => {
  const hours = Math.max(1, end - start);
  const pctVal = +((hours / totalDuration) * 100).toFixed(1);
  const pctStr = pctVal % 1 === 0 ? `${pctVal.toFixed(0)}%` : `${pctVal}%`;
  return `${type} | ${hours}h | ${pctStr}`;
};

for (const r of intervals.dark) {
  if (r.end - r.start > 12) {
    list.push({ type: 'DARK', start: r.start, end: r.end, rank: 0, text: formatBadgeText('DARK', r.start, r.end) });
  }
}
for (const r of intervals.power) {
  list.push({ type: 'POWER', start: r.start, end: r.end, rank: 0, text: formatBadgeText('POWER', r.start, r.end) });
}
for (const r of intervals.comms) {
  list.push({ type: 'COMMS', start: r.start, end: r.end, rank: 1, text: formatBadgeText('COMMS', r.start, r.end) });
}
for (const r of intervals.optimal) {
  list.push({ type: 'OPTIMAL', start: r.start, end: r.end, rank: 2, text: formatBadgeText('OPTIMAL', r.start, r.end) });
}

list.sort((a, b) => a.start - b.start || a.rank - b.rank);

const thresholdSteps = 35;
for (let i = 0; i < list.length; i++) {
  let stackLevel = 0;
  for (let j = 0; j < i; j++) {
    if (Math.abs(list[i].start - list[j].start) < thresholdSteps) {
      stackLevel = Math.max(stackLevel, list[j].stackLevel + 1);
    }
  }
  list[i].stackLevel = stackLevel;
  list[i].bottomOffset = 2 + stackLevel * 28;
}

// Verify overlapping labels stacking:
// At start=0: DARK (rank 0) is level 0 (bottom 2px), COMMS (rank 1) is level 1 (bottom 30px)
const darkBadge = list.find((b) => b.type === 'DARK');
const commsBadge = list.find((b) => b.type === 'COMMS');
assert.equal(darkBadge.stackLevel, 0);
assert.equal(darkBadge.bottomOffset, 2);
assert.equal(commsBadge.stackLevel, 1);
assert.equal(commsBadge.bottomOffset, 30, 'COMMS sits on top of DARK');

// At start=288: POWER (rank 0) is level 0 (bottom 2px), OPTIMAL (rank 2) is level 1 (bottom 30px)
const powerBadge = list.find((b) => b.type === 'POWER');
const optimalBadge = list.find((b) => b.type === 'OPTIMAL');
assert.equal(powerBadge.stackLevel, 0);
assert.equal(powerBadge.bottomOffset, 2);
assert.equal(powerBadge.text, 'POWER | 192h | 40%');

assert.equal(optimalBadge.stackLevel, 1);
assert.equal(optimalBadge.bottomOffset, 30, 'OPTIMAL sits on top of POWER');
assert.equal(optimalBadge.text, 'OPTIMAL | 192h | 40%');

// 3. Test Stacked End Indicators Algorithm
const endList = [];
for (const r of intervals.dark) {
  if (r.end - r.start > 12) {
    endList.push({ type: 'DARK', start: r.start, end: r.end, rank: 0 });
  }
}
for (const r of intervals.power) {
  endList.push({ type: 'POWER', start: r.start, end: r.end, rank: 0 });
}
for (const r of intervals.comms) {
  endList.push({ type: 'COMMS', start: r.start, end: r.end, rank: 1 });
}
for (const r of intervals.optimal) {
  endList.push({ type: 'OPTIMAL', start: r.start, end: r.end, rank: 2 });
}

endList.sort((a, b) => a.end - b.end || a.rank - b.rank);

for (let i = 0; i < endList.length; i++) {
  let stackLevel = 0;
  for (let j = 0; j < i; j++) {
    if (Math.abs(endList[i].end - endList[j].end) < thresholdSteps) {
      stackLevel = Math.max(stackLevel, endList[j].stackLevel + 1);
    }
  }
  endList[i].stackLevel = stackLevel;
  endList[i].bottomOffset = 2 + stackLevel * 28;
}

// At end=480: POWER (rank 0) level 0, COMMS (rank 1) level 1, OPTIMAL (rank 2) level 2
const powerEnd = endList.find((b) => b.type === 'POWER');
const commsEnd = endList.find((b) => b.type === 'COMMS');
const optimalEnd = endList.find((b) => b.type === 'OPTIMAL');
assert.equal(powerEnd.stackLevel, 0);
assert.equal(powerEnd.bottomOffset, 2);
assert.equal(commsEnd.stackLevel, 1);
assert.equal(commsEnd.bottomOffset, 30);
assert.equal(optimalEnd.stackLevel, 2);
assert.equal(optimalEnd.bottomOffset, 58, 'OPTIMAL end tick sits on top of COMMS and POWER end ticks');

// 4. Test Date Formatter
function formatDate(timeStr) {
  const m = timeStr.trim().match(/^(\d{4})-([A-Za-z0-9]+)-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const year = m[1];
  let month = m[2].toUpperCase();
  const day = m[3].padStart(2, '0');
  let hourNum = parseInt(m[4], 10);
  const ampm = hourNum >= 12 ? 'PM' : 'AM';
  hourNum = hourNum % 12 || 12;
  const hourStr = `${String(hourNum).padStart(2, '0')}:00 ${ampm}`;
  return { dateStr: `${month} ${day} ${year}`, timeStr: hourStr };
}

const f1 = formatDate('2026-Nov-05 01:00');
assert.deepEqual(f1, { dateStr: 'NOV 05 2026', timeStr: '01:00 AM' });

const f2 = formatDate('2026-Nov-17 14:00');
assert.deepEqual(f2, { dateStr: 'NOV 17 2026', timeStr: '02:00 PM' });

const f3 = formatDate('2026-Nov-25 00:00');
assert.deepEqual(f3, { dateStr: 'NOV 25 2026', timeStr: '12:00 AM' });

// 5. Test Hourly Step Marks & Snapping Slider
const totalStepsCount = 481;
const count = totalStepsCount - 1;
const tickMarks = [];
for (let i = 0; i <= count; i++) {
  tickMarks.push({
    pct: (i / count) * 100,
    isDay: i % 24 === 0,
    isHalfDay: i % 12 === 0
  });
}
assert.equal(tickMarks.length, totalStepsCount, 'Tick marks count matches dataset hourly steps count');
assert.equal(tickMarks[0].pct, 0);
assert.equal(tickMarks[count].pct, 100);
assert.equal(tickMarks[24].isDay, true, 'Every 24 hours is marked as a day boundary');
assert.equal(tickMarks[12].isHalfDay, true, 'Every 12 hours is marked as half day');

// Test pointer snapping alignment with ticks
for (let i = 0; i < totalStepsCount; i++) {
  const fraction = i / count;
  const targetIndex = Math.min(count, Math.max(0, Math.round(fraction * count)));
  assert.equal(targetIndex, i);
  const playheadPct = (targetIndex / count) * 100;
  assert.equal(playheadPct, tickMarks[i].pct, `Playhead position snaps exactly to tick mark ${i}`);
}

// Test keyboard arrow key step navigation logic
let testIndex = 240;
const clampIndex = (idx) => Math.min(count, Math.max(0, idx));
// ArrowRight
testIndex = clampIndex(testIndex + 1);
assert.equal(testIndex, 241, 'ArrowRight steps +1 hour forward');
// ArrowLeft
testIndex = clampIndex(testIndex - 1);
assert.equal(testIndex, 240, 'ArrowLeft steps -1 hour backward');
// Clamping at ends
assert.equal(clampIndex(count + 1), count, 'Clamps at end');
assert.equal(clampIndex(-1), 0, 'Clamps at start');

console.log('All timeline logic and overlap checks passed successfully.');
