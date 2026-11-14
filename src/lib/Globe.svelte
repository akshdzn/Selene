<script>
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import UTIF from 'three/examples/jsm/libs/utif.module.js';
	import { fetchCurrentLunarPositions, vector3ToLatLon, formatLatLon } from './ephemeris.js';
	import moonUrl from '../assets/moon.webp';
	import moonDisplacementUrl from '../assets/moon_displacement.tif';
	import earthUrl from '../assets/earth.jpg';

	let { lunarPositions = null } = $props();

	let cursorRadius = $state(0.026);
	let cursorThickness = $state(0.006);
	let cursorLineLength = $state(0.07);
	let cursorLineThickness = $state(0.006);
	let cursorLineColor = $state('#ff5500');
	let cursorShadowSize = $state(0.15);
	let cursorShadowOpacity = $state(0.6);

	let cursorCoords = $state(null);
	let subSolarCoords = $state(null);
	let subEarthCoords = $state(null);

	let container;
	let animId;

	let sunMeshRef;
	let sunGlowRef;
	let sunLightRef;
	let earthMeshRef;

	function updateCelestialPositions(positions) {
		if (!positions) return;
		if (positions.sunPos) {
			sunMeshRef?.position.copy(positions.sunPos);
			sunGlowRef?.position.copy(positions.sunPos);
			sunLightRef?.position.copy(positions.sunPos);
			const { lat, lon } = vector3ToLatLon(positions.sunPos);
			subSolarCoords = formatLatLon(lat, lon);
		}
		if (positions.earthPos) {
			earthMeshRef?.position.copy(positions.earthPos);
			const { lat, lon } = vector3ToLatLon(positions.earthPos);
			subEarthCoords = formatLatLon(lat, lon);
		}
	}

	$effect(() => {
		if (lunarPositions) {
			updateCelestialPositions(lunarPositions);
		}
	});

	// Gentle radial glow for the visual Sun disk
	function createSunGlowTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 128;
		canvas.height = 128;
		const ctx = canvas.getContext('2d');

		const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
		gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
		gradient.addColorStop(0.2, 'rgba(255, 245, 210, 0.55)');
		gradient.addColorStop(0.5, 'rgba(255, 200, 120, 0.15)');
		gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 128, 128);

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

		const sunMesh = new THREE.Mesh(
			new THREE.SphereGeometry(1.8, 32, 32),
			new THREE.MeshBasicMaterial({ color: 0xffffff })
		);
		sunMesh.position.copy(sunPos);
		scene.add(sunMesh);
		sunMeshRef = sunMesh;

		const sunGlowTex = createSunGlowTexture();
		const sunGlow = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: sunGlowTex,
				blending: THREE.AdditiveBlending,
				color: 0xffeedd,
				transparent: true,
				opacity: 0.6
			})
		);
		sunGlow.position.copy(sunPos);
		sunGlow.scale.set(10, 10, 1);
		scene.add(sunGlow);
		sunGlowRef = sunGlow;

		// Directional sunlight from the Sun's position to illuminate the Moon & reveal surface displacement
		const sunLight = new THREE.DirectionalLight(0xfffaed, 2.8);
		sunLight.position.copy(sunPos);
		scene.add(sunLight);
		sunLightRef = sunLight;

		// Soft ambient light (earthshine & cosmic background) keeping unlit terrain navigably visible
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.18);
		scene.add(ambientLight);

		// 6. Background Earth (distant unlit textured sphere)
		const earthTexture = textureLoader.load(earthUrl);
		earthTexture.colorSpace = THREE.SRGBColorSpace;

		const earth = new THREE.Mesh(
			new THREE.SphereGeometry(0.85, 48, 48),
			new THREE.MeshBasicMaterial({
				map: earthTexture
			})
		);
		earth.position.copy(earthPos);
		earth.rotation.y = 1.2;
		scene.add(earth);
		earthMeshRef = earth;

		if (!lunarPositions) {
			fetchCurrentLunarPositions(0, 0).then((res) => {
				updateCelestialPositions(res);
			});
		}

		// 7. Hero Object: The Moon with displacement mapping and lighting
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

		const raycaster = new THREE.Raycaster();
		const mouse = new THREE.Vector2(-1000, -1000);
		const cursorNormal = new THREE.Vector3();
		const UP_Z = new THREE.Vector3(0, 0, 1);
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
			cursorCoords = null;
		}

		container.addEventListener('pointermove', onPointerMove);
		container.addEventListener('pointerleave', onPointerLeave);

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
		function animate() {
			animId = requestAnimationFrame(animate);
			controls.update();
			starSystem.update(camera);

			if (hasPointer) {
				raycaster.setFromCamera(mouse, camera);
				const intersects = raycaster.intersectObject(moon);
				if (intersects.length > 0) {
					const hitPoint = intersects[0].point;
					cursorNormal.copy(hitPoint).normalize();
					cursor.position.copy(hitPoint).addScaledVector(cursorNormal, 0.003);
					cursor.quaternion.setFromUnitVectors(UP_Z, cursorNormal);
					const { lat, lon } = vector3ToLatLon(cursorNormal);
					cursorCoords = formatLatLon(lat, lon);
					const lineR = cursorLineThickness / 2;
					line.scale.set(lineR, lineR, cursorLineLength);
					lineMat.color.set(cursorLineColor);
					shadowMat.opacity = cursorShadowOpacity;
					shadowMesh.scale.set(cursorShadowSize, cursorShadowSize, 1);
					cursor.visible = true;
				} else {
					cursorCoords = null;
					cursor.visible = false;
				}
			}

			renderer.render(scene, camera);
		}
		animate();

		// Cleanup
		return () => {
			cancelAnimationFrame(animId);
			window.removeEventListener('resize', onResize);
			container.removeEventListener('pointermove', onPointerMove);
			container.removeEventListener('pointerleave', onPointerLeave);
			controls.dispose();
			renderer.dispose();
			cursorGeo.dispose();
			cursorMat.dispose();
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
			earth.geometry.dispose();
			earth.material.dispose();
			earthTexture.dispose();
			sunMesh.geometry.dispose();
			sunMesh.material.dispose();
			sunGlow.material.dispose();
			sunGlowTex.dispose();
			starSystem.dispose();
		};
	});
