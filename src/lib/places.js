import * as THREE from 'three';
import { latLonToVector3, formatLatLon } from './ephemeris.js';
import placesData from './Places.json' with { type: 'json' };

/**
 * Creates a planar square ring (hollow square) geometry.
 *
 * @param {number} outerSize Outer width/height of the square frame
 * @param {number} innerSize Inner width/height of the cutout hole
 * @returns {THREE.ShapeGeometry} Square ring geometry in the XY plane
 */
export function createSquareRingGeometry(outerSize = 0.055, innerSize = 0.041) {
	const shape = new THREE.Shape();
	const ho = outerSize / 2;
	shape.moveTo(-ho, -ho);
	shape.lineTo(ho, -ho);
	shape.lineTo(ho, ho);
	shape.lineTo(-ho, ho);
	shape.closePath();

	const hole = new THREE.Path();
	const hi = innerSize / 2;
	hole.moveTo(-hi, -hi);
	hole.lineTo(hi, -hi);
	hole.lineTo(hi, hi);
	hole.lineTo(-hi, hi);
	hole.closePath();

	shape.holes.push(hole);
	return new THREE.ShapeGeometry(shape);
}

/**
 * Creates corner bracket accent geometry to give the square ring a high-tech reticle look.
 */
function createCornerBracketsGeometry(outerSize = 0.055, bracketLength = 0.012, thickness = 0.0025) {
	const ho = outerSize / 2;
	const shape = new THREE.Shape();

	// 4 corner L-brackets sitting slightly outside the main frame
	const d = ho + 0.003;
	const bl = bracketLength;
	const t = thickness;

	// Top-Right corner
	shape.moveTo(d - bl, d);
	shape.lineTo(d, d);
	shape.lineTo(d, d - bl);
	shape.lineTo(d - t, d - bl);
	shape.lineTo(d - t, d - t);
	shape.lineTo(d - bl, d - t);
	shape.closePath();

	// Top-Left corner
	shape.moveTo(-d + bl, d);
	shape.lineTo(-d, d);
	shape.lineTo(-d, d - bl);
	shape.lineTo(-d + t, d - bl);
	shape.lineTo(-d + t, d - t);
	shape.lineTo(-d + bl, d - t);
	shape.closePath();

	// Bottom-Left corner
	shape.moveTo(-d + bl, -d);
	shape.lineTo(-d, -d);
	shape.lineTo(-d, -d + bl);
	shape.lineTo(-d + t, -d + bl);
	shape.lineTo(-d + t, -d + t);
	shape.lineTo(-d + bl, -d + t);
	shape.closePath();

	// Bottom-Right corner
	shape.moveTo(d - bl, -d);
	shape.lineTo(d, -d);
	shape.lineTo(d, -d + bl);
	shape.lineTo(d - t, -d + bl);
	shape.lineTo(d - t, -d + t);
	shape.lineTo(d - bl, -d + t);
	shape.closePath();

	return new THREE.ShapeGeometry(shape);
}

/**
 * Creates shiny PBR material for the square ring marker.
 */
export function createShinyRingMaterial(color = 0x00e5ff, emissive = 0x0088cc) {
	return new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 0.7,
		metalness: 0.95,
		roughness: 0.12,
		side: THREE.DoubleSide,
		transparent: true,
		opacity: 0.92,
		depthWrite: false
	});
}

/**
 * Creates and positions all markers for locations in Places.json using Marker.svg.
 *
 * @param {Array} locations Array of place objects from Places.json
 * @param {number} moonRadius Sphere radius (default 1.0)
 * @param {THREE.Texture|null} markerTexture Three.js texture of Marker.svg
 * @returns {object} { containerGroup, markers, hitMeshes, dispose }
 */
