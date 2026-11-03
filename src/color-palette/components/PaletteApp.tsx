"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ColorCard from "@/components/ColorCard";
import ExportPanel from "@/components/ExportPanel";
import SavedPalettes from "@/components/SavedPalettes";
import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  HeartIcon,
  InfoIcon,
  LinkIcon,
  ShuffleIcon,
  SparklesIcon,
} from "@/components/icons";
import { copyText } from "@/lib/clipboard";
import { normalizeHex } from "@/lib/color";
import {
  applyLocks,
  DEFAULT_PALETTE,
  ensureFiveDistinct,
  generatePalette,
  HARMONY_MODES,
  type HarmonyMode,
  type Palette,
} from "@/lib/palette";
import {
  deleteSavedPalette,
  getSavedPalettes,
  savePalette,
  type SavedPalette,
} from "@/lib/storage";

type MessageKind = "info" | "success" | "warning";

interface Message {
  id: number;
  kind: MessageKind;
  text: string;
}

const PALETTE_SIZE = 5;

const emptyLocks = (): boolean[] => Array<boolean>(PALETTE_SIZE).fill(false);

const MESSAGE_STYLES: Record<MessageKind, string> = {
  info: "bg-indigo-50 text-indigo-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
};

const SEED_ERROR = "Enter a valid HEX color like #4F46E5.";

const SECONDARY_BUTTON =
  "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-slate-50";

/**
 * The interactive generator: controls (generate / randomize / save / share /
 * locks / harmony / seed), the 5-color card grid, the export panel, and saved
 * palettes. All state lives here; child components stay presentational.
 *
 * localStorage and the URL are only touched inside client effects, so the
 * server render (and first client render) always match — no hydration issues.
 */
