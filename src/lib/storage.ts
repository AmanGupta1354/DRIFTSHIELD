import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/** localStorage can be missing or throw (private windows, blocked storage, SSR): never let that break the app. */
const safe: StateStorage = {
  getItem: (k) => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  },
  removeItem: (k) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const safeJSONStorage = createJSONStorage(() => safe);
export const STORE_KEY = 'driftshield:v1';

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = safe.getItem(key) as string | null;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, value: unknown) {
  safe.setItem(key, JSON.stringify(value));
}
