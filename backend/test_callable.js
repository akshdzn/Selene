import assert from "node:assert/strict";
import getLunarData, { analyzeSite, loadDem } from "./Lunarfunction.js";

// Verify module callable exports
assert.equal(typeof getLunarData, "function", "Default export must be a function");
assert.equal(typeof analyzeSite, "function", "analyzeSite must be an exported function");

// Verify direct call with lat and lon (and 1-day range for fast check)
const res = await getLunarData(-89.9, 0, { startTime: "2027-01-01", stopTime: "2027-01-02" });

assert.ok(res.coordinates, "Must return coordinates");
assert.equal(res.coordinates.latitude, -89.9);
assert.equal(res.coordinates.longitude, 0);
assert.ok(Array.isArray(res.sun), "Must return sun ephemeris array");
assert.ok(Array.isArray(res.earth), "Must return earth ephemeris array");
assert.ok(typeof res.summary?.["Power %"] === "number", "Must compute power summary");

console.log("Lunarfunction callable module test passed.");
