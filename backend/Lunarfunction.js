// Fetch Sun and Earth azimuth/elevation from a lunar south pole point with DEM terrain occlusion.
// Run: node backend/Lunarfunction.js  (Node 18+)

export const lat = 45.4561;
export const lon = 177.5885;  // Von Kármán Crater

export const SUN_RADIUS = 0.27;   // degrees
export const EARTH_MIN_ELEV = 2;  // degrees; set to 0 for the ideal case
export const R_MOON = 1737400.0;  // mean lunar radius in meters

let cachedDem = null;

const DEFAULT_META_80M = {
  width: 1896,
  height: 1896,
  dtype: "int16",
  endian: "little",
  scale: 0.5,
  offset: 1737400.0,
  metersPerPixel: 80.0,
  projection: "polar stereographic, south pole, center lon 0",
  refRadiusKm: 1737.4,
  maxLat: -87.5,
  minLat: -90.0,
  lineProjectionOffset: 947.875,
  sampleProjectionOffset: 947.875,
  source: "LDEM_875S_20M.IMG",
};

const DEFAULT_META_320M = {
  width: 1900,
  height: 1900,
  dtype: "int16",
  endian: "little",
  scale: 0.5,
  offset: 1737400.0,
  metersPerPixel: 320.0,
  projection: "polar stereographic, south pole, center lon 0",
  refRadiusKm: 1737.4,
};

/**
 * Loads the LOLA Digital Elevation Model (DEM) and metadata.
 * Works in both browser environments (fetch) and Node.js environments (fs fallback).
 */
export async function loadDem(
  binSource = null,
  jsonSource = null
) {
  let meta, buf;

  // Node.js local filesystem loader
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const fs = await import(/* @vite-ignore */ "node:fs");
      const path = await import(/* @vite-ignore */ "node:path");
      const { fileURLToPath } = await import(/* @vite-ignore */ "node:url");

      const scriptDir = path.dirname(fileURLToPath(import.meta.url));
      const candidates = [
        (p) => p,
        (p) => path.join(scriptDir, p),
        (p) => path.join(scriptDir, "backend", p),
        (p) => path.join(process.cwd(), p),
        (p) => path.join(process.cwd(), "backend", p),
      ];

      const searchSources = [
        { b: binSource || "south_pole_875s_80m.bin", j: jsonSource || "south_pole_875s_80m.bin.json", defaultMeta: DEFAULT_META_80M },
        { b: "south_pole_320m.bin", j: "south_pole_320m.bin.json", defaultMeta: DEFAULT_META_320M },
      ];

      for (const src of searchSources) {
        for (const getPath of candidates) {
          const jPath = getPath(src.j);
          const bPath = getPath(src.b);
          if (fs.existsSync(bPath)) {
            const fileBuf = fs.readFileSync(bPath);
            buf = fileBuf.buffer.slice(
              fileBuf.byteOffset,
              fileBuf.byteOffset + fileBuf.byteLength
            );
            if (fs.existsSync(jPath)) {
              meta = JSON.parse(fs.readFileSync(jPath, "utf8"));
            } else {
              meta = src.defaultMeta;
            }
            break;
          }
        }
        if (meta && buf) break;
      }
    } catch {
      // fallback to fetch below
    }
  }

  // Web fetch loader (browser / URL fallback)
  if (!meta || !buf) {
    const defaultBin = new URL("./south_pole_875s_80m.bin", import.meta.url).href;
    const defaultJson = new URL("./south_pole_875s_80m.bin.json", import.meta.url).href;
    const candidates = [
      { b: binSource || defaultBin, j: jsonSource || defaultJson, defaultMeta: DEFAULT_META_80M },
      { b: "/backend/south_pole_875s_80m.bin", j: "/backend/south_pole_875s_80m.bin.json", defaultMeta: DEFAULT_META_80M },
      { b: new URL("./south_pole_320m.bin", import.meta.url).href, j: new URL("./south_pole_320m.bin.json", import.meta.url).href, defaultMeta: DEFAULT_META_320M },
      { b: "/backend/south_pole_320m.bin", j: "/backend/south_pole_320m.bin.json", defaultMeta: DEFAULT_META_320M },
    ];

    for (const c of candidates) {
      try {
        const bRes = await fetch(c.b);
        if (!bRes.ok) continue;
        buf = await bRes.arrayBuffer();

        try {
          const jRes = await fetch(c.j);
          if (jRes.ok) {
            meta = await jRes.json();
          }
        } catch {}

        if (!meta) meta = c.defaultMeta;
        if (buf && meta) break;
      } catch {
        // try next candidate
      }
    }
  }

  if (!meta || !buf) {
    throw new Error("Failed to load lunar DEM data (both local filesystem and web fetch failed).");
  }

  const dem = new Int16Array(buf); // length = width * height
  const heightM = (x, y) => {
    if (x < 0 || x >= meta.width || y < 0 || y >= meta.height) return null;
    return dem[y * meta.width + x] * meta.scale + meta.offset;
  };

  return { meta, dem, heightM };
}

