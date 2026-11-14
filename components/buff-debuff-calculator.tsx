"use client"

import { useMemo, useState } from "react"
import { Calculator, Percent, TrendingDown, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSettings } from "@/components/app-settings"
import { applyModifier } from "@/lib/modifiers"
import { toPercent } from "@/lib/number-input"

const PRESETS = [5, 7.5, 10, 15, 20, 25]

export function BuffDebuffCalculator() {
  const { t } = useSettings()
  const [initialStat, setInitialStat] = useState(0)
  const [modType, setModType] = useState<"buff" | "debuff">("buff")
  const [modValue, setModValue] = useState(0)

  const isBuff = modType === "buff"
  const results = useMemo(
    () => applyModifier(initialStat, isBuff ? modValue : -modValue),
    [initialStat, isBuff, modValue]
  )
  const up = results.variation >= 0
  const Trend = isBuff ? TrendingUp : TrendingDown
  const ResultTrend = up ? TrendingUp : TrendingDown

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t.common.configuration}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 space-y-2">
            <Label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Percent className="h-4 w-4" />
              {t.buff.initial}
            </Label>
            <Input
              type="number"
              min={0}
              step="0.1"
              inputMode="decimal"
              value={initialStat || ""}
              onChange={(e) => setInitialStat(toPercent(e.target.value))}
              className="border-border/50 bg-input font-mono text-xl"
              placeholder="0"
            />
          </div>

          <div className="mb-6 space-y-2">
            <Label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calculator className="h-4 w-4" />
              {t.buff.modType}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["buff", t.buff.buffOpt, TrendingUp, "text-green-400"],
                  ["debuff", t.buff.debuffOpt, TrendingDown, "text-red-400"],
                ] as const
              ).map(([id, label, Icon, tint]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setModType(id)}
                  aria-pressed={modType === id}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm transition ${
                    modType === id
                      ? "border-primary bg-primary/15 font-semibold"
                      : "border-border/50 bg-input text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${tint}`} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6 space-y-2">
            <Label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Trend className={`h-4 w-4 ${isBuff ? "text-green-400" : "text-red-400"}`} />
              {t.buff.modValue}
            </Label>
            <Input
              type="number"
              min={0}
              step="0.1"
              inputMode="decimal"
              value={modValue || ""}
              onChange={(e) => setModValue(toPercent(e.target.value))}
              className="border-border/50 bg-input font-mono text-xl"
              placeholder="0"
            />
          </div>

          <div className="mb-6 space-y-2">
            <Label className="text-xs text-muted-foreground">{t.buff.quick}</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setModValue(preset)}
                  className={`rounded-lg border px-3 py-2 font-mono text-xs transition-all ${
                    modValue === preset
                      ? "border-primary/50 bg-primary text-primary-foreground"
                      : "border-border/50 bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {isBuff ? "+" : "−"}
                  {preset}%
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-4">
            <Calculator className="h-5 w-5 shrink-0 text-primary" />
            <span className="text-sm text-muted-foreground">{t.buff.formula}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-card/80 backdrop-blur">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t.common.results}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="divide-y divide-border/30">
            <Row
              icon={<Percent className="h-5 w-5 text-blue-400" />}
              bg="bg-blue-500/20"
              title={t.buff.statInitial}
              sub={t.buff.startValue}
              value={`${initialStat.toFixed(2)}%`}
              tint="text-blue-400"
            />
            <Row
              icon={<Trend className={`h-5 w-5 ${isBuff ? "text-green-400" : "text-red-400"}`} />}
              bg={isBuff ? "bg-green-500/20" : "bg-red-500/20"}
              title={isBuff ? t.buff.buffApplied : t.buff.debuffApplied}
              sub={t.buff.modifier}
              value={`${isBuff ? "+" : "−"}${modValue.toFixed(1)}%`}
              tint={isBuff ? "text-green-400" : "text-red-400"}
            />
            <Row
              icon={<ResultTrend className={`h-5 w-5 ${up ? "text-green-400" : "text-red-400"}`} />}
              bg={up ? "bg-green-500/20" : "bg-red-500/20"}
              title={t.buff.variation}
              sub={t.buff.variationDesc}
              value={`${up ? "+" : ""}${results.variation.toFixed(2)}%`}
              tint={up ? "text-green-400" : "text-red-400"}
            />
          </div>

          <div className="mt-6 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t.buff.finalStat}</span>
              <span className="font-mono text-2xl font-bold text-accent">
                {results.finalStat.toFixed(2)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({
  icon,
  bg,
  title,
  sub,
  value,
  tint,
}: {
  icon: React.ReactNode
  bg: string
  title: string
  sub: string
  value: string
  tint: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bg}`}>{icon}</div>
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
      <span className={`shrink-0 font-mono text-xl font-bold ${tint}`}>{value}</span>
    </div>
  )
}
