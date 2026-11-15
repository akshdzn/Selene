<script>
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import UTIF from 'three/examples/jsm/libs/utif.module.js';
	import { fetchCurrentLunarPositions, vector3ToLatLon, latLonToVector3, formatLatLon, calculateEarthRotation } from './ephemeris.js';
	import moonUrl from '../assets/moon.webp';
	import moonDisplacementUrl from '../assets/moon_displacement.tif';
	import earthUrl from '../assets/earth.jpg';
	import markerSvgUrl from '../assets/Marker.svg';
	import placesData from './Places.json' with { type: 'json' };
	import landingSitesData from './moon_landing_sites.json' with { type: 'json' };
	import {
		createPlaceMarkers,
		checkPlaceHover,
		updatePlaceMarkersAnimation,
		getHistoricLandingSites
	} from './places.js';

	let {
		lunarPositions = null,
		selectedCoords = null,
		onCoordinateSelect = null,
		onHoverCoords = null,
		isCalculating = false
	} = $props();

	let cursorRadius = $state(0.026);
	let cursorThickness = $state(0.006);
	let cursorLineLength = $state(0.07);
	let cursorLineThickness = $state(0.006);
	let cursorLineColor = $state('#ff5500');
	let cursorShadowSize = $state(0.15);
	let cursorShadowOpacity = $state(0.6);
	let flareLength = $state(1.0); // Flare Length multiplier (1.0 = base max size; renders at 0.75x at default zoom)

	let cursorCoords = $state(null);
	let subSolarCoords = $state(null);
	let subEarthCoords = $state(null);
	let hoveredPlace = $state(null);
	let hoverBoxPos = $state({ x: 0, y: 0, isNearTop: false });

	let container;
	let animId;

	let sunMeshRef;
	let innerCoronaRef;
	let outerCoronaRef;
	let horizontalStreakRef;
	let raySpritesRef = [];
	let sunBloomRef;
	let sunLightRef;
	let earthGroupRef;
	let earthMeshRef;
	let selectedCursorRef;
	let celestialLineRef;
	let celestialLineGeo;
	let targetEarthRotation = 0;
	let currentEarthRotation = 0;
	let lastScrubTime = typeof performance !== 'undefined' ? performance.now() * 0.001 : 0;
	let baselineDatasetHour = 12;

	$effect(() => {
		const targetLat = selectedCoords?.lat ?? lunarPositions?.dataset?.coordinates?.latitude;
		const targetLon = selectedCoords?.lon ?? lunarPositions?.dataset?.coordinates?.longitude;
		if (typeof targetLat === 'number' && typeof targetLon === 'number' && selectedCursorRef) {
			const normal = latLonToVector3(targetLat, targetLon, 1.0).normalize();
			selectedCursorRef.position.copy(normal).multiplyScalar(1.003);
			selectedCursorRef.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
			selectedCursorRef.visible = true;
		}
	});

	function updateCelestialPositions(positions) {
		if (!positions) return;
		if (positions.sunPos) {
			sunMeshRef?.position.copy(positions.sunPos);
			innerCoronaRef?.position.copy(positions.sunPos);
			outerCoronaRef?.position.copy(positions.sunPos);
			sunBloomRef?.position.copy(positions.sunPos);
			horizontalStreakRef?.position.copy(positions.sunPos);
			for (const ray of raySpritesRef) {
				ray.position.copy(positions.sunPos);
			}
			sunLightRef?.position.copy(positions.sunPos);
			const { lat, lon } = vector3ToLatLon(positions.sunPos);
			subSolarCoords = formatLatLon(lat, lon);
		}
		if (positions.earthPos) {
			earthGroupRef?.position.copy(positions.earthPos);
			const { lat, lon } = vector3ToLatLon(positions.earthPos);
			subEarthCoords = formatLatLon(lat, lon);
		}
		if (celestialLineGeo && celestialLineRef) {
			const posAttr = celestialLineGeo.getAttribute('position');
			if (posAttr) {
				if (positions.earthPos) {
					posAttr.setXYZ(0, positions.earthPos.x, positions.earthPos.y, positions.earthPos.z);
				}
				posAttr.setXYZ(1, 0, 0, 0);
				if (positions.sunPos) {
					posAttr.setXYZ(2, positions.sunPos.x, positions.sunPos.y, positions.sunPos.z);
				}
				posAttr.needsUpdate = true;
				celestialLineRef.computeLineDistances();
			}
		}
		targetEarthRotation = calculateEarthRotation(positions, baselineDatasetHour);
		lastScrubTime = typeof performance !== 'undefined' ? performance.now() * 0.001 : 0;
	}

	$effect(() => {
		if (lunarPositions) {
			updateCelestialPositions(lunarPositions);
		}
	});

	// High-resolution procedural textures for realistic solar appearance & halo rings
	function createInnerCoronaTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext('2d');

		const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
		gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
		gradient.addColorStop(0.18, 'rgba(255, 252, 240, 0.95)');
		gradient.addColorStop(0.38, 'rgba(255, 235, 185, 0.6)');
		gradient.addColorStop(0.60, 'rgba(255, 205, 130, 0.22)');
		gradient.addColorStop(0.82, 'rgba(255, 175, 75, 0.05)');
		gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 512, 512);

		return new THREE.CanvasTexture(canvas);
	}

	function createOuterCoronaTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext('2d');

		const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
		gradient.addColorStop(0, 'rgba(255, 245, 225, 0.7)');
		gradient.addColorStop(0.22, 'rgba(255, 225, 170, 0.38)');
		gradient.addColorStop(0.48, 'rgba(255, 185, 110, 0.15)');
		gradient.addColorStop(0.72, 'rgba(255, 145, 65, 0.04)');
		gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 512, 512);

		return new THREE.CanvasTexture(canvas);
	}

	// Expansive, smooth radial bloom texture mimicking HDR optical camera bloom (zero postprocessing overhead)
	function createSunBloomTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext('2d');

		// Multi-stop inverse-exponential bloom gradient
		const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
		gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
		gradient.addColorStop(0.08, 'rgba(255, 253, 245, 0.95)');
		gradient.addColorStop(0.18, 'rgba(255, 242, 215, 0.75)');
		gradient.addColorStop(0.32, 'rgba(255, 225, 175, 0.45)');
		gradient.addColorStop(0.50, 'rgba(255, 200, 135, 0.20)');
		gradient.addColorStop(0.72, 'rgba(255, 175, 95, 0.06)');
		gradient.addColorStop(0.90, 'rgba(255, 150, 60, 0.015)');
		gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 512, 512);

		return new THREE.CanvasTexture(canvas);
	}

	// Symmetrical diffraction rays matching ISS solar reference photo (colors matched to 0xfffaed)
	function createSolarBeamTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext('2d');
		const cx = 256;
		const cy = 256;

		ctx.clearRect(0, 0, 512, 512);

		// Core needle-sharp diffraction ray
		const rayGrad = ctx.createLinearGradient(-256, 0, 256, 0);
		rayGrad.addColorStop(0, 'rgba(255, 235, 180, 0)');
		rayGrad.addColorStop(0.30, 'rgba(255, 245, 220, 0.20)');
		rayGrad.addColorStop(0.50, 'rgba(255, 255, 255, 1.0)');
		rayGrad.addColorStop(0.70, 'rgba(255, 245, 220, 0.20)');
		rayGrad.addColorStop(1, 'rgba(255, 235, 180, 0)');

		ctx.save();
		ctx.translate(cx, cy);

		ctx.fillStyle = rayGrad;
		ctx.beginPath();
		ctx.moveTo(-256, 0);
		ctx.lineTo(0, -2.5);
		ctx.lineTo(256, 0);
		ctx.lineTo(0, 2.5);
		ctx.closePath();
		ctx.fill();

		// Soft wider scattering ray envelope
		const softGrad = ctx.createLinearGradient(-256, 0, 256, 0);
		softGrad.addColorStop(0, 'rgba(255, 205, 130, 0)');
		softGrad.addColorStop(0.35, 'rgba(255, 225, 175, 0.12)');
		softGrad.addColorStop(0.50, 'rgba(255, 250, 237, 0.55)');
		softGrad.addColorStop(0.65, 'rgba(255, 225, 175, 0.12)');
		softGrad.addColorStop(1, 'rgba(255, 205, 130, 0)');

		ctx.fillStyle = softGrad;
		ctx.beginPath();
		ctx.moveTo(-220, 0);
		ctx.lineTo(0, -7);
		ctx.lineTo(220, 0);
		ctx.lineTo(0, 7);
		ctx.closePath();
		ctx.fill();

		ctx.restore();

		// Central bright hotspot blending the root into the sun
		const centerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
		centerGlow.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
		centerGlow.addColorStop(0.45, 'rgba(255, 250, 237, 0.40)');
		centerGlow.addColorStop(1, 'rgba(255, 235, 185, 0)');
		ctx.fillStyle = centerGlow;
		ctx.beginPath();
		ctx.arc(cx, cy, 40, 0, Math.PI * 2);
		ctx.fill();

		return new THREE.CanvasTexture(canvas);
	}

	// Wide horizontal light scattering flare streak (anamorphic glare as depicted in reference photo)
	function createLightScatteringStreakTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 128;
		const ctx = canvas.getContext('2d');
		const cx = 256;
		const cy = 64;

		ctx.clearRect(0, 0, 512, 128);

		// 1. Core intense razor-sharp horizontal streak line
		const coreGrad = ctx.createLinearGradient(0, cy, 512, cy);
		coreGrad.addColorStop(0, 'rgba(255, 235, 180, 0)');
		coreGrad.addColorStop(0.25, 'rgba(255, 245, 225, 0.35)');
		coreGrad.addColorStop(0.50, 'rgba(255, 255, 255, 1.0)');
		coreGrad.addColorStop(0.75, 'rgba(255, 245, 225, 0.35)');
		coreGrad.addColorStop(1, 'rgba(255, 235, 180, 0)');

		ctx.fillStyle = coreGrad;
		ctx.beginPath();
		ctx.moveTo(0, cy);
		ctx.lineTo(cx, cy - 2.5);
		ctx.lineTo(512, cy);
		ctx.lineTo(cx, cy + 2.5);
		ctx.closePath();
		ctx.fill();

		// 2. Diffuse scattering envelope with soft vertical gaussian falloff
		const scatterGrad = ctx.createLinearGradient(0, cy, 512, cy);
		scatterGrad.addColorStop(0, 'rgba(255, 205, 130, 0)');
		scatterGrad.addColorStop(0.30, 'rgba(255, 230, 180, 0.20)');
		scatterGrad.addColorStop(0.50, 'rgba(255, 250, 237, 0.65)');
		scatterGrad.addColorStop(0.70, 'rgba(255, 230, 180, 0.20)');
		scatterGrad.addColorStop(1, 'rgba(255, 205, 130, 0)');

		ctx.fillStyle = scatterGrad;
		ctx.beginPath();
		ctx.moveTo(30, cy);
		ctx.lineTo(cx, cy - 10);
		ctx.lineTo(482, cy);
		ctx.lineTo(cx, cy + 10);
		ctx.closePath();
		ctx.fill();

		return new THREE.CanvasTexture(canvas);
	}

	// Soft circular star sprite for natural rendering without square particle artifacts
	// ponytail: 16x16 canvas texture keeps stars circular and soft without external assets
	function createStarTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 16;
		canvas.height = 16;
		const ctx = canvas.getContext('2d');

		const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
		gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
		gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
		gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 16, 16);

		return new THREE.CanvasTexture(canvas);
	}

	// Continuous starfield with GPU-driven smooth light trails
	// ponytail: connected LineSegments geometry eliminates 60Hz screen ghosting with 0 postprocessing overhead
	function createStarfield(count = 2500) {
		const STEPS = 6;
		const numSegments = STEPS - 1;
		const verticesPerStar = numSegments * 2;
		const totalTrailVerts = count * verticesPerStar;

		const headPositions = new Float32Array(count * 3);
		const headColors = new Float32Array(count * 3);

		const trailPositions = new Float32Array(totalTrailVerts * 3);
		const trailSteps = new Float32Array(totalTrailVerts);
		const trailColors = new Float32Array(totalTrailVerts * 3);

		let trailPtr = 0;

		for (let i = 0; i < count; i++) {
			const radius = 250 + Math.random() * 150;
			const u = Math.random();
			const v = Math.random();
			const theta = u * 2.0 * Math.PI;
			const phi = Math.acos(2.0 * v - 1.0);

			const x = radius * Math.sin(phi) * Math.cos(theta);
			const y = radius * Math.sin(phi) * Math.sin(theta);
			const z = radius * Math.cos(phi);

			headPositions[i * 3] = x;
			headPositions[i * 3 + 1] = y;
			headPositions[i * 3 + 2] = z;

			const brightness = 0.5 + Math.random() * 0.5;
			const tint = Math.random();
			let r, g, b;
			if (tint < 0.2) {
				// Warm star (slight amber)
				r = brightness;
				g = brightness * 0.88;
				b = brightness * 0.75;
			} else if (tint < 0.4) {
				// Cool star (slight blue)
				r = brightness * 0.85;
				g = brightness * 0.95;
				b = brightness;
			} else {
				// Crisp white
				r = brightness;
				g = brightness;
				b = brightness;
			}

			headColors[i * 3] = r;
			headColors[i * 3 + 1] = g;
			headColors[i * 3 + 2] = b;

			// Build continuous connected segments from step s to step s+1
			for (let s = 0; s < numSegments; s++) {
				trailPositions[trailPtr * 3] = x;
				trailPositions[trailPtr * 3 + 1] = y;
				trailPositions[trailPtr * 3 + 2] = z;
				trailSteps[trailPtr] = s;
				trailColors[trailPtr * 3] = r;
				trailColors[trailPtr * 3 + 1] = g;
				trailColors[trailPtr * 3 + 2] = b;
				trailPtr++;

				trailPositions[trailPtr * 3] = x;
				trailPositions[trailPtr * 3 + 1] = y;
				trailPositions[trailPtr * 3 + 2] = z;
				trailSteps[trailPtr] = s + 1;
				trailColors[trailPtr * 3] = r;
				trailColors[trailPtr * 3 + 1] = g;
				trailColors[trailPtr * 3 + 2] = b;
				trailPtr++;
			}
		}

		// 1. Star heads (soft glowing points at current camera pose)
		const headGeometry = new THREE.BufferGeometry();
		headGeometry.setAttribute('position', new THREE.BufferAttribute(headPositions, 3));
		headGeometry.setAttribute('color', new THREE.BufferAttribute(headColors, 3));

		const starTexture = createStarTexture();
		const headMaterial = new THREE.PointsMaterial({
			size: 2.8,
			vertexColors: true,
			sizeAttenuation: false,
			map: starTexture,
			transparent: true,
			opacity: 0.9,
			depthWrite: false
		});
		const points = new THREE.Points(headGeometry, headMaterial);

		// 2. Star trails (continuous line segments connecting history matrices)
		const trailGeometry = new THREE.BufferGeometry();
		trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
		trailGeometry.setAttribute('aStep', new THREE.BufferAttribute(trailSteps, 1));
		trailGeometry.setAttribute('aColor', new THREE.BufferAttribute(trailColors, 3));

		const historyQuats = Array.from({ length: STEPS }, () => new THREE.Quaternion());
		const historyPositions = Array.from({ length: STEPS }, () => new THREE.Vector3());
		const trailMatrices = Array.from({ length: STEPS }, () => new THREE.Matrix4());

		const trailMaterial = new THREE.ShaderMaterial({
			uniforms: {
				uTrailMatrices: { value: trailMatrices },
				uTrailOpacity: { value: 1.0 }
			},
			vertexShader: /* glsl */`
				uniform mat4 uTrailMatrices[6];
				attribute float aStep;
				attribute vec3 aColor;

				varying vec3 vColor;
				varying float vAlpha;

				void main() {
					int idx = int(aStep + 0.5);
					vec4 viewPos = uTrailMatrices[idx] * vec4(position, 1.0);
					gl_Position = projectionMatrix * viewPos;

					vColor = aColor;
					vAlpha = pow(max(0.0, 1.0 - (aStep / 5.0)), 1.3);
				}
			`,
			fragmentShader: /* glsl */`
				uniform float uTrailOpacity;
				varying vec3 vColor;
				varying float vAlpha;

				void main() {
					gl_FragColor = vec4(vColor, vAlpha * 0.85 * uTrailOpacity);
				}
			`,
			transparent: true,
			blending: THREE.AdditiveBlending,
			depthTest: true,
			depthWrite: false
		});

		const trails = new THREE.LineSegments(trailGeometry, trailMaterial);

		const group = new THREE.Group();
		group.add(trails);
		group.add(points);

		let initialized = false;
		const scaleOne = new THREE.Vector3(1, 1, 1);
		const MAX_TRAIL_ANGLE = 0.18; // ponytail: hard angular limit prevents overboard streaks during rapid dragging

		function update(camera) {
			if (!initialized) {
				for (let k = 0; k < STEPS; k++) {
					historyQuats[k].copy(camera.quaternion);
					historyPositions[k].copy(camera.position);
					trailMatrices[k].compose(historyPositions[k], historyQuats[k], scaleOne).invert();
				}
				initialized = true;
				return;
			}

			historyQuats[0].copy(camera.quaternion);
			historyPositions[0].copy(camera.position);

			// Lag tracking tuned to half the previous length (0.50 vs 0.30)
			for (let k = 1; k < STEPS; k++) {
				historyQuats[k].slerp(historyQuats[k - 1], 0.50);
				historyPositions[k].lerp(historyPositions[k - 1], 0.50);
			}

			// Clamp trail to max length and dim opacity inversely with length
			const currentTrailAngle = historyQuats[0].angleTo(historyQuats[STEPS - 1]);
			let effectiveAngle = currentTrailAngle;

			if (currentTrailAngle > MAX_TRAIL_ANGLE) {
				const clampRatio = MAX_TRAIL_ANGLE / currentTrailAngle;
				for (let k = 1; k < STEPS; k++) {
					historyQuats[k].slerpQuaternions(historyQuats[0], historyQuats[k], clampRatio);
					historyPositions[k].lerpVectors(historyPositions[0], historyPositions[k], clampRatio);
				}
				effectiveAngle = MAX_TRAIL_ANGLE;
			}

			// Opacity inversely proportional to trail length
			const lengthRatio = effectiveAngle / MAX_TRAIL_ANGLE;
			trailMaterial.uniforms.uTrailOpacity.value = 1.0 / (1.0 + 2.2 * lengthRatio);

			for (let k = 0; k < STEPS; k++) {
				trailMatrices[k].compose(historyPositions[k], historyQuats[k], scaleOne).invert();
			}
		}

		function dispose() {
			headGeometry.dispose();
			headMaterial.dispose();
			starTexture.dispose();
			trailGeometry.dispose();
			trailMaterial.dispose();
		}

		return { group, update, dispose };
	}

	onMount(() => {
		const width = container.clientWidth;
		const height = container.clientHeight;

		// 1. Scene & Camera (focused on the Moon at origin)
		//Maybe You Can See Lucy Somewhere.(If Only)
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
		camera.position.set(0, 0, 2.9);

		// 2. Renderer (No tone mapping dimming, 1:1 true texture colors)
		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(width, height);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.toneMapping = THREE.NoToneMapping;
		container.appendChild(renderer.domElement);

		// 3. Orbit Controls: Moon stays perfectly centered
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.05;
		controls.enablePan = false; // Keep Moon locked in the center
		controls.minDistance = 1.3;
		controls.maxDistance = 7.0;
		controls.rotateSpeed = 0.7;

		const textureLoader = new THREE.TextureLoader();

		// 4. Background stars with continuous GPU light trails
		const starSystem = createStarfield(2500);
		scene.add(starSystem.group);

		// 5. Visual Sun in the background and directional lighting
		const defaultSunPos = new THREE.Vector3(28, 12, -45);
		const defaultEarthPos = new THREE.Vector3(-14, 6, -24);
		const sunPos = new THREE.Vector3().copy(lunarPositions?.sunPos || defaultSunPos);
		const earthPos = new THREE.Vector3().copy(lunarPositions?.earthPos || defaultEarthPos);

		// 5a. Solar Photosphere core with limb darkening
		const sunMesh = new THREE.Mesh(
			new THREE.SphereGeometry(1.8, 48, 48),
			new THREE.ShaderMaterial({
				vertexShader: /* glsl */`
					varying vec3 vNormal;
					void main() {
						vNormal = normalize(normalMatrix * normal);
						gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
					}
				`,
				fragmentShader: /* glsl */`
					varying vec3 vNormal;
					void main() {
						float cosTheta = clamp(vNormal.z, 0.0, 1.0);
						vec3 coreColor = vec3(1.0, 1.0, 1.0);
						vec3 limbColor = vec3(1.0, 0.94, 0.82);
						vec3 color = mix(limbColor, coreColor, pow(cosTheta, 0.4));
						gl_FragColor = vec4(color, 1.0);
					}
				`
			})
		);
		sunMesh.position.copy(sunPos);
		scene.add(sunMesh);
		sunMeshRef = sunMesh;

		// 5b. Inner high-intensity corona bloom
		const innerCoronaTex = createInnerCoronaTexture();
		const innerCorona = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: innerCoronaTex,
				blending: THREE.AdditiveBlending,
				color: 0xffffff,
				transparent: true,
				opacity: 0.95,
				depthWrite: false
			})
		);
		innerCorona.position.copy(sunPos);
		innerCorona.scale.set(7.5, 7.5, 1);
		scene.add(innerCorona);
		innerCoronaRef = innerCorona;

		// 5c. Outer extended corona fading smoothly into deep space
		const outerCoronaTex = createOuterCoronaTexture();
		const outerCorona = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: outerCoronaTex,
				blending: THREE.AdditiveBlending,
				color: 0xffeedd,
				transparent: true,
				opacity: 0.45,
				depthWrite: false
			})
		);
		outerCorona.position.copy(sunPos);
		outerCorona.scale.set(16, 16, 1);
		scene.add(outerCorona);
		outerCoronaRef = outerCorona;

		// 5d. Horizontal anamorphic light scattering flare streak (recreating ISS photo)
		const BASE_STREAK_LENGTH = 46;
		const BASE_STREAK_THICKNESS = 2.6;
		const BASE_MAJOR_RAY_SCALE = 30;
		const BASE_MINOR_RAY_SCALE = 23;
		const BASE_STREAK_OPACITY = 0.70;
		const initialFlareScale = flareLength * 0.75;

		const streakTex = createLightScatteringStreakTexture();
		const horizontalStreak = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: streakTex,
				blending: THREE.AdditiveBlending,
				color: 0xfffaed, // exact project sun color
				transparent: true,
				opacity: BASE_STREAK_OPACITY,
				depthTest: false,
				depthWrite: false
			})
		);
		horizontalStreak.renderOrder = 1;
		horizontalStreak.position.copy(sunPos);
		horizontalStreak.scale.set(BASE_STREAK_LENGTH * initialFlareScale, BASE_STREAK_THICKNESS * initialFlareScale, 1);
		scene.add(horizontalStreak);
		horizontalStreakRef = horizontalStreak;

		// 5e. Symmetrically rotated starburst diffraction light beams (16 rays = 8 crossing axes)
		const beamTex = createSolarBeamTexture();
		const raySprites = [];
		const NUM_AXES = 8;
		for (let i = 0; i < NUM_AXES; i++) {
			const angle = i * (Math.PI / NUM_AXES); // symmetric rotation: 0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5 deg
			const isMajor = (i % 2 === 0);
			const baseRayScale = isMajor ? BASE_MAJOR_RAY_SCALE : BASE_MINOR_RAY_SCALE;
			const rayScale = baseRayScale * initialFlareScale;
			const rayOpacity = isMajor ? 0.38 : 0.24;

			const raySprite = new THREE.Sprite(
				new THREE.SpriteMaterial({
					map: beamTex,
					blending: THREE.AdditiveBlending,
					color: 0xfffaed, // exact project sun color
					transparent: true,
					opacity: rayOpacity,
					rotation: angle,
					depthTest: false,
					depthWrite: false
				})
			);
			raySprite.userData.baseOpacity = rayOpacity;
			raySprite.renderOrder = 1;
			raySprite.position.copy(sunPos);
			raySprite.scale.set(rayScale, rayScale, 1);
			scene.add(raySprite);
			raySprites.push(raySprite);
		}
		raySpritesRef = raySprites;

		// 5f. Procedural HDR Solar Bloom sprite (zero postprocessing overhead)
		const BASE_BLOOM_SCALE = 32;
		const BASE_BLOOM_OPACITY = 0.85;
		const bloomTex = createSunBloomTexture();
		const sunBloom = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: bloomTex,
				blending: THREE.AdditiveBlending,
				color: 0xfffaed,
				transparent: true,
				opacity: BASE_BLOOM_OPACITY,
				depthTest: false,
				depthWrite: false
			})
		);
		sunBloom.renderOrder = 1;
		sunBloom.position.copy(sunPos);
		sunBloom.scale.set(BASE_BLOOM_SCALE * initialFlareScale, BASE_BLOOM_SCALE * initialFlareScale, 1);
		scene.add(sunBloom);
		sunBloomRef = sunBloom;
        //Then Mahadev Said Let There be light 
		// Directional sunlight from the Sun's position to illuminate the Moon & reveal surface displacement
		const sunLight = new THREE.DirectionalLight(0xfffaed, 2.8);
		sunLight.position.copy(sunPos);
		sunLight.target.position.set(0, 0, 0);
		scene.add(sunLight.target);
		scene.add(sunLight);
		sunLightRef = sunLight;

		// Soft ambient light (earthshine & cosmic background) keeping unlit terrain navigably visible
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.18);
		scene.add(ambientLight);

		// 6. Background Earth illuminated by directional sunlight
		const earthTexture = textureLoader.load(earthUrl);
		earthTexture.colorSpace = THREE.SRGBColorSpace;

		const earthSunDir = new THREE.Vector3().subVectors(sunPos, earthPos).normalize();
		const earthMaterial = new THREE.ShaderMaterial({
			uniforms: {
				uMap: { value: earthTexture },
				uSunDirection: { value: earthSunDir }
			},
			vertexShader: /* glsl */`
				varying vec2 vUv;
				varying vec3 vWorldNormal;
				varying vec3 vViewDirection;

				void main() {
					vUv = uv;
					vec4 worldPos = modelMatrix * vec4(position, 1.0);
					vWorldNormal = normalize(mat3(modelMatrix) * normal);
					vViewDirection = normalize(cameraPosition - worldPos.xyz);
					gl_Position = projectionMatrix * viewMatrix * worldPos;
				}
			`,
			fragmentShader: /* glsl */`
				uniform sampler2D uMap;
				uniform vec3 uSunDirection;
				varying vec2 vUv;
				varying vec3 vWorldNormal;
				varying vec3 vViewDirection;

				void main() {
					vec4 texColor = texture2D(uMap, vUv);
					vec3 N = normalize(vWorldNormal);
					float NdotL = dot(N, uSunDirection);

					// Smooth day/night terminator wrap across Earth's atmosphere
					float daylight = smoothstep(-0.15, 0.25, NdotL);
					// Subtle ambient starlight (0.12) keeping night side oceans and continents recognizable
					float lighting = mix(0.12, 1.0, daylight);

					// Sunlight warm tint on day side
					vec3 sunColor = vec3(1.0, 0.98, 0.94);
					vec3 color = texColor.rgb * mix(vec3(1.0), sunColor, daylight) * lighting;

					// Atmospheric limb scattering: thin blue Rayleigh horizon haze where sun illuminates the atmosphere
					vec3 V = normalize(vViewDirection);
					float rim = 1.0 - max(0.0, dot(V, N));
					float atmosphere = pow(rim, 3.5) * max(0.0, NdotL + 0.1) * 0.65;
					vec3 atmosphereColor = vec3(0.25, 0.55, 1.0);
					color += atmosphereColor * atmosphere;

					gl_FragColor = vec4(color, 1.0);
				}
			`
		});

		const earthGroup = new THREE.Group();
		earthGroup.name = 'background-earth-group';
		earthGroup.position.copy(earthPos);
		// Earth's authentic axial obliquity tilt (23.44°)
		earthGroup.rotation.z = 23.44 * (Math.PI / 180);

		const earth = new THREE.Mesh(
			new THREE.SphereGeometry(0.85, 48, 48),
			earthMaterial
		);
		earthGroup.add(earth);
		scene.add(earthGroup);
		earthMeshRef = earth;
		earthGroupRef = earthGroup;

		// 6b. Visual celestial alignment guide: dashed line connecting Earth, Moon (origin), and Sun
		const celestialLineGeometry = new THREE.BufferGeometry();
		celestialLineGeometry.setFromPoints([earthPos, new THREE.Vector3(0, 0, 0), sunPos]);
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
		celestialLine.raycast = () => {}; // Purely visual, ignores raycasting
		scene.add(celestialLine);
		celestialLineRef = celestialLine;
		celestialLineGeo = celestialLineGeometry;

		if (lunarPositions) {
			if (typeof lunarPositions.hour === 'number') {
				baselineDatasetHour = lunarPositions.hour;
			}
			targetEarthRotation = calculateEarthRotation(lunarPositions, baselineDatasetHour);
			currentEarthRotation = targetEarthRotation;
			earth.rotation.y = targetEarthRotation;
		}

		if (!lunarPositions) {
			fetchCurrentLunarPositions(0, 0).then((res) => {
				updateCelestialPositions(res);
			});
		}

		// 7. Hero Object: The Moon with displacement mapping and lighting
		//I Couldnt Wait For You to Come And Clean The Cupboards
		const moonTexture = textureLoader.load(moonUrl);
		moonTexture.colorSpace = THREE.SRGBColorSpace;

		const moonGeometry = new THREE.SphereGeometry(1.0, 256, 256);
		// Bake Selenographic alignment into geometry: (0° lat, 0° lon) is along +Z, North is +Y, East is +X
		moonGeometry.rotateY(-Math.PI / 2);

		const moonMaterial = new THREE.MeshStandardMaterial({
			map: moonTexture,
			displacementScale: 0.001,
			displacementBias: 0.0,
			bumpScale: 0.5,
			roughness: 0.85,
			metalness: 0.0
		});

		// Load 32-bit floating point elevation TIFF (NASA LOLA ldem_4, values in km)
		let moonDisplacementMap = null;
		const fileLoader = new THREE.FileLoader();
		fileLoader.setResponseType('arraybuffer');

		// Anti-aliased elevation filter with trilinear float mipmaps
		// ponytail: separable binomial blur removes single-pixel LOLA sensor spikes; CPU mipmaps enable hardware trilinear filtering on float textures without WebGL2 INVALID_OPERATION
		function buildAntialiasedElevationMips(src, w, h) {
			const tmp = new Float32Array(w * h);
			const smoothed = new Float32Array(w * h);

			// Horizontal pass (spherical longitude 360° wrap)
			for (let y = 0; y < h; y++) {
				const row = y * w;
				for (let x = 0; x < w; x++) {
					const left = row + ((x - 1 + w) % w);
					const center = row + x;
					const right = row + ((x + 1) % w);
					tmp[center] = 0.25 * src[left] + 0.5 * src[center] + 0.25 * src[right];
				}
			}

			// Vertical pass (clamped at poles)
			for (let y = 0; y < h; y++) {
				const topRow = Math.max(0, y - 1) * w;
				const midRow = y * w;
				const botRow = Math.min(h - 1, y + 1) * w;
				for (let x = 0; x < w; x++) {
					smoothed[midRow + x] = 0.25 * tmp[topRow + x] + 0.5 * tmp[midRow + x] + 0.25 * tmp[botRow + x];
				}
			}

			// Downsample complete mipmap pyramid for trilinear anti-aliasing
			const mips = [{ data: smoothed, width: w, height: h }];
			let curr = smoothed, curW = w, curH = h;
			while (curW > 1 || curH > 1) {
				const nextW = Math.max(1, curW >> 1);
				const nextH = Math.max(1, curH >> 1);
				const next = new Float32Array(nextW * nextH);
				for (let y = 0; y < nextH; y++) {
					const y0 = Math.min(y * 2, curH - 1) * curW;
					const y1 = Math.min(y * 2 + 1, curH - 1) * curW;
					for (let x = 0; x < nextW; x++) {
						const x0 = x * 2;
						const x1 = Math.min(x0 + 1, curW - 1);
						next[y * nextW + x] = 0.25 * (
							curr[y0 + x0] + curr[y0 + x1] +
							curr[y1 + x0] + curr[y1 + x1]
						);
					}
				}
				mips.push({ data: next, width: nextW, height: nextH });
				curr = next;
				curW = nextW;
				curH = nextH;
			}
			return mips;
		}

		fileLoader.load(moonDisplacementUrl, (buffer) => {
			const ifds = UTIF.decode(buffer);
			UTIF.decodeImage(buffer, ifds[0]);
			const ifd = ifds[0];
			const f32 = new Float32Array(ifd.data.buffer.slice(ifd.data.byteOffset, ifd.data.byteOffset + ifd.data.byteLength));
			const mips = buildAntialiasedElevationMips(f32, ifd.width, ifd.height);

			moonDisplacementMap = new THREE.DataTexture(
				mips[0].data,
				ifd.width,
				ifd.height,
				THREE.RedFormat,
				THREE.FloatType
			);
			moonDisplacementMap.mipmaps = mips;
			moonDisplacementMap.wrapS = THREE.RepeatWrapping;
			moonDisplacementMap.wrapT = THREE.ClampToEdgeWrapping;
			moonDisplacementMap.minFilter = THREE.LinearMipmapLinearFilter;
			moonDisplacementMap.magFilter = THREE.LinearFilter;
			moonDisplacementMap.generateMipmaps = false;
			moonDisplacementMap.flipY = true;
			moonDisplacementMap.needsUpdate = true;

			moonMaterial.displacementMap = moonDisplacementMap;
			moonMaterial.bumpMap = moonDisplacementMap;
			moonMaterial.needsUpdate = true;
		});

		const moon = new THREE.Mesh(moonGeometry, moonMaterial);
		// Selenographic orientation baked into moonGeometry: (0°N, 0°E) faces +Z directly
		scene.add(moon);

		// 8. 3D surface cursor (white circular outline hovering over moon surface)
		const cursorGeo = new THREE.RingGeometry(cursorRadius - cursorThickness / 2, cursorRadius + cursorThickness / 2, 64);
		const cursorMat = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			side: THREE.DoubleSide,
			transparent: true,
			depthTest: false,
			depthWrite: false
		});
		const cursor = new THREE.Mesh(cursorGeo, cursorMat);
		cursor.renderOrder = 1;

		// Shadow plane under the cursor circle
		const shadowTexture = textureLoader.load('/cursor-shadow.png');
		shadowTexture.colorSpace = THREE.SRGBColorSpace;
		const shadowGeo = new THREE.PlaneGeometry(1, 1);
		const shadowMat = new THREE.MeshBasicMaterial({
			map: shadowTexture,
			transparent: true,
			opacity: cursorShadowOpacity,
			depthTest: false,
			depthWrite: false
		});
		const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
		shadowMesh.renderOrder = 0;
		shadowMesh.position.z = -0.001; // under the cursor circle and line
		shadowMesh.scale.set(cursorShadowSize, cursorShadowSize, 1);
		cursor.add(shadowMesh);

		// Normal indicator line pointing outward from cursor center
		const lineGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
		lineGeo.rotateX(Math.PI / 2);
		lineGeo.translate(0, 0, 0.5);
		const lineMat = new THREE.MeshBasicMaterial({
			color: cursorLineColor,
			transparent: true,
			depthTest: false,
			depthWrite: false
		});
		const line = new THREE.Mesh(lineGeo, lineMat);
		line.renderOrder = 2;
		const lineR = cursorLineThickness / 2;
		line.scale.set(lineR, lineR, cursorLineLength);
		cursor.add(line);

		cursor.visible = false;
		scene.add(cursor);

		// 9. Red 3D selected coordinate cursor pinned to chosen site on Moon
		const selCursorGeo = new THREE.RingGeometry(cursorRadius - cursorThickness / 2, cursorRadius + cursorThickness / 2, 64);
		const selCursorMat = new THREE.MeshBasicMaterial({
			color: 0xff2600,
			side: THREE.DoubleSide,
			transparent: true,
			depthTest: true,
			depthWrite: false
		});
		const selectedCursor = new THREE.Mesh(selCursorGeo, selCursorMat);
		selectedCursor.renderOrder = 3;

		const selLineMat = new THREE.MeshBasicMaterial({
			color: 0xff2600,
			transparent: true,
			depthTest: true,
			depthWrite: false
		});
		const selLine = new THREE.Mesh(lineGeo, selLineMat);
		selLine.renderOrder = 4;
		selLine.scale.set(lineR, lineR, cursorLineLength);
		selectedCursor.add(selLine);

		selectedCursor.visible = false;
		scene.add(selectedCursor);
		selectedCursorRef = selectedCursor;

		const UP_Z = new THREE.Vector3(0, 0, 1);
		const initLat = selectedCoords?.lat ?? lunarPositions?.dataset?.coordinates?.latitude ?? 26.1322;
		const initLon = selectedCoords?.lon ?? lunarPositions?.dataset?.coordinates?.longitude ?? 3.6339;
		if (typeof initLat === 'number' && typeof initLon === 'number') {
			const normal = latLonToVector3(initLat, initLon, 1.0).normalize();
			selectedCursor.position.copy(normal).multiplyScalar(1.003);
			selectedCursor.quaternion.setFromUnitVectors(UP_Z, normal);
			selectedCursor.visible = true;
		}

		// 10. Markers for Places.json using Marker.svg
		const markerTexture = textureLoader.load(markerSvgUrl);
		markerTexture.colorSpace = THREE.SRGBColorSpace;
		const {
			containerGroup: placesGroup,
			markers: placeMarkers,
			hitMeshes: placeHitMeshes,
			dispose: disposePlaces
		} = createPlaceMarkers(placesData.locations, 1.0, markerTexture);
		scene.add(placesGroup);

		// 11. Markers for Moon Landing Sites (Apollo and Chandrayaan only)
		const historicLandingSites = getHistoricLandingSites(landingSitesData);
		const {
			containerGroup: landingSitesGroup,
			markers: landingMarkers,
			hitMeshes: landingHitMeshes,
			dispose: disposeLandingSites
		} = createPlaceMarkers(historicLandingSites, 1.0, markerTexture);
		scene.add(landingSitesGroup);

		const allPlaceMarkers = [...placeMarkers, ...landingMarkers];
		const allPlaceHitMeshes = [...placeHitMeshes, ...landingHitMeshes];

		const raycaster = new THREE.Raycaster();
		const mouse = new THREE.Vector2(-1000, -1000);
		const cursorNormal = new THREE.Vector3();
		let hasPointer = false;

		function onPointerMove(e) {
			const rect = container.getBoundingClientRect();
			mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
			mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
			hasPointer = true;
		}

		function onPointerLeave() {
			hasPointer = false;
			cursor.visible = false;
			if (cursorCoords !== null) {
				cursorCoords = null;
				onHoverCoords?.(null);
			}
			hoveredPlace = null;
			if (container) container.style.cursor = '';
		}

		let pointerDownPos = { x: 0, y: 0 };
		function onPointerDown(e) {
			pointerDownPos = { x: e.clientX, y: e.clientY };
		}

		function onClick(e) {
			if (isCalculating || !container) return;
			// Only select if not dragging camera
			const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
			if (dist > 5) return;

			const rect = container.getBoundingClientRect();
			mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
			mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
			raycaster.setFromCamera(mouse, camera);

			const placeHit = checkPlaceHover(raycaster, allPlaceHitMeshes, camera);
			if (placeHit) {
				e.preventDefault();
				e.stopPropagation();
				onCoordinateSelect?.({ lat: placeHit.latitude, lon: placeHit.longitude });
				return;
			}

			const intersects = raycaster.intersectObject(moon);
			if (intersects.length > 0) {
				e.preventDefault();
				e.stopPropagation();
				const hitPoint = intersects[0].point;
				const norm = hitPoint.clone().normalize();
				const { lat, lon } = vector3ToLatLon(norm);
				onCoordinateSelect?.({ lat, lon });
			}
		}

		function onDoubleClick(e) {
			if (isCalculating || !container) return;
			const rect = container.getBoundingClientRect();
			mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
			mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
			raycaster.setFromCamera(mouse, camera);

			// Check if a place marker was clicked
			const placeHit = checkPlaceHover(raycaster, allPlaceHitMeshes, camera);
			if (placeHit) {
				e.preventDefault();
				e.stopPropagation();
				onCoordinateSelect?.({ lat: placeHit.latitude, lon: placeHit.longitude });
				return;
			}

			const intersects = raycaster.intersectObject(moon);
			if (intersects.length > 0) {
				e.preventDefault();
				e.stopPropagation();
				const hitPoint = intersects[0].point;
				const norm = hitPoint.clone().normalize();
				const { lat, lon } = vector3ToLatLon(norm);
				onCoordinateSelect?.({ lat, lon });
			}
		}

		container.addEventListener('pointermove', onPointerMove);
		container.addEventListener('pointerleave', onPointerLeave);
		container.addEventListener('pointerdown', onPointerDown);
		container.addEventListener('click', onClick);
		container.addEventListener('dblclick', onDoubleClick);

		// Window resize
		function onResize() {
			if (!container) return;
			const w = container.clientWidth;
			const h = container.clientHeight;
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
			renderer.setSize(w, h);
		}
		window.addEventListener('resize', onResize);

		// Render loop
		const _toSun = new THREE.Vector3();
		const _sunDir = new THREE.Vector3();

		function animate(timestamp) {
			animId = requestAnimationFrame(animate);
			controls.update();
			starSystem.update(camera);

			// Calculate sun obstruction by the Moon (sphere of radius 1.0 at origin)
			_toSun.subVectors(horizontalStreak.position, camera.position);
			const sunDist = _toSun.length();
			_sunDir.copy(_toSun).divideScalar(sunDist);

			// Projection of vector from camera to moon center (which is -camera.position) onto sun direction
			const t = -camera.position.dot(_sunDir);
			let flareVisibility = 1.0;

			if (t > 0 && t < sunDist) {
				const camDistSq = camera.position.lengthSq();
				const distSq = Math.max(0, camDistSq - t * t);
				const dPerp = Math.sqrt(distSq);

				// ponytail: occlusion radius (1.02) clears the Moon's displacement map peaks and prevents the flare center from rendering inside the lunar limb
				const occlusionRadius = 1.02;
				const sunRadius = 1.8;
				const sunConeRadius = sunRadius * (t / sunDist);

				const innerThreshold = occlusionRadius;
				const outerThreshold = occlusionRadius + sunConeRadius;

				flareVisibility = THREE.MathUtils.smoothstep(dPerp, innerThreshold, outerThreshold);
			}

			// Dynamic flare scaling proportional to page zoom and obstruction visibility
			// Camera distance from Moon origin (0, 0, 0)
			const camDist = camera.position.length();
			// Linear mapping: at default distance (2.9) -> 0.75; at maxDistance (7.0) -> 1.0; at minDistance (1.3) -> ~0.65
			const zoomProgress = (camDist - 2.9) / (controls.maxDistance - 2.9);
			const zoomFactor = THREE.MathUtils.clamp(0.75 + zoomProgress * (1.0 - 0.75), 0.65, 1.0);
			const currentFlareScale = flareLength * zoomFactor * flareVisibility;
			const isVisible = flareVisibility > 0.0001;

			horizontalStreak.visible = isVisible;
			horizontalStreak.material.opacity = BASE_STREAK_OPACITY * flareVisibility;
			horizontalStreak.scale.set(BASE_STREAK_LENGTH * currentFlareScale, BASE_STREAK_THICKNESS * currentFlareScale, 1);
			for (let i = 0; i < raySprites.length; i++) {
				const ray = raySprites[i];
				ray.visible = isVisible;
				ray.material.opacity = (ray.userData.baseOpacity ?? 0.3) * flareVisibility;
				const baseRayScale = (i % 2 === 0) ? BASE_MAJOR_RAY_SCALE : BASE_MINOR_RAY_SCALE;
				ray.scale.set(baseRayScale * currentFlareScale, baseRayScale * currentFlareScale, 1);
			}

			sunBloom.visible = isVisible;
			sunBloom.material.opacity = BASE_BLOOM_OPACITY * flareVisibility;
			const currentBloomScale = BASE_BLOOM_SCALE * currentFlareScale;
			sunBloom.scale.set(currentBloomScale, currentBloomScale, 1);

			let currentHovered = null;
			if (hasPointer) {
				raycaster.setFromCamera(mouse, camera);
				currentHovered = checkPlaceHover(raycaster, allPlaceHitMeshes, camera);

				if (currentHovered) {
					hoveredPlace = currentHovered;
					const proj = currentHovered.surfacePos.clone().project(camera);
					const screenX = (proj.x * 0.5 + 0.5) * container.clientWidth;
					const screenY = (-proj.y * 0.5 + 0.5) * container.clientHeight;

					const marginX = 160;
					const clampedX = Math.max(marginX, Math.min(container.clientWidth - marginX, screenX));
					const isNearTop = screenY < 90;
					const clampedY = isNearTop ? screenY + 28 : screenY - 24;

					hoverBoxPos = { x: clampedX, y: clampedY, isNearTop };
					container.style.cursor = 'pointer';
				} else {
					hoveredPlace = null;
					container.style.cursor = '';
				}

				const intersects = raycaster.intersectObject(moon);
				if (intersects.length > 0) {
					const hitPoint = intersects[0].point;
					cursorNormal.copy(hitPoint).normalize();
					cursor.position.copy(hitPoint).addScaledVector(cursorNormal, 0.003);
					cursor.quaternion.setFromUnitVectors(UP_Z, cursorNormal);
					const { lat, lon } = vector3ToLatLon(cursorNormal);
					cursorCoords = {
						lat,
						lon,
						...formatLatLon(lat, lon)
					};
					onHoverCoords?.(cursorCoords);
					const lineR = cursorLineThickness / 2;
					line.scale.set(lineR, lineR, cursorLineLength);
					lineMat.color.set(cursorLineColor);
					shadowMat.opacity = cursorShadowOpacity;
					shadowMesh.scale.set(cursorShadowSize, cursorShadowSize, 1);
					cursor.visible = !currentHovered;
				} else {
					if (cursorCoords !== null) {
						cursorCoords = null;
						onHoverCoords?.(null);
					}
					cursor.visible = false;
				}
			} else {
				hoveredPlace = null;
			}

			const time = (timestamp || performance.now()) * 0.001;
			updatePlaceMarkersAnimation(allPlaceMarkers, time, currentHovered);
			//Spin That Shi Editor
			// Realistic Earth axial rotation driven by lunar ephemeris dataset + natural planetary spin
			currentEarthRotation = THREE.MathUtils.lerp(currentEarthRotation, targetEarthRotation, 0.12);
			const liveSpin = (time - lastScrubTime) * 0.03;
			if (earth) {
				earth.rotation.y = currentEarthRotation + liveSpin;
			}

			const earthWorldPos = new THREE.Vector3();
			earth.getWorldPosition(earthWorldPos);
			earthMaterial.uniforms.uSunDirection.value.subVectors(horizontalStreak.position, earthWorldPos).normalize();

			renderer.render(scene, camera);
		}
		animate();

		// Cleanup
		return () => {
			cancelAnimationFrame(animId);
			window.removeEventListener('resize', onResize);
			container.removeEventListener('pointermove', onPointerMove);
			container.removeEventListener('pointerleave', onPointerLeave);
			container.removeEventListener('pointerdown', onPointerDown);
			container.removeEventListener('click', onClick);
			container.removeEventListener('dblclick', onDoubleClick);
			controls.dispose();
			renderer.dispose();
			scene.remove(placesGroup);
			disposePlaces();
			scene.remove(landingSitesGroup);
			disposeLandingSites();
			markerTexture.dispose();
			controls.dispose();
			renderer.dispose();
			cursorGeo.dispose();
			cursorMat.dispose();
			selCursorGeo.dispose();
			selCursorMat.dispose();
			selLineMat.dispose();
			shadowGeo.dispose();
			shadowMat.dispose();
			shadowTexture.dispose();
			lineGeo.dispose();
			lineMat.dispose();
			moonGeometry.dispose();
			moonMaterial.dispose();
			moonTexture.dispose();
			moonDisplacementMap?.dispose();
			sunLight.dispose();
			ambientLight.dispose();
			scene.remove(earthGroup);
			earthGroup.remove(earth);
			earth.geometry.dispose();
			earth.material.dispose();
			earthTexture.dispose();
			scene.remove(celestialLine);
			celestialLineGeometry.dispose();
			celestialLineMat.dispose();
			celestialLineRef = null;
			celestialLineGeo = null;
			sunMesh.geometry.dispose();
			sunMesh.material.dispose();
			innerCorona.material.dispose();
			innerCoronaTex.dispose();
			outerCorona.material.dispose();
			outerCoronaTex.dispose();
			sunBloom.material.dispose();
			bloomTex.dispose();
			horizontalStreak.material.dispose();
			streakTex.dispose();
			beamTex.dispose();
			for (const ray of raySprites) {
				ray.material.dispose();
			}
			starSystem.dispose();
		};
	});
