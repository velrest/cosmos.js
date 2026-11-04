import { test } from "node:test";
import assert from "node:assert/strict";
import { arrivalText, nearestStar, polarPoint, starGlow } from "../src/star-map.js";
import { delayMs } from "../src/energyspeed.js";
import { findStar } from "../src/star-chart.js";
import { NORTH_POLE, SIRIUS_UP, pickFate, summonUniverse } from "./cosmos-helpers.js";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
const ASCENDED = { energy: 90, streak: 3 };

test("straight up is the center of the map", () => {
  const { x, y } = polarPoint(90, 123);
  close(x, 0);
  close(y, 0);
});
test("north is up and east is left, as on a sky chart", () => {
  const north = polarPoint(0, 0);
  close(north.x, 0);
  close(north.y, 1);
  const east = polarPoint(0, 90);
  close(east.x, -1);
  close(east.y, 0);
});
test("altitude sets the distance from the center", () => {
  const { x, y } = polarPoint(45, 180);
  close(x, 0);
  close(y, -0.5);
});
test("nearestStar picks the closest within reach", () => {
  const points = [{ x: 10, y: 10, star: "a" }, { x: 20, y: 10, star: "b" }];
  assert.equal(nearestStar(points, 18, 10, 5).star, "b");
  assert.equal(nearestStar(points, 100, 100, 5), undefined);
  assert.equal(nearestStar([], 0, 0, 5), undefined);
});
test("brighter stars look brighter, following magnitude", () => {
  const magnitudes = [-1.5, 0, 1, 2, 3, 4, 5, 6];
  for (let i = 1; i < magnitudes.length; i++) {
    const brighter = starGlow(magnitudes[i - 1]);
    const fainter = starGlow(magnitudes[i]);
    assert.ok(brighter.radius > fainter.radius);
    assert.ok(brighter.alpha >= fainter.alpha);
  }
  assert.equal(starGlow(-1.5).alpha, 1);
  assert.ok(starGlow(6).alpha > 0 && starGlow(6).alpha < 0.35);
  assert.ok(starGlow(6).radius > 0);
});
test("arrival times read well", () => {
  assert.equal(arrivalText(250), "under a second");
  assert.equal(arrivalText(12_000), "12 s");
  assert.equal(arrivalText(300_000), "5 min");
  assert.equal(arrivalText(3_900_000), "1 h 5 min");
});

test("pierceVeil is for Ascended users only", () => {
  for (const energy of [5, 35, 60, 90]) {
    assert.equal(summonUniverse({ soul: { energy, streak: 0 } }).cosmos.pierceVeil(), undefined);
  }
  assert.ok(summonUniverse({ soul: ASCENDED }).cosmos.pierceVeil());
});
test("pierceVeil returns nothing with no location", () => {
  assert.equal(summonUniverse({ soul: ASCENDED, location: null }).cosmos.pierceVeil(), undefined);
});
test("pierceVeil lists visible stars with positions, and the sun", () => {
  const { cosmos } = summonUniverse({ soul: ASCENDED, location: SIRIUS_UP });
  cosmos.seed({ Sirius: { v: 1 } });
  const { stars, sun } = cosmos.pierceVeil();
  assert.ok(stars.length > 1000);
  assert.ok(stars.every((star) => star.altitude > 0 && star.azimuth >= 0 && star.azimuth < 360));
  const sirius = stars.find((star) => star.name === "Sirius");
  assert.ok(sirius.altitude > 60);
  assert.equal(sirius.holdsData, true);
  assert.equal(sirius.pendingCount, 0);
  assert.equal(stars.find((star) => star.name === "Rigel").holdsData, false);
  assert.ok(sun.altitude < 0);
  assert.ok(sun.azimuth >= 0 && sun.azimuth < 360);
});
test("pierceVeil counts saves on their way", () => {
  const { cosmos } = summonUniverse({ soul: ASCENDED });
  cosmos.sendEnergyToStar("Sirius", { v: 1 });
  const sirius = cosmos.pierceVeil().stars.find((star) => star.name === "Sirius");
  assert.equal(sirius.holdsData, false);
  assert.equal(sirius.pendingCount, 1);
});
test("pierceStarVeil shows stored data and saves on their way", () => {
  const { cosmos, clock } = summonUniverse({ soul: ASCENDED, location: NORTH_POLE });
  cosmos.seed({ Vega: { v: 1 } });
  cosmos.sendEnergyToStar("Vega", { v: 2 });
  const delay = delayMs(findStar("Vega").ly, 90);
  clock.t += delay / 4;
  const vega = cosmos.pierceStarVeil("vega");
  assert.equal(vega.name, "Vega");
  assert.deepEqual(vega.data, { v: 1 });
  assert.deepEqual(vega.pending[0].data, { v: 2 });
  assert.ok(Math.abs(vega.pending[0].arrivesInMs - delay * 0.75) < 1);
  vega.data.v = 99;
  assert.equal(cosmos.pierceStarVeil("Vega").data.v, 1);
});
test("pierceStarVeil returns nothing for hidden or unknown stars, or below Ascended", () => {
  const { cosmos } = summonUniverse({ soul: ASCENDED, location: NORTH_POLE });
  assert.equal(cosmos.pierceStarVeil("Acrux"), undefined);
  assert.equal(cosmos.pierceStarVeil("Nonsense"), undefined);
  assert.equal(cosmos.pierceStarVeil("constructor"), undefined);
  assert.equal(summonUniverse({ soul: { energy: 90, streak: 0 } }).cosmos.pierceStarVeil("Sirius"), undefined);
});
test("losing Ascended ends the audit", () => {
  const { cosmos, clock } = summonUniverse({ soul: ASCENDED });
  clock.t += 1_800_000;
  cosmos.settle();
  pickFate(cosmos, "bad");
  assert.equal(cosmos.pierceVeil(), undefined);
});
