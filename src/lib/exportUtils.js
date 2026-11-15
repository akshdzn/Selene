import { getHistoricLandingSites, placesData } from './places.js';
import { convertToDirectionalCoords, calculateOptimalValue } from './ephemeris.js';

/**
 * Returns a unified list of all exportable lunar sites.
 * Combines historic landing sites and known lunar landmarks/plains.
 * Also optionally includes the currently selected/active coordinate location.
 *
 * @param {object|null} currentCustomSite Optional active site { name, lat, lon }
 * @returns {Array<object>} Array of site objects
 */
export function getAllExportableSites(currentCustomSite = null) {
  const landingSites = getHistoricLandingSites().map((s) => ({
    id: `landing_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    name: s.name,
    category: 'Historic Landing Sites',
    subType: s.type || 'Lunar Landing Site',
    country: s.country || '',
    lat: s.lat,
    lon: s.lon,
    note: s.note || '',
    isLandingSite: true
  }));

  const places = (placesData.locations || []).map((p) => {
    const lat = p.latitude ?? p.lat;
    const lon = p.longitude ?? p.lon;
    return {
      id: `place_${p.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name: p.name,
      category: p.type || 'Lunar Landmark',
      subType: p.type || 'Lunar Landmark',
      country: '',
      lat,
      lon,
      note: p.diameter_km ? `Diameter: ${Math.round(p.diameter_km)} km` : '',
      isLandingSite: false
    };
  });

  const allSites = [...landingSites, ...places];

  // Optionally include custom active coordinates if not matching any predefined site
  if (
    currentCustomSite &&
    typeof currentCustomSite.lat === 'number' &&
    typeof currentCustomSite.lon === 'number'
  ) {
    const alreadyExists = allSites.some(
      (s) =>
        Math.abs(s.lat - currentCustomSite.lat) < 0.05 &&
        Math.abs(s.lon - currentCustomSite.lon) < 0.05
    );
    if (!alreadyExists) {
      allSites.unshift({
        id: 'custom_active_site',
        name: currentCustomSite.name || 'Current Target Location',
        category: 'Custom Location',
        subType: 'Target Coordinates',
        country: '',
        lat: currentCustomSite.lat,
        lon: currentCustomSite.lon,
        note: 'User-specified target coordinates',
        isLandingSite: false,
        isCustom: true
      });
    }
  }

  return allSites;
}

/**
 * Calculates days difference between two YYYY-MM-DD date strings.
 */
export function getDaysDiff(startStr, endStr) {
  if (!startStr || !endStr) return 20;
  const s = new Date(startStr + 'T00:00:00');
  const e = new Date(endStr + 'T00:00:00');
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

/**
 * Offsets a YYYY-MM-DD date string by a given number of days.
 */
export function offsetDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Computes run intervals (power, comms, optimal, dark) from sun and earth ephemeris arrays.
 */
export function computeIntervals(sunArr = [], earthArr = []) {
  if (!sunArr?.length || !earthArr?.length) {
    return { optimal: [], power: [], comms: [], dark: [] };
  }
  const n = Math.min(sunArr.length, earthArr.length);
  const isPowerAt = (i) => (sunArr[i]?.elevation ?? -15) > 0;
  const isCommsAt = (i) => (earthArr[i]?.elevation ?? -15) > 2;
  const isOptimalAt = (i) => isPowerAt(i) && isCommsAt(i);
  const isDarkAt = (i) => !isPowerAt(i);

  const getRuns = (predicate, type) => {
    const runs = [];
    let cur = null;
    for (let i = 0; i < n; i++) {
      if (predicate(i)) {
        if (!cur) cur = { startStep: i, endStep: i, startTime: sunArr[i]?.time || '', endTime: sunArr[i]?.time || '', type };
        else {
          cur.endStep = i;
          cur.endTime = sunArr[i]?.time || '';
        }
      } else if (cur) {
        runs.push(cur);
        cur = null;
      }
    }
    if (cur) runs.push(cur);
    return runs;
  };

  return {
    optimal: getRuns(isOptimalAt, 'OPTIMAL'),
    power: getRuns(isPowerAt, 'POWER'),
    comms: getRuns(isCommsAt, 'COMMS'),
    dark: getRuns(isDarkAt, 'DARK')
  };
}

export const computeTelemetryIntervals = computeIntervals;

/**
 * Compiles export data for a collection of selected sites and dates.
 *
 * @param {object} options
 * @param {Array<object>} options.selectedSites List of site objects to export
 * @param {string} options.defaultStartDate Start date string (YYYY-MM-DD)
 * @param {string} options.defaultEndDate End date string (YYYY-MM-DD)
 * @param {object} [options.customDatesMap] Map of siteId -> { startDate, endDate } overrides
 * @param {Function} [options.fetchEphemerisFn] Optional async function (lat, lon, { startDate, endDate }) => positions
 * @param {Function} [options.onProgress] Optional callback ({ current, total, siteName })
 * @returns {Promise<object>} Full structured JSON export payload
 */
export async function generateExportPayload({
  selectedSites = [],
  defaultStartDate = '2026-03-01',
  defaultEndDate = '2026-03-21',
  customDatesMap = {},
  fetchEphemerisFn = null,
  onProgress = null
}) {
  const exportTimestamp = new Date().toISOString();
  const sitesData = [];

  for (let i = 0; i < selectedSites.length; i++) {
    const site = selectedSites[i];
    const siteId = site.id || site.name;
    const custom = customDatesMap[siteId];
    const startDate = custom?.startDate || defaultStartDate;
    const endDate = custom?.endDate || defaultEndDate;
    const durationDays = getDaysDiff(startDate, endDate);

    onProgress?.({
      current: i + 1,
      total: selectedSites.length,
      siteName: site.name
    });

    let telemetry = null;
    let analysis = null;
    let intervals = null;

    if (fetchEphemerisFn && typeof site.lat === 'number' && typeof site.lon === 'number') {
      try {
        const pos = await fetchEphemerisFn(site.lat, site.lon, { startDate, endDate });
        if (pos?.dataset) {
          const sunData = Array.isArray(pos.dataset.sun) ? pos.dataset.sun : [];
          const earthData = Array.isArray(pos.dataset.earth) ? pos.dataset.earth : [];
          const optimalWindowHours = calculateOptimalValue(sunData, earthData);

          let powerHours = 0;
          let commsHours = 0;
          let optimalHours = 0;
          let darkHours = 0;

          const n = Math.min(sunData.length, earthData.length);
          for (let idx = 0; idx < n; idx++) {
            const isPower = (sunData[idx]?.elevation ?? -15) > 0;
            const isComms = (earthData[idx]?.elevation ?? -15) > 2;
            if (isPower) powerHours++;
            else darkHours++;
            if (isComms) commsHours++;
            if (isPower && isComms) optimalHours++;
          }

          analysis = {
            optimalWindowHours,
            totalHoursEvaluated: n,
            powerHours,
            commsHours,
            optimalHours,
            darkHours
          };

          intervals = computeIntervals(sunData, earthData);

          telemetry = {
            totalDataPoints: n,
            sun: sunData,
            earth: earthData
          };
        }
      } catch (err) {
        console.warn(`Could not compute ephemeris for ${site.name}:`, err);
      }
    }

    const dirCoords = convertToDirectionalCoords(site.lat, site.lon, { precision: 4, space: ' ' });

    sitesData.push({
      site: {
        name: site.name,
        category: site.category,
        subType: site.subType,
        country: site.country || null,
        note: site.note || null,
        coordinates: {
          latitude: site.lat,
          longitude: site.lon,
          formattedLatitude: dirCoords.latStr,
          formattedLongitude: dirCoords.lonStr
        }
      },
      missionWindow: {
        startDate,
        endDate,
        durationDays
      },
      analysis,
      intervals,
      ephemeris: telemetry,
      telemetry
    });
  }

  return {
    exportTitle: 'Selene Lunar Mission Site Ephemeris & Data',
    exportTimestamp,
    generator: 'Selene Lunar Mission Simulator',
    version: '1.0.0',
    totalSitesExported: sitesData.length,
    defaultMissionWindow: {
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      durationDays: getDaysDiff(defaultStartDate, defaultEndDate)
    },
    sites: sitesData
  };
}

/**
 * Triggers a browser download of the generated JSON payload.
 *
 * @param {object} payload Object to export as JSON
 * @param {string} [filename] Optional custom filename
 */
export function downloadJsonFile(payload, filename = null) {
  const jsonStr = JSON.stringify(payload, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10);
  const actualFilename = filename || `selene-lunar-data-${dateStr}.json`;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = actualFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return actualFilename;
}
