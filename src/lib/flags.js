import * as THREE from 'three';
import { latLonToVector3 } from './ephemeris.js';
import landingSitesData from './moon_landing_sites.json' with { type: 'json' };

/**
 * Procedural texture generator for the Flag of the United States of America (Old Glory).
 * 13 alternating red and white stripes, blue canton with 50 white stars.
 */
export function createAmericanFlagTexture(width = 760, height = 400) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');

	const stripeHeight = height / 13;

	// 1. Draw 13 alternating red and white stripes
	for (let i = 0; i < 13; i++) {
		ctx.fillStyle = i % 2 === 0 ? '#B22234' : '#FFFFFF';
		ctx.fillRect(0, i * stripeHeight, width, stripeHeight + 0.5);
	}

	// 2. Draw Blue Canton (Union)
	const cantonWidth = width * 0.40;
	const cantonHeight = stripeHeight * 7;
	ctx.fillStyle = '#3C3B6E';
	ctx.fillRect(0, 0, cantonWidth, cantonHeight);

	// 3. Helper to draw a 5-pointed star
	function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
		let rot = (Math.PI / 2) * 3;
		let x = cx;
		let y = cy;
		const step = Math.PI / spikes;

		ctx.beginPath();
		ctx.moveTo(cx, cy - outerRadius);
		for (let i = 0; i < spikes; i++) {
			x = cx + Math.cos(rot) * outerRadius;
			y = cy + Math.sin(rot) * outerRadius;
			ctx.lineTo(x, y);
			rot += step;

			x = cx + Math.cos(rot) * innerRadius;
			y = cy + Math.sin(rot) * innerRadius;
			ctx.lineTo(x, y);
			rot += step;
		}
		ctx.lineTo(cx, cy - outerRadius);
		ctx.closePath();
		ctx.fillStyle = '#FFFFFF';
		ctx.fill();
	}

	// 4. Draw 50 Stars in 9 alternating rows (6 and 5 stars)
	const numRows = 9;
	const starRadius = stripeHeight * 0.28;
	const innerRadius = starRadius * 0.40;
	const rowSpacing = cantonHeight / (numRows + 1);

	for (let row = 0; row < numRows; row++) {
		const isEven = row % 2 === 0;
		const numStars = isEven ? 6 : 5;
		const colSpacing = cantonWidth / (numStars + 1);
		const y = (row + 1) * rowSpacing;

		for (let col = 0; col < numStars; col++) {
			const x = (col + 1) * colSpacing;
			drawStar(x, y, 5, starRadius, innerRadius);
		}
	}

	// Subtle fabric weave texture
	addFabricWeaveOverlay(ctx, width, height);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

/**
 * Procedural texture generator for the National Flag of India (Tiranga).
 * Horizontal tricolour: Saffron, White, and Green with the 24-spoke Ashoka Chakra.
 */
export function createIndianFlagTexture(width = 600, height = 400) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');

	const bandHeight = height / 3;

	// 1. Saffron (Top)
	ctx.fillStyle = '#FF9933';
	ctx.fillRect(0, 0, width, bandHeight);

	// 2. White (Middle)
	ctx.fillStyle = '#FFFFFF';
	ctx.fillRect(0, bandHeight, width, bandHeight);

	// 3. India Green (Bottom)
	ctx.fillStyle = '#138808';
	ctx.fillRect(0, bandHeight * 2, width, bandHeight);

	// 4. Ashoka Chakra (Center of White Band)
	const cx = width / 2;
	const cy = height / 2;
	const chakraRadius = bandHeight * 0.42;
	const hubRadius = chakraRadius * 0.18;
	const navy = '#000080';

	// Outer circular ring
	ctx.strokeStyle = navy;
	ctx.lineWidth = Math.max(2, chakraRadius * 0.08);
	ctx.beginPath();
	ctx.arc(cx, cy, chakraRadius, 0, Math.PI * 2);
	ctx.stroke();

	// Inner hub circle
	ctx.fillStyle = navy;
	ctx.beginPath();
	ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
	ctx.fill();

	// Center pin dot
	ctx.fillStyle = '#FFFFFF';
	ctx.beginPath();
	ctx.arc(cx, cy, hubRadius * 0.35, 0, Math.PI * 2);
	ctx.fill();

	// Exactly 24 Spokes radiating outwards
	ctx.strokeStyle = navy;
	ctx.lineWidth = Math.max(1.5, chakraRadius * 0.04);
	const numSpokes = 24;
	for (let i = 0; i < numSpokes; i++) {
		const angle = (i * 2 * Math.PI) / numSpokes;
		const x1 = cx + Math.cos(angle) * hubRadius;
		const y1 = cy + Math.sin(angle) * hubRadius;
		const x2 = cx + Math.cos(angle) * chakraRadius;
		const y2 = cy + Math.sin(angle) * chakraRadius;

		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	}

	// Small dots between spokes along outer rim
	ctx.fillStyle = navy;
	for (let i = 0; i < numSpokes; i++) {
		const angle = ((i + 0.5) * 2 * Math.PI) / numSpokes;
		const r = chakraRadius * 0.90;
		const dx = cx + Math.cos(angle) * r;
		const dy = cy + Math.sin(angle) * r;
		ctx.beginPath();
		ctx.arc(dx, dy, chakraRadius * 0.03, 0, Math.PI * 2);
		ctx.fill();
	}

	// Subtle fabric weave texture
	addFabricWeaveOverlay(ctx, width, height);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

