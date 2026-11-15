import assert from 'node:assert';
import * as THREE from 'three';

// 1. Flare obstruction calculation
function calculateFlareVisibility(cameraPos, sunPos, occlusionRadius = 1.02, sunRadius = 1.8) {
	const _toSun = new THREE.Vector3().subVectors(sunPos, cameraPos);
	const sunDist = _toSun.length();
	const _sunDir = _toSun.clone().divideScalar(sunDist);

	const t = -cameraPos.dot(_sunDir);
	if (t <= 0 || t >= sunDist) {
		return 1.0;
	}

	const camDistSq = cameraPos.lengthSq();
	const distSq = Math.max(0, camDistSq - t * t);
	const dPerp = Math.sqrt(distSq);

	const sunConeRadius = sunRadius * (t / sunDist);
	const innerThreshold = occlusionRadius;
	const outerThreshold = occlusionRadius + sunConeRadius;

	return THREE.MathUtils.smoothstep(dPerp, innerThreshold, outerThreshold);
}

// Obstructed: Sun directly behind Moon
assert.strictEqual(
	calculateFlareVisibility(new THREE.Vector3(0, 0, 3), new THREE.Vector3(0, 0, -50)),
	0,
	'Sun behind moon must have 0 visibility'
);

// Clear: Sun far to the side
assert.strictEqual(
	calculateFlareVisibility(new THREE.Vector3(0, 0, 2.9), new THREE.Vector3(28, 12, -45)),
	1.0,
	'Clear sun must have 1.0 visibility'
);

// 2. Earth illumination vector
const sunPos = new THREE.Vector3(28, 12, -45);
const earthPos = new THREE.Vector3(-14, 6, -24);
const earthSunDir = new THREE.Vector3().subVectors(sunPos, earthPos).normalize();
assert(earthSunDir.length() > 0.999 && earthSunDir.length() < 1.001, 'Earth sun direction must be unit vector');

console.log('All Globe lighting & occlusion checks passed successfully.');
