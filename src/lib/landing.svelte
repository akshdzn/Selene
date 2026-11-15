<script>
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import earthUrl from '../assets/earth.jpg';
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
	const moonPos = new THREE.Vector3(-14, 6, -24);
	const startCamPos = new THREE.Vector3();
	const startTarget = new THREE.Vector3();
	const endCamPos = new THREE.Vector3(moonPos.x, moonPos.y, moonPos.z + 2.9);
	const endTarget = moonPos.clone();
	const flightDir = new THREE.Vector3();

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
		earthMesh.visible = true;
		distantMoonMesh.visible = true;
	}

	$effect(() => {
		if (isLoaded && lunarPositions) {
			applyPositions(lunarPositions);
		}
	});

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

		// 5. Distant Moon in the horizon (visible for future transitions)
		const moonTexture = textureLoader.load(moonUrl);
		moonTexture.colorSpace = THREE.SRGBColorSpace;

		const moonGeometry = new THREE.SphereGeometry(0.85, 48, 48);
		moonGeometry.rotateY(-Math.PI / 2);
		const moonMaterial = new THREE.MeshBasicMaterial({
			map: moonTexture
		});
		const distantMoon = new THREE.Mesh(moonGeometry, moonMaterial);
		distantMoon.name = 'distantMoon';
		distantMoon.position.copy(moonPos);
		distantMoon.lookAt(0, 0, 0); // Near-side (0°N, 0°E) faces Earth at (0, 0, 0)
		scene.add(distantMoon);

		// 6. Hero Object: Earth (100% visible, unlit flat texture, 23.44° axial tilt)
		const earthTexture = textureLoader.load(earthUrl);
		earthTexture.colorSpace = THREE.SRGBColorSpace;

		const earthGeometry = new THREE.SphereGeometry(1.0, 128, 128);
		const earthMaterial = new THREE.MeshBasicMaterial({
			map: earthTexture
		});
		const earth = new THREE.Mesh(earthGeometry, earthMaterial);
		// Align Prime Meridian facing the camera, with authentic 23.44° axial tilt
		earth.rotation.y = -Math.PI / 2;
		earth.rotation.z = 23.44 * (Math.PI / 180);
		scene.add(earth);

		distantMoonMesh = distantMoon;
		earthMesh = earth;
		earth.visible = Boolean(isLoaded);
		distantMoon.visible = Boolean(isLoaded);
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
		function animate(timestamp) {
			animId = requestAnimationFrame(animate);

			if (!isWarping) {
				controls.update();
				starSystem.update(camera, 0, null);
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

			renderer.render(scene, camera);
		}
		animate();

		// Cleanup
		return () => {
			cancelAnimationFrame(animId);
			window.removeEventListener('resize', onResize);
			controls.dispose();
			renderer.dispose();
			earthGeometry.dispose();
			earthMaterial.dispose();
			earthTexture.dispose();
			moonGeometry.dispose();
			moonMaterial.dispose();
			moonTexture.dispose();
			starSystem.dispose();
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="space-viewport" bind:this={container}>
	{#if !isLoaded}
		<div class="loading-hud">
			<div class="pulse-dot"></div>
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
		gap: 12px;
		color: rgba(255, 255, 255, 0.7);
		font-family: "Jersey 25", sans-serif;
		font-size: 20px;
		letter-spacing: 1px;
		pointer-events: none;
	}
	.pulse-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #ff5500;
		box-shadow: 0 0 10px #ff5500;
		animation: pulse 1.2s infinite ease-in-out;
	}
	@keyframes pulse {
		0%, 100% { opacity: 0.3; transform: scale(0.8); }
		50% { opacity: 1; transform: scale(1.2); }
	}
	.travel-btn {
		position: absolute;
		bottom: 64px;
		left: 50%;
		transform: translateX(-50%);
		padding: 10px 26px;
		background: rgba(255, 255, 255, 0.08);
		color: #ffffff;
		border: 1px solid rgba(255, 255, 255, 0.45);
		border-radius: 4px;
		font-family: "Jersey 25", sans-serif;
		font-size: 22px;
		letter-spacing: 1px;
		cursor: pointer;
		backdrop-filter: blur(8px);
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
		backdrop-filter: blur(8px);
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
		backdrop-filter: blur(4px);
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
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
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
		backdrop-filter: blur(8px);
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
