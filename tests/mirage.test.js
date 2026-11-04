import { test } from "node:test";
import assert from "node:assert/strict";
import { conjureMirage } from "../src/mirage.js";

test("reads current values on every access", () => {
  let data = { a: 1 };
  const live = conjureMirage(() => data);
  assert.equal(live.a, 1);
  data = { a: 2, b: 3 };
  assert.equal(live.a, 2);
  assert.deepEqual(Object.keys(live), ["a", "b"]);
});
test("works with JSON.stringify and for...in", () => {
  const live = conjureMirage(() => ({ a: 1, list: [1, 2] }));
  assert.equal(JSON.stringify(live), '{"a":1,"list":[1,2]}');
  const keys = [];
  for (const key in live) keys.push(key);
  assert.deepEqual(keys, ["a", "list"]);
});
test("goes empty when hidden and fills again", () => {
  let data;
  const live = conjureMirage(() => data);
  assert.equal(JSON.stringify(live), "{}");
  data = { a: 1 };
  assert.equal(live.a, 1);
});
test("writes and deletes are silently ignored, even in strict mode", () => {
  const live = conjureMirage(() => ({ a: 1 }));
  live.a = 2;
  live.b = 3;
  delete live.a;
  Object.defineProperty(live, "c", { value: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(live)), { a: 1 });
});
test("nested values are copies", () => {
  const source = { meta: { x: 1 } };
  const live = conjureMirage(() => source);
  live.meta.x = 99;
  assert.equal(source.meta.x, 1);
  assert.ok(Array.isArray(conjureMirage(() => ({ list: [] })).list));
});
test("array stars behave like arrays and stay live", () => {
  let data = [{ name: "Ada" }];
  const live = conjureMirage(() => data, "array");
  assert.ok(Array.isArray(live));
  assert.deepEqual(live.map((p) => p.name), ["Ada"]);
  data = [{ name: "Ada" }, { name: "Grace" }];
  assert.equal(live.length, 2);
  assert.equal(JSON.stringify(live), '[{"name":"Ada"},{"name":"Grace"}]');
});
test("a shape mismatch reads as empty", () => {
  assert.equal(JSON.stringify(conjureMirage(() => [1], "object")), "{}");
  assert.equal(JSON.stringify(conjureMirage(() => ({ a: 1 }), "array")), "[]");
});
test("array writes are silently ignored", () => {
  const live = conjureMirage(() => [1], "array");
  live.push(2);
  assert.equal(live.length, 1);
});
test("inherited object methods still work", () => {
  const live = conjureMirage(() => ({ a: 1 }));
  assert.equal(live.hasOwnProperty("a"), true);
  assert.equal(live.toString(), "[object Object]");
});
