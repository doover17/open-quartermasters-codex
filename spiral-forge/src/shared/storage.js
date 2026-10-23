// Browser-storage keys. These must not change: saved work is keyed by them.
export const STORE_KEY = "spiral-forge-v2";
export const OLD_STORE_KEY = "spiral-forge-v1";
export const LIB_KEY = "spiral-forge-library-v1";
export const NDEST_KEY = "spiral-forge-notion-dest";

export function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
