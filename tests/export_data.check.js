import assert from 'node:assert';
import {
  getAllExportableSites,
  getDaysDiff,
  offsetDays,
  computeTelemetryIntervals,
  generateExportPayload
} from '../src/lib/exportUtils.js';

console.log('Testing Lunar Data Export Utility Logic...');

// 1. Test Site Retrieval & Formatting
const allSites = getAllExportableSites();
assert.ok(Array.isArray(allSites), 'allSites should be an array');
assert.ok(allSites.length >= 17, `Expected at least 17 sites, got ${allSites.length}`);

// Check historic landing sites
const apollo11 = allSites.find((s) => s.name === 'Apollo 11');
assert.ok(apollo11, 'Apollo 11 must be present in exportable sites');
assert.strictEqual(typeof apollo11.lat, 'number', 'Apollo 11 lat must be number');
assert.strictEqual(typeof apollo11.lon, 'number', 'Apollo 11 lon must be number');
assert.strictEqual(apollo11.isLandingSite, true, 'Apollo 11 is landing site');

const apollo15 = allSites.find((s) => s.name === 'Apollo 15');
assert.ok(apollo15, 'Apollo 15 must be present');
assert.strictEqual(apollo15.lat, 26.132, 'Apollo 15 latitude');

const ch3 = allSites.find((s) => s.name === 'Chandrayaan-3 Vikram');
assert.ok(ch3, 'Chandrayaan-3 Vikram must be present');
assert.strictEqual(ch3.country, 'India', 'Chandrayaan-3 country');

// Check lunar plains & landmarks
const oceanus = allSites.find((s) => s.name === 'Oceanus Procellarum');
assert.ok(oceanus, 'Oceanus Procellarum must be present');
assert.strictEqual(typeof oceanus.lat, 'number', 'Oceanus lat must be number');
assert.strictEqual(typeof oceanus.lon, 'number', 'Oceanus lon must be number');

// Test custom location inclusion
const customSites = getAllExportableSites({ name: 'Shackleton Crater Base', lat: -89.9, lon: 0.0 });
const shackleton = customSites.find((s) => s.name === 'Shackleton Crater Base');
assert.ok(shackleton, 'Custom site should be prepended to site list');
assert.strictEqual(shackleton.isCustom, true, 'isCustom flag should be set');
assert.strictEqual(customSites.length, allSites.length + 1, 'Site count incremented by 1');

console.log('✔ All exportable lunar sites retrieved and validated.');

// 2. Test Date Utilities
assert.strictEqual(getDaysDiff('2026-03-01', '2026-03-21'), 20, '20 days difference');
assert.strictEqual(offsetDays('2026-03-01', 20), '2026-03-21', 'Offsetting 20 days gives 2026-03-21');
assert.strictEqual(offsetDays('2026-03-01', 29), '2026-03-30', 'Lunar synodic approximation');

console.log('✔ Date diff and offset utilities verified.');

// 3. Test Telemetry Interval Computation
const mockSun = [{ elevation: 5 }, { elevation: 8 }, { elevation: -5 }, { elevation: -10 }];
const mockEarth = [{ elevation: 10 }, { elevation: 1 }, { elevation: 5 }, { elevation: 5 }];
const intervals = computeTelemetryIntervals(mockSun, mockEarth);

assert.strictEqual(intervals.power.length, 1, '1 power run');
assert.strictEqual(intervals.power[0].endStep, 1, 'Power ends at step 1');
assert.strictEqual(intervals.optimal.length, 1, '1 optimal interval');
assert.strictEqual(intervals.optimal[0].startStep, 0, 'Optimal starts at step 0');
assert.strictEqual(intervals.dark.length, 1, '1 dark run');
assert.strictEqual(intervals.dark[0].startStep, 2, 'Dark starts at step 2');

console.log('✔ Telemetry intervals computation verified.');

// 4. Test Multi-Site JSON Export Payload Generation (No Limit!)
async function testExportPayload() {
  // Select multiple sites without limit: e.g. 5 sites
  const selected = [
    allSites[0],
    allSites[1],
    allSites[2],
    allSites[3],
    allSites[4]
  ];

  // Custom date override for site 2
  const customDates = {
    [allSites[1].id]: { startDate: '2026-04-01', endDate: '2026-04-15' }
  };

  // Mock ephemeris fetcher
  const mockFetchEphemeris = async (lat, lon, { startDate, endDate }) => ({
    dataset: {
      sun: [{ elevation: 10 }, { elevation: 12 }, { elevation: 14 }],
      earth: [{ elevation: 8 }, { elevation: 9 }, { elevation: 10 }]
    }
  });

  const progressEvents = [];
  const payload = await generateExportPayload({
    selectedSites: selected,
    defaultStartDate: '2026-03-01',
    defaultEndDate: '2026-03-21',
    customDatesMap: customDates,
    fetchEphemerisFn: mockFetchEphemeris,
    onProgress: (p) => progressEvents.push(p)
  });

  assert.strictEqual(payload.totalSitesExported, 5, 'Total exported sites count must be 5');
  assert.strictEqual(payload.sites.length, 5, 'Sites array length must be 5');
  assert.strictEqual(progressEvents.length, 5, '5 progress events must be fired');

  // Check first site (uses default dates)
  const site0 = payload.sites[0];
  assert.strictEqual(site0.missionWindow.startDate, '2026-03-01', 'Site 0 start date');
  assert.strictEqual(site0.missionWindow.endDate, '2026-03-21', 'Site 0 end date');
  assert.strictEqual(site0.missionWindow.durationDays, 20, 'Site 0 duration in days');
  assert.ok(site0.site.coordinates.formattedLatitude, 'Directional latitude formatted');
  assert.ok(site0.site.coordinates.formattedLongitude, 'Directional longitude formatted');
  assert.strictEqual(site0.analysis.optimalWindowHours, 3, 'Site 0 optimal window hours');
  assert.strictEqual(site0.analysis.powerHours, 3, 'Site 0 power hours');
  assert.strictEqual(site0.analysis.commsHours, 3, 'Site 0 comms hours');

  // Check second site (uses custom date override)
  const site1 = payload.sites[1];
  assert.strictEqual(site1.missionWindow.startDate, '2026-04-01', 'Site 1 custom start date');
  assert.strictEqual(site1.missionWindow.endDate, '2026-04-15', 'Site 1 custom end date');
  assert.strictEqual(site1.missionWindow.durationDays, 14, 'Site 1 duration 14 days');

  // Test full export of ALL sites (17+ sites, testing unlimited selection)
  const allPayload = await generateExportPayload({
    selectedSites: allSites,
    defaultStartDate: '2026-05-01',
    defaultEndDate: '2026-05-21'
  });

  assert.strictEqual(allPayload.totalSitesExported, allSites.length, 'All sites can be selected with no limit');
  assert.strictEqual(allPayload.sites.length, allSites.length);

  // Validate JSON serialization
  const jsonString = JSON.stringify(payload, null, 2);
  const parsed = JSON.parse(jsonString);
  assert.strictEqual(parsed.exportTitle, 'Selene Lunar Mission Site Ephemeris & Data');
  assert.strictEqual(parsed.totalSitesExported, 5);
  assert.ok(parsed.exportTimestamp, 'ISO timestamp must be present');

  console.log('✔ JSON export payload schema and unlimited multi-site generation verified.');
}

testExportPayload()
  .then(() => {
    console.log('\nALL LUNAR DATA EXPORT TESTS PASSED SUCCESSFULLY!');
  })
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
