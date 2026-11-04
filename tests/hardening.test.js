import { test } from "node:test";
import assert from "node:assert/strict";
import { createCosmos } from "../src/cosmos.js";
import { conjureMirage } from "../src/mirage.js";
import { EVERY_STAR } from "../src/star-chart.js";
import { NORTH_POLE, SIRIUS_UP, T0, summonUniverse } from "./cosmos-helpers.js";

const LEVELS = ["Blinded", "Hazed", "Unconnected", "Aware", "Connected", "Ascended"];
const CONNECTED = { energy: 75, streak: 0 };

const badStates = {
  "an unknown star": { stars: { Nonsense: { data: { a: 1 }, pending: [{ data: { b: 1 }, progress: 0 }] } } },
  "a record with no pending list": { stars: { Sirius: { data: { a: 1 } } } },
  "a record that isn't an object": { stars: { Sirius: 5 } },
  "bad pending entries": { stars: { Sirius: { pending: [null, { data: 5, progress: "x" }, { data: {}, progress: "x" }] } } },
  "bad star data": { stars: { Sirius: { data: 5, pending: [] } } },
  "null stars": { stars: null },
  "null soul": { soul: null },
  "text energy": { soul: { energy: "x", streak: 0 } },
  "out of range energy": { soul: { energy: 900, streak: -4 } },
  "an empty omen": { omen: {} },
  "an omen with bad fates": { omen: { signs: ["Leo", "Virgo", "Libra"], fates: {}, deadline: null } },
  "a text omen time": { soul: { energy: 90, streak: 3 }, nextOmenAt: "soon" },
  "a bad location": { location: { lat: "north" } },
  "a text settled time": { settledAt: "yesterday" },
  "not an object": 5,
};

for (const [name, state] of Object.entries(badStates)) {
  test(`stored state with ${name} doesn't break anything`, () => {
    const cosmos = createCosmos({ now: () => T0, persist() {}, state });
    cosmos.setLocation(SIRIUS_UP);
    assert.ok(LEVELS.includes(cosmos.level()));
    cosmos.gazeIntoStar("Sirius");
    cosmos.gazeIntoSky();
    cosmos.currentOmen();
    const omen = cosmos.drawOmen();
    if (omen) cosmos.chooseSign(omen.signs[0]);
    assert.ok(Number.isFinite(cosmos.soul().energy));
    assert.ok(cosmos.soul().energy >= 0 && cosmos.soul().energy <= 100);
    cosmos.nextEventAt();
  });
}
test("valid data survives next to a bad record", () => {
  const cosmos = createCosmos({
    now: () => T0,
    persist() {},
    state: { location: SIRIUS_UP, stars: { Nonsense: {}, Sirius: { data: { a: 1 } } } },
  });
  assert.equal(cosmos.gazeIntoStar("Sirius").a, 1);
});

test("the fallback location is used only while nothing better is known", () => {
  const taipei = { lat: 25.03, lon: 121.57 };
  const clock = { t: T0 };
  const cosmos = createCosmos({ now: () => clock.t, persist() {}, fallbackLocation: taipei });
  assert.deepEqual(cosmos.channelLocation(), { ...taipei, source: "fallback" });
  assert.ok(cosmos.scanHeavens().length > 1000);
  assert.equal(cosmos.snapshot().location, null);
  cosmos.setLocation(SIRIUS_UP);
  assert.deepEqual(cosmos.channelLocation(), { ...SIRIUS_UP, source: "real" });
  cosmos.simulateLocation(NORTH_POLE);
  assert.deepEqual(cosmos.channelLocation(), { ...NORTH_POLE, source: "simulated" });
});
test("a stored real location beats the fallback", () => {
  const cosmos = createCosmos({
    now: () => T0,
    persist() {},
    state: { location: SIRIUS_UP },
    fallbackLocation: { lat: 25.03, lon: 121.57 },
  });
  assert.equal(cosmos.channelLocation().source, "real");
});
test("channelLocation returns nothing with no location at all", () => {
  assert.equal(createCosmos({ now: () => T0, persist() {} }).channelLocation(), undefined);
});
test("setting a location always reruns onCosmicShift", () => {
  const { cosmos } = summonUniverse();
  let runs = 0;
  cosmos.onCosmicShift(() => runs++);
  cosmos.setLocation({ ...SIRIUS_UP });
  assert.equal(runs, 2);
});
test("a late location reruns onCosmicShift even with no data anywhere", () => {
  const { cosmos } = summonUniverse({ location: null });
  let runs = 0;
  cosmos.onCosmicShift(() => runs++);
  cosmos.setLocation(SIRIUS_UP);
  assert.equal(runs, 2);
});