/**
 * Converts Lunar South Polar Stereographic (lat, lon) to DEM pixel coordinates (px, py).
 * Latitude is negative (e.g., -89.9 deg), Longitude is East degrees (-180 to 180 or 0 to 360).
 */
export function latLonToPixel(latDeg, lonDeg, meta) {
  const rMoon = meta?.refRadiusKm ? meta.refRadiusKm * 1000 : R_MOON;
  const mpp = meta?.metersPerPixel || 320.0;
  const cx = ((meta?.width || 1900) - 1) / 2.0;
  const cy = ((meta?.height || 1900) - 1) / 2.0;

  const latRad = (latDeg * Math.PI) / 180.0;
  const lonRad = (lonDeg * Math.PI) / 180.0;
  const r = 2.0 * rMoon * Math.tan((Math.PI / 2.0 + latRad) / 2.0);
  const x = r * Math.sin(lonRad);
  const y = r * Math.cos(lonRad);
  const px = cx + x / mpp;
  const py = cy - y / mpp;
  return { px, py, x, y };
}

/**
 * Converts DEM pixel coordinates (px, py) to (lat, lon) in degrees.
 */
export function pixelToLatLon(px, py, meta) {
  const rMoon = meta?.refRadiusKm ? meta.refRadiusKm * 1000 : R_MOON;
  const mpp = meta?.metersPerPixel || 320.0;
  const cx = ((meta?.width || 1900) - 1) / 2.0;
  const cy = ((meta?.height || 1900) - 1) / 2.0;

  const x = (px - cx) * mpp;
  const y = (cy - py) * mpp;
  const r = Math.sqrt(x * x + y * y);
  const lonDeg = (Math.atan2(x, y) * 180.0) / Math.PI;
  const latDeg = -90.0 + (2.0 * Math.atan(r / (2.0 * rMoon)) * 180.0) / Math.PI;
  return { lat: latDeg, lon: lonDeg };
}

/**
 * Retrieves the surface radius and altitude relative to the reference sphere (1737.4 km).
 */
export function getSiteElevation(latDeg, lonDeg, demData) {
  const { meta, heightM } = demData;
  const { px, py } = latLonToPixel(latDeg, lonDeg, meta);
  const ix = Math.round(px);
  const iy = Math.round(py);

  if (ix < 0 || ix >= meta.width || iy < 0 || iy >= meta.height) {
    return { radiusM: meta.offset, altitudeM: 0, altitudeKm: 0, px, py, ix, iy };
  }

  const radiusM = heightM(ix, iy);
  const altitudeM = radiusM - meta.offset;
  const altitudeKm = altitudeM / 1000.0;
  return { radiusM, altitudeM, altitudeKm, px, py, ix, iy };
}

/**
 * Computes a 360-degree topographic horizon elevation mask (0° to 359° in azimuth)
 * by raymarching the DEM with lunar spherical curvature drop accounted for.
 *
 * @param {number} latDeg - Observer latitude (-90 to -80 deg)
 * @param {number} lonDeg - Observer east longitude (-180 to 180 deg)
 * @param {object} demData - Result from loadDem()
 * @param {object} options - { maxDistanceKm: 80, stepM: 320, mastHeightM: 2.0 }
 * @returns {Float32Array} 360 horizon elevation angles in degrees above horizontal
 */
