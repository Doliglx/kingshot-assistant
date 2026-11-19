"use client"

import { useMemo, useState } from "react"
import { Crosshair, Shield, Swords, Target, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useSettings } from "@/components/app-settings"
import { splitTroops, type Shares } from "@/lib/ratio"
import { toCount } from "@/lib/number-input"

const PRESETS: Shares[] = [
  { inf: 50, cav: 20, arc: 30 },
  { inf: 50, cav: 25, arc: 25 },
  { inf: 45, cav: 20, arc: 35 },
  { inf: 10, cav: 10, arc: 80 },
  { inf: 60, cav: 20, arc: 20 },
  { inf: 60, cav: 40, arc: 0 },
]

const TROOPS = [
  { key: "inf", icon: Shield, tint: "text-blue-400", bg: "bg-blue-500/20" },
  { key: "cav", icon: Swords, tint: "text-red-400", bg: "bg-red-500/20" },
  { key: "arc", icon: Target, tint: "text-green-400", bg: "bg-green-500/20" },
] as const

export function RatioCalculator() {
  const { t, locale } = useSettings()
  const [total, setTotal] = useState(55000)
  const [pct, setPct] = useState<Shares>(PRESETS[0])

  const results = useMemo(() => splitTroops(total, pct), [total, pct])
  const sum = pct.inf + pct.cav + pct.arc
  const names = { inf: t.common.infantry, cav: t.common.cavalry, arc: t.common.archers }
  const fmt = (n: number) => n.toLocaleString(locale)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card className="border-border/50 bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t.common.configuration}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 space-y-2">
            <Label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-4 w-4" />
              {t.ratio.totalTroops}
            </Label>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={total || ""}
              onChange={(e) => setTotal(toCount(e.target.value))}
              className="border-border/50 bg-input font-mono text-xl"
              placeholder="0"
            />
          </div>

          <div className="mb-6 space-y-2">
            <Label className="text-xs text-muted-foreground">{t.ratio.presets}</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const label = `${p.inf}/${p.cav}/${p.arc}`
                const selected = pct.inf === p.inf && pct.cav === p.cav && pct.arc === p.arc
                return (
                  <Button
                    key={label}
                    variant={selected ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPct(p)}
                    className="font-mono text-xs"
                  >
                    {label}
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {TROOPS.map(({ key, icon: Icon, tint }) => (
              <div key={key} className="space-y-2">
                <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className={`h-4 w-4 ${tint}`} />
                  {names[key]} %
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={pct[key] || ""}
                  onChange={(e) => setPct((p) => ({ ...p, [key]: toCount(e.target.value, 100) }))}
                  className="border-border/50 bg-input font-mono"
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          {sum !== 100 && (
            <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {t.ratio.mustBe100(sum)}
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-4">
            <Crosshair className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">{t.ratio.auto}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t.ratio.split}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="divide-y divide-border/30">
            {TROOPS.map(({ key, icon: Icon, tint, bg }) => (
              <div key={key} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
                    <Icon className={`h-5 w-5 ${tint}`} />
                  </div>
                  <div>
                    <p className="font-medium">{names[key]}</p>
                    <p className="text-xs text-muted-foreground">{t.ratio.ofTotal(pct[key])}</p>
                  </div>
                </div>
                <span className={`font-mono text-xl font-bold ${tint}`}>{fmt(results[key])}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t.ratio.verified}</span>
              <span
                className={`font-mono text-lg font-bold ${sum === 100 ? "text-accent" : "text-destructive"}`}
              >
                {fmt(results.inf + results.cav + results.arc)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
