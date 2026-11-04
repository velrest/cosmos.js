import { test } from "node:test";
import assert from "node:assert/strict";
import { createCosmos } from "../src/cosmos.js";
import { delayMs } from "../src/energyspeed.js";
import { findStar } from "../src/star-chart.js";
import { NORTH_POLE, SIRIUS_DOWN, SIRIUS_UP, T0, summonUniverse } from "./cosmos-helpers.js";

const CONNECTED = { energy: 75, streak: 0 };
const siriusDelay = (energy) => delayMs(findStar("Sirius").ly, energy);

test("seeded data is visible at once", () => {
  const { cosmos } = summonUniverse();
  cosmos.seed({ Sirius: { owner: "ops" } });
  assert.equal(cosmos.gazeIntoStar("Sirius").owner, "ops");
});
test("seed does not overwrite saved data", () => {
  const { cosmos } = summonUniverse();
  cosmos.seed({ Sirius: { v: 1 } });
  cosmos.seed({ Sirius: { v: 2 } });
  assert.equal(cosmos.gazeIntoStar("Sirius").v, 1);
});
test("seed skips unknown names and invalid values", () => {
  const { cosmos } = summonUniverse();
  cosmos.seed({ Nonsense: { v: 1 }, Sirius: 5, Rigel: { v: 2 } });
  assert.equal(JSON.stringify(cosmos.gazeIntoStar("Sirius")), "{}");
  assert.equal(cosmos.gazeIntoStar("Rigel").v, 2);
  cosmos.seed(undefined);
});
test("a readable star with no data is a live empty object", () => {
  const { cosmos } = summonUniverse();
  assert.equal(JSON.stringify(cosmos.gazeIntoStar("Sirius")), "{}");
});
test("unknown star names return undefined", () => {
  const { cosmos } = summonUniverse();
  for (const name of ["Nonsense", "constructor", "__proto__", 5]) assert.equal(cosmos.gazeIntoStar(name), undefined);
});
test("a hidden star returns undefined and a held object goes empty", () => {
  const { cosmos } = summonUniverse();
  cosmos.seed({ Sirius: { v: 1 } });
  const held = cosmos.gazeIntoStar("Sirius");
  cosmos.setLocation(SIRIUS_DOWN);
  assert.equal(cosmos.gazeIntoStar("Sirius"), undefined);
  assert.equal(JSON.stringify(held), "{}");
  cosmos.setLocation(SIRIUS_UP);
  assert.equal(held.v, 1);
});
test("a save arrives after its delay and returns the old value first", () => {
  const { cosmos, clock } = summonUniverse({ soul: CONNECTED });
  cosmos.seed({ Sirius: { v: 1 } });
  const seen = cosmos.sendEnergyToStar("Sirius", { v: 2 });
  assert.equal(seen.v, 1);
  clock.t += siriusDelay(75) - 1;
  assert.equal(seen.v, 1);
  clock.t += 2;
  assert.equal(seen.v, 2);
});
test("saves arrive in order", () => {
  const { cosmos, clock } = summonUniverse({ soul: CONNECTED });
  const seen = cosmos.sendEnergyToStar("Sirius", { v: 1 });
  clock.t += 10;
  cosmos.sendEnergyToStar("Sirius", { v: 2 });
  clock.t += siriusDelay(75) - 5;
  assert.equal(seen.v, 1);
  clock.t += 10;
  assert.equal(seen.v, 2);
});
test("an energy change speeds up an update in flight", async () => {
  const { pickFate } = await import("./cosmos-helpers.js");
  const { cosmos, clock } = summonUniverse({ soul: { energy: 75, streak: 0 } });
  const seen = cosmos.sendEnergyToStar("Rigel", { v: 1 });
  const rigel = delayMs(findStar("Rigel").ly, 75);
  clock.t += rigel / 2;
  cosmos.drawOmen();
  pickFate(cosmos, "right");
  clock.t += rigel * 0.45;
  assert.equal(seen.v, 1);
});
test("saves replace and do not merge", () => {
  const { cosmos, clock } = summonUniverse({ soul: CONNECTED });
  cosmos.seed({ Sirius: { a: 1, b: 2 } });
  const seen = cosmos.sendEnergyToStar("Sirius", { c: 3 });
  clock.t += siriusDelay(75) + 1;
  assert.deepEqual(JSON.parse(JSON.stringify(seen)), { c: 3 });
});
test("per-level access", () => {
  const up = (energy) => summonUniverse({ soul: { energy, streak: 0 } }).cosmos;
  assert.notEqual(up(15).gazeIntoStar("Sirius"), undefined);
  assert.equal(up(15).gazeIntoStar("Bellatrix"), undefined);
  assert.equal(up(30).sendEnergyToStar("Sirius", { v: 1 }), undefined);
  assert.notEqual(up(30).gazeIntoStar("Bellatrix"), undefined);
  assert.notEqual(up(60).sendEnergyToStar("Sirius", { v: 1 }), undefined);
  assert.equal(up(60).sendEnergyToStar("Bellatrix", { v: 1 }), undefined);
  assert.notEqual(up(80).sendEnergyToStar("Bellatrix", { v: 1 }), undefined);
});
test("a save to a hidden star is dropped", () => {
  const { cosmos } = summonUniverse({ soul: CONNECTED, location: SIRIUS_DOWN });
  assert.equal(cosmos.sendEnergyToStar("Sirius", { v: 1 }), undefined);
  assert.equal(cosmos.snapshot().stars.Sirius, undefined);
});
test("Blinded gets nothing, including energy", () => {
  const { cosmos } = summonUniverse({ soul: { energy: 5, streak: 0 } });
  assert.equal(cosmos.gazeIntoStar("Sirius"), undefined);
  assert.equal(cosmos.gazeIntoSky(), undefined);
  assert.equal(cosmos.gazeIntoSelf(), undefined);
});
test("gazeIntoSelf ignores the sky", () => {
  const { cosmos } = summonUniverse();
  cosmos.setLocation(null);
  assert.equal(cosmos.gazeIntoSelf(), 35);
});
test("gazeIntoSky only lists readable stars with data, and is live", () => {
  const { cosmos, clock } = summonUniverse({ soul: CONNECTED });
  cosmos.seed({ Canopus: { v: 0 } });
  const sky = cosmos.gazeIntoSky();
  assert.deepEqual(Object.keys(sky).includes("Sirius"), false);
  cosmos.sendEnergyToStar("Sirius", { v: 1 });
  clock.t += siriusDelay(75) + 1;
  assert.equal(sky.Sirius.v, 1);
  cosmos.setLocation(SIRIUS_DOWN);
  assert.equal(sky.Sirius, undefined);
});
test("gazeIntoSky is an empty object with no data, and undefined with no location", () => {
  const { cosmos } = summonUniverse();
  assert.equal(JSON.stringify(cosmos.gazeIntoSky()), "{}");
  cosmos.setLocation(null);
  assert.equal(cosmos.gazeIntoSky(), undefined);
});
test("gazeIntoConstellation returns only that constellation", () => {
  const { cosmos } = summonUniverse();
  cosmos.seed({ Betelgeuse: { v: 1 }, Sirius: { v: 2 } });
  assert.deepEqual(Object.keys(cosmos.gazeIntoConstellation("Orion")), ["Betelgeuse"]);
  assert.deepEqual(Object.keys(cosmos.gazeIntoConstellation("ori")), ["Betelgeuse"]);
  assert.equal(cosmos.gazeIntoConstellation("Nonsense"), undefined);
});
test("sendEnergyToConstellations applies rules per star", () => {
  const { cosmos, clock } = summonUniverse({ soul: { energy: 60, streak: 0 } });
  const seen = cosmos.sendEnergyToConstellations({ Orion: { Rigel: { v: 1 }, Bellatrix: { v: 2 }, Sirius: { v: 3 } } });
  assert.deepEqual(Object.keys(cosmos.snapshot().stars), ["Rigel"]);
  clock.t += delayMs(findStar("Rigel").ly, 60) + 1;
  assert.equal(seen.Rigel.v, 1);
});
test("sendEnergyToConstellations returns undefined when nothing is allowed", () => {
  const { cosmos } = summonUniverse();
  assert.equal(cosmos.sendEnergyToConstellations({ Orion: { Rigel: { v: 1 } } }), undefined);
  assert.equal(cosmos.sendEnergyToConstellations(5), undefined);
  assert.equal(cosmos.sendEnergyToConstellations({ Nonsense: { Rigel: { v: 1 } } }), undefined);
});
test("non-object saves are dropped", () => {
  const { cosmos } = summonUniverse({ soul: CONNECTED });
  for (const bad of [5, "x", true, null]) assert.equal(cosmos.sendEnergyToStar("Sirius", bad), undefined);
});
test("array stars can be seeded, read, and saved", () => {
  const { cosmos, clock } = summonUniverse({ soul: CONNECTED });
  cosmos.seed({ Sirius: [{ name: "Ada" }] });
  const people = cosmos.gazeIntoStar("Sirius");
  assert.deepEqual(people.map((p) => p.name), ["Ada"]);
  cosmos.sendEnergyToStar("Sirius", [{ name: "Grace" }]);
  clock.t += siriusDelay(75) + 1;
  assert.deepEqual(people.map((p) => p.name), ["Grace"]);
});
test("a held object goes empty when the star changes type", () => {
  const { cosmos, clock } = summonUniverse({ soul: CONNECTED });
  cosmos.seed({ Sirius: { a: 1 } });
  const held = cosmos.gazeIntoStar("Sirius");
  cosmos.sendEnergyToStar("Sirius", [1]);
  clock.t += siriusDelay(75) + 1;
  assert.equal(JSON.stringify(held), "{}");
  assert.deepEqual([...cosmos.gazeIntoStar("Sirius")], [1]);
});
test("gazeIntoStar() gives a different random unnamed star each call", () => {
  let tick = 0;
  const { cosmos } = summonUniverse({ soul: CONNECTED, random: () => (tick++ * 0.37) % 1 });
  const first = cosmos.sendEnergyToStar({ a: 1 });
  const second = cosmos.sendEnergyToStar({ b: 2 });
  assert.notEqual(first, undefined);
  assert.notEqual(second, undefined);
  const saved = Object.keys(cosmos.snapshot().stars);
  assert.equal(saved.length, 2);
  for (const name of saved) assert.match(name, /^HYG \d+$/);
  assert.equal(JSON.stringify(cosmos.gazeIntoStar()), "{}");
});
test("gazeIntoStar() returns undefined below Unconnected", () => {
  const { cosmos } = summonUniverse({ soul: { energy: 15, streak: 0 } });
  assert.equal(cosmos.gazeIntoStar(), undefined);
});
test("sendEnergyToStar(data) saves to a random unnamed star, findable by its ID", () => {
  const { cosmos, clock } = summonUniverse({ soul: CONNECTED, location: NORTH_POLE });
  const held = cosmos.sendEnergyToStar({ a: 1 });
  assert.equal(JSON.stringify(held), "{}");
  clock.t += 11_000_000;
  assert.equal(held.a, 1);
  const [name] = Object.keys(cosmos.gazeIntoSky());
  assert.match(name, /^HYG \d+$/);
  assert.equal(cosmos.gazeIntoStar(name).a, 1);
});
test("sendEnergyToStar(data) returns undefined when no unnamed star is editable", () => {
  // The only brightest unnamed star, HYG 118360, never rises this far south.
  const { cosmos } = summonUniverse({ soul: { energy: 60, streak: 0 }, location: { lat: -60, lon: 0 } });
  assert.equal(cosmos.sendEnergyToStar({ a: 1 }), undefined);
});
test("Aware users can only land on a brightest unnamed star", () => {
  const { cosmos } = summonUniverse({ soul: { energy: 60, streak: 0 }, location: NORTH_POLE });
  assert.notEqual(cosmos.sendEnergyToStar({ a: 1 }), undefined);
  assert.deepEqual(Object.keys(cosmos.snapshot().stars), ["HYG 118360"]);
});
test("values JSON can't represent are dropped without throwing", () => {
  const { cosmos } = summonUniverse({ soul: CONNECTED });
  const circular = {};
  circular.self = circular;
  assert.equal(cosmos.sendEnergyToStar("Sirius", circular), undefined);
  assert.equal(cosmos.sendEnergyToStar("Sirius", { n: 1n }), undefined);
  assert.equal(cosmos.sendEnergyToStar("Sirius", () => {}), undefined);
});
test("saved objects are copied on save", () => {
  const { cosmos, clock } = summonUniverse({ soul: CONNECTED });
  const input = { v: 1 };
  const seen = cosmos.sendEnergyToStar("Sirius", input);
  input.v = 99;
  clock.t += siriusDelay(75) + 1;
  assert.equal(seen.v, 1);
});
test("a clock moving backward does not reduce progress", () => {
  const { cosmos, clock } = summonUniverse({ soul: CONNECTED });
  const seen = cosmos.sendEnergyToStar("Sirius", { v: 1 });
  clock.t += siriusDelay(75) / 2;
  cosmos.settle();
  const before = cosmos.snapshot().stars.Sirius.pending[0].progress;
  clock.t -= 10_000;
  cosmos.settle();
  assert.equal(cosmos.snapshot().stars.Sirius.pending[0].progress, before);
  clock.t += siriusDelay(75);
  assert.equal(seen.v, 1);
});
test("state survives a restart, and updates travel while closed", () => {
  const { cosmos, clock } = summonUniverse({ soul: CONNECTED });
  cosmos.sendEnergyToStar("Sirius", { v: 1 });
  const state = JSON.parse(JSON.stringify(cosmos.snapshot()));
  clock.t += siriusDelay(75) + 1;
  const reborn = createCosmos({ now: () => clock.t, persist() {}, state });
  assert.equal(reborn.gazeIntoStar("Sirius").v, 1);
});
test("a simulated location overrides the real one and is not saved", () => {
  const { cosmos } = summonUniverse({ location: SIRIUS_DOWN });
  assert.equal(cosmos.gazeIntoStar("Sirius"), undefined);
  cosmos.simulateLocation(SIRIUS_UP);
  assert.notEqual(cosmos.gazeIntoStar("Sirius"), undefined);
  cosmos.setLocation({ lat: 10, lon: 180 });
  assert.notEqual(cosmos.gazeIntoStar("Sirius"), undefined);
  assert.deepEqual(cosmos.snapshot().location, { lat: 10, lon: 180 });
});
test("scanHeavens lists visible stars with no data needed, brightest first", () => {
  const { cosmos } = summonUniverse();
  const stars = cosmos.scanHeavens();
  assert.ok(stars.length > 1000);
  const sirius = stars.find((star) => star.name === "Sirius");
  assert.equal(sirius.con, "CMa");
  assert.ok(sirius.mag < 0);
  assert.ok(stars.some((star) => star.name.startsWith("HYG ")));
  for (let i = 1; i < stars.length; i++) assert.ok(stars[i - 1].mag <= stars[i].mag);
});
test("scanHeavens depends on location", () => {
  const { cosmos } = summonUniverse({ location: SIRIUS_DOWN });
  assert.equal(cosmos.scanHeavens().some((star) => star.name === "Sirius"), false);
});
test("scanHeavens marks what the level can read, without hiding anything", () => {
  const stars = (energy) => summonUniverse({ soul: { energy, streak: 0 } }).cosmos.scanHeavens();
  const everyone = stars(35);
  assert.ok(everyone.every((star) => star.readable));
  const hazed = stars(15);
  assert.equal(hazed.length, everyone.length);
  for (const star of hazed) assert.equal(star.readable, star.mag <= 1.5);
  assert.ok(hazed.some((star) => star.readable));
  const blinded = stars(5);
  assert.equal(blinded.length, everyone.length);
  assert.ok(blinded.every((star) => !star.readable));
});
test("scanHeavens gives each star's travel time at the current energy", () => {
  const travelTime = (energy) =>
    summonUniverse({ soul: { energy, streak: 0 } }).cosmos.scanHeavens().find((star) => star.name === "Sirius").travelMs;
  assert.equal(travelTime(35), delayMs(findStar("Sirius").ly, 35));
  assert.ok(Math.abs(travelTime(100) - travelTime(35) / 4) < 0.001);
  assert.ok(travelTime(0) > travelTime(35));
});
test("a location change reruns onCosmicShift even for a Blinded user", () => {
  const { cosmos } = summonUniverse({ soul: { energy: 5, streak: 0 } });
  let runs = 0;
  cosmos.onCosmicShift(() => runs++);
  cosmos.setLocation(SIRIUS_DOWN);
  assert.equal(runs, 2);
});
test("scanHeavens returns nothing with no location", () => {
  assert.equal(summonUniverse({ location: null }).cosmos.scanHeavens(), undefined);
});
test("scanHeavens returns copies", () => {
  const { cosmos } = summonUniverse();
  cosmos.scanHeavens()[0].name = "Changed";
  assert.notEqual(cosmos.scanHeavens()[0].name, "Changed");
});
test("changes are persisted", () => {
  const { cosmos, saves } = summonUniverse({ soul: CONNECTED });
  cosmos.sendEnergyToStar("Sirius", { v: 1 });
  assert.ok(saves.at(-1).stars.Sirius.pending.length === 1);
  assert.equal(T0, saves.at(-1).settledAt);
});