export function computeHorizonMask(latDeg, lonDeg, demData, options = {}) {
  const { meta, heightM } = demData;
  const maxDistanceKm = options.maxDistanceKm ?? 80;
  const stepM = options.stepM ?? meta.metersPerPixel ?? 320;
  const mastHeightM = options.mastHeightM ?? 2.0;
  const rMoon = meta.refRadiusKm ? meta.refRadiusKm * 1000 : R_MOON;
  const mpp = meta.metersPerPixel ?? 320.0;

  const { px: px0, py: py0 } = latLonToPixel(latDeg, lonDeg, meta);
  const ix0 = Math.round(px0);
  const iy0 = Math.round(py0);

  if (ix0 < 0 || ix0 >= meta.width || iy0 < 0 || iy0 >= meta.height) {
    return new Float32Array(360);
  }

  const h0 = heightM(ix0, iy0) + mastHeightM;
  const maxSteps = Math.floor((maxDistanceKm * 1000) / stepM);
  const angles = new Float32Array(360);

  for (let az = 0; az < 360; az++) {
    // Azimuth measured clockwise from local North towards East
    const angleRad = ((lonDeg + az) * Math.PI) / 180.0;
    const sinA = Math.sin(angleRad);
    const cosA = Math.cos(angleRad);

    let maxTan = -Infinity;
    for (let step = 1; step <= maxSteps; step++) {
      const dist = step * stepM;
      const px = Math.round(px0 + (dist * sinA) / mpp);
      const py = Math.round(py0 - (dist * cosA) / mpp);

      if (px < 0 || px >= meta.width || py < 0 || py >= meta.height) break;

      const h = heightM(px, py);
      const curvDrop = (dist * dist) / (2.0 * rMoon);
      const tanElev = (h - h0 - curvDrop) / dist;
      if (tanElev > maxTan) maxTan = tanElev;
    }
    angles[az] = (Math.atan(maxTan) * 180.0) / Math.PI;
  }

  return angles;
}

/**
 * Linearly interpolates horizon elevation angle for any azimuth (degrees).
 */
export function getHorizonElevation(angles, azDeg) {
  if (!angles) return 0;
  const az = ((azDeg % 360) + 360) % 360;
  const i0 = Math.floor(az);
  const i1 = (i0 + 1) % 360;
  const frac = az - i0;
  return angles[i0] * (1 - frac) + angles[i1] * frac;
}

// Fraction (0..1) of the Sun's disk above the local horizon (terrain-corrected)
export function sunVisibleFraction(elev, horizonElev = 0) {
  const effectiveElev = elev - horizonElev;
  const t = Math.max(-1, Math.min(1, -effectiveElev / SUN_RADIUS));
  return (Math.acos(t) - t * Math.sqrt(1 - t * t)) / Math.PI;
}

// Earth line-of-sight visibility above local terrain horizon with minimum clearance
export const earthVisible = (elev, min = EARTH_MIN_ELEV, horizonElev = 0) => (elev - horizonElev) > min;

// Longest run of consecutive true values -> { start, length } in samples
export function longestRun(flags) {
  let best = { start: -1, length: 0 };
  let cur = { start: 0, length: 0 };
  flags.forEach((f, i) => {
    if (!f) { cur.length = 0; return; }
    if (cur.length === 0) cur.start = i;
    cur.length++;
    if (cur.length > best.length) best = { ...cur };
  });
  return best;
}

export function summarize(sun, earth, horizonMask = null, stepHours = 1) {
  const n = sun.length;
  const sunUp = sun.map((s) => {
    const horiz = horizonMask ? getHorizonElevation(horizonMask, s.angle) : 0;
    return sunVisibleFraction(s.elevation, horiz) > 0;
  });
  const earthUp = earth.map((e) => {
    const horiz = horizonMask ? getHorizonElevation(horizonMask, e.angle) : 0;
    return earthVisible(e.elevation, EARTH_MIN_ELEV, horiz);
  });
  const both = sunUp.map((v, i) => v && earthUp[i]);

  const pct = (arr) => +((100 * arr.filter(Boolean).length) / n).toFixed(1);
  const toWindow = (r) =>
    r.length === 0
      ? null
      : {
          start: sun[r.start].time,
          end: sun[r.start + r.length - 1].time,
          hours: (r.length - 1) * stepHours,
          samples: r.length,
        };

  const res = {
    "Power %": pct(sunUp),
    "Comms %": pct(earthUp),
    "Both %": pct(both),
    bestWindow: toWindow(longestRun(both)),                         // null if none
    longestDarkness: toWindow(longestRun(sunUp.map((v) => !v))),
  };

  if (horizonMask) {
    const flatSunUp = sun.map((s) => sunVisibleFraction(s.elevation, 0) > 0);
    const flatEarthUp = earth.map((e) => earthVisible(e.elevation, EARTH_MIN_ELEV, 0));
    const flatBoth = flatSunUp.map((v, i) => v && flatEarthUp[i]);
    res.flatBaseline = {
      "Power %": pct(flatSunUp),
      "Comms %": pct(flatEarthUp),
      "Both %": pct(flatBoth),
      bestWindow: toWindow(longestRun(flatBoth)),
      longestDarkness: toWindow(longestRun(flatSunUp.map((v) => !v))),
    };
  }

  return res;
}

