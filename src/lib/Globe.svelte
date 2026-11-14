<script>
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import moonUrl from '../assets/moon.webp';
	import earthUrl from '../assets/earth.jpg';
	

	let container;
	let animId;

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

	// Non-intrusive background starfield
	function createStarfield(count = 2500) {
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(count * 3);
		const colors = new Float32Array(count * 3);

		for (let i = 0; i < count; i++) {
			const radius = 250 + Math.random() * 150;
			const u = Math.random();
			const v = Math.random();
			const theta = u * 2.0 * Math.PI;
			const phi = Math.acos(2.0 * v - 1.0);

			positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
			positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
			positions[i * 3 + 2] = radius * Math.cos(phi);

			const brightness = 0.35 + Math.random() * 0.45;
			colors[i * 3] = brightness;
			colors[i * 3 + 1] = brightness * 0.95;
			colors[i * 3 + 2] = brightness * 1.05;
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

		const material = new THREE.PointsMaterial({
			size: 1.2,
			vertexColors: true,
			sizeAttenuation: false,
			transparent: true,
			opacity: 0.75
		});

		return new THREE.Points(geometry, material);
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

		// 4. Subtle background stars
		const stars = createStarfield(2800);
		scene.add(stars);

		// 5. Visual Sun in the background (no directional light/shadows)
		const sunPos = new THREE.Vector3(28, 12, -45);

		const sunMesh = new THREE.Mesh(
			new THREE.SphereGeometry(1.8, 32, 32),
			new THREE.MeshBasicMaterial({ color: 0xffffff })
		);
		sunMesh.position.copy(sunPos);
		scene.add(sunMesh);

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

		// 6. Background Earth (distant unlit textured sphere)
		const earthPos = new THREE.Vector3(-14, 6, -24);
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

		// 7. Hero Object: The Moon (100% visible, unlit flat texture, no shadows)
		const moonTexture = textureLoader.load(moonUrl);
		moonTexture.colorSpace = THREE.SRGBColorSpace;

		const moonGeometry = new THREE.SphereGeometry(1.0, 128, 128);
		const moonMaterial = new THREE.MeshBasicMaterial({
			map: moonTexture
		});
		const moon = new THREE.Mesh(moonGeometry, moonMaterial);
		// Align near-side (0° lon) to initially face the camera
		moon.rotation.y = -Math.PI / 2;
		scene.add(moon);

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
			renderer.render(scene, camera);
		}
		animate();

		// Cleanup
		return () => {
			cancelAnimationFrame(animId);
			window.removeEventListener('resize', onResize);
			controls.dispose();
			renderer.dispose();
			moonGeometry.dispose();
			moonMaterial.dispose();
			moonTexture.dispose();
			earth.geometry.dispose();
			earth.material.dispose();
			earthTexture.dispose();
			sunMesh.geometry.dispose();
			sunMesh.material.dispose();
			sunGlow.material.dispose();
			sunGlowTex.dispose();
			stars.geometry.dispose();
			stars.material.dispose();
		};
	});
</script>

<div class="space-viewport" bind:this={container}>
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
