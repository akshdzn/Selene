import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getTodayDateRange, azElToVector3, fetchCurrentLunarPositions } from '../src/lib/ephemeris.js';

// 1. Test getTodayDateRange
const { startTime, stopTime, hour } = getTodayDateRange();
assert(/^\d{4}-\d{2}-\d{2}$/.test(startTime), `startTime is valid date: ${startTime}`);
assert(/^\d{4}-\d{2}-\d{2}$/.test(stopTime), `stopTime is valid date: ${stopTime}`);
assert(hour >= 0 && hour <= 23, `hour is within 0-23: ${hour}`);
const diffMs = new Date(stopTime).getTime() - new Date(startTime).getTime();
assert.equal(diffMs, 86400000, 'Difference is exactly 24 hours (1 day range)');

// 2. Test azElToVector3 geometry mapping
const r = 100;
// Zenith (elevation 90 deg) -> points along +Z
const zenith = azElToVector3(0, 90, r);
assert(Math.abs(zenith.x) < 1e-4);
assert(Math.abs(zenith.y) < 1e-4);
assert(Math.abs(zenith.z - r) < 1e-4);

// North horizon (az 0, el 0) -> points along +Y
const north = azElToVector3(0, 0, r);
assert(Math.abs(north.x) < 1e-4);
assert(Math.abs(north.y - r) < 1e-4);
assert(Math.abs(north.z) < 1e-4);

// East horizon (az 90, el 0) -> points along +X
const east = azElToVector3(90, 0, r);
assert(Math.abs(east.x - r) < 1e-4);
assert(Math.abs(east.y) < 1e-4);
assert(Math.abs(east.z) < 1e-4);

// Arbitrary angle vector length preservation
const arbitrary = azElToVector3(137.5, -28.4, 45.0);
assert(Math.abs(arbitrary.length() - 45.0) < 1e-4, 'Vector length matches radius');

// 3. Test fetchCurrentLunarPositions (runs against real getLunarData)
console.log('Testing live fetchCurrentLunarPositions(0, 0)...');
const pos = await fetchCurrentLunarPositions(0, 0);
assert(pos.sunPos instanceof THREE.Vector3, 'sunPos is Vector3');
assert(pos.earthPos instanceof THREE.Vector3, 'earthPos is Vector3');
assert(Math.abs(pos.sunPos.length() - 52.0) < 0.1, `Sun distance is ~52: ${pos.sunPos.length()}`);
assert(Math.abs(pos.earthPos.length() - 28.0) < 0.1, `Earth distance is ~28: ${pos.earthPos.length()}`);
assert(typeof pos.sunEntry.angle === 'number', 'Sun azimuth is number');
assert(typeof pos.sunEntry.elevation === 'number', 'Sun elevation is number');
assert(typeof pos.earthEntry.angle === 'number', 'Earth azimuth is number');
assert(typeof pos.earthEntry.elevation === 'number', 'Earth elevation is number');
assert.equal(pos.hour, hour, 'Hour matches system hour');

console.log('All ephemeris tests passed successfully.');
