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

/**
 * Converts a 3D unit vector or position on the Moon to Selenographic (lat, lon) in degrees.
 * Coordinate mapping:
 * - +Y: North Pole (+90°N)
 * - -Y: South Pole (-90°S)
 * - +Z: Near-side Center (0° lat, 0° lon)
 * - +X: Eastern Limb (0° lat, +90° lon)
 * - -X: Western Limb (0° lat, -90° lon)
 * - -Z: Farside Center (0° lat, 180° lon)
 */
export function vector3ToLatLon(vec) {
  const norm = vec.clone().normalize();
  const lat = Math.asin(Math.max(-1, Math.min(1, norm.y))) * (180 / Math.PI);
  const lon = Math.atan2(norm.x, norm.z) * (180 / Math.PI);
  return { lat, lon };
}

/**
 * Converts Selenographic (lat, lon) in degrees to a 3D Vector3 at the specified radius.
 */
export function latLonToVector3(latDeg, lonDeg, radius = 1.0) {
  const latRad = (latDeg * Math.PI) / 180;
  const lonRad = (lonDeg * Math.PI) / 180;
  const cosLat = Math.cos(latRad);

  const x = radius * cosLat * Math.sin(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * cosLat * Math.cos(lonRad);

  return new THREE.Vector3(x, y, z);
}

/**
 * Formats (lat, lon) in degrees to a clean human-readable string (e.g. "14.2°N, 45.1°E").
 */
export function formatLatLon(lat, lon) {
  const latNum = Number(lat) || 0;
  const lonNum = Number(lon) || 0;
  const latStr = `${Math.abs(latNum).toFixed(1)}°${latNum >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lonNum).toFixed(1)}°${lonNum >= 0 ? 'E' : 'W'}`;
  return { latStr, lonStr, full: `${latStr}, ${lonStr}` };
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

    const subSolar = vector3ToLatLon(sunPos);
    const subEarth = vector3ToLatLon(earthPos);

    return {
      sunPos,
      earthPos,
      subSolar,
      subEarth,
      sunEntry,
      earthEntry,
      hour,
      success: true
    };
  } catch (err) {
    console.warn('Ephemeris fetch fallback:', err);
    const sunPos = new THREE.Vector3(28, 12, -45);
    const earthPos = new THREE.Vector3(-14, 6, -24);
    const subSolar = vector3ToLatLon(sunPos);
    const subEarth = vector3ToLatLon(earthPos);

    return {
      sunPos,
      earthPos,
      subSolar,
      subEarth,
      sunEntry: { angle: 90, elevation: -15 },
      earthEntry: { angle: 0, elevation: 85 },
      hour,
      success: false
    };
  }
}
