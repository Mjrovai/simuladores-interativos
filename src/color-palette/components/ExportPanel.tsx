"use client";

import { useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/clipboard";
import {
  downloadSvg,
  paletteToCssVariables,
  paletteToTailwindConfig,
  paletteToJson,
  paletteToSvg,
} from "@/lib/export";
import type { Palette } from "@/lib/palette";
import { CheckIcon, CopyIcon, DownloadIcon } from "@/components/icons";

type Tab = "css" | "tailwind" | "json" | "svg";

const TABS: { id: Tab; label: string }[] = [
  { id: "css", label: "CSS variables" },
  { id: "tailwind", label: "Tailwind" },
  { id: "json", label: "JSON" },
  { id: "svg", label: "SVG" },
];

function buildContent(tab: Tab, palette: Palette): string {
  switch (tab) {
    case "css":
      return paletteToCssVariables(palette);
    case "tailwind":
      return paletteToTailwindConfig(palette);
    case "json":
      return paletteToJson(palette);
    case "svg":
      return paletteToSvg(palette);
  }
}

/**
 * Export panel: format tabs (CSS / Tailwind / JSON / SVG), a copy button for
 * the active snippet, and a download button on the SVG tab.
 */
export default function ExportPanel({ palette }: { palette: Palette }) {
  const [tab, setTab] = useState<Tab>("css");
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const content = buildContent(tab, palette);

  function flash(next: "copied" | "failed") {
    setState(next);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setState("idle"), 1800);
  }

  async function handleCopy() {
    const ok = await copyText(content);
    flash(ok ? "copied" : "failed");
  }

  function handleDownload() {
    downloadSvg(paletteToSvg(palette), "palette.svg");
  }

  return (
    <section aria-labelledby="export-heading">
      <h2
        id="export-heading"
        className="font-display text-2xl font-semibold tracking-tight text-ink"
      >
        Export your palette
      </h2>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Export format"
            className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setState("idle");
                }}
                aria-pressed={tab === t.id}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t.id
                    ? "bg-white text-ink shadow-sm"
                    : "text-slate-500 hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-slate-50"
            >
              {state === "copied" ? (
                <CheckIcon className="h-4 w-4 text-emerald-600" />
              ) : (
                <CopyIcon className="h-4 w-4" />
              )}
              {state === "copied"
                ? "Copied!"
                : state === "failed"
                  ? "Copy unavailable"
                  : "Copy"}
            </button>
            {tab === "svg" && (
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-slate-50"
              >
                <DownloadIcon className="h-4 w-4" />
                Download SVG
              </button>
            )}
          </div>
        </div>
        <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
          <code>{content}</code>
        </pre>
        <p className="mt-3 text-xs text-slate-400">
          Coming soon: Pro exports and brand kits.
        </p>
      </div>
    </section>
  );
}