/**
 * Adds micro fabric grain and shading to prevent plastic/flat look.
 */
function addFabricWeaveOverlay(ctx, width, height) {
	const imgData = ctx.getImageData(0, 0, width, height);
	const data = imgData.data;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const idx = (y * width + x) * 4;
			// Fine alternating thread modulation (micro-weave)
			const weave = ((x % 2 === 0 ? 1 : -1) + (y % 2 === 0 ? 1 : -1)) * 1.5;
			data[idx] = Math.min(255, Math.max(0, data[idx] + weave));
			data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + weave));
			data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + weave));
		}
	}
	ctx.putImageData(imgData, 0, 0);
}

/**
 * Generates a displacement/bump map simulating zero-gravity lunar flag ripples.
 * Real Apollo/lunar flags retain wavy folds along the horizontal crossbar in the vacuum.
 */
export function createFlagDisplacementTexture(width = 512, height = 256) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	const imgData = ctx.createImageData(width, height);
	const data = imgData.data;

	for (let y = 0; y < height; y++) {
		const v = y / height;
		for (let x = 0; x < width; x++) {
			const u = x / width;

			// Longitudinal undulating waves with vertical dampening
			const wave1 = Math.sin(u * Math.PI * 6.5) * 0.45;
			const wave2 = Math.sin(u * Math.PI * 13.0 + 1.2) * 0.25;
			const wave3 = Math.cos(v * Math.PI * 4.0 + u * 3.0) * 0.15;
			const fold = Math.sin(u * Math.PI * 2.0) * 0.15;

			const total = (wave1 + wave2 + wave3 + fold) * (0.5 + 0.5 * u); // amplitude increases away from mast
			const val = Math.floor(THREE.MathUtils.clamp((total + 1.0) * 0.5 * 255, 0, 255));

			const idx = (y * width + x) * 4;
			data[idx] = val;
			data[idx + 1] = val;
			data[idx + 2] = val;
			data[idx + 3] = 255;
		}
	}

	ctx.putImageData(imgData, 0, 0);
	return new THREE.CanvasTexture(canvas);
}

/**
 * Creates a physically modeled 3D Lunar Flag Assembly (Apollo/Chandrayaan style).
 * Modeled identically to the Moon:
 * - Uses MeshStandardMaterial with physical roughness, metalness, and bump mapping.
 * - Double-sided fabric mesh responding to directional sunlight and ambient lighting.
 * - Anodized aluminum/gold flagpole, horizontal deployment crossbar, and ground anchor footpad.
 * - Scaled so it is realistic and tiny on the Moon surface (R=1.0), visible when zoomed in.
 * - Supports physical orientation: 'standing' (upright) or 'fallen'/'knocked_over' (lying flat on lunar regolith).
 *
 * @param {string} country 'usa' | 'india'
 * @param {object} options Configuration options
 * @returns {THREE.Group} Complete 3D flag model group
 */
