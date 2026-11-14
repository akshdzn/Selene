import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  getDateRange20Days,
  azElToVector3,
  topocentricToSelenographic,
  calculateCelestialPositions,
  fetchCurrentLunarPositions,
  latLonToVector3
} from '../src/lib/ephemeris.js';

// 1. Test getDateRange20Days
const { startTime, stopTime, hour, startDate, endDate } = getDateRange20Days();
assert(/^\d{4}-\d{2}-\d{2} \d{2}:00$/.test(startTime), `startTime is valid format: ${startTime}`);
assert(/^\d{4}-\d{2}-\d{2} \d{2}:00$/.test(stopTime), `stopTime is valid format: ${stopTime}`);
assert(hour >= 0 && hour <= 23, `hour is within 0-23: ${hour}`);
const diffHours = (new Date(stopTime).getTime() - new Date(startTime).getTime()) / 3600000;
assert.equal(diffHours, 20 * 24, 'Difference is exactly 20 days (480 hours)');

// 2. Test topocentricToSelenographic geometry mapping at (0, 0)
const r = 100;
// Zenith (elevation 90 deg) -> points along +Z
const zenith = topocentricToSelenographic(0, 90, 0, 0, r);
assert(Math.abs(zenith.x) < 1e-4);
assert(Math.abs(zenith.y) < 1e-4);
assert(Math.abs(zenith.z - r) < 1e-4);

// North horizon (az 0, el 0) -> points along +Y
const north = topocentricToSelenographic(0, 0, 0, 0, r);
assert(Math.abs(north.x) < 1e-4);
assert(Math.abs(north.y - r) < 1e-4);
assert(Math.abs(north.z) < 1e-4);

// East horizon (az 90, el 0) -> points along +X
const east = topocentricToSelenographic(90, 0, 0, 0, r);
assert(Math.abs(east.x - r) < 1e-4);
assert(Math.abs(east.y) < 1e-4);
assert(Math.abs(east.z) < 1e-4);

// 3. Test topocentricToSelenographic accuracy at Apollo 15 (26.1322°N, 3.6339°E)
const apolloLat = 26.1322;
const apolloLon = 3.6339;
const apolloNormal = latLonToVector3(apolloLat, apolloLon, 1.0);

// For arbitrary azimuth (137.5°) and elevation (28.4°), dot product with site normal must equal sin(elevation)
const testAz = 137.5;
const testEl = 28.4;
const sunVec = topocentricToSelenographic(testAz, testEl, apolloLat, apolloLon, 1.0);
const dot = sunVec.dot(apolloNormal);
const expectedDot = Math.sin((testEl * Math.PI) / 180);
assert(Math.abs(dot - expectedDot) < 1e-6, `Topocentric elevation matches dot product: ${dot} vs ${expectedDot}`);

// 4. Test calculateCelestialPositions helper with site coordinates
const samplePositions = calculateCelestialPositions(
  { angle: testAz, elevation: testEl },
  { angle: 180, elevation: 60 },
  apolloLat,
  apolloLon
);
assert(samplePositions.sunPos instanceof THREE.Vector3);
assert(samplePositions.earthPos instanceof THREE.Vector3);
assert(Math.abs(samplePositions.sunPos.length() - 52.0) < 1e-4);
assert(Math.abs(samplePositions.earthPos.length() - 28.0) < 1e-4);

// 5. Test fetchCurrentLunarPositions
console.log('Testing live fetchCurrentLunarPositions(26.1322, 3.6339)...');
const pos = await fetchCurrentLunarPositions(apolloLat, apolloLon);
assert(pos.sunPos instanceof THREE.Vector3, 'sunPos is Vector3');
assert(pos.earthPos instanceof THREE.Vector3, 'earthPos is Vector3');
assert(Math.abs(pos.sunPos.length() - 52.0) < 0.1, `Sun distance is ~52: ${pos.sunPos.length()}`);
assert(Math.abs(pos.earthPos.length() - 28.0) < 0.1, `Earth distance is ~28: ${pos.earthPos.length()}`);
assert(typeof pos.sunEntry.angle === 'number', 'Sun azimuth is number');
assert(typeof pos.sunEntry.elevation === 'number', 'Sun elevation is number');
assert(typeof pos.earthEntry.angle === 'number', 'Earth azimuth is number');
assert(typeof pos.earthEntry.elevation === 'number', 'Earth elevation is number');
assert.equal(pos.hour, hour, 'Hour matches system hour');
assert.equal(pos.currentIndex, 240, 'Current index matches midpoint 240');
assert(pos.dataset?.sun?.length >= 480, `Dataset has ~480+ hourly steps: ${pos.dataset?.sun?.length}`);

// 6. Test fetchCurrentLunarPositions with Custom Date Range
console.log('Testing custom date range ephemeris (2026-10-23 to 2026-11-01)...');
const customPos = await fetchCurrentLunarPositions(apolloLat, apolloLon, {
  startDate: '2026-10-23',
  endDate: '2026-11-01'
});
assert.equal(customPos.success, true);
assert(customPos.sunPos instanceof THREE.Vector3);
assert(customPos.earthPos instanceof THREE.Vector3);
assert(customPos.dataset?.sun?.length > 0);
assert(customPos.timeRange?.startTime.startsWith('2026-10-23'));
assert(customPos.timeRange?.stopTime.startsWith('2026-11-01'));

console.log('All ephemeris tests passed successfully.');
