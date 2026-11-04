import { test } from "node:test";
import assert from "node:assert/strict";
import { NEWBORN_SOUL, applyFate, applyMiss, canEdit, canSee, levelOf, readCosmicEnergy } from "../src/karma.js";

test("level boundaries", () => {
  const cases = [[0, "Blinded"], [9, "Blinded"], [10, "Hazed"], [24, "Hazed"], [25, "Unconnected"],
    [49, "Unconnected"], [50, "Aware"], [74, "Aware"], [75, "Connected"], [100, "Connected"]];
  for (const [energy, level] of cases) assert.equal(levelOf({ energy, streak: 0 }), level);
});
test("a new soul is Unconnected", () => assert.equal(levelOf(NEWBORN_SOUL), "Unconnected"));
test("Ascended needs both streak and energy", () => {
  assert.equal(levelOf({ energy: 75, streak: 3 }), "Ascended");
  assert.equal(levelOf({ energy: 74, streak: 3 }), "Aware");
  assert.equal(levelOf({ energy: 100, streak: 2 }), "Connected");
});
test("fates change energy and streak", () => {
  assert.deepEqual(applyFate({ energy: 50, streak: 2 }, "right"), { energy: 65, streak: 3 });
  assert.deepEqual(applyFate({ energy: 50, streak: 2 }, "neutral"), { energy: 48, streak: 0 });
  assert.deepEqual(applyFate({ energy: 50, streak: 2 }, "bad"), { energy: 40, streak: 0 });
});
test("energy is clamped", () => {
  assert.equal(applyFate({ energy: 95, streak: 0 }, "right").energy, 100);
  assert.equal(applyFate({ energy: 5, streak: 0 }, "bad").energy, 0);
});
test("a miss resets streak without energy cost", () =>
  assert.deepEqual(applyMiss({ energy: 90, streak: 5 }), { energy: 90, streak: 0 }));
test("visibility and editing per level", () => {
  const bright = { mag: 1 }, faint = { mag: 4 };
  const table = { Blinded: [0, 0, 0, 0], Hazed: [1, 0, 0, 0], Unconnected: [1, 1, 0, 0],
    Aware: [1, 1, 1, 0], Connected: [1, 1, 1, 1], Ascended: [1, 1, 1, 1] };
  for (const [level, [seeBright, seeFaint, editBright, editFaint]] of Object.entries(table)) {
    assert.equal(canSee(level, bright), !!seeBright);
    assert.equal(canSee(level, faint), !!seeFaint);
    assert.equal(canEdit(level, bright), !!editBright);
    assert.equal(canEdit(level, faint), !!editFaint);
  }
});
test("readCosmicEnergy gives 3 distinct zodiac signs, one of each fate", () => {
  for (let i = 0; i < 200; i++) {
    const { signs, fates } = readCosmicEnergy();
    assert.equal(new Set(signs).size, 3);
    assert.deepEqual(signs.map((s) => fates[s]).sort(), ["bad", "neutral", "right"]);
  }
});
