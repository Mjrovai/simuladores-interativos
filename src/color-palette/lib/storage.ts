/**
 * Saved-palette persistence using localStorage only.
 *
 * Every read/write is guarded so the app keeps working when localStorage is
 * unavailable (private browsing, storage disabled, etc.). These functions are
 * safe to call on the server (they no-op), but the UI only calls them from
 * client effects to avoid hydration mismatches.
 */

export interface SavedPalette {
  id: string;
  colors: string[]; // "#RRGGBB", in order
  createdAt: string; // ISO timestamp
}

export type SaveStatus = "saved" | "duplicate" | "unavailable";

const STORAGE_KEY = "color-palette-generator:saved";
const MAX_SAVED = 24;

function isStorageAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

function readStore(): SavedPalette[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is SavedPalette =>
        p !== null &&
        typeof p === "object" &&
        typeof (p as SavedPalette).id === "string" &&
        Array.isArray((p as SavedPalette).colors) &&
        typeof (p as SavedPalette).createdAt === "string",
    );
  } catch {
    return [];
  }
}

function writeStore(palettes: SavedPalette[]): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(palettes));
    return true;
  } catch {
    return false; // quota exceeded or storage blocked
  }
}

/** True when the browser can actually persist saved palettes. */
export function hasStorage(): boolean {
  return isStorageAvailable();
}

/** All saved palettes, newest first. */
export function getSavedPalettes(): SavedPalette[] {
  return readStore();
}

export interface SaveResult {
  ok: boolean;
  status: SaveStatus;
  id?: string;
}

/**
 * Save a palette. Returns a status the UI can surface:
 * - "duplicate" if an identical palette is already saved
 * - "unavailable" when localStorage cannot be used
 * - "saved" on success
 */
export function savePalette(colors: string[]): SaveResult {
  if (!isStorageAvailable()) return { ok: false, status: "unavailable" };

  const list = readStore();
  const key = colors.join(",").toLowerCase();
  if (list.some((p) => p.colors.join(",").toLowerCase() === key)) {
    return { ok: false, status: "duplicate" };
  }

  const id =
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const entry: SavedPalette = {
    id,
    colors,
    createdAt: new Date().toISOString(),
  };

  const next = [entry, ...list].slice(0, MAX_SAVED);
  const written = writeStore(next);
  return written ? { ok: true, status: "saved", id } : { ok: false, status: "unavailable" };
}

/** Delete one saved palette by id; returns the remaining list. */
export function deleteSavedPalette(id: string): SavedPalette[] {
  const next = readStore().filter((p) => p.id !== id);
  writeStore(next);
  return next;
}

/** Remove all saved palettes. */
export function clearSavedPalettes(): SavedPalette[] {
  writeStore([]);
  return [];
}
