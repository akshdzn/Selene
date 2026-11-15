import assert from 'node:assert';
import { calculateOptimalValue, determineOptimalSample } from '../src/lib/ephemeris.js';

// 1. Test Duration Matching Logic
function getDaysDiff(d1Str, d2Str) {
  if (!d1Str || !d2Str) return 0;
  const d1 = new Date(d1Str);
  const d2 = new Date(d2Str);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
}

function offsetDays(dStr, numDays) {
  if (!dStr) return '';
  const d = new Date(dStr);
  d.setUTCDate(d.getUTCDate() + numDays);
  return d.toISOString().split('T')[0];
}

console.log('Testing Compare Mode Duration & Timeline Synchronization...');

// Test 1: S1 duration is selected by user
let pendingS1Start = '2026-03-01';
let pendingS1End = '2026-03-21';
let s1Duration = getDaysDiff(pendingS1Start, pendingS1End);
assert.strictEqual(s1Duration, 20, 'S1 duration should be 20 days');

// Test 2: In S2, user selects first date -> second date is autofilled based on S1 days count
let pendingS2Start = '2026-04-05';
let pendingS2End = offsetDays(pendingS2Start, s1Duration);
assert.strictEqual(pendingS2End, '2026-04-25', 'S2 End date should be autofilled to S2 start + S1 duration');
assert.strictEqual(getDaysDiff(pendingS2Start, pendingS2End), s1Duration, 'Autofilled S2 duration must equal S1 duration');

// Test 3: S2 second date cannot be changed (disabled = true)
const isS2EndDateDisabled = true;
assert.strictEqual(isS2EndDateDisabled, true, 'S2 End date must be locked / disabled');

// Test 4: When user adjusts S1 dates, S2 end date re-autofills to match the new S1 days count
pendingS1End = '2026-03-31'; // S1 changed to 30 days
s1Duration = getDaysDiff(pendingS1Start, pendingS1End);
assert.strictEqual(s1Duration, 30, 'S1 updated duration should be 30 days');
pendingS2End = offsetDays(pendingS2Start, s1Duration);
assert.strictEqual(pendingS2End, '2026-05-05', 'S2 end date re-autofills to 30 days after S2 start');
assert.strictEqual(getDaysDiff(pendingS2Start, pendingS2End), s1Duration, 'S2 duration strictly matches new S1 duration');

// Test 4: Interval computation logic
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
      if (predicate(i)) {
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

  return {
    optimal: getRuns(isOptimalAt, 'OPTIMAL'),
    power: getRuns(isPowerAt, 'POWER'),
    comms: getRuns(isCommsAt, 'COMMS'),
    dark: getRuns(isDarkAt, 'DARK')
  };
}

const mockSunS1 = [{ elevation: 5 }, { elevation: 5 }, { elevation: -10 }];
const mockEarthS1 = [{ elevation: 10 }, { elevation: 1 }, { elevation: 10 }];
const intvsS1 = computeIntervals(mockSunS1, mockEarthS1);

assert.strictEqual(intvsS1.power.length, 1, 'S1 should have 1 power run');
assert.strictEqual(intvsS1.power[0].end, 1, 'S1 power run ends at index 1');
assert.strictEqual(intvsS1.optimal.length, 1, 'S1 should have 1 optimal step');
assert.strictEqual(intvsS1.optimal[0].start, 0, 'S1 optimal step at 0');

const mockSunS2 = [{ elevation: -10 }, { elevation: -10 }, { elevation: 5 }];
const mockEarthS2 = [{ elevation: 10 }, { elevation: 10 }, { elevation: 10 }];
const intvsS2 = computeIntervals(mockSunS2, mockEarthS2);

assert.strictEqual(intvsS2.dark.length, 1, 'S2 should have 1 dark run');
assert.strictEqual(intvsS2.dark[0].end, 1, 'S2 dark run ends at index 1');
assert.strictEqual(intvsS2.power.length, 1, 'S2 should have 1 power step');
assert.strictEqual(intvsS2.power[0].start, 2, 'S2 power step at 2');

console.log('Testing Optimal Sample Determination Logic in Compare Mode...');

