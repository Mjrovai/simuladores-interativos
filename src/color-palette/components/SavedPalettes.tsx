"use client";

import type { SavedPalette } from "@/lib/storage";
import { TrashIcon } from "@/components/icons";

interface SavedPalettesProps {
  saved: SavedPalette[];
  onLoad: (palette: SavedPalette) => void;
  onDelete: (id: string) => void;
}

/**
 * Saved palettes grid: compact swatch strips that load into the generator,
 * a delete button per entry, and a friendly empty state.
 */
export default function SavedPalettes({
  saved,
  onLoad,
  onDelete,
}: SavedPalettesProps) {
  return (
    <section aria-labelledby="saved-heading">
      <div className="flex items-end justify-between gap-3">
        <h2
          id="saved-heading"
          className="font-display text-2xl font-semibold tracking-tight text-ink"
        >
          Saved palettes
        </h2>
        {saved.length > 0 && (
          <span className="text-sm text-slate-400">{saved.length} saved</span>
        )}
      </div>

      {saved.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
          No saved palettes yet. Save your favorite combinations here.
        </div>
      ) : (
        <ul role="list" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((entry, i) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"
            >
              <button
                type="button"
                onClick={() => onLoad(entry)}
                aria-label={`Load palette ${i + 1}: ${entry.colors.join(", ")}`}
                className="flex h-12 flex-1 overflow-hidden rounded-lg border border-slate-100 transition-opacity hover:opacity-85"
              >
                {entry.colors.map((color, j) => (
                  <span
                    key={`${color}-${j}`}
                    className="h-full flex-1"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[11px] text-slate-400">
                  {formatDate(entry.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(entry.id)}
                  aria-label={`Delete palette ${i + 1}`}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
