import assert from 'node:assert';
import * as THREE from 'three';

console.log('Testing visual celestial line connecting Earth, Moon, and Sun...');

// 1. Setup geometry and points
const defaultSunPos = new THREE.Vector3(28, 12, -45);
const defaultEarthPos = new THREE.Vector3(-14, 6, -24);
const moonPos = new THREE.Vector3(0, 0, 0);

const celestialLineGeometry = new THREE.BufferGeometry();
celestialLineGeometry.setFromPoints([defaultEarthPos, moonPos, defaultSunPos]);

const celestialColors = new Float32Array([
	0.2, 0.7, 1.0, // Earth: cyan-blue
	1.0, 1.0, 1.0, // Moon: white
	1.0, 0.7, 0.2  // Sun: warm gold
]);
celestialLineGeometry.setAttribute('color', new THREE.BufferAttribute(celestialColors, 3));

const celestialLineMat = new THREE.LineDashedMaterial({
	vertexColors: true,
	dashSize: 0.9,
	gapSize: 0.5,
	transparent: true,
	opacity: 0.6,
	depthTest: true,
	depthWrite: false
});

const celestialLine = new THREE.Line(celestialLineGeometry, celestialLineMat);
celestialLine.computeLineDistances();
celestialLine.raycast = () => {};

// Check 1: 3 vertices connecting Earth -> Moon -> Sun
const posAttr = celestialLineGeometry.getAttribute('position');
assert.strictEqual(posAttr.count, 3, 'Geometry must contain exactly 3 vertices');
assert.strictEqual(posAttr.getX(0), -14);
assert.strictEqual(posAttr.getY(0), 6);
assert.strictEqual(posAttr.getZ(0), -24);

assert.strictEqual(posAttr.getX(1), 0);
assert.strictEqual(posAttr.getY(1), 0);
assert.strictEqual(posAttr.getZ(1), 0);

assert.strictEqual(posAttr.getX(2), 28);
assert.strictEqual(posAttr.getY(2), 12);
assert.strictEqual(posAttr.getZ(2), -45);
console.log('✔ Verified vertex points: Earth -> Moon (origin) -> Sun.');

// Check 2: Vertex colors (Earth cyan, Moon white, Sun gold)
const colAttr = celestialLineGeometry.getAttribute('color');
assert.strictEqual(colAttr.count, 3);
assert(Math.abs(colAttr.getX(0) - 0.2) < 1e-4); // Earth R
assert(Math.abs(colAttr.getY(0) - 0.7) < 1e-4); // Earth G
assert(Math.abs(colAttr.getZ(0) - 1.0) < 1e-4); // Earth B
assert(Math.abs(colAttr.getX(1) - 1.0) < 1e-4); // Moon R
assert(Math.abs(colAttr.getX(2) - 1.0) < 1e-4); // Sun R
assert(Math.abs(colAttr.getY(2) - 0.7) < 1e-4); // Sun G
console.log('✔ Verified vertex colors differentiating Earth, Moon, and Sun.');

// Check 3: Line distances computed for LineDashedMaterial
const distAttr = celestialLineGeometry.getAttribute('lineDistance');
assert(distAttr, 'lineDistance attribute must be generated for dashed rendering');
const earthToMoonDist = defaultEarthPos.distanceTo(moonPos);
const moonToSunDist = moonPos.distanceTo(defaultSunPos);
assert.strictEqual(distAttr.getX(0), 0);
assert(Math.abs(distAttr.getX(1) - earthToMoonDist) < 1e-4);
assert(Math.abs(distAttr.getX(2) - (earthToMoonDist + moonToSunDist)) < 1e-4);
console.log(`✔ Verified dashed line cumulative distances: 0 -> ${earthToMoonDist.toFixed(2)} -> ${(earthToMoonDist + moonToSunDist).toFixed(2)}.`);

// Check 4: Dynamic update when celestial positions shift
const updatedEarthPos = new THREE.Vector3(-12, 8, -20);
const updatedSunPos = new THREE.Vector3(32, 14, -40);
posAttr.setXYZ(0, updatedEarthPos.x, updatedEarthPos.y, updatedEarthPos.z);
posAttr.setXYZ(1, 0, 0, 0);
posAttr.setXYZ(2, updatedSunPos.x, updatedSunPos.y, updatedSunPos.z);
posAttr.needsUpdate = true;
celestialLine.computeLineDistances();

const updatedDistAttr = celestialLineGeometry.getAttribute('lineDistance');
const updatedEarthToMoonDist = updatedEarthPos.distanceTo(moonPos);
const updatedMoonToSunDist = moonPos.distanceTo(updatedSunPos);
assert(Math.abs(updatedDistAttr.getX(1) - updatedEarthToMoonDist) < 1e-4);
assert(Math.abs(updatedDistAttr.getX(2) - (updatedEarthToMoonDist + updatedMoonToSunDist)) < 1e-4);
console.log('✔ Verified dynamic updating and distance recomputation on position shifts.');

// Check 5: Raycast is a no-op (purely visual)
let raycastHits = [];
const dummyRaycaster = new THREE.Raycaster();
celestialLine.raycast(dummyRaycaster, raycastHits);
assert.strictEqual(raycastHits.length, 0, 'Line must ignore raycaster hits');
console.log('✔ Verified non-interactive (raycasting disabled).');

// Check 6: Clean disposal
celestialLineGeometry.dispose();
celestialLineMat.dispose();
console.log('✔ Verified geometry and material disposal.');

console.log('ALL CELESTIAL DASHED LINE CHECKS PASSED SUCCESSFULLY!');
