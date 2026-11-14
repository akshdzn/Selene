import assert from 'node:assert/strict';
import * as THREE from 'three';
import { vector3ToLatLon, latLonToVector3, formatLatLon } from '../src/lib/ephemeris.js';

// 1. Cardinal Selenographic Points
// Center (Sinus Medii): (0, 0, 1) -> Lat 0°, Lon 0°
const center = vector3ToLatLon(new THREE.Vector3(0, 0, 1));
assert(Math.abs(center.lat) < 1e-4, `Center latitude is 0: ${center.lat}`);
assert(Math.abs(center.lon) < 1e-4, `Center longitude is 0: ${center.lon}`);

// North Pole: (0, 1, 0) -> Lat +90°, Lon 0°
const north = vector3ToLatLon(new THREE.Vector3(0, 1, 0));
assert(Math.abs(north.lat - 90) < 1e-4, `North latitude is +90: ${north.lat}`);

// South Pole: (0, -1, 0) -> Lat -90°, Lon 0°
const south = vector3ToLatLon(new THREE.Vector3(0, -1, 0));
assert(Math.abs(south.lat - (-90)) < 1e-4, `South latitude is -90: ${south.lat}`);

// Eastern Limb (Mare Crisium direction): (1, 0, 0) -> Lat 0°, Lon +90°E
const east = vector3ToLatLon(new THREE.Vector3(1, 0, 0));
assert(Math.abs(east.lat) < 1e-4, `East latitude is 0: ${east.lat}`);
assert(Math.abs(east.lon - 90) < 1e-4, `East longitude is +90: ${east.lon}`);

// Western Limb (Oceanus Procellarum / Mare Orientale): (-1, 0, 0) -> Lat 0°, Lon -90°W
const west = vector3ToLatLon(new THREE.Vector3(-1, 0, 0));
assert(Math.abs(west.lat) < 1e-4, `West latitude is 0: ${west.lat}`);
assert(Math.abs(west.lon - (-90)) < 1e-4, `West longitude is -90: ${west.lon}`);

// Farside Center: (0, 0, -1) -> Lat 0°, Lon 180°
const farside = vector3ToLatLon(new THREE.Vector3(0, 0, -1));
assert(Math.abs(farside.lat) < 1e-4, `Farside latitude is 0: ${farside.lat}`);
assert(Math.abs(Math.abs(farside.lon) - 180) < 1e-4, `Farside longitude is 180: ${farside.lon}`);

// 2. Round-trip conversion: lat/lon -> Vector3 -> lat/lon
const testCases = [
  { lat: 14.5, lon: 45.2 },
  { lat: -32.8, lon: -115.4 },
  { lat: 85.0, lon: 175.0 },
  { lat: -89.9, lon: -10.0 }
];

for (const tc of testCases) {
  const v = latLonToVector3(tc.lat, tc.lon, 1.0);
  const back = vector3ToLatLon(v);
  assert(Math.abs(back.lat - tc.lat) < 1e-4, `Roundtrip lat matches: ${back.lat} vs ${tc.lat}`);
  assert(Math.abs(back.lon - tc.lon) < 1e-4, `Roundtrip lon matches: ${back.lon} vs ${tc.lon}`);
}

// 3. Coordinate formatting
const fmt1 = formatLatLon(14.23, 45.18);
assert.equal(fmt1.full, '14.2°N, 45.2°E');
const fmt2 = formatLatLon(-19.5, -92.3);
assert.equal(fmt2.full, '19.5°S, 92.3°W');
const fmt3 = formatLatLon(0, 0);
assert.equal(fmt3.full, '0.0°N, 0.0°E');

// 4. Tidal locking in landing page: Near-side (0°N, 0°E) faces Earth at (0, 0, 0)
const geo = new THREE.SphereGeometry(0.85, 48, 48);
geo.rotateY(-Math.PI / 2);
const distantMoon = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
distantMoon.position.set(-18.5, 7.2, -20.1);
distantMoon.lookAt(0, 0, 0);
distantMoon.updateMatrixWorld();

const nearSideWorld = new THREE.Vector3(0, 0, 1).transformDirection(distantMoon.matrixWorld);
const dirToEarth = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), distantMoon.position).normalize();
const dot = nearSideWorld.dot(dirToEarth);
assert(Math.abs(dot - 1.0) < 1e-4, `Moon near-side accurately points at Earth (dot = ${dot})`);

console.log('All Selenographic coordinate mapping tests passed successfully.');