export default function PaletteApp() {
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const [locks, setLocks] = useState<boolean[]>(emptyLocks);
  const [mode, setMode] = useState<HarmonyMode>("random");
  const [seedInput, setSeedInput] = useState("");
  const [seedError, setSeedError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedPalette[]>([]);
  const [message, setMessage] = useState<Message | null>(null);

  const messageTimerRef = useRef<number | null>(null);
  const messageIdRef = useRef(0);

  const notify = useCallback(
    (text: string, kind: MessageKind = "info") => {
      messageIdRef.current += 1;
      setMessage({ id: messageIdRef.current, kind, text });
    },
    [],
  );

  // Auto-clear status messages after a few seconds.
  useEffect(() => {
    if (message === null) return;
    if (messageTimerRef.current !== null) {
      window.clearTimeout(messageTimerRef.current);
    }
    messageTimerRef.current = window.setTimeout(() => setMessage(null), 4000);
    return () => {
      if (messageTimerRef.current !== null) {
        window.clearTimeout(messageTimerRef.current);
      }
    };
  }, [message]);

  // Client-only boot: load saved palettes and honor a shared ?palette=... URL.
  useEffect(() => {
    setSaved(getSavedPalettes());
    const raw = new URLSearchParams(window.location.search).get("palette");
    if (raw !== null) {
      const valid = raw
        .split(",")
        .map((token) => normalizeHex(token))
        .filter((hex): hex is string => hex !== null);
      if (valid.length > 0) {
        // Invalid tokens are ignored; the rest is topped up to exactly 5.
        setPalette(ensureFiveDistinct(valid.map((hex) => "#" + hex)));
      }
    }
  }, []);

  // Keep the current URL shareable as the palette changes.
  useEffect(() => {
    const url = `${window.location.pathname}?palette=${palette.join(",")}`;
    window.history.replaceState(null, "", url);
  }, [palette]);

  const anyLocked = locks.some(Boolean);

  function generateWith(targetMode: HarmonyMode) {
    const seed = seedInput.trim();
    if (seed !== "" && !normalizeHex(seed)) {
      setSeedError(SEED_ERROR);
      return;
    }
    if (locks.every(Boolean)) {
      notify("Unlock a color to generate new options.", "warning");
      return;
    }
    if (seedError !== null) setSeedError(null);
    const fresh = generatePalette({
      mode: targetMode,
      seed: seed !== "" ? seed : undefined,
    });
    setPalette((current) => applyLocks(current, fresh, locks));
  }

  function handleToggleLock(index: number) {
    setLocks((current) =>
      current.map((value, i) => (i === index ? !value : value)),
    );
  }

  function handleClearLocks() {
    setLocks(emptyLocks());
    notify("Locks cleared.");
  }

  function handleSave() {
    const result = savePalette(palette);
    if (result.status === "saved") {
      setSaved(getSavedPalettes());
      notify("Palette saved.", "success");
    } else if (result.status === "duplicate") {
      notify("Already saved.", "info");
    } else {
      notify("Saving is unavailable in this browser mode.", "warning");
    }
  }

  function handleShare() {
    const url = `${window.location.origin}/?palette=${palette.join(",")}`;
    void copyText(url).then((ok) => {
      notify(
        ok
          ? "Link copied to clipboard."
          : "Copy is not available in this browser.",
        ok ? "success" : "warning",
      );
    });
  }

  function handleLoadSaved(entry: SavedPalette) {
    setPalette(ensureFiveDistinct(entry.colors));
    setLocks(emptyLocks());
    notify("Palette loaded.", "success");
    document
      .getElementById("generator")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleDeleteSaved(id: string) {
    setSaved(deleteSavedPalette(id));
  }

  function handleSeedBlur() {
    const seed = seedInput.trim();
    setSeedError(seed !== "" && !normalizeHex(seed) ? SEED_ERROR : null);
  }

  const normalizedSeed = normalizeHex(seedInput);
  const colorPickerValue = normalizedSeed
    ? `#${normalizedSeed.toLowerCase()}`
    : "#808080";

  return (
    <div className="space-y-12">
      {/* Generator controls */}
      <section
        id="generator"
        aria-label="Palette generator controls"
        className="scroll-mt-20"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => generateWith(mode)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 active:bg-indigo-700"
              >
                <SparklesIcon className="h-4 w-4" />
                Generate palette
              </button>
              <button
                type="button"
                onClick={() => generateWith("random")}
                className={SECONDARY_BUTTON}
              >
                <ShuffleIcon className="h-4 w-4" />
                Randomize
              </button>
              <button
                type="button"
                onClick={handleSave}
                className={SECONDARY_BUTTON}
              >
                <HeartIcon className="h-4 w-4" />
                Save palette
              </button>
              <button
                type="button"
                onClick={handleShare}
                className={SECONDARY_BUTTON}
              >
                <LinkIcon className="h-4 w-4" />
                Share palette
              </button>
              {anyLocked && (
                <button
                  type="button"
                  onClick={handleClearLocks}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink"
                >
                  Clear locks
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="harmony-mode"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-400"
                >
                  Harmony mode
                </label>
                <div className="relative">
                  <select
                    id="harmony-mode"
                    value={mode}
                    onChange={(event) =>
                      setMode(event.target.value as HarmonyMode)
                    }
                    className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-ink"
                  >
                    {HARMONY_MODES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="seed-hex"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-400"
                >
                  Seed color
                </label>
                <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <input
                    type="color"
                    value={colorPickerValue}
                    onChange={(event) => {
                      setSeedInput(event.target.value.toUpperCase());
                      setSeedError(null);
                    }}
                    aria-label="Pick a seed color with the color picker"
                    className="h-9 w-9 cursor-pointer bg-transparent p-1"
                  />
                  <input
                    type="text"
                    id="seed-hex"
                    value={seedInput}
                    onChange={(event) => setSeedInput(event.target.value)}
                    onBlur={handleSeedBlur}
                    placeholder="#2A9D8F"
                    maxLength={7}
                    spellCheck={false}
                    autoComplete="off"
                    aria-invalid={seedError !== null}
                    aria-describedby={seedError !== null ? "seed-error" : undefined}
                    className="h-9 w-24 border-0 bg-transparent px-2 font-mono text-sm text-ink placeholder:text-slate-300 focus:outline-none"
                  />
                  {seedInput !== "" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSeedInput("");
                        setSeedError(null);
                      }}
                      aria-label="Clear seed color"
                      className="flex h-9 w-8 items-center justify-center text-slate-400 transition-colors hover:bg-slate-50 hover:text-ink"
                    >
                      <CloseIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {seedError !== null && (
            <p
              id="seed-error"
              role="alert"
              className="mt-3 flex items-center gap-1.5 text-sm font-medium text-red-600"
            >
              <AlertIcon className="h-4 w-4 shrink-0" />
              {seedError}
            </p>
          )}

          <p className="mt-4 text-xs text-slate-400">
            Runs in your browser. No signup required. Saved palettes stay on
            this device.
          </p>
        </div>

        {/* Global status line (copy/save/share/generate feedback). */}
        <div aria-live="polite" aria-atomic="true" className="mt-3 min-h-6">
          {message !== null && (
            <span
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${MESSAGE_STYLES[message.kind]}`}
            >
              {message.kind === "success" ? (
                <CheckIcon className="h-4 w-4 shrink-0" />
              ) : message.kind === "warning" ? (
                <AlertIcon className="h-4 w-4 shrink-0" />
              ) : (
                <InfoIcon className="h-4 w-4 shrink-0" />
              )}
              {message.text}
            </span>
          )}
        </div>
      </section>

      {/* The palette itself */}
      <section aria-label="Current palette">
        <ul
          role="list"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          {palette.map((hex, index) => (
            <ColorCard
              key={index}
              hex={hex}
              index={index}
              locked={locks[index] === true}
              onToggleLock={handleToggleLock}
            />
          ))}
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <InfoIcon className="h-3.5 w-3.5 shrink-0" />
          Contrast guidance is a helpful starting point, not a full
          accessibility audit.
        </p>
      </section>

      <ExportPanel palette={palette} />

      <SavedPalettes
        saved={saved}
        onLoad={handleLoadSaved}
        onDelete={handleDeleteSaved}
      />
    </div>
  );
}