test("sendEnergyToStar with an array to a random star fills on arrival", () => {
  const { cosmos, clock } = summonUniverse({ soul: CONNECTED, location: NORTH_POLE });
  const held = cosmos.sendEnergyToStar([1, 2]);
  clock.t += 11_000_000;
  assert.deepEqual([...held], [1, 2]);
});

test("freezing or changing a live object doesn't break it", () => {
  const live = conjureMirage(() => ({ a: 1 }));
  for (const attempt of [
    () => Object.freeze(live),
    () => Object.preventExtensions(live),
    () => Object.defineProperty(live, "x", { value: 1, configurable: false }),
    () => Object.setPrototypeOf(live, { evil: true }),
  ]) {
    try {
      attempt();
    } catch {
      // Throwing here is allowed. Staying usable afterward is what matters.
    }
  }
  assert.deepEqual(Object.keys(live), ["a"]);
  assert.equal(JSON.stringify(live), '{"a":1}');
  assert.equal(live.evil, undefined);
});

test("strange names and throwing getters never throw", () => {
  const { cosmos } = summonUniverse({ soul: CONNECTED });
  const noPrototype = Object.create(null);
  const hostile = { toString() { throw new Error("no"); } };
  const trapped = { get Orion() { throw new Error("no"); } };
  for (const name of [noPrototype, hostile, Symbol("x"), null]) {
    assert.equal(cosmos.gazeIntoStar(name), undefined);
    assert.equal(cosmos.gazeIntoConstellation(name), undefined);
    assert.equal(cosmos.sendEnergyToStar(name, {}), undefined);
  }
  assert.equal(cosmos.sendEnergyToConstellations(trapped), undefined);
  assert.equal(cosmos.sendEnergyToConstellations({ Orion: trapped }), undefined);
  cosmos.seed(trapped);
});

test("a callback that saves and takes longer than the delay can't hang the page", () => {
  const { cosmos, clock } = summonUniverse({ soul: CONNECTED });
  let runs = 0;
  let stop = () => {};
  stop = cosmos.onCosmicShift(() => {
    runs++;
    if (runs > 50) {
      stop();
      return;
    }
    cosmos.sendEnergyToStar("Sirius", { run: runs });
    clock.t += 1_000_000;
    cosmos.settle();
  });
  stop();
  assert.ok(runs < 5, `${runs} runs in one synchronous pass`);
});

test("reading a sky with many stars stays fast", () => {
  const { cosmos } = summonUniverse({ location: NORTH_POLE });
  const seeds = Object.fromEntries(EVERY_STAR.filter((star) => star.dec > 0).slice(0, 1000).map((star) => [star.name, { a: 1 }]));
  cosmos.seed(seeds);
  const started = performance.now();
  const text = JSON.stringify(cosmos.gazeIntoSky());
  const elapsed = performance.now() - started;
  assert.ok(text.length > 1000);
  assert.ok(elapsed < 100, `took ${elapsed} ms`);
});

test("a cached sky still notices arrivals", () => {
  const { cosmos, clock } = summonUniverse({ soul: CONNECTED });
  const sky = cosmos.gazeIntoSky();
  assert.equal(sky.Sirius, undefined);
  cosmos.sendEnergyToStar("Sirius", { v: 1 });
  clock.t += 1000;
  assert.equal(sky.Sirius.v, 1);
});
