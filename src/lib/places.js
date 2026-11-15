import * as THREE from 'three';
import { latLonToVector3, formatLatLon } from './ephemeris.js';
import placesData from './Places.json' with { type: 'json' };
import moonLandingSitesData from './moon_landing_sites.json' with { type: 'json' };

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
		const lat = loc.latitude ?? loc.lat;
		const lon = loc.longitude ?? loc.lon;
		const surfacePos = latLonToVector3(lat, lon, moonRadius + 0.004);
		markerGroup.position.copy(surfacePos);

		const normal = surfacePos.clone().normalize();
		const UP_Z = new THREE.Vector3(0, 0, 1);
		markerGroup.quaternion.setFromUnitVectors(UP_Z, normal);

		const coordsFormat = formatLatLon(lat, lon);

		// Store place metadata in userData
		const placeData = {
			...loc,
			name: loc.name,
			type: loc.type,
			latitude: lat,
			longitude: lon,
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
			const latVal = m.latitude ?? m.lat ?? 0;
			if (m.ringMesh) {
				const pulse = 0.65 + 0.20 * Math.sin(time * 2.5 + latVal * 0.1);
				m.ringMesh.material.color.setHex(0x33e5ff); // Electric cyan
				m.ringMesh.material.emissive?.setHex(0x0077aa);
				m.ringMesh.material.emissiveIntensity = pulse;
			}
			if (m.bracketsMesh) {
				const pulse = 0.65 + 0.20 * Math.sin(time * 2.5 + latVal * 0.1);
				m.bracketsMesh.material.color.setHex(0x99f3ff);
				m.bracketsMesh.material.emissive?.setHex(0x22aacc);
				m.bracketsMesh.material.emissiveIntensity = pulse * 1.2;
			}

			m.markerGroup.scale.set(1.0, 1.0, 1.0);
		}
	}
}

/**
 * Filters and formats historic lunar landing sites from moon_landing_sites.json.
 * Only includes Apollo (crewed) and Chandrayaan missions.
 * Excludes Surveyors and commercial rovers as specified.
 *
 * @param {object} jsonData Raw data from moon_landing_sites.json
 * @returns {Array} Array of landing site objects formatted for place markers
 */
export function getHistoricLandingSites(jsonData = moonLandingSitesData) {
	const sites = jsonData?.sites || jsonData || [];
	return sites
		.filter((site) => {
			const name = (site.name || '').toLowerCase();
			// Explicitly exclude Surveyors
			if (name.includes('surveyor')) return false;
			// Explicitly exclude commercial rovers/landers (Intuitive Machines, Firefly, etc.)
			if (
				name.includes('odysseus') ||
				name.includes('blue ghost') ||
				name.includes('athena')
			) {
				return false;
			}
			// Only include Apollo and Chandrayaan missions
			return name.includes('apollo') || name.includes('chandrayaan');
		})
		.map((site) => {
			const typeMap = {
				crewed_landing: 'Crewed Lunar Landing',
				robotic_landing: 'Robotic Lunar Landing',
				crash: 'Lunar Impact Probe / Lander'
			};
			const typeDesc = typeMap[site.type] || 'Lunar Landing Site';
			const fullType = site.note
				? `${typeDesc} (${site.note})`
				: `${typeDesc} · ${site.country}`;

			return {
				name: site.name,
				country: site.country,
				type: fullType,
				rawType: site.type,
				latitude: site.lat,
				longitude: site.lon,
				lat: site.lat,
				lon: site.lon,
				date: site.date,
				note: site.note || '',
				left_behind: site.left_behind || [],
				isLandingSite: true
			};
		});
}

/**
 * Returns distinct types of lunar landmarks from Places.json, plus Historic Landing Sites.
 *
 * @param {Array} locations Array of place objects (defaults to placesData.locations)
 * @param {boolean} includeLandingSites Whether to include historic landing sites category
 * @returns {Array<{ value: string, label: string, count: number }>}
 */
export function getLandmarkTypes(locations = placesData.locations, includeLandingSites = true) {
	const typeCounts = new Map();

	for (const loc of locations) {
		const type = loc.type;
		if (type) {
			typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
		}
	}

	const result = Array.from(typeCounts.entries()).map(([type, count]) => ({
		value: type,
		label: type,
		count
	}));

	if (includeLandingSites) {
		const landingSites = getHistoricLandingSites(moonLandingSitesData);
		result.push({
			value: 'Historic Landing Sites',
			label: 'Historic Landing Sites',
			count: landingSites.length
		});
	}

	return result;
}

/**
 * Returns landmarks matching a specified landmark type.
 *
 * @param {string} type Landmark type string
 * @param {Array} locations Array of place objects
 * @returns {Array} Matching landmark objects
 */
export function getLandmarksByType(type, locations = placesData.locations) {
	if (!type) return [];
	if (type === 'Historic Landing Sites' || type.toLowerCase().includes('landing site')) {
		return getHistoricLandingSites(moonLandingSitesData);
	}
	return locations.filter((loc) => loc.type === type);
}

/**
 * Finds a landmark or landing site near the provided coordinates.
 *
 * @param {number} lat Latitude
 * @param {number} lon Longitude
 * @param {number} epsilon Max angular distance in degrees to match
 * @returns {object|null} Matching landmark or null
 */
export function findLandmarkByCoords(lat, lon, epsilon = 0.05) {
	if (typeof lat !== 'number' || typeof lon !== 'number') return null;
	const landingSites = getHistoricLandingSites(moonLandingSitesData);
	for (const site of landingSites) {
		const sLat = site.latitude ?? site.lat;
		const sLon = site.longitude ?? site.lon;
		if (typeof sLat === 'number' && typeof sLon === 'number') {
			if (Math.abs(sLat - lat) < epsilon && Math.abs(sLon - lon) < epsilon) {
				return site;
			}
		}
	}
	for (const loc of placesData.locations) {
		const lLat = loc.latitude ?? loc.lat;
		const lLon = loc.longitude ?? loc.lon;
		if (typeof lLat === 'number' && typeof lLon === 'number') {
			if (Math.abs(lLat - lat) < epsilon && Math.abs(lLon - lon) < epsilon) {
				return loc;
			}
		}
	}
	return null;
}

export { placesData, moonLandingSitesData };
