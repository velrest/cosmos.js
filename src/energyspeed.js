// How long data takes to arrive. Replaces the speed of light.

const NEAREST_LY = 4.24;
const FARTHEST_LY = 5000;
const NEAREST_MS = 100;
const FARTHEST_MS = 10_800_000;
const NEWBORN_ENERGY = 35;
const ENERGY_DOUBLING = 32.5;
const CURVE = Math.log(FARTHEST_MS / NEAREST_MS) / Math.log(FARTHEST_LY / NEAREST_LY);

export function baseDelayMs(ly) {
  const distance = Math.min(FARTHEST_LY, Math.max(NEAREST_LY, ly));
  return NEAREST_MS * (distance / NEAREST_LY) ** CURVE;
}

export function energyFactor(energy) {
  return 2 ** ((NEWBORN_ENERGY - energy) / ENERGY_DOUBLING);
}

export function delayMs(ly, energy) {
  return baseDelayMs(ly) * energyFactor(energy);
}

export function progressAfter(progress, elapsedMs, ly, energy) {
  return Math.min(1, progress + Math.max(0, elapsedMs) / delayMs(ly, energy));
}
