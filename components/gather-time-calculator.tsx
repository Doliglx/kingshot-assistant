"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock, Clock, Flag, Gauge, Play, Timer, Zap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSettings } from "@/components/app-settings"
import { boostedDuration } from "@/lib/modifiers"
import { toCount, toPercent } from "@/lib/number-input"

const STORAGE_KEY = "gather-current-speed"
const SPEED_PRESETS = [5, 10, 15, 20, 25, 50]

const pad = (n: number) => n.toString().padStart(2, "0")

/** Seconds → "HHh MMm SSs". */
function formatDuration(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return "--h --m --s"
  const s = Math.round(totalSeconds)
  return `${pad(Math.floor(s / 3600))}h ${pad(Math.floor((s % 3600) / 60))}m ${pad(s % 60)}s`
}

export function GatherTimeCalculator() {
  const { t, locale } = useSettings()
  const [h, setH] = useState(0)
  const [m, setM] = useState(0)
  const [s, setS] = useState(0)
  const [currentSpeed, setCurrentSpeed] = useState(0)
  const [addedSpeed, setAddedSpeed] = useState(25)
  const [targetDate, setTargetDate] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) setCurrentSpeed(toPercent(stored))
    } catch {
      // storage unavailable
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, String(currentSpeed))
    } catch {
      // ignore
    }
  }, [currentSpeed, loaded])

  // Keep "finish time from now" current while the screen stays open.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const results = useMemo(() => {
    const sec = h * 3600 + m * 60 + s
    const newSec = boostedDuration(sec, currentSpeed, addedSpeed)
    const targetMs = targetDate.trim() ? new Date(targetDate).getTime() : NaN
    return { sec, newSec, hasTarget: isFinite(targetMs), targetMs }
  }, [h, m, s, currentSpeed, addedSpeed, targetDate])

  const formatClock = (ms: number) =>
    isFinite(ms)
      ? new Date(ms).toLocaleString(locale, {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "--"

  const when = (durationSec: number) =>
    formatClock(results.hasTarget ? results.targetMs - durationSec * 1000 : now + durationSec * 1000)
  const whenLabel = results.hasTarget ? t.gather.launchTime : t.gather.finishTime
  const WhenIcon = results.hasTarget ? Play : Flag
  const timeSaved = results.sec - results.newSec

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card className="border-border/50 bg-card/80 backdrop-blur lg:col-span-2">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Timer className="h-4 w-4" />
            {t.common.configuration}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-4 w-4" />
                {t.gather.shown}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    [h, setH, t.gather.hours, 9999],
                    [m, setM, t.gather.minutes, 59],
                    [s, setS, t.gather.seconds, 59],
                  ] as const
                ).map(([value, set, label, max]) => (
                  <div key={label}>
                    <Input
                      type="number"
                      min={0}
                      max={max}
                      inputMode="numeric"
                      value={value || ""}
                      onChange={(e) => set(toCount(e.target.value, max))}
                      className="border-border/50 bg-input text-center font-mono text-xl"
                      placeholder="00"
                      aria-label={label}
                    />
                    <p className="mt-1 text-center text-[10px] uppercase text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Gauge className="h-4 w-4" />
                  {t.gather.currentSpeed}
                  <span className="ml-auto text-[10px] text-primary">{t.common.saved}</span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  inputMode="decimal"
                  value={currentSpeed || ""}
                  onChange={(e) => setCurrentSpeed(toPercent(e.target.value))}
                  className="border-border/50 bg-input font-mono text-xl"
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Zap className="h-4 w-4 text-accent" />
                  {t.gather.bonus}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  inputMode="decimal"
                  value={addedSpeed || ""}
                  onChange={(e) => setAddedSpeed(toPercent(e.target.value))}
                  className="border-border/50 bg-input font-mono text-xl"
                  placeholder="25"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  {SPEED_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAddedSpeed(preset)}
                      className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition-all ${
                        addedSpeed === preset
                          ? "border-primary/50 bg-primary text-primary-foreground"
                          : "border-border/50 bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      +{preset}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <Label className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              {t.gather.targetDate}
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="datetime-local"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="max-w-xs border-border/50 bg-input font-mono"
              />
              {targetDate && (
                <button
                  type="button"
                  onClick={() => setTargetDate("")}
                  className="rounded-lg border border-border/50 bg-secondary/50 px-3 py-2 text-xs text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground"
                >
                  {t.common.clear}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {targetDate ? t.gather.hintTarget : t.gather.hintEmpty}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Current speed */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t.gather.standard}
            </span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">+0%</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="rounded-xl bg-secondary/40 p-4 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.common.duration}</p>
            <p className="mt-1 font-mono text-3xl font-bold text-foreground">{formatDuration(results.sec)}</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border/30 bg-background/30 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
              <WhenIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{whenLabel}</p>
              <p className="truncate font-mono text-sm font-semibold text-foreground">{when(results.sec)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* With the extra bonus */}
      <Card className="border-primary/40 bg-card/80 backdrop-blur">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-primary">
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              {t.gather.boosted}
            </span>
            <span className="rounded-md bg-primary/20 px-2 py-0.5 text-primary">+{addedSpeed}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 p-4 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.common.duration}</p>
            <p className="mt-1 font-mono text-3xl font-bold text-accent">{formatDuration(results.newSec)}</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-background/30 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <WhenIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{whenLabel}</p>
              <p className="truncate font-mono text-sm font-semibold text-foreground">
                {when(results.newSec)}
              </p>
            </div>
          </div>
          {timeSaved > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-green-500/10 px-4 py-2">
              <span className="text-xs text-green-400">{t.gather.timeSaved}</span>
              <span className="font-mono text-sm font-bold text-green-400">{formatDuration(timeSaved)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