export function createPlaceMarkers(locations = placesData.locations, moonRadius = 1.0, markerTexture = null) {
	const containerGroup = new THREE.Group();
	containerGroup.name = 'lunar-places-markers';

	const markerAspect = 152 / 144;
	const markerHeight = 0.052;
	const markerWidth = markerHeight * markerAspect;
	const markerGeo = new THREE.PlaneGeometry(markerWidth, markerHeight);

	const ringGeo = createSquareRingGeometry(0.052, 0.040);
	const bracketsGeo = createCornerBracketsGeometry(0.052, 0.010, 0.002);
	const hitGeo = new THREE.PlaneGeometry(0.07, 0.07);
	const hitMat = new THREE.MeshBasicMaterial({
		transparent: true,
		opacity: 0,
		depthWrite: false
	});

	const markers = [];
	const hitMeshes = [];

	for (const loc of locations) {
		const markerGroup = new THREE.Group();
		markerGroup.name = `place-marker-${loc.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;

		// 1. Primary Marker.svg Mesh (active if markerTexture provided)
		let markerMesh = null;
		if (markerTexture) {
			const markerMat = new THREE.MeshBasicMaterial({
				map: markerTexture,
				color: 0xffffff,
				transparent: true,
				opacity: 0.95,
				side: THREE.DoubleSide,
				depthWrite: false
			});
			markerMesh = new THREE.Mesh(markerGeo, markerMat);
			markerMesh.renderOrder = 2;
			markerGroup.add(markerMesh);
		}

		// 2. Procedural Fallback Mesh & Reticle Brackets (visible when markerTexture is null, e.g. Node tests)
		const ringMat = createShinyRingMaterial(0x33e5ff, 0x0077aa);
		const ringMesh = new THREE.Mesh(ringGeo, ringMat);
		ringMesh.visible = !markerTexture;
		markerGroup.add(ringMesh);

		const bracketsMat = new THREE.MeshStandardMaterial({
			color: 0x99f3ff,
			emissive: 0x22aacc,
			emissiveIntensity: 0.9,
			metalness: 0.98,
			roughness: 0.08,
			side: THREE.DoubleSide,
			transparent: true,
			opacity: 0.95,
			depthWrite: false
		});
		const bracketsMesh = new THREE.Mesh(bracketsGeo, bracketsMat);
		bracketsMesh.visible = !markerTexture;
		markerGroup.add(bracketsMesh);

		// 3. Invisible Hit Target for Responsive Raycasting
		const hitMesh = new THREE.Mesh(hitGeo, hitMat);
		markerGroup.add(hitMesh);

		// 4. Position on lunar surface & orient tangent to surface normal
		const surfacePos = latLonToVector3(loc.latitude, loc.longitude, moonRadius + 0.004);
		markerGroup.position.copy(surfacePos);

		const normal = surfacePos.clone().normalize();
		const UP_Z = new THREE.Vector3(0, 0, 1);
		markerGroup.quaternion.setFromUnitVectors(UP_Z, normal);

		const coordsFormat = formatLatLon(loc.latitude, loc.longitude);

		// Store place metadata in userData
		const placeData = {
			name: loc.name,
			type: loc.type,
			latitude: loc.latitude,
			longitude: loc.longitude,
			diameter_km: loc.diameter_km,
			coordsStr: coordsFormat.full,
			markerGroup,
			markerMesh,
			ringMesh,
			bracketsMesh,
			normal,
			surfacePos
		};

		markerGroup.userData = placeData;
		hitMesh.userData = placeData;

		containerGroup.add(markerGroup);
		markers.push(placeData);
		hitMeshes.push(hitMesh);
	}

	return {
		containerGroup,
		markers,
		hitMeshes,
		dispose: () => {
			markerGeo.dispose();
			ringGeo.dispose();
			bracketsGeo.dispose();
			hitGeo.dispose();
			hitMat.dispose();
			for (const m of markers) {
				m.markerMesh?.material.dispose();
				m.ringMesh?.material.dispose();
				m.bracketsMesh?.material.dispose();
			}
		}
	};
}

/**
 * Checks which place marker (if any) is currently hovered by the pointer.
 * Filters out markers situated on the far/occluded hemisphere of the Moon.
 *
 * @param {THREE.Raycaster} raycaster Three.js raycaster configured with pointer coords
 * @param {THREE.Mesh[]} hitMeshes Array of hit mesh proxies
 * @param {THREE.Camera} camera Scene camera
 * @returns {object|null} Hovered place data or null
 */
export function checkPlaceHover(raycaster, hitMeshes, camera) {
	if (!raycaster || !hitMeshes || hitMeshes.length === 0) return null;

	const intersects = raycaster.intersectObjects(hitMeshes, false);
	if (intersects.length === 0) return null;

	for (const hit of intersects) {
		const placeData = hit.object.userData;
		if (!placeData || !placeData.normal || !placeData.surfacePos) continue;

		// Ensure marker is facing the camera (not on occluded hemisphere)
		const toCamera = camera.position.clone().sub(placeData.surfacePos).normalize();
		const dot = placeData.normal.dot(toCamera);
		if (dot > 0.1) {
			return placeData;
		}
	}

	return null;
}

/**
 * Updates dynamic shine, breathing pulsation, and hover highlight on all place markers.
 *
 * @param {Array} markers Array of place marker objects
 * @param {number} time Elapsed time in seconds
 * @param {object|null} hoveredPlace Currently hovered place data
 */
export function updatePlaceMarkersAnimation(markers, time, hoveredPlace) {
	if (!markers) return;

	for (const m of markers) {
		const isHovered = hoveredPlace && hoveredPlace.name === m.name;

		if (isHovered) {
			// Hovered State: Highlight with shiny golden glow & enlarged scale pulse
			if (m.markerMesh) {
				m.markerMesh.material.color.setHex(0xffea77);
				m.markerMesh.material.opacity = 1.0;
			}
			if (m.ringMesh) {
				m.ringMesh.material.color.setHex(0xffea77); // Shiny gold
				m.ringMesh.material.emissive?.setHex(0xffaa00);
				m.ringMesh.material.emissiveIntensity = 1.6;
			}
			if (m.bracketsMesh) {
				m.bracketsMesh.material.color.setHex(0xffffff);
				m.bracketsMesh.material.emissive?.setHex(0xffcc33);
				m.bracketsMesh.material.emissiveIntensity = 2.0;
			}

			// Smooth scale pulse
			const hoverScale = 1.25 + 0.04 * Math.sin(time * 6.0);
			m.markerGroup.scale.set(hoverScale, hoverScale, hoverScale);
		} else {
			// Idle State: Authentic Marker.svg color and resting scale
			if (m.markerMesh) {
				m.markerMesh.material.color.setHex(0xffffff);
				m.markerMesh.material.opacity = 0.92;
			}
			if (m.ringMesh) {
				const pulse = 0.65 + 0.20 * Math.sin(time * 2.5 + m.latitude * 0.1);
				m.ringMesh.material.color.setHex(0x33e5ff); // Electric cyan
				m.ringMesh.material.emissive?.setHex(0x0077aa);
				m.ringMesh.material.emissiveIntensity = pulse;
			}
			if (m.bracketsMesh) {
				const pulse = 0.65 + 0.20 * Math.sin(time * 2.5 + m.latitude * 0.1);
				m.bracketsMesh.material.color.setHex(0x99f3ff);
				m.bracketsMesh.material.emissive?.setHex(0x22aacc);
				m.bracketsMesh.material.emissiveIntensity = pulse * 1.2;
			}

			m.markerGroup.scale.set(1.0, 1.0, 1.0);
		}
	}
}

export { placesData };
