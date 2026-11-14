import assert from 'node:assert/strict';
import { convertToDirectionalCoords, convertPlaceCoordinates } from '../src/lib/ephemeris.js';
import placesData from '../src/lib/Places.json' with { type: 'json' };

console.log('Testing convertToDirectionalCoords with Places.json entries...');

// 1. Test all 8 locations from Places.json
const expectedResults = {
  'Oceanus Procellarum': { latDir: 'N', lonDir: 'W', text: '20.6714°N, 56.6774°W' },
  'Mare Frigoris': { latDir: 'N', lonDir: 'W', text: '57.5923°N, 0.0064°W' },
  'Mare Imbrium': { latDir: 'N', lonDir: 'W', text: '34.7244°N, 14.9086°W' },
  'Mare Australe': { latDir: 'S', lonDir: 'E', text: '47.7705°S, 91.9854°E' },
  'Montes Cordillera': { latDir: 'S', lonDir: 'W', text: '19.4358°S, 94.931°W' },
  'Mare Tranquillitatis': { latDir: 'N', lonDir: 'E', text: '8.35°N, 30.83°E' },
  'Mare Fecunditatis': { latDir: 'S', lonDir: 'E', text: '7.84°S, 53.67°E' },
  'Mare Nubium': { latDir: 'S', lonDir: 'W', text: '20.59°S, 17.29°W' }
};

for (const loc of placesData.locations) {
  const converted = convertPlaceCoordinates(loc);
  const expected = expectedResults[loc.name];
  assert(expected, `Expected entry for ${loc.name}`);

  assert.equal(converted.directionalCoords.latDir, expected.latDir, `${loc.name} latDir`);
  assert.equal(converted.directionalCoords.lonDir, expected.lonDir, `${loc.name} lonDir`);
  assert.equal(converted.coordsFormatted, expected.text, `${loc.name} formatted text`);
  assert(!converted.coordsFormatted.includes('-'), `Formatted text must not contain negative signs: ${converted.coordsFormatted}`);
  console.log(`  ✔ ${loc.name.padEnd(22)} (${loc.latitude}, ${loc.longitude}) -> ${converted.coordsFormatted}`);
}

console.log('\nTesting custom options (precision, spacing)...');
// 2. Custom precision
const rounded = convertToDirectionalCoords(20.6714, -56.6774, { precision: 2, space: ' ' });
assert.equal(rounded.text, '20.67° N, 56.68° W');
assert.equal(rounded.latitude, '20.67° N');
assert.equal(rounded.longitude, '56.68° W');

// 3. Boundary & Edge cases
console.log('Testing boundary & edge cases...');
// Equator & Prime Meridian
const origin = convertToDirectionalCoords(0, 0);
assert.equal(origin.text, '0°N, 0°E');

// South Pole
const southPole = convertToDirectionalCoords(-90, 0);
assert.equal(southPole.latDir, 'S');
assert.equal(southPole.latitude, '90°N' === false ? '' : '90°S');
assert.equal(southPole.text, '90°S, 0°E');

// North Pole
const northPole = convertToDirectionalCoords(90, 0);
assert.equal(northPole.text, '90°N, 0°E');

// Western and Eastern extremes
const westLimb = convertToDirectionalCoords(0, -90);
assert.equal(westLimb.text, '0°N, 90°W');

const eastLimb = convertToDirectionalCoords(0, 90);
assert.equal(eastLimb.text, '0°N, 90°E');

console.log('\nALL COORDINATE CONVERTER TESTS PASSED SUCCESSFULLY!');
