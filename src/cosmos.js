// The engine. Time is lazy: anything touching the cosmos first calls settle(),
// which moves pending updates along by the time that has passed.
import { altitudeDegrees, azimuthDegrees, isStarInSky, whereIsTheSun } from "./celestial-mechanics.js";
import { delayMs, progressAfter } from "./energyspeed.js";
import { NEWBORN_SOUL, applyFate, applyMiss, canEdit, canSee, levelOf, readCosmicEnergy } from "./karma.js";
import { conjureMirage } from "./mirage.js";
import { EVERY_STAR, UNNAMED_STARS, findConstellation, findStar } from "./star-chart.js";

const ASCENDED_OMEN_INTERVAL_MS = 1_800_000;
const OMEN_ANSWER_WINDOW_MS = 60_000;
const SKY_CHECK_INTERVAL_MS = 60_000;

const murmur = (message) => console.warn(`[cosmos] ${message}`);

function purify(value) {
  try {
    const clean = JSON.parse(JSON.stringify(value));
    return typeof clean === "object" && clean !== null ? clean : undefined;
  } catch {
    return undefined;
  }
}

const isJsonShape = (value) => typeof value === "object" && value !== null;
const nameOf = (name) => (typeof name === "string" ? name : "a name that isn't text");

function entriesOf(value) {
  try {
    return Object.entries(value);
  } catch {
    return [];
  }
}

function restoreStars(stars) {
  const restored = {};
  for (const [name, record] of entriesOf(stars ?? {})) {
    const star = findStar(name);
    if (!star || !isJsonShape(record)) continue;
    const pending = (Array.isArray(record.pending) ? record.pending : [])
      .filter((update) => isJsonShape(update) && isJsonShape(update.data))
      .map(({ data, progress }) => ({ data, progress: Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0 }));
    restored[star.name] = isJsonShape(record.data) ? { data: record.data, pending } : { pending };
  }
  return restored;
}

function restoreSoul(soul) {
  return {
    energy: Number.isFinite(soul?.energy) ? Math.min(100, Math.max(0, soul.energy)) : NEWBORN_SOUL.energy,
    streak: Number.isInteger(soul?.streak) && soul.streak >= 0 ? soul.streak : 0,
  };
}

function restoreOmen(omen) {
  const signs = omen?.signs;
  if (!Array.isArray(signs) || signs.length !== 3 || !isJsonShape(omen.fates)) return null;
  if (!signs.every((sign) => ["right", "bad", "neutral"].includes(omen.fates[sign]))) return null;
  return { signs, fates: omen.fates, deadline: Number.isFinite(omen.deadline) ? omen.deadline : null };
}

// Saved data can be old, damaged, or edited by hand. Keep what's usable.
function restoreUniverse(state, t) {
  const saved = isJsonShape(state) ? structuredClone(state) : {};
  const place = saved.location;
  return {
    stars: restoreStars(saved.stars),
    soul: restoreSoul(saved.soul),
    omen: restoreOmen(saved.omen),
    nextOmenAt: Number.isFinite(saved.nextOmenAt) ? saved.nextOmenAt : null,
    location: Number.isFinite(place?.lat) && Number.isFinite(place?.lon) ? place : null,
    settledAt: Number.isFinite(saved.settledAt) ? saved.settledAt : t,
  };
}