export function createFlagModel(country = 'usa', options = {}) {
	const {
		scale = 0.024, // 3x larger (scaled from 0.008 to 0.024 for enhanced visibility)
		poleHeight = 1.0,
		poleRadius = 0.012,
		flagWidth = 0.55,
		flagHeight = 0.35,
		crossbar = true, // Lunar deployment horizontal crossbar
		bumpScale = 0.04,
		orientation = 'standing' // 'standing' | 'fallen' | 'knocked_over'
	} = options;

	const flagGroup = new THREE.Group();
	flagGroup.name = `lunar-flag-${country}-${orientation}`;

	const isFallen = orientation === 'fallen' || orientation === 'knocked_over';

	// Inner assembly holding pole, crossbar, and cloth
	const flagAssembly = new THREE.Group();

	// 1. Select Country Flag Texture
	let flagTexture;
	const lowerCountry = country.toLowerCase();
	if (lowerCountry === 'usa' || lowerCountry === 'america' || lowerCountry === 'american') {
		flagTexture = createAmericanFlagTexture();
	} else if (lowerCountry === 'india' || lowerCountry === 'indian') {
		flagTexture = createIndianFlagTexture();
	} else {
		flagTexture = createAmericanFlagTexture();
	}

	const displacementTexture = createFlagDisplacementTexture();

	// 2. Vertical Flagpole (anodized aluminum)
	const poleGeo = new THREE.CylinderGeometry(poleRadius, poleRadius, poleHeight, 16);
	const poleMat = new THREE.MeshStandardMaterial({
		color: 0xd0d0d8,
		metalness: 0.88,
		roughness: 0.22
	});
	const pole = new THREE.Mesh(poleGeo, poleMat);
	// Center cylinder so its base sits at y=0 (ground contact)
	pole.position.y = poleHeight / 2;
	flagAssembly.add(pole);

	// 3. Ground Anchor Base Footpad (lunar regolith collar - stays rooted at ground origin)
	const footpadGeo = new THREE.CylinderGeometry(poleRadius * 3.5, poleRadius * 4.5, poleHeight * 0.04, 16);
	const footpadMat = new THREE.MeshStandardMaterial({
		color: 0x888890,
		metalness: 0.70,
		roughness: 0.40
	});
	const footpad = new THREE.Mesh(footpadGeo, footpadMat);
	footpad.position.y = poleHeight * 0.02;
	flagGroup.add(footpad);

	// 4. Gold Finial (Pole Tip Cap)
	const finialGeo = new THREE.SphereGeometry(poleRadius * 1.8, 16, 16);
	const finialMat = new THREE.MeshStandardMaterial({
		color: 0xd4af37, // Gold
		metalness: 0.95,
		roughness: 0.15
	});
	const finial = new THREE.Mesh(finialGeo, finialMat);
	finial.position.y = poleHeight;
	flagAssembly.add(finial);

	// 5. Horizontal Top Crossbar (keeps flag open in vacuum)
	if (crossbar) {
		const crossbarRadius = poleRadius * 0.70;
		const crossbarGeo = new THREE.CylinderGeometry(crossbarRadius, crossbarRadius, flagWidth, 12);
		crossbarGeo.rotateZ(-Math.PI / 2); // Orient horizontally along +X
		const crossbarMesh = new THREE.Mesh(crossbarGeo, poleMat);
		crossbarMesh.position.set(flagWidth / 2, poleHeight - (poleRadius * 1.5), 0);
		flagAssembly.add(crossbarMesh);
	}

	// 6. Flag Cloth Fabric Mesh
	// 32x16 segment plane with geometric waves + displacement/bump mapping
	const flagGeo = new THREE.PlaneGeometry(flagWidth, flagHeight, 32, 16);
	const posAttr = flagGeo.attributes.position;

	// Bake physical zero-gravity ripple into vertex coordinates
	// Fallen flags have extra crumpling from ground impact / rocket exhaust
	const foldMultiplier = isFallen ? 1.6 : 1.0;
	for (let i = 0; i < posAttr.count; i++) {
		const u = (posAttr.getX(i) + flagWidth / 2) / flagWidth;
		const v = (posAttr.getY(i) + flagHeight / 2) / flagHeight;
		const zOffset = (
			Math.sin(u * Math.PI * 4.5) * 0.018 * foldMultiplier +
			Math.sin(u * Math.PI * 9.0 + 0.8) * 0.009 * foldMultiplier +
			Math.cos(v * Math.PI * 3.0) * 0.005 * foldMultiplier
		) * u;
		posAttr.setZ(i, zOffset);
	}
	flagGeo.computeVertexNormals();

	const flagMat = new THREE.MeshStandardMaterial({
		map: flagTexture,
		bumpMap: displacementTexture,
		bumpScale: bumpScale * (isFallen ? 1.4 : 1.0),
		displacementMap: displacementTexture,
		displacementScale: 0.004 * (isFallen ? 1.5 : 1.0),
		roughness: 0.80,
		metalness: 0.02,
		side: THREE.DoubleSide
	});

	const flagCloth = new THREE.Mesh(flagGeo, flagMat);
	// Attach top-left corner to flagpole
	flagCloth.position.set(flagWidth / 2, poleHeight - flagHeight / 2 - (poleRadius * 1.5), 0);
	flagAssembly.add(flagCloth);

	if (isFallen) {
		// Fallen/knocked-over flag (e.g. Apollo 11 blown over by Lunar Module ascent blast)
		// Tilt the flagpole down so it lies flat along the lunar surface (XZ ground tangent plane)
		// and the flag cloth rests flat on the lunar regolith facing upwards.
		flagAssembly.rotation.x = -Math.PI * 0.486; // ~87.5 degrees tilt
		flagAssembly.position.y = 0.0001; // Rest slightly on top of lunar regolith
	}

	flagGroup.add(flagAssembly);

	// Apply overall master scaling
	flagGroup.scale.set(scale, scale, scale);

	// Store cleanup method and metadata
	flagGroup.userData = {
		country,
		orientation,
		isFallen,
		flagTexture,
		displacementTexture,
		dispose: () => {
			flagTexture.dispose();
			displacementTexture.dispose();
			poleGeo.dispose();
			poleMat.dispose();
			footpadGeo.dispose();
			footpadMat.dispose();
			finialGeo.dispose();
			finialMat.dispose();
			flagGeo.dispose();
			flagMat.dispose();
		}
	};

	return flagGroup;
}

