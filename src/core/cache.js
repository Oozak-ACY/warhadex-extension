import browser from '../vendor/browser.js';

const PREFIX = 'cache:';

export function createCache({ storage, now = () => Date.now() }) {
  return {
    async get(key) {
      const full = PREFIX + key;
      const stored = (await storage.get(full))[full];
      if (stored === undefined) return undefined;
      if (stored.expiresAt <= now()) {
        await storage.remove(full);
        return undefined;
      }
      return stored.value;
    },

    async set(key, value, ttlMs) {
      await storage.set({ [PREFIX + key]: { value, expiresAt: now() + ttlMs } });
    },

    // storage.local ne contient pas que le cache (la cle d API y vit aussi) :
    // on ne supprime que les entrees prefixees
    async clear() {
      const tout = await storage.get(null);
      const keys = Object.keys(tout ?? {}).filter((key) => key.startsWith(PREFIX));
      if (keys.length) await storage.remove(keys);
    }
  };
}

// optional chaining avoids a crash on import outside an extension context (e.g. tests)
export const cache = createCache({ storage: browser?.storage?.local });