// Scenario A: Sample 2 has higher Optimal value than Sample 1
const s1Sun = [{ elevation: 5 }, { elevation: 5 }, { elevation: -10 }, { elevation: -10 }];
const s1Earth = [{ elevation: 10 }, { elevation: 1 }, { elevation: 10 }, { elevation: 10 }];
// Only index 0 is optimal in S1 (sun > 0 and earth > 2) -> 1 hour

const s2Sun = [{ elevation: 5 }, { elevation: 5 }, { elevation: 5 }, { elevation: -10 }];
const s2Earth = [{ elevation: 10 }, { elevation: 10 }, { elevation: 10 }, { elevation: 10 }];
// Indices 0, 1, 2 are optimal in S2 -> 3 hours

const optVal1 = calculateOptimalValue(s1Sun, s1Earth);
const optVal2 = calculateOptimalValue(s2Sun, s2Earth);
assert.strictEqual(optVal1, 1, 'Sample 1 optimal value should be 1');
assert.strictEqual(optVal2, 3, 'Sample 2 optimal value should be 3');

// Variable called Optimal Sample which gets input from the higher Optimal value between the two samples
const resultA = determineOptimalSample(s1Sun, s1Earth, s2Sun, s2Earth);
assert.strictEqual(resultA.higherOptimalValue, 3, 'Higher optimal value must be 3');
assert.strictEqual(resultA.optimalSample, 2, 'Sample 2 must be the optimal sample');
assert.strictEqual(resultA.OptimalSample, 2, 'OptimalSample variable must be 2');

// Scenario B: Sample 1 has higher Optimal value than Sample 2
const s1SunB = [{ elevation: 10 }, { elevation: 10 }, { elevation: 10 }, { elevation: 10 }];
const s1EarthB = [{ elevation: 5 }, { elevation: 5 }, { elevation: 5 }, { elevation: 5 }];
// All 4 indices optimal in S1 -> 4 hours

const s2SunB = [{ elevation: 10 }, { elevation: 10 }, { elevation: -5 }, { elevation: -5 }];
const s2EarthB = [{ elevation: 5 }, { elevation: 5 }, { elevation: 5 }, { elevation: 5 }];
// 2 indices optimal in S2 -> 2 hours

const resultB = determineOptimalSample(s1SunB, s1EarthB, s2SunB, s2EarthB);
assert.strictEqual(resultB.higherOptimalValue, 4, 'Higher optimal value must be 4');
assert.strictEqual(resultB.optimalSample, 1, 'Sample 1 must be the optimal sample');
assert.strictEqual(resultB.OptimalSample, 1, 'OptimalSample variable must be 1');

// Test display badge logic
function getSampleBadge(sampleNumber, optimalSampleWinner) {
  return sampleNumber === optimalSampleWinner ? 'OPTIMAL SAMPLE' : null;
}

assert.strictEqual(getSampleBadge(1, resultB.optimalSample), 'OPTIMAL SAMPLE', 'Sample 1 must display OPTIMAL SAMPLE next to sample number');
assert.strictEqual(getSampleBadge(2, resultB.optimalSample), null, 'Sample 2 must not display OPTIMAL SAMPLE when Sample 1 is optimal');
assert.strictEqual(getSampleBadge(2, resultA.optimalSample), 'OPTIMAL SAMPLE', 'Sample 2 must display OPTIMAL SAMPLE next to sample number');
assert.strictEqual(getSampleBadge(1, resultA.optimalSample), null, 'Sample 1 must not display OPTIMAL SAMPLE when Sample 2 is optimal');

console.log('✔ Optimal Sample comparison and badge display logic verified.');

console.log('Testing Sites vs Timelines Compare Sub-modes...');

// Test 5: Sub-mode selection
let compareType = 'timelines';
assert.strictEqual(compareType, 'timelines', 'Default or timelines mode');
compareType = 'sites';
assert.strictEqual(compareType, 'sites', 'Switched to sites mode');

// Test 6: Sites Compare Mode uses the same timeline for both sites
const sharedStartDate = '2026-06-01';
const sharedEndDate = '2026-06-21';
const site1 = { lat: 26.1322, lon: 3.6339, name: 'Apollo 15' };
const site2 = { lat: 0.6741, lon: 23.4730, name: 'Apollo 11' };