/**
 * Convenience constructors for specific national flags
 */
export function createAmericanFlag(options = {}) {
	return createFlagModel('usa', options);
}

export function createIndianFlag(options = {}) {
	return createFlagModel('india', options);
}

/**
 * Extracts and maps all flag landing sites from moon_landing_sites.json
 * Maps each site to its country, coordinates, and orientation ('standing' or 'fallen').
 */
export function getFlagLandingSites(jsonData = landingSitesData, options = {}) {
	const sites = jsonData?.sites || jsonData || [];
	return sites
		.filter((site) => {
			if (options.onlyApollo) {
				return site.name.startsWith('Apollo');
			}
			if (options.onlyExplicitYes) {
				return site.flag_left_behind === 'yes';
			}
			// Include sites with flags left behind or known flags on lunar probes/landers
			return (
				site.flag_left_behind === 'yes' ||
				site.flag === 'standing' ||
				site.flag === 'knocked_over' ||
				site.flag === 'painted_on_probe' ||
				(site.country === 'India' && site.name.includes('Chandrayaan'))
			);
		})
		.map((site) => {
			let orientation = 'standing';
			if (
				site.flag === 'knocked_over' ||
				site.type === 'crash' ||
				site.note?.toLowerCase().includes('on its side')
			) {
				orientation = 'fallen';
			} else if (site.flag === 'standing') {
				orientation = 'standing';
			} else if (site.type === 'robotic_landing' || site.type === 'crewed_landing') {
				orientation = 'standing';
			}

			return {
				name: site.name,
				country: site.country,
				lat: site.lat,
				lon: site.lon,
				date: site.date,
				type: site.type,
				flagStatus: site.flag,
				flagLeftBehind: site.flag_left_behind,
				orientation, // 'standing' or 'fallen'
				note: site.note || ''
			};
		});
}

/**
 * Creates and places all flag models from moon_landing_sites.json on the Moon sphere.
 * Applies exact Selenographic coordinates and physical orientation (fallen vs standing).
 *
 * @param {number} moonRadius Sphere radius (default 1.0)
 * @param {object} options Configuration options ({ scale, onlyApollo, ... })
 * @returns {THREE.Group} Group containing all placed flag models
 */
