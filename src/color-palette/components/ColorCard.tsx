"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatHsl,
  formatRgb,
  getContrastInfo,
  type ContrastInfo,
} from "@/lib/color";
import { copyText } from "@/lib/clipboard";
import {
  CheckIcon,
  CopyIcon,
  LockIcon,
  UnlockIcon,
} from "@/components/icons";

type CopyKey = "hex" | "rgb" | "hsl";

interface ColorCardProps {
  /** A valid "#RRGGBB" color. */
  hex: string;
  /** 0-based position in the palette (used for labels). */
  index: number;
  /** Whether this slot is preserved across regeneration. */
  locked: boolean;
  onToggleLock: (index: number) => void;
}

const BADGE_STYLES: Record<ContrastInfo["label"], string> = {
  "Good for text": "bg-emerald-50 text-emerald-700",
  "Use carefully": "bg-amber-50 text-amber-700",
  "Decorative only": "bg-slate-100 text-slate-600",
};

/**
 * One swatch card: large color area (auto black/white text), clickable HEX,
 * RGB/HSL copy rows, lock toggle, and simplified WCAG contrast guidance.
 */
export default function ColorCard({
  hex,
  index,
  locked,
  onToggleLock,
}: ColorCardProps) {
  const [copied, setCopied] = useState<CopyKey | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  async function handleCopy(key: CopyKey, value: string) {
    const ok = await copyText(value);
    if (ok) {
      setCopyFailed(false);
      setCopied(key);
    } else {
      setCopyFailed(true);
      setCopied(null);
    }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setCopied(null);
      setCopyFailed(false);
    }, 1800);
  }

  const info = getContrastInfo(hex);
  const onLight = info.best === "white";
  const swatchText = onLight ? "text-white" : "text-black";
  const swatchSub = onLight ? "text-white/80" : "text-black/60";
  const lockButton = onLight
    ? "bg-white/15 hover:bg-white/30"
    : "bg-black/10 hover:bg-black/20";

  const rgb = formatRgb(hex);
  const hsl = formatHsl(hex);

  return (
    <li className="animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div
        className={`flex min-h-44 flex-col gap-3 p-4 ${swatchText}`}
        style={{ backgroundColor: hex }}
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className={`text-[11px] font-semibold uppercase tracking-wider ${swatchSub}`}
          >
            Color {index + 1}
          </span>
          <button
            type="button"
            onClick={() => onToggleLock(index)}
            aria-pressed={locked}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${lockButton}`}
          >
            {locked ? (
              <LockIcon className="h-3.5 w-3.5" />
            ) : (
              <UnlockIcon className="h-3.5 w-3.5" />
            )}
            {locked ? "Locked" : "Lock"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleCopy("hex", hex)}
          className="group flex items-center gap-2 self-start rounded-lg font-display text-2xl font-semibold tracking-tight"
          aria-label={`Copy HEX value ${hex}`}
        >
          {hex}
          {copied === "hex" ? (
            <CheckIcon className="h-5 w-5" />
          ) : (
            <CopyIcon className="h-5 w-5 opacity-60 transition-opacity group-hover:opacity-100" />
          )}
        </button>

        <p className={`text-xs ${swatchSub}`}>
          Best text: <span className="font-semibold">{info.best}</span>
        </p>

        {/* Screen-reader feedback for copy actions (icon swap is visual only). */}
        <span className="sr-only" role="status" aria-live="polite">
          {copied
            ? `Copied ${copied.toUpperCase()} value.`
            : copyFailed
              ? "Copy is not available in this browser."
              : ""}
        </span>
      </div>

      <div className="space-y-1 p-3">
        <CopyRow
          label="RGB"
          value={rgb}
          active={copied === "rgb"}
          onCopy={() => handleCopy("rgb", rgb)}
        />
        <CopyRow
          label="HSL"
          value={hsl}
          active={copied === "hsl"}
          onCopy={() => handleCopy("hsl", hsl)}
        />
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2 pt-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE_STYLES[info.label]}`}
          >
            {info.label}
          </span>
          <span className="text-[11px] tabular-nums text-slate-400">
            white {info.ratioWhite.toFixed(1)} · black {info.ratioBlack.toFixed(1)}
          </span>
        </div>
      </div>
    </li>
  );
}

/** Compact value + copy-button row (RGB / HSL). */
function CopyRow({
  label,
  value,
  active,
  onCopy,
}: {
  label: string;
  value: string;
  active: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
      <div className="flex min-w-0 items-baseline gap-2 text-xs">
        <span className="w-7 shrink-0 font-semibold text-slate-400">
          {label}
        </span>
        <code className="truncate font-mono text-slate-700">{value}</code>
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label} value ${value}`}
        className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink"
      >
        {active ? (
          <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <CopyIcon className="h-3.5 w-3.5" />
        )}
        {active ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