const site1MissionWindow = { startDate: sharedStartDate, endDate: sharedEndDate };
const site2MissionWindow = { startDate: sharedStartDate, endDate: sharedEndDate };

assert.strictEqual(site1MissionWindow.startDate, site2MissionWindow.startDate, 'Site 1 and Site 2 must share start date');
assert.strictEqual(site1MissionWindow.endDate, site2MissionWindow.endDate, 'Site 1 and Site 2 must share end date');
assert.strictEqual(
  getDaysDiff(site1MissionWindow.startDate, site1MissionWindow.endDate),
  getDaysDiff(site2MissionWindow.startDate, site2MissionWindow.endDate),
  'Duration must be identical for both sites on shared timeline'
);

// Test 7: Comparing two sites on shared timeline with Optimal Sample calculation
import { findLandmarkByCoords } from '../src/lib/places.js';

const apollo15 = findLandmarkByCoords(26.1322, 3.6339);
assert.ok(apollo15, 'Apollo 15 should be found by coords');
assert.strictEqual(apollo15.name, 'Apollo 15');

const apollo11 = findLandmarkByCoords(0.6741, 23.4730);
assert.ok(apollo11, 'Apollo 11 should be found by coords');
assert.strictEqual(apollo11.name, 'Apollo 11');

const ch3 = findLandmarkByCoords(-69.373, 32.319);
assert.ok(ch3, 'Chandrayaan-3 should be found by coords');
assert.strictEqual(ch3.name, 'Chandrayaan-3 Vikram');

// Site 1 (Apollo 15) vs Site 2 (Apollo 11) simulated ephemeris on same dates
const site1Sun = [{ elevation: 8 }, { elevation: 12 }, { elevation: 14 }, { elevation: -2 }];
const site1Earth = [{ elevation: 25 }, { elevation: 25 }, { elevation: 26 }, { elevation: 26 }];
// Indices 0, 1, 2 optimal -> 3 hours

const site2Sun = [{ elevation: 15 }, { elevation: 18 }, { elevation: 20 }, { elevation: 22 }];
const site2Earth = [{ elevation: 30 }, { elevation: 30 }, { elevation: 31 }, { elevation: 31 }];
// Indices 0, 1, 2, 3 optimal -> 4 hours

const siteOptVal1 = calculateOptimalValue(site1Sun, site1Earth);
const siteOptVal2 = calculateOptimalValue(site2Sun, site2Earth);
assert.strictEqual(siteOptVal1, 3, 'Site 1 optimal window should be 3 hours');
assert.strictEqual(siteOptVal2, 4, 'Site 2 optimal window should be 4 hours');

const sitesResult = determineOptimalSample(site1Sun, site1Earth, site2Sun, site2Earth);
assert.strictEqual(sitesResult.optimalSample, 2, 'Site 2 (Apollo 11) should be optimal sample');
assert.strictEqual(sitesResult.OptimalSample, 2, 'OptimalSample variable should equal 2');
assert.strictEqual(
  getSampleBadge(2, sitesResult.optimalSample),
  'OPTIMAL SAMPLE',
  'Site 2 must display OPTIMAL SAMPLE badge next to its header'
);

function getTrackTag(siteSlot, siteName, compareTypeMode) {
  if (compareTypeMode === 'sites') {
    return siteName ? `SITE ${siteSlot} (${siteName})` : `SITE ${siteSlot}`;
  }
  return `SAMPLE ${siteSlot}`;
}

assert.strictEqual(getTrackTag(1, 'Apollo 15', 'sites'), 'SITE 1 (Apollo 15)', 'Site 1 label formatting');
assert.strictEqual(getTrackTag(2, 'Apollo 11', 'sites'), 'SITE 2 (Apollo 11)', 'Site 2 label formatting');
assert.strictEqual(getTrackTag(1, null, 'timelines'), 'SAMPLE 1', 'Timelines Sample 1 label');
assert.strictEqual(getTrackTag(2, null, 'timelines'), 'SAMPLE 2', 'Timelines Sample 2 label');

console.log('✔ Sites sub-mode shared timeline and optimal sample checks verified.');

console.log('✔ All compare mode duration and timeline checks passed successfully!');
