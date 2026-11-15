<script>
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { calculateEarthRotation } from './ephemeris.js';
	import earthUrl from '../assets/earth.jpg';
	import earthNightUrl from '../assets/earth_night.jpg';
	import moonUrl from '../assets/moon.webp';
	import Info from './info.svelte';

	let { onComplete, lunarPositions = null, isLoaded = false } = $props();

	let container;
	let animId;
	let isWarping = $state(false);
	let showInfo = $state(false);
	let triggerFlight;

	function handleKeydown(e) {
		if (e.key === 'Escape' && showInfo) {
			showInfo = false;
		}
	}

	let distantMoonMesh;
	let earthMesh;
	let earthGroupRef;
	let earthMaterialRef;
	let sunMeshRef;
	let innerCoronaRef;
	let outerCoronaRef;
	let horizontalStreakRef;
	let raySpritesRef = [];
	let sunBloomRef;
	let sunLightRef;

	const defaultSunPos = new THREE.Vector3(28, 12, -45);
	const defaultEarthPos = new THREE.Vector3(-14, 6, -24);
	const defaultSunLanding = new THREE.Vector3().subVectors(defaultSunPos, defaultEarthPos);
	const defaultMoonPos = new THREE.Vector3().copy(defaultEarthPos).negate();

	const sunPos = new THREE.Vector3().copy(defaultSunLanding);
	const moonPos = new THREE.Vector3().copy(defaultMoonPos);
	const startCamPos = new THREE.Vector3();
	const startTarget = new THREE.Vector3();
	const endCamPos = new THREE.Vector3(moonPos.x, moonPos.y, moonPos.z + 2.9);
	const endTarget = moonPos.clone();
	const flightDir = new THREE.Vector3();

	let targetEarthRotation = -Math.PI / 2;
	let currentEarthRotation = -Math.PI / 2;
	let lastScrubTime = typeof performance !== 'undefined' ? performance.now() * 0.001 : 0;
	let baselineDatasetHour = 12;

	function setSunVisibility(visible) {
		if (sunMeshRef) sunMeshRef.visible = visible;
		if (innerCoronaRef) innerCoronaRef.visible = visible;
		if (outerCoronaRef) outerCoronaRef.visible = visible;
		if (sunLightRef) sunLightRef.visible = visible;
	}

	function applyPositions(positions) {
		if (!positions?.earthPos || !distantMoonMesh || !earthMesh) return;
		// The Moon from Earth is in the exact opposite direction of Earth from the Moon
		const moonDir = positions.earthPos.clone().negate().normalize();
		moonPos.copy(moonDir.multiplyScalar(28.0));
		distantMoonMesh.position.copy(moonPos);
		// Tidal locking: Near-side (0°N, 0°E) faces Earth at origin (0, 0, 0)
		distantMoonMesh.lookAt(0, 0, 0);
		endCamPos.set(moonPos.x, moonPos.y, moonPos.z + 2.9);
		endTarget.copy(moonPos);

		if (positions.sunPos) {
			const targetSunPos = new THREE.Vector3().subVectors(positions.sunPos, positions.earthPos);
			sunPos.copy(targetSunPos);
			sunMeshRef?.position.copy(sunPos);
			innerCoronaRef?.position.copy(sunPos);
			outerCoronaRef?.position.copy(sunPos);
			sunBloomRef?.position.copy(sunPos);
			horizontalStreakRef?.position.copy(sunPos);
			for (const ray of raySpritesRef) {
				ray.position.copy(sunPos);
			}
			sunLightRef?.position.copy(sunPos);
		}

		if (earthGroupRef) earthGroupRef.visible = true;
		earthMesh.visible = true;
		distantMoonMesh.visible = true;
		setSunVisibility(true);

		if (typeof positions.hour === 'number') {
			baselineDatasetHour = positions.hour;
		}
		targetEarthRotation = calculateEarthRotation(positions, baselineDatasetHour);
		lastScrubTime = typeof performance !== 'undefined' ? performance.now() * 0.001 : 0;
	}

	$effect(() => {
		if (isLoaded && lunarPositions) {
			applyPositions(lunarPositions);
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

	function createSunBloomTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext('2d');

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

	function createSolarBeamTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext('2d');
		const cx = 256;
		const cy = 256;

		ctx.clearRect(0, 0, 512, 512);

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

	function createLightScatteringStreakTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 128;
		const ctx = canvas.getContext('2d');
		const cx = 256;
		const cy = 64;

		ctx.clearRect(0, 0, 512, 128);

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

		// 1. Star heads (soft circular points at current camera pose)
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
		const MAX_TRAIL_ANGLE = 0.18;

		function update(camera, warpIntensity = 0, flightDir = null) {
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

			if (warpIntensity > 0 && flightDir) {
				//Disney Pls No Sue we broke
				// Hyperdrive mode during Earth -> Moon movement:
				// 5x original star trail length and 4x original intensity
				const trailStepLength = 17.5; // 5x original (3.5 * 5)
				for (let k = 1; k < STEPS; k++) {
					historyQuats[k].copy(camera.quaternion);
					historyPositions[k].copy(camera.position).addScaledVector(flightDir, -warpIntensity * k * trailStepLength);
				}
				trailMaterial.uniforms.uTrailOpacity.value = (0.6 + warpIntensity * 0.4) * 4.0; // 4x original intensity (additive glow)
			} else {
				for (let k = 1; k < STEPS; k++) {
					historyQuats[k].slerp(historyQuats[k - 1], 0.50);
					historyPositions[k].lerp(historyPositions[k - 1], 0.50);
				}

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

				const lengthRatio = effectiveAngle / MAX_TRAIL_ANGLE;
				trailMaterial.uniforms.uTrailOpacity.value = 1.0 / (1.0 + 2.2 * lengthRatio);
			}

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

		// 1. Scene & Camera (focused on Earth at origin)
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
		camera.position.set(0, 0, 2.9);

		// 2. Renderer (No tone mapping dimming, 1:1 true texture colors)
		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(width, height);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.toneMapping = THREE.NoToneMapping;
		container.appendChild(renderer.domElement);

		// 3. Orbit Controls: Earth stays centered
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.05;
		controls.enablePan = false;
		controls.minDistance = 1.3;
		controls.maxDistance = 7.0;
		controls.rotateSpeed = 0.7;

		const textureLoader = new THREE.TextureLoader();

		// 4. Background stars with continuous GPU light trails
		const starSystem = createStarfield(2500);
		scene.add(starSystem.group);

		// 5. Visual Sun in the background and directional lighting
		if (lunarPositions?.sunPos && lunarPositions?.earthPos) {
			sunPos.subVectors(lunarPositions.sunPos, lunarPositions.earthPos);
		} else {
			sunPos.copy(defaultSunLanding);
		}

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

		// 5d. Horizontal anamorphic light scattering flare streak
		const BASE_STREAK_LENGTH = 46;
		const BASE_STREAK_THICKNESS = 2.6;
		const BASE_MAJOR_RAY_SCALE = 30;
		const BASE_MINOR_RAY_SCALE = 23;
		const BASE_STREAK_OPACITY = 0.70;
		const initialFlareScale = 0.75;

		const streakTex = createLightScatteringStreakTexture();
		const horizontalStreak = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: streakTex,
				blending: THREE.AdditiveBlending,
				color: 0xfffaed,
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
			const angle = i * (Math.PI / NUM_AXES);
			const isMajor = (i % 2 === 0);
			const baseRayScale = isMajor ? BASE_MAJOR_RAY_SCALE : BASE_MINOR_RAY_SCALE;
			const rayScale = baseRayScale * initialFlareScale;
			const rayOpacity = isMajor ? 0.38 : 0.24;

			const raySprite = new THREE.Sprite(
				new THREE.SpriteMaterial({
					map: beamTex,
					blending: THREE.AdditiveBlending,
					color: 0xfffaed,
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

		// 5f. Procedural HDR Solar Bloom sprite
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

		// Directional sunlight from Sun to origin to illuminate celestial bodies
		const sunLight = new THREE.DirectionalLight(0xfffaed, 2.8);
		sunLight.position.copy(sunPos);
		sunLight.target.position.set(0, 0, 0);
		scene.add(sunLight.target);
		scene.add(sunLight);
		sunLightRef = sunLight;

		// Soft ambient light
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.18);
		scene.add(ambientLight);

		// 6. Distant Moon in the horizon
		const moonTexture = textureLoader.load(moonUrl);
		moonTexture.colorSpace = THREE.SRGBColorSpace;

		const moonGeometry = new THREE.SphereGeometry(0.85, 48, 48);
		moonGeometry.rotateY(-Math.PI / 2);
		const moonMaterial = new THREE.MeshStandardMaterial({
			map: moonTexture,
			roughness: 0.85,
			metalness: 0.0
		});
		const distantMoon = new THREE.Mesh(moonGeometry, moonMaterial);
		distantMoon.name = 'distantMoon';
		distantMoon.position.copy(moonPos);
		distantMoon.lookAt(0, 0, 0); // Near-side (0°N, 0°E) faces Earth at (0, 0, 0)
		scene.add(distantMoon);

		// 7. Hero Object: Earth illuminated by directional sunlight with Rayleigh scattering
		const earthTexture = textureLoader.load(earthUrl);
		earthTexture.colorSpace = THREE.SRGBColorSpace;
		const earthNightTexture = textureLoader.load(earthNightUrl);
		earthNightTexture.colorSpace = THREE.SRGBColorSpace;

		const earthSunDir = new THREE.Vector3().copy(sunPos).normalize();
		const earthMaterial = new THREE.ShaderMaterial({
			uniforms: {
				uMap: { value: earthTexture },
				uMapNight: { value: earthNightTexture },
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
				uniform sampler2D uMapNight;
				uniform vec3 uSunDirection;
				varying vec2 vUv;
				varying vec3 vWorldNormal;
				varying vec3 vViewDirection;

				void main() {
					vec4 dayTex = texture2D(uMap, vUv);
					vec4 nightTex = texture2D(uMapNight, vUv);
					vec3 N = normalize(vWorldNormal);
					float NdotL = dot(N, uSunDirection);

					// Smooth day/night terminator wrap across Earth's atmosphere
					float daylight = smoothstep(-0.15, 0.25, NdotL);

					// Sunlight warm tint on day side
					vec3 sunColor = vec3(1.0, 0.98, 0.94);
					vec3 dayColor = dayTex.rgb * sunColor;

					// Night side with city lights and subtle ambient starlight
					vec3 nightColor = nightTex.rgb + dayTex.rgb * 0.04;

					// Smooth mask blend between illuminated day and shadowed night
					vec3 color = mix(nightColor, dayColor, daylight);

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
		earthMaterialRef = earthMaterial;

		const earthGroup = new THREE.Group();
		earthGroup.name = 'hero-earth-group';
		// Earth's authentic axial obliquity tilt (23.44°)
		earthGroup.rotation.z = 23.44 * (Math.PI / 180);

		const earthGeometry = new THREE.SphereGeometry(1.0, 128, 128);
		const earth = new THREE.Mesh(earthGeometry, earthMaterial);
		earthGroup.add(earth);
		scene.add(earthGroup);

		distantMoonMesh = distantMoon;
		earthMesh = earth;
		earthGroupRef = earthGroup;

		earthGroup.visible = Boolean(isLoaded);
		distantMoon.visible = Boolean(isLoaded);
		setSunVisibility(Boolean(isLoaded));

		if (lunarPositions) {
			if (typeof lunarPositions.hour === 'number') {
				baselineDatasetHour = lunarPositions.hour;
			}
			targetEarthRotation = calculateEarthRotation(lunarPositions, baselineDatasetHour);
			currentEarthRotation = targetEarthRotation;
			earth.rotation.y = targetEarthRotation;
		}

		if (isLoaded && lunarPositions) {
			applyPositions(lunarPositions);
		}

		// Hyperdrive flight state
		const FLIGHT_DURATION = 2000; // ms (exact 2000ms duration)
		let flightStartTime = null;
		let flightCompleted = false;

		// inOutCirc circular easing curve
		function inOutCirc(t) {
			return t < 0.5
				? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
				: (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
		}

		triggerFlight = function() {
			if (isWarping) return;
			isWarping = true;
			controls.enabled = false;
			startCamPos.copy(camera.position);
			startTarget.copy(controls.target);
			flightDir.subVectors(endCamPos, startCamPos).normalize();
			flightStartTime = performance.now();
		};

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

			const time = (timestamp || performance.now()) * 0.001;

			if (!isWarping) {
				controls.update();
				starSystem.update(camera, 0, null);

				currentEarthRotation = THREE.MathUtils.lerp(currentEarthRotation, targetEarthRotation, 0.12);
				const liveSpin = (time - lastScrubTime) * 0.03;
				if (earthMesh) {
					earthMesh.rotation.y = currentEarthRotation + liveSpin;
				}
			} else {
				const now = timestamp || performance.now();
				const elapsed = now - flightStartTime;
				const t = Math.min(elapsed / FLIGHT_DURATION, 1.0);

				// inOutCirc easing curve for camera translation
				const posProgress = inOutCirc(t);

				// Warp trail intensity peaks in mid-flight and smoothly drops to 0 at arrival
				const warpIntensity = Math.pow(Math.sin(Math.PI * t), 1.2);

				camera.position.lerpVectors(startCamPos, endCamPos, posProgress);
				const currentTarget = new THREE.Vector3().lerpVectors(startTarget, endTarget, posProgress);
				camera.lookAt(currentTarget);

				// Moon scales from 0.85 to 1.0 to perfectly match Globe.svelte radius
				const moonScale = 1.0 + (1.0 / 0.85 - 1.0) * posProgress;
				distantMoon.scale.set(moonScale, moonScale, moonScale);

				starSystem.update(camera, warpIntensity, flightDir);

				if (t >= 1.0 && !flightCompleted) {
					flightCompleted = true;
					onComplete?.();
				}
			}

			// Calculate sun obstruction by Earth (sphere of radius 1.0 at origin)
			_toSun.subVectors(horizontalStreak.position, camera.position);
			const sunDist = _toSun.length();
			_sunDir.copy(_toSun).divideScalar(sunDist);

			// Projection of vector from camera to earth center (which is -camera.position) onto sun direction
			const tOcc = -camera.position.dot(_sunDir);
			let flareVisibility = 1.0;

			if (tOcc > 0 && tOcc < sunDist) {
				const camDistSq = camera.position.lengthSq();
				const distSq = Math.max(0, camDistSq - tOcc * tOcc);
				const dPerp = Math.sqrt(distSq);

				const occlusionRadius = 1.02;
				const sunRadius = 1.8;
				const sunConeRadius = sunRadius * (tOcc / sunDist);

				const innerThreshold = occlusionRadius;
				const outerThreshold = occlusionRadius + sunConeRadius;

				flareVisibility = THREE.MathUtils.smoothstep(dPerp, innerThreshold, outerThreshold);
			}

			// Dynamic flare scaling proportional to page zoom and obstruction visibility
			const camDist = camera.position.length();
			const zoomProgress = (camDist - 2.9) / (controls.maxDistance - 2.9);
			const zoomFactor = THREE.MathUtils.clamp(0.75 + zoomProgress * (1.0 - 0.75), 0.65, 1.0);
			const currentFlareScale = zoomFactor * flareVisibility;
			const isVisible = (isLoaded || sunMeshRef?.visible) && flareVisibility > 0.0001;

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

			// Update Earth lighting direction for terminator and Rayleigh atmosphere
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
			controls.dispose();
			renderer.dispose();
			scene.remove(earthGroup);
			earthGroup.remove(earth);
			earthGeometry.dispose();
			earthMaterial.dispose();
			earthTexture.dispose();
			earthNightTexture.dispose();
			distantMoonMesh = null;
			moonGeometry.dispose();
			moonMaterial.dispose();
			moonTexture.dispose();
			starSystem.dispose();
			sunLight.dispose();
			ambientLight.dispose();
			scene.remove(sunMesh);
			sunMesh.geometry.dispose();
			sunMesh.material.dispose();
			scene.remove(innerCorona);
			innerCorona.material.dispose();
			innerCoronaTex.dispose();
			scene.remove(outerCorona);
			outerCorona.material.dispose();
			outerCoronaTex.dispose();
			scene.remove(sunBloom);
			sunBloom.material.dispose();
			bloomTex.dispose();
			scene.remove(horizontalStreak);
			horizontalStreak.material.dispose();
			streakTex.dispose();
			beamTex.dispose();
			for (const ray of raySprites) {
				scene.remove(ray);
				ray.material.dispose();
			}
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="space-viewport" bind:this={container}>
	{#if !isLoaded}
		<div class="loading-hud">
			<div class="loader"></div>
			<span>ACQUIRING LUNAR EPHEMERIS FROM HORIZONS...</span>
		</div>
	{:else if !isWarping}
		<button class="travel-btn" onclick={() => triggerFlight?.()}>
			[ TRAVEL TO MOON ]
		</button>
		<button class="info-btn" onclick={() => (showInfo = !showInfo)}>
			[ INFO ]
		</button>
		<div class="overlay-hint">Drag to rotate Earth &bull; Scroll to zoom</div>
	{/if}

	{#if showInfo}
		<div
			class="info-popup-backdrop"
			role="button"
			tabindex="0"
			onclick={() => (showInfo = false)}
			onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') showInfo = false; }}
		>
			<div
				class="info-popup-card"
				role="dialog"
				aria-modal="true"
				tabindex="-1"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
			>
				<div class="info-popup-header">
					<button class="info-close-btn" onclick={() => (showInfo = false)}>
						[ CLOSE ]
					</button>
				</div>
				<div class="info-popup-body">
					<Info />
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
    .loader {
      width: 60px;
      aspect-ratio: 1;
      display: flex;
      transform: scale(0.35);
      margin: 0 -16px;
      --c: #ff5500;
    }
    .loader:before,
    .loader:after {
      content: "";
      flex: 1;
      aspect-ratio: 1;
      --g: conic-gradient(from -90deg at 10px 10px, var(--c) 90deg, #0000 0);
      background: var(--g), var(--g), var(--g);
      filter: drop-shadow(30px 30px 0 var(--c));
      animation: l20 1s infinite;
    }
    .loader:after {
      transform: scaleX(-1);
    }
    @keyframes l20 {
       0%   {background-position:0     0, 10px 10px, 20px 20px}
       33%  {background-position:10px  10px}
       66%  {background-position:0    20px,10px 10px,20px 0   }
       100% {background-position:0     0, 10px 10px, 20px 20px}
    }

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
	.loading-hud {
		position: absolute;
		bottom: 48px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 30px;
		color: rgba(255, 255, 255, 0.7);
		font-family: "Jersey 25", sans-serif;
		font-size: 20px;
		letter-spacing: 1px;
		pointer-events: none;
	}
	.travel-btn {
		position: absolute;
		bottom: 64px;
		left: 50%;
		transform: translateX(-50%) translateZ(0);
		padding: 10px 26px;
		background: rgba(255, 255, 255, 0.08);
		color: #ffffff;
		border: 1px solid rgba(255, 255, 255, 0.45);
		border-radius: 4px;
		font-family: "Jersey 25", sans-serif;
		font-size: 22px;
		letter-spacing: 1px;
		cursor: pointer;
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		will-change: transform, backdrop-filter;
		box-shadow: 0 0 16px rgba(255, 255, 255, 0.15);
		transition: all 0.25s ease;
		z-index: 10;
	}
	.travel-btn:hover {
		background: rgba(255, 255, 255, 0.22);
		border-color: #ffffff;
		box-shadow: 0 0 25px rgba(255, 255, 255, 0.45);
		transform: translateX(-50%) scale(1.05);
	}
	.travel-btn:active {
		transform: translateX(-50%) scale(0.97);
	}
	.info-btn {
		position: absolute;
		bottom: 32px;
		left: 32px;
		padding: 10px 26px;
		background: rgba(255, 255, 255, 0.08);
		color: #ffffff;
		border: 1px solid rgba(255, 255, 255, 0.45);
		font-family: "Jersey 25", sans-serif;
		font-size: 22px;
		letter-spacing: 1px;
		cursor: pointer;
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		transform: translateZ(0);
		will-change: transform, backdrop-filter;
		box-shadow: 0 0 16px rgba(255, 255, 255, 0.15);
		transition: all 0.25s ease;
		z-index: 10;
	}
	.info-btn:hover {
		background: rgba(255, 255, 255, 0.22);
		border-color: #ffffff;
		box-shadow: 0 0 25px rgba(255, 255, 255, 0.45);
		transform: scale(1.05);
	}
	.info-btn:active {
		transform: scale(0.97);
	}
	.info-popup-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		-webkit-backdrop-filter: blur(4px);
		backdrop-filter: blur(4px);
		transform: translateZ(0);
		will-change: backdrop-filter;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
		animation: fadeIn 0.15s ease-out;
	}
	.info-popup-card {
		position: relative;
		width: 90vw;
		max-width: 600px;
		max-height: 82vh;
		padding: 24px 28px;
		background: rgba(10, 10, 16, 0.88);
		color: #ffffff;
		font-family: "Jersey 25", sans-serif;
		letter-spacing: 1px;
		-webkit-backdrop-filter: blur(14px);
		backdrop-filter: blur(14px);
		will-change: transform, backdrop-filter;
		box-shadow: 0 0 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(255, 255, 255, 0.12);
		display: flex;
		flex-direction: column;
		gap: 16px;
		overflow-y: auto;
		animation: scaleUp 0.18s ease-out;
		z-index: 51;
	}
	.info-popup-card::-webkit-scrollbar {
		width: 6px;
	}
	.info-popup-card::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.04);
		border-radius: 3px;
	}
	.info-popup-card::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.25);
		border-radius: 3px;
	}
	.info-popup-card::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.45);
	}
	.info-popup-header {
		display: flex;
		justify-content: flex-end;
		align-items: center;
	}
	.info-close-btn {
		padding: 6px 18px;
		background: rgba(255, 255, 255, 0.08);
		color: #ffffff;
		border: 1px solid rgba(255, 255, 255, 0.45);
		border-radius: 4px;
		font-family: "Jersey 25", sans-serif;
		font-size: 18px;
		letter-spacing: 1px;
		cursor: pointer;
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		transform: translateZ(0);
		will-change: transform, backdrop-filter;
		box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
		transition: all 0.2s ease;
	}
	.info-close-btn:hover {
		background: rgba(255, 255, 255, 0.22);
		border-color: #ffffff;
		box-shadow: 0 0 16px rgba(255, 255, 255, 0.35);
		transform: scale(1.04);
	}
	.info-close-btn:active {
		transform: scale(0.96);
	}
	.info-popup-body {
		display: flex;
		flex-direction: column;
	}
	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes scaleUp {
		from { opacity: 0; transform: scale(0.94); }
		to { opacity: 1; transform: scale(1); }
	}
	.overlay-hint {
		position: absolute;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		color: rgba(255, 255, 255, 0.4);
		font-family: "Jersey 25", sans-serif;
		font-size: 18px;
		letter-spacing: 0.5px;
		pointer-events: none;
	}
</style>