</script>

<div class="space-viewport" bind:this={container}>
	<div class="hud-panel">
		<div class="hud-item">
			<span class="hud-label">COORDINATES:</span>
			<span class="hud-val">{cursorCoords ? cursorCoords.full : 'HOVER MOON'}</span>
		</div>
		{#if subSolarCoords}
			<div class="hud-item">
				<span class="hud-label">SUB-SOLAR:</span>
				<span class="hud-val">{subSolarCoords.full}</span>
			</div>
		{/if}
		{#if subEarthCoords}
			<div class="hud-item">
				<span class="hud-label">SUB-EARTH:</span>
				<span class="hud-val">{subEarthCoords.full}</span>
			</div>
		{/if}
	</div>
	<div class="overlay-hint">Drag to rotate the Moon &bull; Scroll to zoom</div>
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
	.hud-panel {
		position: absolute;
		top: 24px;
		left: 24px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 18px;
		background: rgba(10, 10, 16, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		backdrop-filter: blur(10px);
		font-family: "Jersey 25", sans-serif;
		letter-spacing: 0.8px;
		pointer-events: none;
		z-index: 10;
	}
	.hud-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 16px;
	}
	.hud-label {
		color: rgba(255, 255, 255, 0.5);
	}
	.hud-val {
		color: #ffaa44;
		font-family: monospace;
		font-size: 14px;
	}
	.overlay-hint {
		position: absolute;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		color: rgba(255, 255, 255, 0.4);
		font-family: "Jersey 25", sans-serif;
		font-size: 20px;
		letter-spacing: 0.5px;
		pointer-events: none;
	}
</style>