export function createCosmos({ now, random = Math.random, persist = () => {}, state, ascendedPrompts = false, fallbackLocation = null }) {
  const universe = restoreUniverse(state, now());
  const listeners = new Set();
  const launchWatchers = new Set();
  let simulatedLocation = null;
  let dirty = false;
  let shifting = false;
  let skyKey = 0;
  let skyGeneration = 0;
  let skyCheckedAt = now();

  const level = () => levelOf(universe.soul);
  const location = () => simulatedLocation ?? universe.location ?? fallbackLocation;
  const inSky = (star) => isStarInSky(star, new Date(now()), location());
  const canRead = (star) => canSee(level(), star) && inSky(star);
  const canWrite = (star) => canEdit(level(), star) && inSky(star);
  const snapshot = () => structuredClone(universe);
  const chronicle = () => persist(snapshot());

  // One pass at a time. Changes made during a pass get a later one, so a
  // callback that keeps causing changes can't freeze the page.
  function flush() {
    if (shifting || !dirty) return;
    shifting = true;
    dirty = false;
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error("[cosmos] onCosmicShift callback failed", error);
      }
    }
    shifting = false;
    if (dirty) setTimeout(flush, 0);
  }

  // A fingerprint of which stars are visible, cheap enough for every check.
  function skyFingerprint() {
    let fingerprint = 0;
    EVERY_STAR.forEach((star, index) => {
      if (inSky(star)) fingerprint = (fingerprint * 31 + index) | 0;
    });
    return fingerprint;
  }

  function refreshSky(t) {
    skyCheckedAt = t;
    skyGeneration++;
    const key = skyFingerprint();
    if (key !== skyKey) dirty = true;
    skyKey = key;
  }

  function moveUpdatesAlong(elapsed) {
    let arrived = false;
    for (const [name, record] of Object.entries(universe.stars)) {
      if (record.pending.length === 0) continue;
      const star = findStar(name);
      for (const update of record.pending) {
        update.progress = progressAfter(update.progress, elapsed, star.ly, universe.soul.energy);
      }
      while (record.pending[0]?.progress >= 1) {
        record.data = record.pending.shift().data;
        arrived = true;
      }
    }
    return arrived;
  }

  function tendOmens(t) {
    if (level() !== "Ascended") {
      universe.nextOmenAt = null;
      return false;
    }
    let changed = false;
    // With ascendedPrompts, an omen drawn on demand gives way to the timed one.
    if (universe.omen && !universe.omen.deadline && universe.nextOmenAt !== null && t >= universe.nextOmenAt) {
      universe.omen = null;
    }
    if (!universe.omen && universe.nextOmenAt === null) {
      universe.nextOmenAt = t + ASCENDED_OMEN_INTERVAL_MS;
      changed = true;
    }
    if (!universe.omen && t >= universe.nextOmenAt) {
      universe.omen = { ...readCosmicEnergy(random), deadline: universe.nextOmenAt + OMEN_ANSWER_WINDOW_MS };
      dirty = true;
      changed = true;
    }
    if (universe.omen?.deadline && t >= universe.omen.deadline) {
      universe.soul = applyMiss(universe.soul);
      universe.omen = null;
      universe.nextOmenAt = null;
      dirty = true;
      changed = true;
    }
    return changed;
  }

  function settle() {
    const t = now();
    const elapsed = t - universe.settledAt;
    let changed = false;
    universe.settledAt = t;
    if (elapsed > 0 && moveUpdatesAlong(elapsed)) {
      dirty = true;
      changed = true;
    }
    if (tendOmens(t)) changed = true;
    if (changed || t - skyCheckedAt >= SKY_CHECK_INTERVAL_MS || t < skyCheckedAt) refreshSky(t);
    if (changed) chronicle();
    flush();
  }

  const recordOf = (star) => (universe.stars[star.name] ??= { pending: [] });
  const dataOf = (star) => universe.stars[star.name]?.data;

  function viewOfStar(star) {
    // An empty star takes its shape from the data on its way.
    const sample = dataOf(star) ?? universe.stars[star.name]?.pending.at(-1)?.data;
    const shape = Array.isArray(sample) ? "array" : "object";
    return conjureMirage(() => {
      settle();
      return canRead(star) ? dataOf(star) : undefined;
    }, shape);
  }

  function viewOfStars(belongs) {
    // Every property access lands here, so only rebuild when the sky changed.
    let seen = null;
    let builtFor = -1;
    return conjureMirage(() => {
      settle();
      if (builtFor !== skyGeneration) {
        builtFor = skyGeneration;
        seen = {};
        for (const [name, record] of Object.entries(universe.stars)) {
          const star = findStar(name);
          if (record.data !== undefined && belongs(star) && canRead(star)) seen[name] = record.data;
        }
      }
      return seen;
    });
  }

  function pickWanderer(worthy) {
    const start = Math.floor(random() * UNNAMED_STARS.length);
    for (let i = 0; i < UNNAMED_STARS.length; i++) {
      const star = UNNAMED_STARS[(start + i) % UNNAMED_STARS.length];
      if (worthy(star)) return star;
    }
    return undefined;
  }

  function launch(star, data) {
    const clean = purify(data);
    if (!clean) {
      murmur(`Dropped a save to ${star.name}: data must be a JSON object or array`);
      return false;
    }
    recordOf(star).pending.push({ data: clean, progress: 0 });
    return true;
  }

  // Saves don't change what users can see yet, so they aren't shifts. The star
  // map still wants to know, to show them on their way.
  function announceLaunch() {
    for (const watcher of launchWatchers) {
      try {
        watcher();
      } catch (error) {
        console.error("[cosmos] A save watcher failed", error);
      }
    }
  }

  function resolveStar(name) {
    const star = findStar(name);
    if (!star) murmur(`Unknown star: ${nameOf(name)}`);
    return star;
  }

  const cosmos = {
    level() {
      settle();
      return level();
    },
    soul() {
      settle();
      return { ...universe.soul };
    },
    snapshot,
    settle,

    seed(initialData) {
      if (typeof initialData !== "object" || initialData === null) return;
      for (const [name, data] of entriesOf(initialData)) {
        const star = resolveStar(name);
        if (!star || universe.stars[star.name]) continue;
        const clean = purify(data);
        if (clean) universe.stars[star.name] = { data: clean, pending: [] };
        else murmur(`Skipped seed for ${star.name}: data must be a JSON object or array`);
      }
      refreshSky(now());
      dirty = dirty && listeners.size > 0;
      chronicle();
      flush();
    },

    setLocation(place) {
      settle();
      universe.location = place;
      dirty = true;
      refreshSky(now());
      chronicle();
      flush();
    },

    simulateLocation(place) {
      settle();
      simulatedLocation = place;
      refreshSky(now());
      flush();
    },

    gazeIntoStar(...args) {
      settle();
      if (args.length === 0) {
        if (!canSee(level(), { mag: Infinity })) return undefined;
        const star = pickWanderer(inSky);
        return star && viewOfStar(star);
      }
      const star = resolveStar(args[0]);
      return star && canRead(star) ? viewOfStar(star) : undefined;
    },

    gazeIntoConstellation(nameOrCode) {
      settle();
      const constellation = findConstellation(nameOrCode);
      if (!constellation) {
        murmur(`Unknown constellation: ${nameOf(nameOrCode)}`);
        return undefined;
      }
      if (!constellation.stars.some(canRead)) return undefined;
      return viewOfStars((star) => star.con === constellation.code);
    },

    gazeIntoSky() {
      settle();
      return EVERY_STAR.some(canRead) ? viewOfStars(() => true) : undefined;
    },

    channelLocation() {
      settle();
      const place = location();
      if (!place) return undefined;
      const source = simulatedLocation ? "simulated" : universe.location ? "real" : "fallback";
      return { ...place, source };
    },

    scanHeavens() {
      settle();
      if (!location()) return undefined;
      const currentLevel = level();
      return EVERY_STAR.filter(inSky)
        .sort((a, b) => a.mag - b.mag)
        .map((star) => ({
          ...star,
          readable: canSee(currentLevel, star),
          travelMs: delayMs(star.ly, universe.soul.energy),
        }));
    },

    pierceVeil() {
      settle();
      if (level() !== "Ascended" || !location()) return undefined;
      const date = new Date(now());
      const place = location();
      const sun = whereIsTheSun(date);
      return {
        sun: { altitude: altitudeDegrees(sun, date, place), azimuth: azimuthDegrees(sun, date, place) },
        stars: EVERY_STAR.filter(inSky).map((star) => ({
          ...star,
          altitude: altitudeDegrees(star, date, place),
          azimuth: azimuthDegrees(star, date, place),
          holdsData: dataOf(star) !== undefined,
          pendingCount: universe.stars[star.name]?.pending.length ?? 0,
        })),
      };
    },

    pierceStarVeil(name) {
      settle();
      const star = findStar(name);
      if (level() !== "Ascended" || !star || !inSky(star)) return undefined;
      const record = universe.stars[star.name];
      return structuredClone({
        ...star,
        data: record?.data,
        pending: (record?.pending ?? []).map((update) => ({
          data: update.data,
          arrivesInMs: (1 - update.progress) * delayMs(star.ly, universe.soul.energy),
        })),
      });
    },

    gazeIntoSelf() {
      settle();
      return level() === "Blinded" ? undefined : universe.soul.energy;
    },

    sendEnergyToStar(...args) {
      settle();
      if (args.length === 0) return undefined;
      const named = args.length > 1;
      const star = named ? resolveStar(args[0]) : pickWanderer(canWrite);
      if (!star || !canWrite(star) || !launch(star, named ? args[1] : args[0])) return undefined;
      chronicle();
      announceLaunch();
      return viewOfStar(star);
    },

    sendEnergyToConstellations(map) {
      settle();
      if (typeof map !== "object" || map === null) return undefined;
      const saved = new Set();
      for (const [nameOrCode, stars] of entriesOf(map)) {
        const constellation = findConstellation(nameOrCode);
        if (!constellation || typeof stars !== "object" || stars === null) {
          murmur(`Skipped invalid constellation: ${nameOrCode}`);
          continue;
        }
        for (const [name, data] of entriesOf(stars)) {
          const star = resolveStar(name);
          if (!star || star.con !== constellation.code || !canWrite(star)) continue;
          if (launch(star, data)) saved.add(star.name);
        }
      }
      if (saved.size === 0) return undefined;
      chronicle();
      announceLaunch();
      return viewOfStars((star) => saved.has(star.name));
    },

    drawOmen() {
      settle();
      if (level() === "Ascended" && !ascendedPrompts) return undefined;
      if (!universe.omen) {
        universe.omen = { ...readCosmicEnergy(random), deadline: null };
        chronicle();
      }
      return cosmos.currentOmen();
    },

    currentOmen() {
      settle();
      if (!universe.omen) return undefined;
      return { signs: [...universe.omen.signs], deadline: universe.omen.deadline };
    },

    revealedFates() {
      settle();
      return universe.omen ? { ...universe.omen.fates } : undefined;
    },

    chooseSign(sign) {
      settle();
      const omen = universe.omen;
      if (!omen || !omen.signs.includes(sign)) return undefined;
      const fate = omen.fates[sign];
      universe.soul = applyFate(universe.soul, fate);
      universe.omen = null;
      universe.nextOmenAt = null;
      const t = now();
      tendOmens(t);
      dirty = true;
      refreshSky(t);
      chronicle();
      flush();
      return fate;
    },

    onCosmicShift(callback) {
      if (typeof callback !== "function") return undefined;
      listeners.add(callback);
      const wasShifting = shifting;
      shifting = true;
      try {
        settle();
        callback();
      } catch (error) {
        console.error("[cosmos] onCosmicShift callback failed", error);
      } finally {
        shifting = wasShifting;
      }
      flush();
      return () => listeners.delete(callback);
    },

    onLaunch(watcher) {
      launchWatchers.add(watcher);
      return () => launchWatchers.delete(watcher);
    },

    nextEventAt() {
      settle();
      const t = now();
      const times = [];
      for (const [name, record] of Object.entries(universe.stars)) {
        const update = record.pending[0];
        if (update) times.push(t + (1 - update.progress) * delayMs(findStar(name).ly, universe.soul.energy));
      }
      if (universe.omen?.deadline) times.push(universe.omen.deadline);
      if (universe.nextOmenAt !== null && !universe.omen?.deadline) times.push(universe.nextOmenAt);
      return times.length ? Math.ceil(Math.min(...times)) : undefined;
    },
  };

  skyKey = skyFingerprint();
  settle();
  return cosmos;
}
