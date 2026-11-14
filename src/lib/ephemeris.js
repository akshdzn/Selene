import getLunarData from '../../backend/Lunarfunction.js';
import * as THREE from 'three';

export function getTodayDateRange() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const startTime = formatDate(now);
  const tomorrow = new Date(now.getTime() + 86400000);
  const stopTime = formatDate(tomorrow);

  return { startTime, stopTime, hour: now.getHours() };
}

/**
 * Converts Azimuth and Elevation (degrees) into a 3D Cartesian Vector3.
 * Coordinate frame aligned with Three.js scene:
 * - +Y: North (Moon's spin axis)
 * - +X: East
 * - +Z: Zenith (pointing toward Near-side observer/camera)
 */
export function azElToVector3(azDeg, elDeg, radius) {
  const azRad = (azDeg * Math.PI) / 180;
  const elRad = (elDeg * Math.PI) / 180;
  const cosEl = Math.cos(elRad);

  const x = radius * cosEl * Math.sin(azRad);
  const y = radius * cosEl * Math.cos(azRad);
  const z = radius * Math.sin(elRad);

  return new THREE.Vector3(x, y, z);
}

export async function fetchCurrentLunarPositions(lat = 0, lon = 0) {
  const { startTime, stopTime, hour } = getTodayDateRange();
  try {
    const data = await getLunarData(lat, lon, { startTime, stopTime });
    const sunEntry = data.sun?.[hour] || data.sun?.[0] || { angle: 90, elevation: -15 };
    const earthEntry = data.earth?.[hour] || data.earth?.[0] || { angle: 0, elevation: 85 };

    const SUN_DISTANCE = 52.0;
    const EARTH_DISTANCE = 28.0;

    const sunPos = azElToVector3(sunEntry.angle, sunEntry.elevation, SUN_DISTANCE);
    const earthPos = azElToVector3(earthEntry.angle, earthEntry.elevation, EARTH_DISTANCE);

    return {
      sunPos,
      earthPos,
      sunEntry,
      earthEntry,
      hour,
      success: true
    };
  } catch (err) {
    console.warn('Ephemeris fetch fallback:', err);
    return {
      sunPos: new THREE.Vector3(28, 12, -45),
      earthPos: new THREE.Vector3(-14, 6, -24),
      sunEntry: { angle: 90, elevation: -15 },
      earthEntry: { angle: 0, elevation: 85 },
      hour,
      success: false
    };
  }
}
