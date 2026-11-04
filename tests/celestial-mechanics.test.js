import { test } from "node:test";
import assert from "node:assert/strict";
import {
  altitudeDegrees,
  azimuthDegrees,
  isStarInSky,
  localSiderealDegrees,
  whereIsTheSun,
} from "../src/celestial-mechanics.js";

const J2000 = new Date("2000-01-01T12:00:00Z");
const close = (actual, expected, tolerance) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);

test("sidereal time at J2000", () => close(localSiderealDegrees(J2000, 0), 280.46, 0.01));
test("sidereal time shifts with longitude", () => close(localSiderealDegrees(J2000, 90), 10.46, 0.01));
test("sun position at J2000", () => {
  const sun = whereIsTheSun(J2000);
  close(sun.ra, 281.3, 0.2);
  close(sun.dec, -23.0, 0.2);
});
test("Polaris altitude is near latitude", () =>
  close(altitudeDegrees({ ra: 37.95, dec: 89.26 }, J2000, { lat: 47, lon: 8 }), 47, 1));
test("Polaris never rises in Sydney", () => {
  for (let hour = 0; hour < 24; hour++) {
    const date = new Date(Date.UTC(2026, 5, 21, hour));
    assert.equal(isStarInSky({ ra: 37.95, dec: 89.26 }, date, { lat: -33.87, lon: 151.2 }), false);
  }
});
test("sun border blocks within 15 degrees only", () => {
  const sun = whereIsTheSun(J2000);
  const equator = { lat: 0, lon: 0 };
  assert.equal(isStarInSky({ ra: sun.ra, dec: sun.dec + 14 }, J2000, equator), false);
  assert.equal(isStarInSky({ ra: sun.ra, dec: sun.dec + 16 }, J2000, equator), true);
});
test("a star below the horizon is hidden", () => {
  const sun = whereIsTheSun(J2000);
  assert.equal(isStarInSky({ ra: (sun.ra + 180) % 360, dec: -sun.dec }, J2000, { lat: 0, lon: 0 }), false);
});
test("azimuth runs clockwise from north", () => {
  const lst = localSiderealDegrees(J2000, 0);
  const equator = { lat: 0, lon: 0 };
  close(azimuthDegrees({ ra: (lst + 90) % 360, dec: 0 }, J2000, equator), 90, 0.01);
  close(azimuthDegrees({ ra: (lst + 270) % 360, dec: 0 }, J2000, equator), 270, 0.01);
  close(azimuthDegrees({ ra: lst, dec: -60 }, J2000, equator), 180, 0.01);
  close(azimuthDegrees({ ra: lst, dec: 60 }, J2000, equator), 0, 0.01);
});
test("no location means no sky",() => assert.equal(isStarInSky({ ra: 0, dec: 0 }, J2000, null), false));
