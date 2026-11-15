import getLunarData from '../../backend/Lunarfunction.js';
import * as THREE from 'three';

const pad = (n) => String(n).padStart(2, '0');

export function getDateRange20Days(baseDate = new Date()) {
  const hour = baseDate.getHours();
  const dStart = new Date(baseDate.getTime() - 10 * 86400000);
  const dEnd = new Date(baseDate.getTime() + 10 * 86400000);

  const startTime = `${dStart.getFullYear()}-${pad(dStart.getMonth() + 1)}-${pad(dStart.getDate())} ${pad(hour)}:00`;
  const stopTime = `${dEnd.getFullYear()}-${pad(dEnd.getMonth() + 1)}-${pad(dEnd.getDate())} ${pad(hour)}:00`;

  return { startTime, stopTime, hour, startDate: dStart, endDate: dEnd, now: baseDate };
}

export function getTodayDateRange() {
  return getDateRange20Days();
}

export const SUN_DISTANCE = 52.0;
export const EARTH_DISTANCE = 28.0;

/**
 * Transforms topocentric (local observer horizon) Azimuth and Elevation at a given site (lat, lon)
 * into a true Selenographic 3D Cartesian Vector3.
 *
 * Coordinate frame aligned with Moon body and Three.js scene:
 * - +Y: North Pole (+90° lat)
 * - +Z: Prime Meridian Center (0° lat, 0° lon)
 * - +X: Eastern Limb (0° lat, +90° lon)
 *
 * Basis vectors:
 * - Zenith: unit normal at (lat, lon) pointing radially outward from Moon center
 * - North: tangent unit vector pointing toward North Pole (+Y) along meridian
 * - East: tangent unit vector pointing toward East limb (+X) (East = North x Zenith)
 * - Vector: sin(az)*cos(el)*East + cos(az)*cos(el)*North + sin(el)*Zenith
 */
export function topocentricToSelenographic(azDeg, elDeg, siteLatDeg = 0, siteLonDeg = 0, radius = 1.0) {
  const latRad = (siteLatDeg * Math.PI) / 180;
  const lonRad = (siteLonDeg * Math.PI) / 180;
  const azRad = (azDeg * Math.PI) / 180;
  const elRad = (elDeg * Math.PI) / 180;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const sinAz = Math.sin(azRad);
  const cosAz = Math.cos(azRad);
  const sinEl = Math.sin(elRad);
  const cosEl = Math.cos(elRad);

  // Basis vectors in Selenographic world coordinates:
  const zx = cosLat * sinLon;
  const zy = sinLat;
  const zz = cosLat * cosLon;

  const nx = -sinLat * sinLon;
  const ny = cosLat;
  const nz = -sinLat * cosLon;

  const ex = cosLon;
  const ey = 0;
  const ez = -sinLon;

  const x = radius * (cosEl * sinAz * ex + cosEl * cosAz * nx + sinEl * zx);
  const y = radius * (cosEl * sinAz * ey + cosEl * cosAz * ny + sinEl * zy);
  const z = radius * (cosEl * sinAz * ez + cosEl * cosAz * nz + sinEl * zz);

  return new THREE.Vector3(x, y, z);
}

/**
 * Converts Azimuth and Elevation (degrees) into a 3D Cartesian Vector3 at the Moon center (0°N, 0°E).
 */
export function azElToVector3(azDeg, elDeg, radius = 1.0) {
  return topocentricToSelenographic(azDeg, elDeg, 0, 0, radius);
}

/**
 * Calculates 3D celestial positions and selenographic sub-solar / sub-earth coordinates
 * for a given pair of Sun and Earth ephemeris entries at the observer site.
 */
export function calculateCelestialPositions(sunEntry, earthEntry, siteLatDeg = 0, siteLonDeg = 0) {
  const sEntry = sunEntry || { angle: 90, elevation: -15 };
  const eEntry = earthEntry || { angle: 0, elevation: 85 };

  const sunPos = topocentricToSelenographic(sEntry.angle, sEntry.elevation, siteLatDeg, siteLonDeg, SUN_DISTANCE);
  const earthPos = topocentricToSelenographic(eEntry.angle, eEntry.elevation, siteLatDeg, siteLonDeg, EARTH_DISTANCE);

  const subSolar = vector3ToLatLon(sunPos);
  const subEarth = vector3ToLatLon(earthPos);

  return {
    sunPos,
    earthPos,
    subSolar,
    subEarth,
    sunEntry: sEntry,
    earthEntry: eEntry
  };
}

