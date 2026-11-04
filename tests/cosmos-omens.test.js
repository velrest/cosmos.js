import { test } from "node:test";
import assert from "node:assert/strict";
import { createCosmos } from "../src/cosmos.js";
import { SIRIUS_DOWN, pickFate, summonUniverse } from "./cosmos-helpers.js";

const ASCENDED = { energy: 90, streak: 3 };

test("drawOmen gives 3 signs with no fates exposed", () => {
  const { cosmos } = summonUniverse();
  const omen = cosmos.drawOmen();
  assert.equal(omen.signs.length, 3);
  assert.equal(omen.fates, undefined);
  assert.equal(omen.deadline, null);
});
test("drawing twice returns the same omen", () => {
  const { cosmos } = summonUniverse();
  assert.deepEqual(cosmos.drawOmen().signs, cosmos.drawOmen().signs);
});
test("a pending omen survives a restart", () => {
  const { cosmos, clock } = summonUniverse();
  const { signs } = cosmos.drawOmen();
  const reborn = createCosmos({ now: () => clock.t, persist() {}, state: cosmos.snapshot() });
  assert.deepEqual(reborn.currentOmen().signs, signs);
});
test("omens can be picked with no cooldown", () => {
  const { cosmos } = summonUniverse();
  for (let i = 0; i < 50 && cosmos.level() !== "Ascended"; i++) {
    assert.ok(cosmos.drawOmen());
    assert.ok(pickFate(cosmos, i % 2 ? "right" : "neutral"));
  }
});
test("choosing applies its fate", () => {
  for (const [fate, energy, streak] of [["right", 50, 2], ["bad", 25, 0], ["neutral", 33, 0]]) {
    const { cosmos } = summonUniverse({ soul: { energy: 35, streak: 1 } });
    cosmos.drawOmen();
    assert.equal(pickFate(cosmos, fate), fate);
    assert.deepEqual(cosmos.soul(), { energy, streak });
    assert.equal(cosmos.currentOmen(), undefined);
  }
});
test("three rights at 75+ energy ascend", () => {
  const { cosmos } = summonUniverse({ soul: { energy: 75, streak: 0 } });
  for (let i = 0; i < 3; i++) {
    cosmos.drawOmen();
    pickFate(cosmos, "right");
  }
  assert.equal(cosmos.level(), "Ascended");
  assert.equal(cosmos.drawOmen(), undefined);
});
test("three rights below 75 energy do not ascend", () => {
  const { cosmos } = summonUniverse({ soul: { energy: 0, streak: 0 } });
  for (let i = 0; i < 3; i++) {
    cosmos.drawOmen();
    pickFate(cosmos, "right");
  }
  assert.deepEqual(cosmos.soul(), { energy: 45, streak: 3 });
  assert.equal(cosmos.level(), "Unconnected");
});
test("an Ascended user gets no omen before 30 minutes", () => {
  const { cosmos, clock } = summonUniverse({ soul: ASCENDED });
  clock.t += 1_799_999;
  assert.equal(cosmos.currentOmen(), undefined);
  clock.t += 1;
  assert.equal(cosmos.currentOmen().deadline, clock.t + 60_000);
});
test("a wrong pick drops to the energy level", () => {
  const { cosmos, clock } = summonUniverse({ soul: ASCENDED });
  clock.t += 1_800_000;
  cosmos.settle();
  pickFate(cosmos, "bad");
  assert.equal(cosmos.level(), "Connected");
  assert.deepEqual(cosmos.soul(), { energy: 80, streak: 0 });
});
test("a right pick keeps Ascended and schedules 30 more minutes", () => {
  const { cosmos, clock } = summonUniverse({ soul: ASCENDED });
  clock.t += 1_800_000;
  cosmos.settle();
  pickFate(cosmos, "right");
  assert.equal(cosmos.level(), "Ascended");
  assert.equal(cosmos.currentOmen(), undefined);
  clock.t += 1_799_999;
  assert.equal(cosmos.currentOmen(), undefined);
  clock.t += 1;
  assert.ok(cosmos.currentOmen());
});
test("an ignored omen drops Ascended after 60 seconds with no energy cost", () => {
  const { cosmos, clock } = summonUniverse({ soul: ASCENDED });
  clock.t += 1_800_000 + 60_001;
  assert.equal(cosmos.level(), "Connected");
  assert.equal(cosmos.soul().energy, 90);
  assert.equal(cosmos.currentOmen(), undefined);
});
test("a deadline missed while the app is closed counts on load", () => {
  const { cosmos, clock } = summonUniverse({ soul: ASCENDED });
  const state = cosmos.snapshot();
  clock.t += 7_200_000;
  const reborn = createCosmos({ now: () => clock.t, persist() {}, state });
  assert.equal(reborn.level(), "Connected");
});
test("Blinded users can draw an omen", () => {
  const { cosmos } = summonUniverse({ soul: { energy: 0, streak: 0 } });
  assert.equal(cosmos.drawOmen().signs.length, 3);
});
test("choosing an unknown sign changes nothing", () => {
  const { cosmos } = summonUniverse();
  cosmos.drawOmen();
  for (const sign of ["Nonsense", "constructor", "__proto__"]) assert.equal(cosmos.chooseSign(sign), undefined);
  assert.ok(cosmos.currentOmen());
  assert.equal(cosmos.soul().energy, 35);
});
test("onCosmicShift runs at once and on arrival", () => {
  const { cosmos, clock } = summonUniverse({ soul: { energy: 75, streak: 0 } });
  let runs = 0;
  cosmos.onCosmicShift(() => runs++);
  assert.equal(runs, 1);
  cosmos.sendEnergyToStar("Sirius", { v: 1 });
  clock.t = cosmos.nextEventAt();
  cosmos.settle();
  assert.equal(runs, 2);
  assert.equal(cosmos.gazeIntoStar("Sirius").v, 1);
});
test("onCosmicShift fires on level change and on a star setting", () => {
  const { cosmos } = summonUniverse();
  cosmos.seed({ Sirius: { v: 1 } });
  let runs = 0;
  cosmos.onCosmicShift(() => runs++);
  cosmos.drawOmen();
  pickFate(cosmos, "right");
  assert.equal(runs, 2);
  cosmos.setLocation(SIRIUS_DOWN);
  assert.equal(runs, 3);
});
test("a star setting with the passage of time fires a shift", () => {
  const { cosmos, clock } = summonUniverse();
  cosmos.seed({ Sirius: { v: 1 } });
  let runs = 0;
  cosmos.onCosmicShift(() => runs++);
  clock.t += 12 * 3_600_000;
  cosmos.settle();
  assert.equal(runs, 2);
  assert.equal(cosmos.gazeIntoStar("Sirius"), undefined);
});
test("a star with no data rising or setting fires a shift", () => {
  const { cosmos, clock } = summonUniverse();
  let runs = 0;
  cosmos.onCosmicShift(() => runs++);
  clock.t += 3_600_000;
  cosmos.settle();
  assert.equal(runs, 2);
});
test("the sun moving over a star fires a shift", () => {
  // At the north pole nothing rises or sets, so only the sun can hide Alhena.
  const { cosmos, clock } = summonUniverse({ location: { lat: 90, lon: 0 } });
  cosmos.seed({ Alhena: { v: 1 } });
  const seen = [];
  cosmos.onCosmicShift(() => seen.push(cosmos.gazeIntoStar("Alhena")?.v));
  assert.deepEqual(seen, [1]);
  clock.t = Date.UTC(2026, 6, 1);
  cosmos.settle();
  assert.deepEqual(seen, [1, undefined]);
});
test("updated data on a star fires a shift with the new value", () => {
  const { cosmos, clock } = summonUniverse({ soul: { energy: 75, streak: 0 } });
  cosmos.seed({ Sirius: { v: 1 } });
  const seen = [];
  cosmos.onCosmicShift(() => seen.push(cosmos.gazeIntoStar("Sirius").v));
  cosmos.sendEnergyToStar("Sirius", { v: 2 });
  assert.deepEqual(seen, [1]);
  clock.t = cosmos.nextEventAt();
  cosmos.settle();
  assert.deepEqual(seen, [1, 2]);
});
test("nothing changing means no extra runs", () => {
  const { cosmos } = summonUniverse();
  let runs = 0;
  cosmos.onCosmicShift(() => runs++);
  cosmos.settle();
  cosmos.settle();
  assert.equal(runs, 1);
});
test("reads inside a callback do not loop", () => {
  const { cosmos } = summonUniverse();
  cosmos.seed({ Sirius: { v: 1 } });
  let runs = 0;
  cosmos.onCosmicShift(() => {
    runs++;
    cosmos.gazeIntoStar("Sirius");
    cosmos.gazeIntoSky();
    cosmos.gazeIntoSelf();
  });
  assert.equal(runs, 1);
});
test("a throwing callback does not stop others", () => {
  const { cosmos } = summonUniverse();
  let runs = 0;
  cosmos.onCosmicShift(() => {
    throw new Error("expected test error");
  });
  cosmos.onCosmicShift(() => runs++);
  cosmos.drawOmen();
  pickFate(cosmos, "right");
  assert.equal(runs, 2);
});
test("stop ends the callback", () => {
  const { cosmos } = summonUniverse();
  let runs = 0;
  const stop = cosmos.onCosmicShift(() => runs++);
  stop();
  cosmos.drawOmen();
  pickFate(cosmos, "right");
  assert.equal(runs, 1);
});
test("with ascendedPrompts, an Ascended user can lower their energy", () => {
  const { cosmos } = summonUniverse({ soul: ASCENDED, ascendedPrompts: true });
  const omen = cosmos.drawOmen();
  assert.equal(omen.signs.length, 3);
  assert.equal(omen.deadline, null);
  pickFate(cosmos, "bad");
  assert.deepEqual(cosmos.soul(), { energy: 80, streak: 0 });
  assert.equal(cosmos.level(), "Connected");
});
test("with ascendedPrompts, a drawn omen doesn't block the timed one", () => {
  const { cosmos, clock } = summonUniverse({ soul: ASCENDED, ascendedPrompts: true });
  cosmos.drawOmen();
  assert.equal(cosmos.nextEventAt(), clock.t + 1_800_000);
  clock.t += 1_800_000;
  assert.equal(cosmos.currentOmen().deadline, clock.t + 60_000);
});
test("nextEventAt is undefined with nothing scheduled", () => {
  const { cosmos } = summonUniverse();
  assert.equal(cosmos.nextEventAt(), undefined);
});
test("nextEventAt reports omen times for Ascended users", () => {
  const { cosmos, clock } = summonUniverse({ soul: ASCENDED });
  assert.equal(cosmos.nextEventAt(), clock.t + 1_800_000);
  clock.t += 1_800_000;
  assert.equal(cosmos.nextEventAt(), clock.t + 60_000);
});
test("the Ascended user's omen uses the deadline even when fates are revealed", () => {
  const { cosmos, clock } = summonUniverse({ soul: ASCENDED });
  clock.t += 1_800_000;
  const fates = Object.values(cosmos.revealedFates()).sort();
  assert.deepEqual(fates, ["bad", "neutral", "right"]);
});
