import assert from 'node:assert';
import * as THREE from 'three';

const {
	createSquareRingGeometry,
	createShinyRingMaterial,
	createPlaceMarkers,
	checkPlaceHover,
	updatePlaceMarkersAnimation,
	placesData
} = await import('../src/lib/places.js');

console.log('Testing Places.json dataset...');
assert(placesData && placesData.locations, 'Places.json must contain locations');
assert.strictEqual(placesData.locations.length, 8, 'Must have exactly 8 locations');

console.log('Testing Square Ring Geometry...');
const ringGeo = createSquareRingGeometry(0.05, 0.038);
assert(ringGeo instanceof THREE.ShapeGeometry, 'Must return ShapeGeometry');

console.log('Testing Place Markers Construction...');
const { containerGroup, markers, hitMeshes, dispose } = createPlaceMarkers(placesData.locations, 1.0);
assert(containerGroup instanceof THREE.Group, 'Container must be THREE.Group');
assert.strictEqual(markers.length, 8, 'Must generate 8 markers');
assert.strictEqual(hitMeshes.length, 8, 'Must generate 8 hit proxy meshes');

for (const m of markers) {
	assert(m.name, 'Marker must have a name');
	assert(m.type, 'Marker must have a type');
	assert(typeof m.latitude === 'number', 'Latitude must be number');
	assert(typeof m.longitude === 'number', 'Longitude must be number');
	assert(m.surfacePos.length() > 0.999 && m.surfacePos.length() < 1.01, 'Must be situated on Moon surface R=1.0');
}
console.log('✔ All 8 shiny square ring place markers created and situated on Moon surface.');

console.log('Testing Hover Detection & Hemisphere Filtering...');
// Position camera in front of Mare Tranquillitatis (+Z side)
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 2.9);

// Mock a ray that hits Mare Tranquillitatis
const mareTranquillitatis = markers.find((m) => m.name === 'Mare Tranquillitatis');
assert(mareTranquillitatis, 'Mare Tranquillitatis must exist');

const mockRaycaster = {
	intersectObjects: (targets) => {
		// Return hit on Mare Tranquillitatis hit proxy
		const target = targets.find((t) => t.userData.name === 'Mare Tranquillitatis');
		return target ? [{ object: target, point: mareTranquillitatis.surfacePos }] : [];
	}
};

const hovered = checkPlaceHover(mockRaycaster, hitMeshes, camera);
assert(hovered, 'Should detect hover on near-side place');
assert.strictEqual(hovered.name, 'Mare Tranquillitatis');
assert.strictEqual(hovered.type, 'Mare (Lunar plain)');
console.log('✔ Hover detection identified place name and type.');

console.log('Testing Animation Pulse & Hover Highlighting...');
updatePlaceMarkersAnimation(markers, 1.5, hovered);
assert.strictEqual(mareTranquillitatis.ringMesh.material.color.getHex(), 0xffea77, 'Hovered marker must highlight in shiny gold');
assert(mareTranquillitatis.markerGroup.scale.x > 1.0, 'Hovered marker must scale up');

updatePlaceMarkersAnimation(markers, 1.5, null);
assert.strictEqual(mareTranquillitatis.ringMesh.material.color.getHex(), 0x33e5ff, 'Unhovered marker must revert to cyan');
console.log('✔ Animation and hover shine transition verified.');

console.log('Testing Resource Disposal...');
dispose();
console.log('✔ Disposed without errors.');

console.log('ALL PLACES CHECKS PASSED SUCCESSFULLY!');
