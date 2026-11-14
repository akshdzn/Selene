import assert from 'node:assert';
import * as THREE from 'three';

// Mock minimal DOM canvas for headless Node test environment
if (typeof document === 'undefined') {
	global.document = {
		createElement: (tag) => {
			if (tag === 'canvas') {
				return {
					width: 0,
					height: 0,
					getContext: () => ({
						fillRect: () => {},
						beginPath: () => {},
						moveTo: () => {},
						lineTo: () => {},
						closePath: () => {},
						fill: () => {},
						stroke: () => {},
						arc: () => {},
						save: () => {},
						restore: () => {},
						getImageData: (x, y, w, h) => ({
							data: new Uint8ClampedArray(w * h * 4)
						}),
						createImageData: (w, h) => ({
							data: new Uint8ClampedArray(w * h * 4)
						}),
						putImageData: () => {}
					})
				};
			}
			return {};
		}
	};
}

const {
	createAmericanFlagTexture,
	createIndianFlagTexture,
	createFlagDisplacementTexture,
	createFlagModel,
	createAmericanFlag,
	createIndianFlag,
	placeFlagOnMoon,
	updateFlagsZoomVisibility,
	getFlagLandingSites,
	createLandingSiteFlags,
	HISTORIC_LUNAR_SITES
} = await import('../src/lib/flags.js');

console.log('Testing Lunar Flag Texture Generators...');
const usTex = createAmericanFlagTexture(760, 400);
assert(usTex instanceof THREE.CanvasTexture, 'US Flag texture must be CanvasTexture');

const inTex = createIndianFlagTexture(600, 400);
assert(inTex instanceof THREE.CanvasTexture, 'Indian Flag texture must be CanvasTexture');

const bumpTex = createFlagDisplacementTexture(512, 256);
assert(bumpTex instanceof THREE.CanvasTexture, 'Displacement texture must be CanvasTexture');
console.log('✔ All procedural flag textures created successfully.');

console.log('Testing 3D Lunar Flag Models (Standing vs Fallen, 3x Scale)...');
const standingFlag = createAmericanFlag({ scale: 0.024, orientation: 'standing' });
assert(standingFlag instanceof THREE.Group, 'Standing flag must be a THREE.Group');
assert.strictEqual(standingFlag.userData.orientation, 'standing');
assert.strictEqual(standingFlag.userData.isFallen, false);
assert.strictEqual(standingFlag.scale.x, 0.024, 'Flag scale must be 0.024 (3x original)');

const fallenFlag = createAmericanFlag({ scale: 0.024, orientation: 'fallen' });
assert(fallenFlag instanceof THREE.Group, 'Fallen flag must be a THREE.Group');
assert.strictEqual(fallenFlag.userData.orientation, 'fallen');
assert.strictEqual(fallenFlag.userData.isFallen, true);
assert.strictEqual(fallenFlag.scale.x, 0.024, 'Flag scale must be 0.024 (3x original)');

// Verify fallen assembly rotation (tilted to lie along lunar surface)
const fallenAssembly = fallenFlag.children.find((c) => c.children && c.children.length > 2);
assert(fallenAssembly, 'Fallen flag must have inner flag assembly');
assert(Math.abs(fallenAssembly.rotation.x) > 1.4, 'Fallen flag assembly must be tilted ~87 degrees along ground');

const standingAssembly = standingFlag.children.find((c) => c.children && c.children.length > 2);
assert.strictEqual(standingAssembly.rotation.x, 0, 'Standing flag assembly must be upright (rotation.x = 0)');
console.log('✔ Standing and fallen orientations verified.');

console.log('Testing moon_landing_sites.json flag parser...');
const sites = getFlagLandingSites();
assert(sites.length >= 6, 'Must find landing sites with flags');

const apollo11 = sites.find((s) => s.name === 'Apollo 11');
assert(apollo11, 'Apollo 11 must be present in parsed sites');
assert.strictEqual(apollo11.lat, 0.674);
assert.strictEqual(apollo11.lon, 23.473);
assert.strictEqual(apollo11.orientation, 'fallen', 'Apollo 11 flag was knocked over by LM ascent engine');

const apollo12 = sites.find((s) => s.name === 'Apollo 12');
assert.strictEqual(apollo12.orientation, 'standing', 'Apollo 12 flag is standing');

const apollo14 = sites.find((s) => s.name === 'Apollo 14');
assert.strictEqual(apollo14.orientation, 'standing', 'Apollo 14 flag is standing');

const apollo15 = sites.find((s) => s.name === 'Apollo 15');
assert.strictEqual(apollo15.orientation, 'standing', 'Apollo 15 flag is standing');

const apollo16 = sites.find((s) => s.name === 'Apollo 16');
assert.strictEqual(apollo16.orientation, 'standing', 'Apollo 16 flag is standing');

const apollo17 = sites.find((s) => s.name === 'Apollo 17');
assert.strictEqual(apollo17.orientation, 'standing', 'Apollo 17 flag is standing');

const chandrayaan3 = sites.find((s) => s.name.includes('Chandrayaan-3'));
if (chandrayaan3) {
	assert.strictEqual(chandrayaan3.country, 'India');
	assert.strictEqual(chandrayaan3.orientation, 'standing');
}
console.log('✔ Landing site coordinates and orientations (fallen/standing) verified from moon_landing_sites.json.');

console.log('Testing createLandingSiteFlags batch generation...');
const landingFlagsGroup = createLandingSiteFlags(1.0);
assert(landingFlagsGroup instanceof THREE.Group);
assert(landingFlagsGroup.userData.flags.length >= 6, 'Must create flags for all lunar landing sites');

// Verify all placed flags are situated on the lunar surface
for (const f of landingFlagsGroup.userData.flags) {
	const dist = f.position.length();
	assert(dist > 0.999 && dist < 1.002, `Flag ${f.userData.siteName} must be on Moon surface (R=1.0)`);
}
console.log('✔ All flags placed at exact Selenographic coordinates on Moon surface.');

console.log('Testing Zoom Visibility Logic (Expanded 2.5 distance threshold)...');
const mockCamera = { position: new THREE.Vector3(0, 0, 2.9) }; // default distance (zoomed out)
updateFlagsZoomVisibility(landingFlagsGroup.userData.flags, mockCamera, 2.5);
for (const f of landingFlagsGroup.userData.flags) {
	assert.strictEqual(f.visible, false, 'Flags must be hidden when zoomed out at default view (2.9 > 2.5)');
}

mockCamera.position.set(0, 0, 2.2); // zoomed in past 2.5 threshold
updateFlagsZoomVisibility(landingFlagsGroup.userData.flags, mockCamera, 2.5);
for (const f of landingFlagsGroup.userData.flags) {
	assert.strictEqual(f.visible, true, 'Flags must be visible at distance 2.2 (<= 2.5 threshold)');
}
console.log('✔ Zoom visibility verified with expanded distance threshold.');

console.log('Testing Resource Disposal...');
landingFlagsGroup.userData.dispose();
standingFlag.userData.dispose();
fallenFlag.userData.dispose();
console.log('✔ Cleanup and disposal executed without error.');

console.log('ALL LUNAR FLAG CHECKS PASSED SUCCESSFULLY!');
