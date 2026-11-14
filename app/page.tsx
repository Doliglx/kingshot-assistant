"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { App as CapacitorApp } from "@capacitor/app"
import {
  ArrowLeft,
  Crosshair,
  MousePointerClick,
  Package,
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
import { ResourceCalculator } from "@/components/resource-calculator"
import { Frakinator } from "@/components/frakinator"
import { RatioCalculator } from "@/components/ratio-calculator"
import { BuffDebuffCalculator } from "@/components/buff-debuff-calculator"
import { GatherTimeCalculator } from "@/components/gather-time-calculator"
import { RallyTiming } from "@/components/rally-timing"
import { AutoClicker } from "@/components/auto-clicker"

type ModuleId = "rss" | "fraki" | "ratio" | "buff" | "gather" | "rally" | "clicker"

const MODULES: {
  id: ModuleId
  icon: LucideIcon
  badge?: "Beta" | "Test"
  Component: React.ComponentType
}[] = [
  { id: "rss", icon: Package, Component: ResourceCalculator },
  { id: "fraki", icon: Swords, Component: Frakinator },
  { id: "ratio", icon: Target, Component: RatioCalculator },
  { id: "buff", icon: TrendingUp, Component: BuffDebuffCalculator },
  { id: "gather", icon: Timer, Component: GatherTimeCalculator },
  { id: "rally", icon: Crosshair, badge: "Beta", Component: RallyTiming },
  { id: "clicker", icon: MousePointerClick, badge: "Test", Component: AutoClicker },
]

const EXIT_MS = 220

export default function KingshotAssistant() {
  const { t, ready } = useSettings()
  const [active, setActive] = useState<ModuleId | null>(null)
  const [closing, setClosing] = useState(false)
  const [origin, setOrigin] = useState("50% 50%")
  const [settingsOpen, setSettingsOpen] = useState(false)
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

  // Android back button: settings → module → leave the app.
  const stateRef = useRef({ active, settingsOpen })
  stateRef.current = { active, settingsOpen }
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const sub = CapacitorApp.addListener("backButton", () => {
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
      if (stateRef.current.settingsOpen) setSettingsOpen(false)
      else if (stateRef.current.active) close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close])

  const current = MODULES.find((m) => m.id === active)

  return (
    <div className="min-h-screen bg-background">
      {/* Ambient glow in the accent colour */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_60%)]" />

      {/* ---------- Home: module tiles ---------- */}
      <div
        className={cn(
          "relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6 sm:px-6",
          active && !closing && "pointer-events-none"
        )}
        aria-hidden={!!active}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label={t.common.settings}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/50 bg-card/80 text-muted-foreground backdrop-blur transition hover:border-primary/40 hover:text-foreground active:scale-95"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-8 pb-10">
          <header className="text-center">
            <h1 className="bg-gradient-to-b from-foreground to-primary bg-clip-text text-3xl font-black uppercase tracking-tight text-transparent sm:text-4xl">
              KingShot Assistant
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{ready ? t.home.tagline : " "}</p>
          </header>

          {ready && (
            <nav className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {MODULES.map((m, i) => {
                const Icon = m.icon
                const label = t.home.modules[m.id]
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={(e) => open(m.id, e.currentTarget)}
                    style={{ animationDelay: `${i * 45}ms` }}
                    className="tile-enter group relative flex flex-col items-center gap-3 rounded-2xl last:odd:col-span-2 sm:last:odd:col-span-1 border border-border/50 bg-card/80 px-3 py-5 text-center backdrop-blur transition duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 active:scale-95"
                  >
                    {m.badge && (
                      <span className="absolute right-2 top-2 rounded-full border border-primary/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                        {m.badge}
                      </span>
                    )}
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary transition duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="h-7 w-7" />
                    </span>
                    <span className="text-sm font-bold leading-tight">{label.name}</span>
                    <span className="text-[11px] leading-snug text-muted-foreground">{label.desc}</span>
                  </button>
                )
              })}
            </nav>
          )}
        </div>

        <footer className="text-center">
          <p className="text-xs text-muted-foreground">KingShot Assistant · #Doliprane · GLX</p>
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
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_60%)]" />
          <div className="sticky top-0 z-10 border-b border-border/50 bg-background/85 backdrop-blur">
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
              {current.badge && (
                <span className="rounded-full border border-primary/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  {current.badge}
                </span>
              )}
            </div>
          </div>
          <main className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
            <current.Component />
          </main>
        </div>
      )}

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
