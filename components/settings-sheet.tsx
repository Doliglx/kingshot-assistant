"use client"

import { useState } from "react"
import { Check, Download, Globe, HardDriveDownload, Palette, RotateCcw, Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { LANGS, LANG_NAMES, isLang } from "@/lib/messages"
import { ACCENT_PRESETS, DEFAULT_HUE, accentColor, useSettings } from "@/components/app-settings"
import { BackupDialog } from "@/components/backup-dialog"

/** Bottom sheet with the language and accent colour settings. */
export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { t, lang, hue, setLang, setHue } = useSettings()
  const [backup, setBackup] = useState<"export" | "import" | null>(null)

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label={t.common.close}
        onClick={onClose}
        className="fade-enter absolute inset-0 bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.common.settings}
        className="sheet-enter relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-b-0 border-border/60 bg-card p-6 pb-8 shadow-2xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight">{t.common.settings}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 transition hover:border-primary/40 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Language */}
        <div className="mb-6 space-y-2">
          <label
            htmlFor="app-lang"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"
          >
            <Globe className="h-4 w-4" />
            {t.settings.language}
          </label>
          <select
            id="app-lang"
            value={lang}
            onChange={(e) => isLang(e.target.value) && setLang(e.target.value)}
            className="h-11 w-full rounded-lg border border-border/50 bg-input px-3 text-base"
          >
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_NAMES[l]}
              </option>
            ))}
          </select>
        </div>

        {/* Accent colour */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Palette className="h-4 w-4" />
            {t.settings.accent}
          </div>
          <div className="flex flex-wrap gap-3">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setHue(p.hue)}
                aria-label={p.id}
                aria-pressed={hue === p.hue}
                style={{ backgroundColor: accentColor(p.hue) }}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full transition active:scale-90",
                  hue === p.hue ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : "opacity-80"
                )}
              >
                {hue === p.hue && <Check className="h-5 w-5 text-white" />}
              </button>
            ))}
          </div>
          <label htmlFor="accent-hue" className="block pt-1 text-xs text-muted-foreground">
            {t.settings.custom}
          </label>
          <input
            id="accent-hue"
            type="range"
            min={0}
            max={360}
            step={1}
            value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            className="hue-slider"
          />
          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">{t.settings.autoSaved}</p>
            <button
              type="button"
              onClick={() => setHue(DEFAULT_HUE)}
              disabled={hue === DEFAULT_HUE}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-xs transition hover:border-primary/40 disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t.settings.reset}
            </button>
          </div>
        </div>

        {/* Backup and restore */}
        <div className="mt-6 space-y-3 border-t border-border/50 pt-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <HardDriveDownload className="h-4 w-4" />
            {t.backup.title}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{t.backup.intro}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setBackup("export")}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border/50 px-2 text-sm transition hover:border-primary/40 active:scale-95"
            >
              <Upload className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{t.backup.export}</span>
            </button>
            <button
              type="button"
              onClick={() => setBackup("import")}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border/50 px-2 text-sm transition hover:border-primary/40 active:scale-95"
            >
              <Download className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{t.backup.import}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    {backup && <BackupDialog mode={backup} onClose={() => setBackup(null)} />}
    </>
  )
}
