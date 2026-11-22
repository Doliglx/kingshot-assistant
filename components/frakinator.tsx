"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { Area, AreaChart, Tooltip, XAxis, YAxis } from "recharts"
import { ChevronDown, ExternalLink, Info, Rocket, Shield, Swords, Target } from "lucide-react"
import { Capacitor } from "@capacitor/core"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useSettings } from "@/components/app-settings"
import { optimise, type FrakStats } from "@/lib/frakinator"
import { toPercent } from "@/lib/number-input"

const TROOPS = [
  { key: "inf", icon: Shield, tint: "text-blue-400", bar: "border-blue-400", chip: "bg-blue-500/20 text-blue-400", short: "INF" },
  { key: "cav", icon: Swords, tint: "text-red-400", bar: "border-red-400", chip: "bg-red-500/20 text-red-400", short: "CAV" },
  { key: "arc", icon: Target, tint: "text-green-400", bar: "border-green-400", chip: "bg-green-500/20 text-green-400", short: "ARC" },
] as const

const FIELDS = ["attack", "lethality"] as const

const FRAK_SITE = "https://frakinator.streamlit.app"
const FRAK_DISCORD = "https://discord.gg/QNGxu9nkp"

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
  const [helpOpen, setHelpOpen] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)
  // In the Android app a link must navigate (the app opens it in the browser); on the web, a new tab.
  const native = mounted && Capacitor.isNativePlatform()

  useEffect(() => setMounted(true), [])

  const best = useMemo(() => optimise(stats, tier ? 1.1 : 1), [stats, tier])
  const names = { inf: t.common.infantry, cav: t.common.cavalry, arc: t.common.archers }

  const calculate = () => {
    setCalculated(true)
    // On a phone the results sit below the form: bring them up unless they are already in view.
    requestAnimationFrame(() => {
      const el = resultsRef.current
      if (el && el.getBoundingClientRect().top > window.innerHeight * 0.65) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    })
  }

  const update = (troop: keyof FrakStats, field: "attack" | "lethality", raw: string) =>
    setStats((s) => ({ ...s, [troop]: { ...s[troop], [field]: toPercent(raw) } }))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card className="gap-3 border-border/50 bg-card py-4">
        <CardHeader className="border-b border-border/50 px-4 [.border-b]:pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t.frak.stats}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="whitespace-nowrap rounded-full border border-primary/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                {t.frak.badge}
              </span>
              <button
                type="button"
                onClick={() => setHelpOpen((o) => !o)}
                aria-expanded={helpOpen}
                aria-controls="frak-help"
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border/50 px-2.5 py-1.5 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground active:scale-95"
              >
                <Info className="h-4 w-4" />
                {helpOpen ? t.frak.hide : t.frak.how}
                <ChevronDown className={`h-4 w-4 transition-transform ${helpOpen ? "rotate-180" : ""}`} />
              </button>
            </div>
            {helpOpen && (
              <div
                id="frak-help"
                className="fade-enter mt-3 space-y-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm leading-relaxed"
              >
                <p>{t.frak.bear}</p>
                <p>{t.frak.source}</p>
                <p>{t.frak.limits}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                  {t.frak.credit}
                  {[
                    [FRAK_SITE, "frakinator.streamlit.app"],
                    [FRAK_DISCORD, t.frak.discord],
                  ].map(([href, label]) => (
                    <a
                      key={href}
                      href={href}
                      target={native ? undefined : "_blank"}
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
                    >
                      {label}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </p>
              </div>
            )}
          </div>
          {/* Stats are short numbers (up to 5 or 6 digits): one row per troop, two narrow fields
              whose label sits inside, a colour bar telling the troops apart. */}
          <div className="mb-4 flex flex-col gap-2">
            {TROOPS.map(({ key, icon: Icon, tint, bar, short }) => (
              <div
                key={key}
                className={`grid grid-cols-[minmax(0,1fr)_6.75rem_6.75rem] items-center gap-2 border-l-[3px] pl-2.5 ${bar}`}
              >
                <div className={`flex min-w-0 items-center gap-2 text-sm font-semibold ${tint}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate max-[380px]:hidden">{names[key]}</span>
                  <span className="hidden max-[380px]:inline">{short}</span>
                </div>
                {FIELDS.map((field) => (
                  <div key={field} className="relative">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      {t.frak[field === "attack" ? "attackShort" : "lethalityShort"]}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      inputMode="decimal"
                      aria-label={`${names[key]} – ${t.frak[field]}`}
                      value={stats[key][field] || ""}
                      onChange={(e) => update(key, field, e.target.value)}
                      className="h-11 border-border/50 bg-input pl-10 pr-2 text-right font-mono text-[15px]"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-input px-3 py-2">
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
            onClick={calculate}
            className="h-11 w-full gap-2 bg-primary text-primary-foreground shadow-lg shadow-primary/30"
          >
            <Rocket className="h-4 w-4" />
            {t.frak.optimize}
          </Button>
        </CardContent>
      </Card>

      <Card ref={resultsRef} className="scroll-mt-20 gap-3 border-primary/30 bg-card py-4">
        <CardHeader className="border-b border-border/50 px-4 [.border-b]:pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t.common.results}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="mb-4 rounded-xl bg-black/30 p-4 font-mono">
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
