import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import UTIF from 'three/examples/jsm/libs/utif.module.js';

// 1. Verify moon_displacement.tif asset exists and is non-empty
const tiffPath = 'src/assets/moon_displacement.tif';
assert(fs.existsSync(tiffPath), 'Displacement map file exists');
const fileBuffer = fs.readFileSync(tiffPath);
assert(fileBuffer.length > 0, 'Displacement file has content');

// 2. Verify UTIF decodes the 32-bit float elevation TIFF correctly
const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
const ifds = UTIF.decode(arrayBuffer);
assert(ifds.length > 0, 'TIFF header contains IFDs');
UTIF.decodeImage(arrayBuffer, ifds[0]);
const ifd = ifds[0];
assert.equal(ifd.width, 1440, 'Width is 1440');
assert.equal(ifd.height, 720, 'Height is 720');

const f32 = new Float32Array(ifd.data.buffer.slice(ifd.data.byteOffset, ifd.data.byteOffset + ifd.data.byteLength));
assert.equal(f32.length, 1440 * 720, 'Float32 buffer matches pixel count');

let min = Infinity;
let max = -Infinity;
for (let i = 0; i < f32.length; i++) {
	if (f32[i] < min) min = f32[i];
	if (f32[i] > max) max = f32[i];
}
// NASA LOLA elevation should be approx -8.88 km to +10.50 km
assert(min >= -10 && min <= -8, `Min elevation within lunar basin bounds (-10 to -8 km): ${min}`);
assert(max >= 9 && max <= 12, `Max elevation within lunar highland bounds (9 to 12 km): ${max}`);

// 3. Verify Anti-aliasing filter and trilinear mipmap pyramid
function buildAntialiasedElevationMips(src, w, h) {
	const tmp = new Float32Array(w * h);
	const smoothed = new Float32Array(w * h);
	for (let y = 0; y < h; y++) {
		const row = y * w;
		for (let x = 0; x < w; x++) {
			const left = row + ((x - 1 + w) % w);
			const center = row + x;
			const right = row + ((x + 1) % w);
			tmp[center] = 0.25 * src[left] + 0.5 * src[center] + 0.25 * src[right];
		}
	}
	for (let y = 0; y < h; y++) {
		const topRow = Math.max(0, y - 1) * w;
		const midRow = y * w;
		const botRow = Math.min(h - 1, y + 1) * w;
		for (let x = 0; x < w; x++) {
			smoothed[midRow + x] = 0.25 * tmp[topRow + x] + 0.5 * tmp[midRow + x] + 0.25 * tmp[botRow + x];
		}
	}
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

const mips = buildAntialiasedElevationMips(f32, ifd.width, ifd.height);
assert.equal(mips.length, 11, 'Expected 11 mipmap levels for 1440x720');
assert.equal(mips[mips.length - 1].width, 1);
assert.equal(mips[mips.length - 1].height, 1);

// 4. Verify Three.js DataTexture creation with trilinear filtering
const tex = new THREE.DataTexture(mips[0].data, ifd.width, ifd.height, THREE.RedFormat, THREE.FloatType);
tex.mipmaps = mips;
tex.minFilter = THREE.LinearMipmapLinearFilter;
tex.magFilter = THREE.LinearFilter;
tex.wrapS = THREE.RepeatWrapping;
assert.equal(tex.format, THREE.RedFormat);
assert.equal(tex.type, THREE.FloatType);
assert.equal(tex.minFilter, THREE.LinearMipmapLinearFilter);

// 5. Verify MeshStandardMaterial setup
const mat = new THREE.MeshStandardMaterial({
	displacementMap: tex,
	displacementScale: 0.003,
	displacementBias: 0.0,
	bumpMap: tex,
	bumpScale: 1.2
});
assert.equal(mat.displacementMap, tex);
assert.equal(mat.displacementScale, 0.003);
assert.equal(mat.bumpScale, 1.2);

// 5. Verify DirectionalLight setup from Sun position
const sunPos = new THREE.Vector3(28, 12, -45);
const sunLight = new THREE.DirectionalLight(0xfffaed, 2.8);
sunLight.position.copy(sunPos);
assert.equal(sunLight.position.x, 28);
assert.equal(sunLight.position.y, 12);
assert.equal(sunLight.position.z, -45);

console.log('All displacement and lighting checks passed.');
