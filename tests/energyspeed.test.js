import { test } from "node:test";
import assert from "node:assert/strict";
import { baseDelayMs, delayMs, energyFactor, progressAfter } from "../src/energyspeed.js";

const close = (a, b, t) => assert.ok(Math.abs(a - b) <= t, `${a} vs ${b}`);

test("base delay anchors", () => {
  close(baseDelayMs(4.24), 100, 0.01);
  close(baseDelayMs(5000), 10_800_000, 1);
});
test("base delay clamps", () => {
  close(baseDelayMs(1), 100, 0.01);
  close(baseDelayMs(326156), 10_800_000, 1);
});
test("mid-range star delays match the spec table", () => {
  close(baseDelayMs(8.6), 320, 10);
  close(baseDelayMs(550) / 60_000, 5, 0.5);
  close(baseDelayMs(2600) / 3_600_000, 1, 0.1);
});
test("energy factor", () => {
  close(energyFactor(35), 1, 1e-9);
  close(energyFactor(100), 0.25, 1e-9);
  close(energyFactor(0), 2.11, 0.01);
});
test("high energy can beat 100ms and low energy can exceed 3 hours", () => {
  assert.ok(delayMs(4.24, 100) < 100);
  assert.ok(delayMs(5000, 0) > 10_800_000);
});
test("progress accumulates and caps at 1", () => {
  const halfway = progressAfter(0, baseDelayMs(8.6) / 2, 8.6, 35);
  close(halfway, 0.5, 1e-9);
  assert.equal(progressAfter(0.9, 1e9, 8.6, 35), 1);
});
test("negative elapsed time never reduces progress", () =>
  assert.equal(progressAfter(0.5, -5000, 8.6, 35), 0.5));