export function parseEphemeris(result) {
  // Rows live between $$SOE and $$EOE
  return result
    .split("$$SOE")[1]
    .split("$$EOE")[0]
    .trim()
    .split("\n")
    .map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      const nums = cols.slice(1).filter((c) => c !== "" && !isNaN(c)).map(Number);
      return {
        time: cols[0],
        angle: nums[nums.length - 2],      // Azimuth angle in degrees
        elevation: nums[nums.length - 1],  // Elevation angle in degrees
      };
    });
}

export async function getSky(
  bodyId,
  siteLat = lat,
  siteLon = lon,
  siteAltKm = 0,
  startTime = "1969-07-20",
  stopTime = "1969-07-21",
  options = {}
) {
  const isBrowser = typeof window !== "undefined";
  const defaultBase = isBrowser
    ? "/api/horizons"
    : "https://ssd.jpl.nasa.gov/api/horizons.api";
  const baseUrl = options.horizonsUrl || defaultBase;

  const params = new URLSearchParams({
    format: "json",
    COMMAND: `'${bodyId}'`,              // 10 = Sun, 399 = Earth
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@301'",               // a point on the Moon
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${siteLon},${siteLat},${siteAltKm}'`, // east lon, lat, altitude (km)
    START_TIME: `'${startTime}'`,
    STOP_TIME: `'${stopTime}'`,          // 30 days range
    STEP_SIZE: "'1h'",                   // Hourly steps
    QUANTITIES: "'4'",                   // azimuth & elevation
    CSV_FORMAT: "'YES'",
  });

  const res = await fetch(`${baseUrl}?${params}`);
  if (!res.ok) {
    throw new Error(`Horizons API request failed: HTTP ${res.status} ${res.statusText}`);
  }
  const { result } = await res.json();
  return parseEphemeris(result);
}

/**
 * Performs complete site analysis including DEM altitude and topographic horizon occlusion.
 * Callable directly with just (lat, lon) or with optional DEM data / settings.
 */
export async function analyzeSite(targetLat = lat, targetLon = lon, demDataOrOptions = null, options = {}) {
  let demData = null;
  let opts = {};

  if (demDataOrOptions && (demDataOrOptions.meta || demDataOrOptions.dem || demDataOrOptions.heightM)) {
    demData = demDataOrOptions;
    opts = options || {};
  } else if (demDataOrOptions && typeof demDataOrOptions === "object") {
    opts = demDataOrOptions;
    demData = opts.demData || null;
  } else {
    opts = options || {};
  }

  if (!demData) {
    if (!cachedDem) {
      cachedDem = await loadDem();
    }
    demData = cachedDem;
  }

  const site = getSiteElevation(targetLat, targetLon, demData);
  const horizonMask = computeHorizonMask(targetLat, targetLon, demData, opts);

  const startTime = opts.startTime || "2027-01-01";
  const stopTime = opts.stopTime || "2027-01-31";

  const sun = await getSky(10, targetLat, targetLon, site.altitudeKm, startTime, stopTime, opts);
  const earth = await getSky(399, targetLat, targetLon, site.altitudeKm, startTime, stopTime, opts);

  const summary = summarize(sun, earth, horizonMask);

  return {
    coordinates: {
      latitude: targetLat,
      longitude: targetLon,
      altitudeKm: site.altitudeKm,
      elevationM: site.altitudeM,
      pixel: { x: site.px, y: site.py },
    },
    horizonMask,
    sun,
    earth,
    summary,
  };
}

export const getLunarData = analyzeSite;
export default analyzeSite;

// Auto-run if executed directly as entrypoint
const isMain =
  typeof process !== "undefined" &&
  Boolean(process.argv?.[1]) &&
  (process.argv[1].endsWith("Lunarfunction.js") ||
    process.argv[1].endsWith("Lunarfunction"));

if (isMain) {
  (async () => {
    try {
      console.log(`Analyzing site lat=${lat.toFixed(4)}, lon=${lon.toFixed(4)}...`);
      const result = await analyzeSite(lat, lon);
      console.log(
        JSON.stringify(
          {
            moonCoordinates: result.coordinates,
            lat,
            lon,
            sun: result.sun,
            earth: result.earth,
            summary: result.summary,
          },
          null,
          2
        )
      );
    } catch (err) {
      console.error("Execution error:", err);
    }
  })();
}
