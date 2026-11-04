import { createCosmos } from "../src/cosmos.js";

// At this moment Sirius is nearly overhead at lat 0, lon 0, far from the sun.
export const T0 = Date.UTC(2026, 0, 1, 0);
export const SIRIUS_UP = { lat: 0, lon: 0 };
export const SIRIUS_DOWN = { lat: 0, lon: 180 };
// At the north pole, stars with a positive declination never set.
export const NORTH_POLE = { lat: 90, lon: 0 };

export function summonUniverse({ soul = { energy: 35, streak: 0 }, location = SIRIUS_UP, random, ascendedPrompts } = {}) {
  const clock = { t: T0 };
  const saves = [];
  const cosmos = createCosmos({
    now: () => clock.t,
    random,
    ascendedPrompts,
    persist: (state) => saves.push(state),
    state: { stars: {}, soul, omen: null, nextOmenAt: null, location, settledAt: T0 },
  });
  return { cosmos, clock, saves };
}

export function pickFate(cosmos, fate) {
  const fates = cosmos.revealedFates();
  const sign = Object.keys(fates).find((s) => fates[s] === fate);
  return cosmos.chooseSign(sign);
}
