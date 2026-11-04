import { test } from "node:test";
import assert from "node:assert/strict";
import { project, unproject } from "../demo/globe.js";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test("the center of the globe is the rotation center", () => {
  const { lat, lon } = unproject(0, 0, 47, 8);
  close(lat, 47);
  close(lon, 8);
});
test("project and unproject round-trip on visible points", () => {
  for (const [lat, lon] of [[10, 20], [-30, 60], [47, 8], [0, -40]]) {
    const point = project(lat, lon, 10, 15);
    assert.equal(point.visible, true);
    const back = unproject(point.x, point.y, 10, 15);
    close(back.lat, lat);
    close(back.lon, lon);
  }
});
test("the far side reports not visible", () => assert.equal(project(-47, -172, 47, 8).visible, false));
test("points off the disc are undefined", () => assert.equal(unproject(0.9, 0.9, 0, 0), undefined));
test("north is up", () => assert.ok(project(60, 0, 0, 0).y > 0));
test("longitude stays in range across the date line", () => {
  const { lon } = unproject(0.5, 0, 0, 170);
  assert.ok(lon >= -180 && lon <= 180);
});