export function createLandingSiteFlags(moonRadius = 1.0, options = {}) {
	const {
		scale = 0.024, // 3x larger (scaled from 0.008 to 0.024)
		sitesData = landingSitesData
	} = options;

	const containerGroup = new THREE.Group();
	containerGroup.name = 'lunar-landing-site-flags';

	const sites = getFlagLandingSites(sitesData, options);
	const createdFlags = [];

	for (const site of sites) {
		const country = site.country.toLowerCase() === 'india' ? 'india' : 'usa';
		const flag = createFlagModel(country, {
			scale,
			orientation: site.orientation
		});

		flag.name = `flag-${site.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
		flag.userData.siteName = site.name;
		flag.userData.country = site.country;
		flag.userData.date = site.date;
		flag.userData.lat = site.lat;
		flag.userData.lon = site.lon;
		flag.userData.orientation = site.orientation;
		flag.userData.site = site;

		placeFlagOnMoon(flag, site.lat, site.lon, moonRadius);
		containerGroup.add(flag);
		createdFlags.push(flag);
	}

	containerGroup.userData = {
		flags: createdFlags,
		dispose: () => {
			for (const f of createdFlags) {
				f.userData?.dispose?.();
			}
		}
	};

	return containerGroup;
}

/**
 * Historical Lunar Landing Sites for each flag
 */
export const HISTORIC_LUNAR_SITES = {
	// USA: Apollo 11 Tranquility Base (Mare Tranquillitatis)
	APOLLO_11: {
		country: 'usa',
		mission: 'Apollo 11',
		siteName: 'Tranquility Base',
		lat: 0.67408,
		lon: 23.47297
	},
	// USA: Apollo 12 (Ocean of Storms)
	APOLLO_12: {
		country: 'usa',
		mission: 'Apollo 12',
		siteName: 'Ocean of Storms',
		lat: -3.01239,
		lon: -23.42157
	},
	// India: Chandrayaan-3 Statio Shiv Shakti (Lunar South Polar region)
	CHANDRAYAAN_3: {
		country: 'india',
		mission: 'Chandrayaan-3',
		siteName: 'Statio Shiv Shakti',
		lat: -69.373,
		lon: 32.319
	},
	// India: Chandrayaan-1 Moon Impact Probe (Shackleton crater vicinity)
	CHANDRAYAAN_1: {
		country: 'india',
		mission: 'Chandrayaan-1 MIP',
		siteName: 'Jawahar Point',
		lat: -89.9,
		lon: 0.0
	}
};

/**
 * Accurately places and anchors a flag model on the Moon's spherical surface.
 * Aligns the vertical flagpole along the local lunar surface normal.
 *
 * @param {THREE.Group} flagGroup The 3D flag model group
 * @param {number} lat Latitude in degrees (-90 to +90)
 * @param {number} lon Longitude in degrees (-180 to +180)
 * @param {number} moonRadius Sphere radius (default 1.0)
 * @param {number} altitudeOffset Tiny offset above sphere to prevent z-fighting (default 0.0001)
 */
export function placeFlagOnMoon(flagGroup, lat, lon, moonRadius = 1.0, altitudeOffset = 0.0001) {
	// 1. Calculate surface vector using project's Selenographic coordinate math
	const surfacePos = latLonToVector3(lat, lon, moonRadius + altitudeOffset);
	flagGroup.position.copy(surfacePos);

	// 2. Local surface normal pointing outward from Moon center
	const normal = surfacePos.clone().normalize();

	// 3. Align flag's local +Y (pole direction) with lunar surface normal
	const UP_Y = new THREE.Vector3(0, 1, 0);
	flagGroup.quaternion.setFromUnitVectors(UP_Y, normal);

	// 4. Record coordinates in userData
	flagGroup.userData.lat = lat;
	flagGroup.userData.lon = lon;

	return flagGroup;
}

/**
 * Dynamic Zoom-Visibility Manager:
 * Makes flags visible only when the user zooms into the Moon.
 * When zoomed out (camera distance > zoomThreshold), flags are hidden or faded out.
 *
 * In Selene, camera distance ranges from 1.3 (max zoom-in) to 7.0 (max zoom-out), with 2.9 default.
 *
 * @param {THREE.Group|THREE.Group[]} flags Flag or array of flag groups
 * @param {THREE.Camera} camera Three.js perspective camera
 * @param {number} zoomThreshold Camera distance below which flags become visible (increased to 2.5 for larger visibility distance)
 */
export function updateFlagsZoomVisibility(flags, camera, zoomThreshold = 2.5) {
	const list = Array.isArray(flags) ? flags : [flags];
	const camDist = camera.position.length(); // Distance to Moon at origin (0, 0, 0)
	const isVisible = camDist <= zoomThreshold;

	for (const flag of list) {
		if (!flag) continue;
		flag.visible = isVisible;
	}
}