/**
 * Calculates realistic Earth rotation angle (in radians) around its polar axis using lunar ephemeris data.
 * - Aligns Greenwich (0° longitude) with the Sun at 12:00 UTC (solar noon).
 * - Progresses by 15° per hour (2π / 24 rad) across the Horizons 20-day dataset.
 * - Rotates West-to-East in standard Selenographic orientation.
 *
 * @param {object} positions Active lunar positions object
 * @param {number} [baselineHour=12] Baseline dataset hour (defaults to 12)
 * @returns {number} Earth rotation angle in radians around Y axis
 */
export function calculateEarthRotation(positions, baselineHour = 12) {
  if (!positions) return 0;

  const sPos = positions.sunPos || new THREE.Vector3(52, 0, 0);
  const ePos = positions.earthPos || new THREE.Vector3(0, 0, 28);

  // Direction vector from Earth to Sun in horizontal Selenographic plane
  const sunDir = new THREE.Vector3().subVectors(sPos, ePos).normalize();
  const phiSun = Math.atan2(sunDir.x, sunDir.z);

  // Determine step index from 481-hour dataset (0 to 480)
  let stepDiff = 0;
  if (typeof positions.currentIndex === 'number') {
    stepDiff = positions.currentIndex - 240;
  }

  let baseH = baselineHour;
  if (typeof positions.hour === 'number' && baselineHour === 12) {
    baseH = positions.hour;
  } else if (positions.sunEntry?.time || positions.time) {
    const timeStr = positions.sunEntry?.time || positions.time || '';
    const m = timeStr.trim().match(/(\d{4})-([A-Za-z0-9]+)-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
    if (m && baselineHour === 12) {
      baseH = parseInt(m[4], 10) + parseInt(m[5], 10) / 60;
    }
  }

  // Hour offset relative to baseline step (240) and solar noon
  const hourOffset = (baseH - 12) + stepDiff;

  // Align Greenwich with solar noon and rotate West-to-East (15°/h)
  return phiSun + hourOffset * (Math.PI / 12) - Math.PI / 2;
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

/**
 * Converts signed decimal coordinates into readable directional coordinates (N, S, E, W)
 * based on the Selenographic coordinate frame:
 * - Latitude: North-positive (>= 0 is N, < 0 is S)
 * - Longitude: East-positive (>= 0 is E, < 0 is W)
 *
 * @param {number|string} lat Signed latitude in decimal degrees (-90 to +90)
 * @param {number|string} lon Signed longitude in decimal degrees (-180 to +180)
 * @param {object} [options]
 * @param {number|null} [options.precision=null] Decimal places to round to (null preserves exact precision)
 * @param {string} [options.space=''] Space between degrees and direction ("47.77°S" vs "47.77° S")
 * @returns {object} Formatted directional coordinate object
 */
export function convertToDirectionalCoords(lat, lon, options = {}) {
  const { precision = null, space = '' } = options;

  const latNum = Number(lat) || 0;
  const lonNum = Number(lon) || 0;

  const latDir = latNum >= 0 ? 'N' : 'S';
  const lonDir = lonNum >= 0 ? 'E' : 'W';

  const absLat = Math.abs(latNum);
  const absLon = Math.abs(lonNum);

  const latValStr = precision !== null ? absLat.toFixed(precision) : String(absLat);
  const lonValStr = precision !== null ? absLon.toFixed(precision) : String(absLon);

  const latStr = `${latValStr}°${space}${latDir}`;
  const lonStr = `${lonValStr}°${space}${lonDir}`;

  return {
    latStr,
    lonStr,
    latitude: latStr,
    longitude: lonStr,
    text: `${latStr}, ${lonStr}`,
    full: `${latStr}, ${lonStr}`,
    latDir,
    lonDir,
    latVal: absLat,
    lonVal: absLon,
    rawLat: latNum,
    rawLon: lonNum
  };
}

/**
 * Parses user-typed coordinate strings into signed decimal numbers.
 * Supports decimal degrees ("26.1322", "-14.5") and directional notation ("26.132° N", "14.5S", "45.2° W").
 *
 * @param {string|number} input Raw coordinate input
 * @param {boolean} [isLatitude=true] True if parsing latitude (-90 to +90), false for longitude (-180 to +180)
 * @returns {number|null} Parsed coordinate rounded to 4 decimals, or null if invalid
 */
export function parseCoordinateInput(input, isLatitude = true) {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!s) return null;

  const upper = s.toUpperCase();
  const hasSouth = upper.includes('S');
  const hasNorth = upper.includes('N');
  const hasWest = upper.includes('W');
  const hasEast = upper.includes('E');

  // Match numbers (integer or floating point, optional leading sign)
  const match = s.match(/[-+]?\d*\.?\d+/);
  if (!match) return null;

  let val = parseFloat(match[0]);
  if (isNaN(val)) return null;

  if (isLatitude) {
    if (hasSouth) val = -Math.abs(val);
    else if (hasNorth) val = Math.abs(val);
    val = Math.max(-90, Math.min(90, val));
  } else {
    if (hasWest) val = -Math.abs(val);
    else if (hasEast) val = Math.abs(val);
    val = Math.max(-180, Math.min(180, val));
  }

  return Number(val.toFixed(4));
}

/**
 * Convenience helper to convert a place object (e.g. from Places.json).
 *
 * @param {object} place Place object with latitude and longitude properties
 * @param {object} [options]
 * @returns {object} Augmented place object with directional coordinate strings
 */
export function convertPlaceCoordinates(place, options = {}) {
  if (!place || typeof place !== 'object') return null;
  const directional = convertToDirectionalCoords(place.latitude, place.longitude, options);
  return {
    ...place,
    directionalCoords: directional,
    coordsFormatted: directional.text
  };
}

export async function fetchCurrentLunarPositions(lat = 0, lon = 0, customRange = null) {
  let startTime, stopTime, hour, startDate, endDate, now;
  const pad = (n) => String(n).padStart(2, '0');

  if (customRange?.startDate && customRange?.endDate) {
    now = new Date();
    hour = now.getHours();
    startDate = typeof customRange.startDate === 'string'
      ? new Date(customRange.startDate + (customRange.startDate.length === 10 ? 'T00:00:00' : ''))
      : customRange.startDate;
    endDate = typeof customRange.endDate === 'string'
      ? new Date(customRange.endDate + (customRange.endDate.length === 10 ? 'T23:00:00' : ''))
      : customRange.endDate;

    startTime = customRange.startTime || `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())} ${pad(startDate.getHours())}:00`;
    stopTime = customRange.stopTime || `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())} ${pad(endDate.getHours())}:00`;
  } else {
    const range = getDateRange20Days();
    startTime = range.startTime;
    stopTime = range.stopTime;
    hour = range.hour;
    startDate = range.startDate;
    endDate = range.endDate;
    now = range.now;
  }
  try {
    const data = await getLunarData(lat, lon, { startTime, stopTime });
    const sunList = Array.isArray(data.sun) ? data.sun : [];
    const earthList = Array.isArray(data.earth) ? data.earth : [];

    // Find today's current hour in dataset if present; otherwise default to midpoint
    let currentIndex = 0;
    if (sunList.length > 0) {
      const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(hour)}:00`;
      const foundIdx = sunList.findIndex((e) => e.time && e.time.startsWith(todayIso));
      if (foundIdx >= 0) {
        currentIndex = foundIdx;
      } else {
        currentIndex = Math.min(240, Math.floor(sunList.length / 2));
      }
      if (currentIndex >= sunList.length) currentIndex = sunList.length - 1;
    }

    const sunEntry = sunList[currentIndex] || sunList[0] || { angle: 90, elevation: -15, time: startTime };
    const earthEntry = earthList[currentIndex] || earthList[0] || { angle: 0, elevation: 85, time: startTime };

    const { sunPos, earthPos, subSolar, subEarth } = calculateCelestialPositions(sunEntry, earthEntry, lat, lon);

    return {
      sunPos,
      earthPos,
      subSolar,
      subEarth,
      sunEntry,
      earthEntry,
      hour,
      currentIndex,
      dataset: data,
      timeRange: { startTime, stopTime, startDate, endDate },
      success: true
    };
  } catch (err) {
    console.warn('Ephemeris fetch fallback:', err);
    const totalSteps = Math.max(2, Math.round((endDate.getTime() - startDate.getTime()) / 3600000) + 1);
    const fallbackSun = [];
    const fallbackEarth = [];
    const startMs = startDate.getTime();

    for (let i = 0; i < totalSteps; i++) {
      const stepDate = new Date(startMs + i * 3600000);
      const angle = (i * 0.5) % 360;
      // Solar elevation oscillates through lunar day/night (~29.5 day cycle)
      const elev = 1.5 * Math.sin(((i - 120) / Math.max(1, totalSteps - 1)) * 2 * Math.PI);
      const timeStr = `${stepDate.getFullYear()}-${pad(stepDate.getMonth() + 1)}-${pad(stepDate.getDate())} ${pad(stepDate.getHours())}:00`;

      fallbackSun.push({ time: timeStr, angle, elevation: elev });
      fallbackEarth.push({ time: timeStr, angle: 45, elevation: 5.0 });
    }

    const currentIndex = Math.min(240, Math.floor(totalSteps / 2));
    const sunEntry = fallbackSun[currentIndex];
    const earthEntry = fallbackEarth[currentIndex];
    const { sunPos, earthPos, subSolar, subEarth } = calculateCelestialPositions(sunEntry, earthEntry, lat, lon);

    const fallbackDataset = {
      coordinates: { latitude: lat, longitude: lon, altitudeKm: 0, elevationM: 0 },
      sun: fallbackSun,
      earth: fallbackEarth,
      summary: {
        'Power %': 50,
        'Comms %': 100,
        'Both %': 50,
        bestWindow: null
      }
    };

    return {
      sunPos,
      earthPos,
      subSolar,
      subEarth,
      sunEntry,
      earthEntry,
      hour,
      currentIndex,
      dataset: fallbackDataset,
      timeRange: { startTime, stopTime, startDate, endDate },
      success: false
    };
  }
}

/**
 * Calculates the total Optimal value (hours where solar elevation > 0 and earth elevation > 2)
 * for an ephemeris dataset.
 *
 * @param {Array} sunArr Array of solar ephemeris entries
 * @param {Array} earthArr Array of earth ephemeris entries
 * @returns {number} Total hours of simultaneous power and communication
 */
export function calculateOptimalValue(sunArr, earthArr) {
  if (!sunArr?.length || !earthArr?.length) return 0;
  const n = Math.min(sunArr.length, earthArr.length);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const isPower = (sunArr[i]?.elevation ?? -15) > 0;
    const isComms = (earthArr[i]?.elevation ?? -15) > 2;
    if (isPower && isComms) count++;
  }
  return count;
}

/**
 * Compares two sample datasets and determines the optimal sample based on higher Optimal value.
 *
 * @param {Array} sunArr1 Sample 1 sun array
 * @param {Array} earthArr1 Sample 1 earth array
 * @param {Array} sunArr2 Sample 2 sun array
 * @param {Array} earthArr2 Sample 2 earth array
 * @returns {{ optimalSample: number|null, OptimalSample: number|null, optimalValue: number, higherOptimalValue: number, sample1Value: number, sample2Value: number }}
 */
export function determineOptimalSample(sunArr1, earthArr1, sunArr2, earthArr2) {
  const sample1Value = calculateOptimalValue(sunArr1, earthArr1);
  const sample2Value = calculateOptimalValue(sunArr2, earthArr2);
  const higherOptimalValue = Math.max(sample1Value, sample2Value);

  let optimalSample = null;
  if (sample1Value > 0 || sample2Value > 0) {
    optimalSample = sample1Value >= sample2Value ? 1 : 2;
  }

  return {
    optimalSample,
    OptimalSample: optimalSample,
    optimalValue: higherOptimalValue,
    higherOptimalValue,
    sample1Value,
    sample2Value
  };
}
