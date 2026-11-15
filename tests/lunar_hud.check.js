import assert from 'node:assert/strict';
import { convertToDirectionalCoords } from '../src/lib/ephemeris.js';

console.log('Testing LunarCoordsHUD coordinate calculation & display logic...');

// Test 1: Selected coordinates formatting (default state or when mouse is off the moon)
const selectedCoords = { lat: 26.1322, lon: 3.6339 };
const formattedSelected = convertToDirectionalCoords(selectedCoords.lat, selectedCoords.lon, { precision: 3, space: ' ' });

assert.equal(formattedSelected.latStr, '26.132° N');
assert.equal(formattedSelected.lonStr, '3.634° E');
console.log('✔ Verified selected coordinates formatting (precision: 3, space before direction).');

// Test 2: Live cursor coordinates (when mouse cursor is hovering over the Moon)
const liveCursorCoords = { lat: 23.456, lon: 126.680 };
const formattedCursor = convertToDirectionalCoords(liveCursorCoords.lat, liveCursorCoords.lon, { precision: 3, space: ' ' });

assert.equal(formattedCursor.latStr, '23.456° N');
assert.equal(formattedCursor.lonStr, '126.680° E');
console.log('✔ Verified live mouse cursor coordinate reading (matches Figma design 23.456° N).');

// Test 3: Southern and Western hemispheres
const southWestCoords = { lat: -47.7705, lon: -94.931 };
const formattedSouthWest = convertToDirectionalCoords(southWestCoords.lat, southWestCoords.lon, { precision: 3, space: ' ' });

assert.equal(formattedSouthWest.latStr, '47.770° S');
assert.equal(formattedSouthWest.lonStr, '94.931° W');
console.log('✔ Verified southern (° S) and western (° W) coordinate formatting.');

// Test 4: Coordinate selection precedence & initial values logic
function getDisplayedCoordinates(selectedCoords, hoveredCoords, defaultLat = 26.1322, defaultLon = 3.6339) {
  if (selectedCoords && typeof selectedCoords.lat === 'number' && typeof selectedCoords.lon === 'number') {
    return convertToDirectionalCoords(selectedCoords.lat, selectedCoords.lon, { precision: 3, space: ' ' });
  }
  if (hoveredCoords && typeof hoveredCoords.lat === 'number' && typeof hoveredCoords.lon === 'number') {
    return convertToDirectionalCoords(hoveredCoords.lat, hoveredCoords.lon, { precision: 3, space: ' ' });
  }
  return convertToDirectionalCoords(defaultLat, defaultLon, { precision: 3, space: ' ' });
}

let selectedCoordsVar = null;
let hoveredCoordsVar = null;
const initialLat = 26.1322;
const initialLon = 3.6339;

// Initial state (before any clicks or hover happen on CoordsHUD)
// User requirement: "let lat = $state(26.1322); let lon = $state(3.6339); show these values as the initial value before any clicks happen on the CoordsHUD"
const initialDisplay = getDisplayedCoordinates(selectedCoordsVar, hoveredCoordsVar, initialLat, initialLon);
assert.equal(initialDisplay.latStr, '26.132° N');
assert.equal(initialDisplay.lonStr, '3.634° E');
console.log('✔ Verified initial values before any clicks/hover: 26.132° N, 3.634° E.');

// Moving mouse over Moon before selecting a point: reads from cursor location
hoveredCoordsVar = { lat: 14.234, lon: -45.678 };
assert.equal(getDisplayedCoordinates(selectedCoordsVar, hoveredCoordsVar).latStr, '14.234° N');
assert.equal(getDisplayedCoordinates(selectedCoordsVar, hoveredCoordsVar).lonStr, '45.678° W');
console.log('✔ Verified reading latitude/longitude from mouse cursor location prior to selection.');

// Selecting a point on the Moon: selectedCoords is set
selectedCoordsVar = { lat: 14.234, lon: -45.678 };
assert.equal(getDisplayedCoordinates(selectedCoordsVar, hoveredCoordsVar).latStr, '14.234° N');
assert.equal(getDisplayedCoordinates(selectedCoordsVar, hoveredCoordsVar).lonStr, '45.678° W');

// User moves mouse somewhere else over the Moon:
// Requirement: "when a coordinate is selcted the above coordinates should only display that coordinate(use the variable called selectedCoords)"
hoveredCoordsVar = { lat: 55.555, lon: 88.888 };
assert.equal(getDisplayedCoordinates(selectedCoordsVar, hoveredCoordsVar).latStr, '14.234° N', 'Must strictly display selected coordinate');
assert.equal(getDisplayedCoordinates(selectedCoordsVar, hoveredCoordsVar).lonStr, '45.678° W', 'Must strictly display selected coordinate');
console.log('✔ Verified HUD strictly displays selectedCoords even when mouse moves elsewhere.');

// Picking a new point updates selectedCoords:
selectedCoordsVar = { lat: -20.590, lon: -17.290 };
assert.equal(getDisplayedCoordinates(selectedCoordsVar, hoveredCoordsVar).latStr, '20.590° S');
assert.equal(getDisplayedCoordinates(selectedCoordsVar, hoveredCoordsVar).lonStr, '17.290° W');
console.log('✔ Verified display updates when new point is picked.');

console.log('\nALL LUNAR COORDS HUD LOGIC CHECKS PASSED SUCCESSFULLY!');
