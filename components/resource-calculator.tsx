"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Cell, Pie, PieChart, Tooltip } from "recharts"
import { Hammer, Mountain, Scale, TreePine, Wheat } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useSettings } from "@/components/app-settings"
import { toCount } from "@/lib/number-input"

/** What one chest of each level gives, depending on the resource picked. */
const CHESTS = [
  { bread: 10_000, wood: 10_000, stone: 2_000, iron: 500 },
  { bread: 100_000, wood: 100_000, stone: 20_000, iron: 5_000 },
  { bread: 1_000_000, wood: 1_000_000, stone: 200_000, iron: 50_000 },
] as const

const RESOURCES = ["bread", "wood", "stone", "iron"] as const
type Resource = (typeof RESOURCES)[number]
type Mode = "balance" | Resource

const COLORS: Record<Resource, string> = {
  bread: "#f59e0b",
  wood: "#8b5a2b",
  stone: "#6b7280",
  iron: "#a19d94",
}

const ICONS = {
  bread: Wheat,
  wood: TreePine,
  stone: Mountain,
  iron: Hammer,
} as const

const ICON_TINT: Record<Resource, string> = {
  bread: "text-amber-500",
  wood: "text-amber-800",
  stone: "text-gray-500",
  iron: "text-stone-400",
}

export function ResourceCalculator() {
  const { t, locale } = useSettings()
  const [quantities, setQuantities] = useState([0, 0, 0])
  const [mode, setMode] = useState<Mode>("balance")
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const results = useMemo(() => {
    const res: Record<Resource, number> = { bread: 0, wood: 0, stone: 0, iron: 0 }
    quantities.forEach((qty, level) => {
      const chest = CHESTS[level]
      if (mode !== "balance") {
        res[mode] += qty * chest[mode]
        return
      }
      // Balance: open the same number of chests for each resource.
      // Leftover chests go to the scarcest resources first.
      const share = Math.floor(qty / 4)
      const rest = qty % 4
      res.bread += share * chest.bread
      res.wood += (share + (rest >= 3 ? 1 : 0)) * chest.wood
      res.stone += (share + (rest >= 2 ? 1 : 0)) * chest.stone
      res.iron += (share + (rest >= 1 ? 1 : 0)) * chest.iron
    })
    return res
  }, [quantities, mode])

  const total = RESOURCES.reduce((sum, r) => sum + results[r], 0)
  const chartData = RESOURCES.map((r) => ({ name: t.rss[r], value: results[r], color: COLORS[r] })).filter(
    (d) => d.value > 0
  )
  const fmt = (n: number) => n.toLocaleString(locale)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t.rss.inventory}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 grid grid-cols-3 gap-4">
            {quantities.map((qty, level) => (
              <div key={level} className="flex flex-col items-center space-y-2">
                <div className="relative h-16 w-16 flex-shrink-0">
                  <Image
                    src={`/images/chest-n${level + 1}.png`}
                    alt={t.rss.level(level + 1)}
                    fill
                    sizes="64px"
                    className="rounded-lg object-contain"
                  />
                </div>
                <Label className="text-xs uppercase text-muted-foreground">{t.rss.level(level + 1)}</Label>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={qty || ""}
                  onChange={(e) =>
                    setQuantities((q) => q.map((v, i) => (i === level ? toCount(e.target.value) : v)))
                  }
                  className="border-border/50 bg-input text-center font-mono text-lg"
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          <div className="grid gap-3">
            <Button
              onClick={() => setMode("balance")}
              className={`w-full gap-2 ${
                mode === "balance"
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              <Scale className="h-4 w-4" />
              {t.rss.balance}
            </Button>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {RESOURCES.map((r) => {
                const Icon = ICONS[r]
                return (
                  <Button
                    key={r}
                    variant={mode === r ? "default" : "outline"}
                    onClick={() => setMode(r)}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {t.rss[r]}
                  </Button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-card/80 backdrop-blur">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t.rss.projection}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-1">
            {RESOURCES.map((r) => {
              const Icon = ICONS[r]
              return (
                <div key={r} className="flex items-center justify-between border-b border-border/30 py-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${ICON_TINT[r]}`} />
                    <span className="text-sm text-muted-foreground">{t.rss[r]}</span>
                  </div>
                  <span className="font-mono text-lg font-bold">{fmt(results[r])}</span>
                </div>
              )
            })}
          </div>

          <div className="mt-6 border-t-2 border-primary pt-4 text-center">
            <p className="text-xs uppercase text-muted-foreground">{t.common.total}</p>
            <p className="font-mono text-3xl font-bold text-accent">{fmt(total)}</p>
          </div>

          <div className="mt-6 flex h-[180px] items-center justify-center">
            {mounted && chartData.length > 0 && (
              <PieChart width={200} height={180}>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => fmt(value)}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: "var(--foreground)" }}
                />
              </PieChart>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
