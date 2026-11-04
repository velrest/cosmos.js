import { test } from "node:test";
import assert from "node:assert/strict";
import { UNNAMED_STARS, findConstellation, findStar, isBrightest } from "../src/star-chart.js";

test("finds Sirius", () => {
  const sirius = findStar("sirius");
  assert.equal(sirius.name, "Sirius");
  assert.equal(sirius.con, "CMa");
  assert.ok(Math.abs(sirius.ly - 8.6) < 0.2);
  assert.ok(isBrightest(sirius));
});
test("Proxima Centauri is present and nearest", () => assert.ok(findStar("Proxima Centauri").ly < 4.3));
test("the Sun is excluded", () => assert.equal(findStar("Sol"), undefined));
test("unnamed stars are listed and findable by ID", () => {
  assert.ok(UNNAMED_STARS.length > 1000);
  const star = UNNAMED_STARS[0];
  assert.match(star.name, /^HYG \d+$/);
  assert.equal(findStar(star.name), star);
});
test("finds constellations by name or code", () => {
  assert.equal(findConstellation("Orion").code, "Ori");
  assert.equal(findConstellation("ori").name, "Orion");
  assert.ok(findConstellation("Orion").stars.some((s) => s.name === "Betelgeuse"));
});
test("all 88 constellations resolve", () => {
  const codes = ["And","Ant","Aps","Aql","Aqr","Ara","Ari","Aur","Boo","CMa","CMi","CVn","Cae","Cam","Cap","Car","Cas","Cen","Cep","Cet","Cha","Cir","Cnc","Col","Com","CrA","CrB","Crt","Cru","Crv","Cyg","Del","Dor","Dra","Equ","Eri","For","Gem","Gru","Her","Hor","Hya","Hyi","Ind","LMi","Lac","Leo","Lep","Lib","Lup","Lyn","Lyr","Men","Mic","Mon","Mus","Nor","Oct","Oph","Ori","Pav","Peg","Per","Phe","Pic","PsA","Psc","Pup","Pyx","Ret","Scl","Sco","Sct","Ser","Sex","Sge","Sgr","Tau","Tel","TrA","Tri","Tuc","UMa","UMi","Vel","Vir","Vol","Vul"];
  assert.equal(codes.length, 88);
  for (const code of codes) assert.equal(findConstellation(code)?.code, code);
});
test("prototype names are unknown", () => {
  for (const name of ["constructor", "__proto__", "toString"]) {
    assert.equal(findStar(name), undefined);
    assert.equal(findConstellation(name), undefined);
  }
});
test("non-string names are unknown", () => {
  for (const name of [undefined, null, 5, {}]) {
    assert.equal(findStar(name), undefined);
    assert.equal(findConstellation(name), undefined);
  }
});
