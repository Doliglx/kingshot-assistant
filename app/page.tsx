"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { App as CapacitorApp } from "@capacitor/app"
import {
  ArrowLeft,
  Crosshair,
  LayoutGrid,
  MessageSquareText,
  MousePointerClick,
  Package,
  RotateCcw,
  Settings as SettingsIcon,
  Swords,
  Target,
  Timer,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSettings } from "@/components/app-settings"
import { SettingsSheet } from "@/components/settings-sheet"
import { AppLogo } from "@/components/app-logo"
import { ResourceCalculator } from "@/components/resource-calculator"
import { Frakinator } from "@/components/frakinator"
import { RatioCalculator } from "@/components/ratio-calculator"
import { BuffDebuffCalculator } from "@/components/buff-debuff-calculator"
import { GatherTimeCalculator } from "@/components/gather-time-calculator"
import { RallyTiming } from "@/components/rally-timing"
import { AutoClicker } from "@/components/auto-clicker"
import { TextArtModule } from "@/components/text-art"
import { ModuleGrid, type TileDef } from "@/components/module-grid"
import { DevBadge, NewBadge } from "@/components/badges"
import { handleBack, onBack } from "@/lib/back-stack"
import { MODULE_IDS, isDefaultOrder, loadOrder, saveOrder, type ModuleId } from "@/lib/module-order"

const MODULES: {
  id: ModuleId
  icon: LucideIcon
  /** "dev": still being tested. "new": just arrived. */
  badge?: "dev" | "new"
  Component: React.ComponentType
}[] = [
  { id: "rss", icon: Package, Component: ResourceCalculator },
  { id: "fraki", icon: Swords, Component: Frakinator },
  { id: "ratio", icon: Target, Component: RatioCalculator },
  { id: "buff", icon: TrendingUp, Component: BuffDebuffCalculator },
  { id: "gather", icon: Timer, Component: GatherTimeCalculator },
  { id: "rally", icon: Crosshair, badge: "dev", Component: RallyTiming },
  { id: "clicker", icon: MousePointerClick, badge: "dev", Component: AutoClicker },
  { id: "textart", icon: MessageSquareText, badge: "new", Component: TextArtModule },
]

const Badge = ({ kind, className }: { kind?: "dev" | "new"; className?: string }) =>
  kind === "dev" ? <DevBadge className={className} /> : kind === "new" ? <NewBadge className={className} /> : null

const EXIT_MS = 220

export default function KingshotAssistant() {
  const { t, ready } = useSettings()
  const [active, setActive] = useState<ModuleId | null>(null)
  const [closing, setClosing] = useState(false)
  const [origin, setOrigin] = useState("50% 50%")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [order, setOrder] = useState<string[]>([...MODULE_IDS])
  const [reordering, setReordering] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const open = (id: ModuleId, el: HTMLElement) => {
    // The module grows out of the tile that was tapped.
    const r = el.getBoundingClientRect()
    setOrigin(`${r.left + r.width / 2}px ${r.top + r.height / 2}px`)
    setClosing(false)
    setActive(id)
  }

  const close = useCallback(() => {
    if (closeTimer.current) return
    setClosing(true)
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null
      setActive(null)
      setClosing(false)
    }, EXIT_MS)
  }, [])

  useEffect(() => setOrder(loadOrder()), [])

  // The back button leaves the reorder mode first.
  useEffect(() => (reordering ? onBack(() => setReordering(false)) : undefined), [reordering])

  const resetOrder = () => {
    setOrder([...MODULE_IDS])
    saveOrder(MODULE_IDS)
  }

  // Android back button: settings → screen inside the module → module → leave the app.
  const stateRef = useRef({ active, settingsOpen })
  stateRef.current = { active, settingsOpen }
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const sub = CapacitorApp.addListener("backButton", () => {
      if (handleBack()) return
      if (stateRef.current.settingsOpen) setSettingsOpen(false)
      else if (stateRef.current.active) close()
      else void CapacitorApp.exitApp()
    })
    return () => {
      void sub.then((s) => s.remove())
    }
  }, [close])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (handleBack()) return
      if (stateRef.current.settingsOpen) setSettingsOpen(false)
      else if (stateRef.current.active) close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close])

  const current = MODULES.find((m) => m.id === active)
  const tiles: TileDef[] = MODULES.map((m) => ({
    id: m.id,
    icon: m.icon,
    badge: m.badge,
    name: t.home.modules[m.id].name,
    desc: t.home.modules[m.id].desc,
  }))

  return (
    <div className="min-h-screen bg-background">
      {/* Ambient glow in the accent colour */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_60%)]" />

      {/* ---------- Home: module tiles ---------- */}
      <div
        className={cn(
          "relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6 sm:px-6",
          reordering && "pb-28",
          active && !closing && "pointer-events-none"
        )}
        aria-hidden={!!active}
      >
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setReordering((r) => !r)}
            aria-label={t.home.reorder}
            aria-pressed={reordering}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl border bg-card/80 transition active:scale-95",
              reordering
                ? "border-primary text-primary"
                : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label={t.common.settings}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/50 bg-card/80 text-muted-foreground transition hover:border-primary/40 hover:text-foreground active:scale-95"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-8 pb-10">
          <header className="flex flex-col items-center text-center">
            <AppLogo className="mb-5 h-20 w-20" />
            <h1 className="bg-gradient-to-b from-foreground to-primary bg-clip-text text-3xl font-black uppercase tracking-tight text-transparent sm:text-4xl">
              KingShot Assistant
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{ready ? t.home.tagline : " "}</p>
          </header>

          {ready && (
            <ModuleGrid
              tiles={tiles}
              order={order}
              reordering={reordering}
              onReordering={setReordering}
              onOrder={setOrder}
              onCommit={saveOrder}
              onOpen={(id, el) => open(id as ModuleId, el)}
            />
          )}
        </div>

        <footer className="space-y-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kingshot Assistant</p>
          <p className="text-xs text-muted-foreground">
            Made with <span aria-label="love">❤️</span> by
          </p>
          <p className="neon-accent text-base font-black tracking-wide">Doliprane · Kingdom 1167</p>
        </footer>
      </div>

      {/* ---------- Open module ---------- */}
      {current && (
        <div
          className={cn(
            "fixed inset-0 z-40 overflow-y-auto bg-background",
            closing ? "module-exit" : "module-enter"
          )}
          style={{ transformOrigin: origin }}
        >
          <div className="sticky top-0 z-10 border-b border-border/50 bg-background/95">
            <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={close}
                aria-label={t.common.back}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-card/80 transition hover:border-primary/40 active:scale-95"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <current.icon className="h-5 w-5 shrink-0 text-primary" />
              <h2 className="min-w-0 truncate text-lg font-black uppercase tracking-tight">
                {t.home.modules[current.id].name}
              </h2>
              <Badge kind={current.badge} />
            </div>
          </div>
          <main className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
            <current.Component />
          </main>
        </div>
      )}

      {reordering && !active && (
        <div className="fade-enter fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">{t.home.reorderHint}</p>
            <button
              type="button"
              onClick={resetOrder}
              disabled={isDefaultOrder(order)}
              aria-label={t.home.reorderReset}
              title={t.home.reorderReset}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/50 text-muted-foreground transition active:scale-95 disabled:opacity-30"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setReordering(false)}
              className="h-11 shrink-0 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition active:scale-95"
            >
              {t.home.reorderDone}
            </button>
          </div>
        </div>
      )}

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