</script>

<div class="space-viewport" bind:this={container}>
	{#if hoveredPlace}
		<div
			class="place-hover-box {hoverBoxPos.isNearTop ? 'is-below' : 'is-above'}"
			style="left: {hoverBoxPos.x}px; top: {hoverBoxPos.y}px;"
		>
			<div class="place-name">{hoveredPlace.name}</div>
			<div class="place-type">{hoveredPlace.type}</div>
		</div>
	{/if}
</div>

<style>
	.space-viewport {
		position: relative;
		width: 100vw;
		height: 100vh;
		background: #000;
		cursor: grab;
		overflow: hidden;
		user-select: none;
	}
	.space-viewport:active {
		cursor: grabbing;
	}
	.place-hover-box {
		position: absolute;
		padding: 10px 24px;
		background: rgba(255, 255, 255, 0.08);
		color: #ffffff;
		border: 1px solid rgba(255, 255, 255, 0.45);
		font-family: "Jersey 25", sans-serif;
		letter-spacing: 1px;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		box-shadow: 0 0 16px rgba(255, 255, 255, 0.15);
		pointer-events: none;
		z-index: 20;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		user-select: none;
		white-space: nowrap;
		animation: placeBoxFade 0.15s ease-out;
	}
	.place-hover-box.is-above {
		transform: translate(-50%, -100%);
	}
	.place-hover-box.is-below {
		transform: translate(-50%, 0);
	}
	.place-name {
		font-size: 22px;
		color: #ffffff;
		line-height: 1.1;
		letter-spacing: 1px;
	}
	.place-type {
		font-size: 15px;
		font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
		color: rgba(255, 255, 255, 0.7);
		letter-spacing: 0.6px;
	}
	@keyframes placeBoxFade {
		from {
			opacity: 0;
			transform: translate(-50%, -85%);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -100%);
		}
	}
	@keyframes placeBoxFadeBelow {
		from {
			opacity: 0;
			transform: translate(-50%, -15%);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}
</style>
