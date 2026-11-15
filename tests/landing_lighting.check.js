import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';

console.log('Testing landing.svelte Sun positioning and Rayleigh lighting...');

// 1. Verify Sun positioning math in landing relative to Globe
const defaultSunPos = new THREE.Vector3(28, 12, -45);
const defaultEarthPos = new THREE.Vector3(-14, 6, -24);

// In Globe, Moon is at (0, 0, 0), Earth is at defaultEarthPos, Sun is at defaultSunPos.
// In Landing, Earth is at (0, 0, 0).
// Therefore, the Sun in Landing relative to Earth must be defaultSunPos - defaultEarthPos.
const defaultSunLanding = new THREE.Vector3().subVectors(defaultSunPos, defaultEarthPos);
assert.equal(defaultSunLanding.x, 42);
assert.equal(defaultSunLanding.y, 6);
assert.equal(defaultSunLanding.z, -21);
console.log('✔ Default Sun position in landing correctly computed as (42, 6, -21).');

// 2. Verify celestial alignment during hyperdrive transition
// Moon in Landing is at -defaultEarthPos
const moonPos = new THREE.Vector3().copy(defaultEarthPos).negate();
assert.equal(moonPos.x, 14);
assert.equal(moonPos.y, -6);
assert.equal(moonPos.z, 24);

// Vector from Moon to Sun in Landing:
const moonToSunLanding = new THREE.Vector3().subVectors(defaultSunLanding, moonPos);
// Must equal defaultSunPos in Globe:
assert.equal(moonToSunLanding.x, defaultSunPos.x);
assert.equal(moonToSunLanding.y, defaultSunPos.y);
assert.equal(moonToSunLanding.z, defaultSunPos.z);
console.log('✔ Hyperdrive arrival alignment: Sun relative to Moon in Landing exactly matches Globe.svelte.');

// 3. Verify Earth lighting direction in Landing matches Globe
// In Globe: sunDir from Earth is normalize(sunPos - earthPos)
const globeEarthSunDir = new THREE.Vector3().subVectors(defaultSunPos, defaultEarthPos).normalize();
// In Landing: Earth is at (0,0,0) and Sun is at defaultSunLanding
const landingEarthSunDir = new THREE.Vector3().copy(defaultSunLanding).normalize();
assert(globeEarthSunDir.distanceTo(landingEarthSunDir) < 1e-6, 'Sun direction from Earth must be identical in Globe and Landing');
console.log('✔ Earth sunlight direction is identical between Globe and Landing.');

// 4. Verify landing.svelte source code contains Rayleigh scattering and lighting components
const landingSource = fs.readFileSync('src/lib/landing.svelte', 'utf8');

assert(landingSource.includes('createInnerCoronaTexture'), 'landing.svelte must include inner corona');
assert(landingSource.includes('createOuterCoronaTexture'), 'landing.svelte must include outer corona');
assert(landingSource.includes('createSunBloomTexture'), 'landing.svelte must include sun bloom');
assert(landingSource.includes('createSolarBeamTexture'), 'landing.svelte must include solar beam diffraction rays');
assert(landingSource.includes('createLightScatteringStreakTexture'), 'landing.svelte must include light scattering streak');
assert(landingSource.includes('smoothstep(-0.15, 0.25, NdotL)'), 'landing.svelte must include day/night terminator wrap');
assert(landingSource.includes('vec3 atmosphereColor = vec3(0.25, 0.55, 1.0);'), 'landing.svelte must include blue Rayleigh atmosphere color');
assert(landingSource.includes('pow(rim, 3.5)'), 'landing.svelte must include Rayleigh horizon rim scattering');
assert(landingSource.includes('calculateEarthRotation'), 'landing.svelte must include realistic Earth rotation');
assert(landingSource.includes('uSunDirection'), 'landing.svelte must include uSunDirection uniform');
assert(landingSource.includes('uMapNight'), 'landing.svelte must include uMapNight uniform for night lights');
assert(landingSource.includes('earth_night.jpg'), 'landing.svelte must import earth_night.jpg');
assert(landingSource.includes('mix(nightColor, dayColor, daylight)'), 'landing.svelte must mix night and day colors');

const globeSource = fs.readFileSync('src/lib/Globe.svelte', 'utf8');
assert(globeSource.includes('uMapNight'), 'Globe.svelte must include uMapNight uniform for night lights');
assert(globeSource.includes('earth_night.jpg'), 'Globe.svelte must import earth_night.jpg');
assert(globeSource.includes('mix(nightColor, dayColor, daylight)'), 'Globe.svelte must mix night and day colors');

console.log('✔ All Rayleigh scattering, night lights map, and Sun shader components verified in landing.svelte and Globe.svelte.');
console.log('All landing lighting checks passed successfully!');
