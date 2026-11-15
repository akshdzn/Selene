import assert from 'node:assert/strict';
import * as THREE from 'three';
import { calculateEarthRotation, fetchCurrentLunarPositions } from '../src/lib/ephemeris.js';

console.log('Testing realistic Earth rotation calculation...');

// 1. Solar noon alignment test (12:00 UTC)
const noonPos = {
  currentIndex: 240,
  sunPos: new THREE.Vector3(0, 0, 52), // Sun at +Z
  earthPos: new THREE.Vector3(0, 0, 28) // Earth at +Z (sub-earth)
};
const noonRot = calculateEarthRotation(noonPos, 12);
// Initial Greenwich vector at u=0.5 is (1, 0, 0)
const greenwichNoon = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), noonRot);
const sunDirNoon = new THREE.Vector3(0, 0, 1);
const dotNoon = greenwichNoon.dot(sunDirNoon);
assert(Math.abs(dotNoon - 1.0) < 1e-3, `Greenwich must align directly with Sun at 12:00 UTC (dot = ${dotNoon})`);
console.log('✔ Greenwich aligns directly with solar noon (dot = 1.0).');

// 2. Midnight alignment test (00:00 UTC)
const midnightPos = {
  currentIndex: 240,
  sunPos: new THREE.Vector3(0, 0, 52),
  earthPos: new THREE.Vector3(0, 0, 28)
};
const midnightRot = calculateEarthRotation(midnightPos, 0);
const greenwichMidnight = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), midnightRot);
const dotMidnight = greenwichMidnight.dot(sunDirNoon);
assert(Math.abs(dotMidnight - (-1.0)) < 1e-3, `Greenwich must be on dark night side at 00:00 UTC (dot = ${dotMidnight})`);
console.log('✔ Greenwich aligns directly with midnight on dark side (dot = -1.0).');

// 3. Hourly rate of rotation: exactly 15° per hour step
const posHour0 = { currentIndex: 240, sunPos: new THREE.Vector3(0, 0, 52), earthPos: new THREE.Vector3(0, 0, 28) };
const posHour1 = { currentIndex: 241, sunPos: new THREE.Vector3(0, 0, 52), earthPos: new THREE.Vector3(0, 0, 28) };
const rot0 = calculateEarthRotation(posHour0, 12);
const rot1 = calculateEarthRotation(posHour1, 12);
const deltaDeg1h = ((rot1 - rot0) * 180) / Math.PI;
assert(Math.abs(deltaDeg1h - 15.0) < 1e-4, `1 hour must advance Earth by 15°: got ${deltaDeg1h}°`);
console.log(`✔ 1-hour step advances Earth by exactly 15° (${deltaDeg1h.toFixed(1)}°).`);

// 4. Daily rate of rotation: exactly 360° per 24 hours
const posDay1 = { currentIndex: 264, sunPos: new THREE.Vector3(0, 0, 52), earthPos: new THREE.Vector3(0, 0, 28) };
const rotDay1 = calculateEarthRotation(posDay1, 12);
const deltaDeg24h = ((rotDay1 - rot0) * 180) / Math.PI;
assert(Math.abs(deltaDeg24h - 360.0) < 1e-4, `24 hours must rotate Earth 360°: got ${deltaDeg24h}°`);
console.log(`✔ 24-hour step rotates Earth by exactly 360° (${deltaDeg24h.toFixed(1)}°).`);

// 5. West-to-East physical spin direction
// Positive Y rotation moves points from West (-X) to East (+X)
const rotAfternoon = calculateEarthRotation({ currentIndex: 241, sunPos: new THREE.Vector3(0, 0, 52), earthPos: new THREE.Vector3(0, 0, 28) }, 12);
const greenwichAfternoon = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotAfternoon);
assert(greenwichAfternoon.x > 0, 'Afternoon rotation must rotate Greenwich eastward (+X)');
console.log('✔ Physical West-to-East spin verified.');

// 6. Test with real Horizons 20-day dataset
console.log('Testing with live/cached lunar dataset...');
const liveData = await fetchCurrentLunarPositions(0, 0);
assert(liveData && liveData.dataset, 'Must fetch valid lunar dataset');
const sunList = liveData.dataset.sun || [];
assert(sunList.length > 0, 'Dataset must have sun entries');

let prevRot = null;
for (let i = 0; i < Math.min(sunList.length, 48); i++) {
  const stepPos = {
    currentIndex: i,
    sunPos: liveData.sunPos,
    earthPos: liveData.earthPos,
    sunEntry: sunList[i],
    hour: liveData.hour
  };
  const stepRot = calculateEarthRotation(stepPos, liveData.hour);
  if (prevRot !== null) {
    const diff = ((stepRot - prevRot) * 180) / Math.PI;
    assert(Math.abs(diff - 15.0) < 0.1, `Continuous step ${i} must advance by ~15° (got ${diff.toFixed(2)}°)`);
  }
  prevRot = stepRot;
}
console.log(`✔ Verified continuous 15°/h rotation across ${Math.min(sunList.length, 48)} hours of Horizons dataset.`);

console.log('ALL REALISTIC EARTH ROTATION CHECKS PASSED SUCCESSFULLY!');
