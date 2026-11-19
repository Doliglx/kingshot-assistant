"use client"

import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, Tooltip, XAxis, YAxis } from "recharts"
import { Rocket, Shield, Swords, Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useSettings } from "@/components/app-settings"
import { optimise, type FrakStats } from "@/lib/frakinator"
import { toPercent } from "@/lib/number-input"

const TROOPS = [
  { key: "inf", icon: Shield, tint: "text-blue-400", chip: "bg-blue-500/20 text-blue-400", short: "INF" },
  { key: "cav", icon: Swords, tint: "text-red-400", chip: "bg-red-500/20 text-red-400", short: "CAV" },
  { key: "arc", icon: Target, tint: "text-green-400", chip: "bg-green-500/20 text-green-400", short: "ARC" },
] as const

const EMPTY: FrakStats = {
  inf: { attack: 0, lethality: 0 },
  cav: { attack: 0, lethality: 0 },
  arc: { attack: 0, lethality: 0 },
}

export function Frakinator() {
  const { t } = useSettings()
  const [stats, setStats] = useState<FrakStats>(EMPTY)
  const [tier, setTier] = useState(true)
  const [calculated, setCalculated] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const best = useMemo(() => optimise(stats, tier ? 1.1 : 1), [stats, tier])
  const names = { inf: t.common.infantry, cav: t.common.cavalry, arc: t.common.archers }

  const update = (troop: keyof FrakStats, field: "attack" | "lethality", raw: string) =>
    setStats((s) => ({ ...s, [troop]: { ...s[troop], [field]: toPercent(raw) } }))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card className="border-border/50 bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t.frak.stats}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 grid gap-6 sm:grid-cols-3">
            {TROOPS.map(({ key, icon: Icon, tint }) => (
              <div key={key} className="space-y-3">
                <div className={`flex items-center gap-2 text-sm font-semibold ${tint}`}>
                  <Icon className="h-4 w-4" />
                  {names[key]}
                </div>
                {(["attack", "lethality"] as const).map((field) => (
                  <div key={field} className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{t.frak[field]}</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      inputMode="decimal"
                      value={stats[key][field] || ""}
                      onChange={(e) => update(key, field, e.target.value)}
                      className="border-border/50 bg-input font-mono"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-input px-4 py-3">
            <span className="text-sm">{t.frak.tier}</span>
            <div className="flex gap-1">
              {[true, false].map((on) => (
                <Button
                  key={String(on)}
                  type="button"
                  size="sm"
                  variant={tier === on ? "default" : "outline"}
                  onClick={() => setTier(on)}
                >
                  {on ? t.frak.enabled : t.frak.disabled}
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => setCalculated(true)}
            className="w-full gap-2 bg-primary text-primary-foreground shadow-lg shadow-primary/30"
          >
            <Rocket className="h-4 w-4" />
            {t.frak.optimize}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t.common.results}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 rounded-xl bg-black/30 p-4 font-mono">
            {calculated ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t.frak.optimum}</p>
                <div className="flex flex-wrap gap-2">
                  {TROOPS.map(({ key, chip, short }) => (
                    <span key={key} className={`rounded px-2 py-1 ${chip}`}>
                      {short}: {best[key]}%
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-lg">
                  {t.frak.score} <span className="font-bold text-accent">{best.score.toFixed(3)}</span>
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">{t.frak.hintClick}</p>
            )}
          </div>

          <div className="flex min-h-[200px] flex-col items-center justify-center gap-2">
            {mounted && calculated && best.curve.length > 1 ? (
              <>
                <AreaChart width={320} height={200} data={best.curve}>
                  <defs>
                    <linearGradient id="frakScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="x"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    tickFormatter={(v) => `${v}%`}
                    axisLine={{ stroke: "#374151" }}
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    axisLine={{ stroke: "#374151" }}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    formatter={(value: number) => value.toFixed(3)}
                    labelFormatter={(label) => `ARC: ${label}%`}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "var(--foreground)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="y"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="url(#frakScore)"
                  />
                </AreaChart>
                <p className="text-center text-[11px] text-muted-foreground">{t.frak.chartNote(best.inf)}</p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">{t.frak.hintResults}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
