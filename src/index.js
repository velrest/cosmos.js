// The public API.
import { openAkashicRecords } from "./akashic-records.js";
import { createCosmos } from "./cosmos.js";
import { summonOracle } from "./oracle.js";
import { summonStarMap } from "./star-map.js";

const FIRST_FIX_WAIT_MS = 5000;
const HEARTBEAT_MS = 1000;
const LONGEST_TIMER_MS = 2 ** 31 - 1;

let engine = null;
let awakening = null;

function asleep() {
  if (engine) return false;
  console.warn("[cosmos] Call initializeCosmos first");
  return true;
}

function isPlaceOnEarth(place) {
  return (
    typeof place === "object" && place !== null &&
    Number.isFinite(place.lat) && Math.abs(place.lat) <= 90 &&
    Number.isFinite(place.lon) && Math.abs(place.lon) <= 180
  );
}

// Tracks the real location, and resolves on the first answer or after a wait.
function followTheUser(cosmos) {
  return new Promise((resolve) => {
    const geolocation = globalThis.navigator?.geolocation;
    if (!geolocation) {
      resolve();
      return;
    }
    setTimeout(resolve, FIRST_FIX_WAIT_MS);
    try {
      geolocation.watchPosition(
        ({ coords }) => {
          cosmos.setLocation({ lat: coords.latitude, lon: coords.longitude });
          resolve();
        },
        (error) => {
          console.warn(`[cosmos] Could not get the location: ${error?.message || "no reason given"}`);
          resolve();
        },
      );
    } catch {
      resolve();
    }
  });
}

function keepTime(cosmos) {
  let timer = null;
  const rearm = () => {
    clearTimeout(timer);
    const at = cosmos.nextEventAt();
    if (at === undefined) return;
    timer = setTimeout(() => {
      cosmos.settle();
      rearm();
    }, Math.min(LONGEST_TIMER_MS, Math.max(0, at - Date.now())));
  };
  setInterval(() => {
    cosmos.settle();
    rearm();
  }, HEARTBEAT_MS);
  return rearm;
}

let rearmTimer = () => {};

async function awaken(initialData, { simulatedLocation, fallbackLocation, revealFates = false, ascendedPrompts = false }) {
  const records = await openAkashicRecords();
  const state = await records.load();
  if (fallbackLocation !== undefined && !isPlaceOnEarth(fallbackLocation)) {
    console.warn("[cosmos] Ignored an invalid fallbackLocation");
  }
  const cosmos = createCosmos({
    now: Date.now,
    persist: records.save,
    state,
    ascendedPrompts,
    fallbackLocation: isPlaceOnEarth(fallbackLocation) ? fallbackLocation : null,
  });
  addEventListener("pagehide", records.quiet);

  const simulated = simulatedLocation !== undefined && isPlaceOnEarth(simulatedLocation);
  if (simulatedLocation !== undefined && !simulated) {
    console.warn("[cosmos] Ignored an invalid simulatedLocation");
  }
  if (simulated) cosmos.simulateLocation(simulatedLocation);

  cosmos.seed(initialData);
  engine = cosmos;
  rearmTimer = keepTime(cosmos);
  summonOracle(cosmos, { revealFates, ascendedPrompts });
  if (!simulated) await followTheUser(cosmos);
}

export function initializeCosmos(initialData, options = {}) {
  awakening ??= awaken(initialData, options ?? {});
  return awakening;
}

export function gazeIntoStar(...args) {
  return asleep() ? undefined : engine.gazeIntoStar(...args);
}

export function gazeIntoConstellation(constellation) {
  return asleep() ? undefined : engine.gazeIntoConstellation(constellation);
}

export function gazeIntoSky() {
  return asleep() ? undefined : engine.gazeIntoSky();
}

export function scanHeavens() {
  return asleep() ? undefined : engine.scanHeavens();
}

export function channelLocation() {
  return asleep() ? undefined : engine.channelLocation();
}

export function pierceVeil() {
  return asleep() ? undefined : engine.pierceVeil();
}

export function pierceStarVeil(star) {
  return asleep() ? undefined : engine.pierceStarVeil(star);
}

export function renderCosmicPlane(element) {
  if (asleep()) return undefined;
  if (!(element instanceof Element)) {
    console.warn("[cosmos] renderCosmicPlane needs a DOM element");
    return undefined;
  }
  return summonStarMap(engine, element);
}

export function gazeIntoSelf() {
  return asleep() ? undefined : engine.gazeIntoSelf();
}

export function sendEnergyToStar(...args) {
  if (asleep()) return undefined;
  const seen = engine.sendEnergyToStar(...args);
  rearmTimer();
  return seen;
}

export function sendEnergyToConstellations(constellations) {
  if (asleep()) return undefined;
  const seen = engine.sendEnergyToConstellations(constellations);
  rearmTimer();
  return seen;
}

export function onCosmicShift(callback) {
  return asleep() ? undefined : engine.onCosmicShift(callback);
}
