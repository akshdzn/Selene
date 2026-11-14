// Fetch Sun and Earth azimuth/elevation from a random lunar south pole point.
// Run: node test.js  (Node 18+)

const lat = -(85 + Math.random() * 5);   // random latitude, 85S to 90S
const lon = -180 + Math.random() * 360;  // random east longitude

const SUN_RADIUS = 0.27;   // degrees
const EARTH_MIN_ELEV = 2;  // degrees; set to 0 for the ideal case

// Fraction (0..1) of the Sun's disk above a flat horizon
function sunVisibleFraction(elev) {
  const t = Math.max(-1, Math.min(1, -elev / SUN_RADIUS));
  return (Math.acos(t) - t * Math.sqrt(1 - t * t)) / Math.PI;
}

const earthVisible = (elev, min = EARTH_MIN_ELEV) => elev > min;

// Longest run of consecutive true values -> { start, length } in samples
function longestRun(flags) {
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

function summarize(sun, earth, stepHours = 1) {
  const n = sun.length;
  const sunUp   = sun.map((s) => sunVisibleFraction(s.elevation) > 0);
  const earthUp = earth.map((e) => earthVisible(e.elevation));
  const both    = sunUp.map((v, i) => v && earthUp[i]);

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

  return {
    "Power %": pct(sunUp),
    "Comms %": pct(earthUp),
    "Both %": pct(both),
    bestWindow: toWindow(longestRun(both)),                         // null if none
    longestDarkness: toWindow(longestRun(sunUp.map((v) => !v))),
  };
}

function parseEphemeris(result) {
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

async function getSky(bodyId) {
  const params = new URLSearchParams({
    format: "json",
    COMMAND: `'${bodyId}'`,              // 10 = Sun, 399 = Earth
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@301'",               // a point on the Moon
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${lon},${lat},0'`,     // east lon, lat, altitude (km)
    START_TIME: "'2027-01-01'",
    STOP_TIME: "'2027-01-31'",           // 30 days range
    STEP_SIZE: "'1h'",                   // Hourly steps
    QUANTITIES: "'4'",                   // azimuth & elevation
    CSV_FORMAT: "'YES'",
  });

  const res = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`);
  const { result } = await res.json();
  return parseEphemeris(result);
}

if (require.main === module) {
  (async () => {
    const sun = await getSky(10);
    const earth = await getSky(399);
    const summary = summarize(sun, earth);
    console.log(
      JSON.stringify(
        {
          moonCoordinates: {
            latitude: lat,
            longitude: lon,
          },
          lat,
          lon,
          sun,
          earth,
          summary,
        },
        null,
        2
      )
    );
  })();
}

if (typeof module !== "undefined") {
  module.exports = {
    getSky,
    parseEphemeris,
    sunVisibleFraction,
    earthVisible,
    longestRun,
    summarize,
  };
}
