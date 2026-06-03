/* In-memory mock of the chrome.storage.local / chrome.storage.sync APIs.
 *
 * Enough of the surface for storage.js: get(keyOrKeys|null) -> Promise<obj>,
 * set(obj) -> Promise, remove(keyOrKeys) -> Promise. Each area is an isolated
 * key/value store. resetChrome() installs a fresh `global.chrome` and returns
 * the backing stores so a test can inspect or seed them directly.
 */

function makeArea() {
  const store = {};
  return {
    __store: store,
    async get(query) {
      if (query == null) return { ...store };
      const keys = Array.isArray(query) ? query : [query];
      const out = {};
      for (const k of keys) if (k in store) out[k] = store[k];
      return out;
    },
    async set(obj) {
      Object.assign(store, obj);
    },
    async remove(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
    },
  };
}

function resetChrome() {
  const local = makeArea();
  const sync = makeArea();
  global.chrome = { storage: { local, sync } };
  return { local, sync };
}

module.exports = { resetChrome };
