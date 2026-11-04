// Storage. Each star has its own IndexedDB record, so a tab only ever writes
// what it changed. There is an in-memory fallback when IndexedDB is unavailable.

const RECORD_STORE = "records";
const CORE_KEY = "core";
const STAR_PREFIX = "star:";
const WRITE_BATCH_MS = 250;

const requestAsPromise = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

async function openDatabase(dbName) {
  const request = indexedDB.open(dbName, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(RECORD_STORE);
  const db = await requestAsPromise(request);
  if (!db.objectStoreNames.contains(RECORD_STORE)) {
    db.close();
    throw new Error(`The database ${dbName} belongs to something else`);
  }
  return db;
}

function memoryVault() {
  const kept = new Map();
  return {
    read: async () => [...kept],
    write: async (entries) => {
      for (const [key, value] of entries) kept.set(key, value);
    },
  };
}

function databaseVault(db) {
  return {
    async read() {
      const store = db.transaction(RECORD_STORE, "readonly").objectStore(RECORD_STORE);
      const [keys, values] = await Promise.all([requestAsPromise(store.getAllKeys()), requestAsPromise(store.getAll())]);
      return keys.map((key, index) => [key, values[index]]);
    },
    write(entries) {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(RECORD_STORE, "readwrite");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
        const store = transaction.objectStore(RECORD_STORE);
        for (const [key, value] of entries) store.put(value, key);
        // Commit now, so the write survives a page reload right after this.
        transaction.commit?.();
      });
    },
  };
}

function splitIntoEntries({ stars, ...core }) {
  const entries = [[CORE_KEY, core]];
  for (const [name, record] of Object.entries(stars ?? {})) entries.push([STAR_PREFIX + name, record]);
  return entries;
}

function joinEntries(entries) {
  if (entries.length === 0) return undefined;
  const state = { stars: {} };
  for (const [key, value] of entries) {
    if (key === CORE_KEY) Object.assign(state, value);
    else if (typeof key === "string" && key.startsWith(STAR_PREFIX)) state.stars[key.slice(STAR_PREFIX.length)] = value;
  }
  return state;
}

export async function openAkashicRecords(dbName = "cosmos.js/universe") {
  let vault;
  try {
    vault = databaseVault(await openDatabase(dbName));
  } catch (error) {
    console.warn("[cosmos] IndexedDB is unavailable, keeping data in memory only", error);
    vault = memoryVault();
  }

  const written = new Map();
  let unwritten;
  let timer = null;

  async function quiet() {
    clearTimeout(timer);
    timer = null;
    if (unwritten === undefined) return;
    const entries = splitIntoEntries(unwritten);
    unwritten = undefined;
    const changed = entries.filter(([key, value]) => written.get(key) !== JSON.stringify(value));
    if (changed.length === 0) return;
    for (const [key, value] of changed) written.set(key, JSON.stringify(value));
    try {
      await vault.write(changed);
    } catch (error) {
      console.warn("[cosmos] Could not save", error);
    }
  }

  return {
    async load() {
      if (unwritten !== undefined) return unwritten;
      try {
        const entries = await vault.read();
        for (const [key, value] of entries) written.set(key, JSON.stringify(value));
        return joinEntries(entries);
      } catch (error) {
        console.warn("[cosmos] Could not read saved data", error);
        return undefined;
      }
    },
    save(state) {
      unwritten = state;
      timer ??= setTimeout(quiet, WRITE_BATCH_MS);
    },
    quiet,
  };
}
