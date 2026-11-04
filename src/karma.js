// Energy, streaks, permission levels, and the fate of each star sign.
import { isBrightest } from "./star-chart.js";

const ZODIAC = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius",
  "Capricorn", "Aquarius", "Pisces"];
const FATE_EFFECTS = { right: 15, neutral: -2, bad: -10 };
const ASCENSION_STREAK = 3;
const ASCENSION_ENERGY = 75;

export const NEWBORN_SOUL = Object.freeze({ energy: 35, streak: 0 });

export function levelOf({ energy, streak }) {
  if (energy >= ASCENSION_ENERGY) return streak >= ASCENSION_STREAK ? "Ascended" : "Connected";
  if (energy >= 50) return "Aware";
  if (energy >= 25) return "Unconnected";
  if (energy >= 10) return "Hazed";
  return "Blinded";
}

export function canSee(level, star) {
  if (level === "Blinded") return false;
  return level !== "Hazed" || isBrightest(star);
}

export function canEdit(level, star) {
  if (level === "Connected" || level === "Ascended") return true;
  return level === "Aware" && isBrightest(star);
}

function shuffleTheHeavens(items, random) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function readCosmicEnergy(random = Math.random) {
  const signs = shuffleTheHeavens(ZODIAC, random).slice(0, 3);
  const dealt = shuffleTheHeavens(Object.keys(FATE_EFFECTS), random);
  return { signs, fates: Object.fromEntries(signs.map((sign, i) => [sign, dealt[i]])) };
}

export function applyFate(soul, fate) {
  return {
    energy: Math.min(100, Math.max(0, soul.energy + FATE_EFFECTS[fate])),
    streak: fate === "right" ? soul.streak + 1 : 0,
  };
}

export function applyMiss(soul) {
  return { energy: soul.energy, streak: 0 };
}
