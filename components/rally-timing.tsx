"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Crosshair,
  Layers,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Square,
  Trash2,
  UserRound,
  Users,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  buildMessage,
  buildQuickMessage,
  computePlan,
  computeQuickSync,
  formatDuration,
  formatOffset,
  formatUtc,
  parseDuration,
  parseTimeOfDay,
  resolveArrival,
  type LeaderInput,
} from "@/lib/march-time"
import { LANGS, LANG_NAMES, isLang, type Lang } from "@/lib/messages"
import type { UiText } from "@/lib/i18n"
import { useSettings } from "@/components/app-settings"
import { monotonicNow } from "@/lib/utc-clock"
import { useUtcClock, type UtcClock } from "@/lib/use-utc-clock"
import { copyText } from "@/lib/clipboard"
import { alertTick, unlockAudio } from "@/lib/alerts"
import { RallyOverlay, floatingAvailable } from "@/lib/rally-overlay"

const STORAGE_KEY = "ks-assist-rally-v1"
const TARGET_PRESETS = ["Castle", "North Tower", "South Tower"]

type Tab = "utc" | "quick"

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

const emptyLeader = (): LeaderInput => ({ id: newId(), name: "", march: "" })

const cardCls = "border-border/50 bg-card/80 backdrop-blur"
const titleCls =
  "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"

/** Précision affichée dans la carte « Moi » et la bulle. */
function precisionLabel(clock: UtcClock, t: UiText): string {
  if (!clock.sync) return t.precPhone
  return t.precSynced(Math.max(1, Math.ceil(clock.sync.uncertaintyMs)))
}

/**
 * Alertes T−3, T−2, T−1 puis GO quand `remainingMs` franchit ces seuils.
 * `key` change → réarmement ; `armed` : un GO immédiat compte (Quick Sync +0s).
 */
function useCountdownAlerts(remainingMs: number | null, key: unknown, armed: boolean) {
  const last = useRef<number | null>(null)
  const keyRef = useRef<unknown>(undefined)
  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key
      last.current = armed ? Number.MAX_SAFE_INTEGER : null
    }
    if (remainingMs === null) {
      last.current = null
      return
    }
    const s = remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0
    const prev = last.current
    last.current = s
    if (prev === null || s >= prev) return
    if (s === 0) alertTick(true)
    else if (s <= 3) alertTick(false)
  })
}

function LangSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: Lang
  onChange: (l: Lang) => void
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => isLang(e.target.value) && onChange(e.target.value)}
      className="h-9 rounded-md border border-border/50 bg-input px-2 text-sm"
    >
      {LANGS.map((l) => (
        <option key={l} value={l}>
          {LANG_NAMES[l]}
        </option>
      ))}
    </select>
  )
}

// =====================================================================

export function RallyTiming() {
  const clock = useUtcClock()
  const { now } = clock

  const [tab, setTab] = useState<Tab>("utc")
  const [target, setTarget] = useState("Castle")
  const { rallyText: t } = useSettings() // langue de l'app (réglages)
  const [lang, setLang] = useState<Lang>("en") // langue du message : EN par défaut
  const [leaders, setLeaders] = useState<LeaderInput[]>(() => [emptyLeader()])
  const [meId, setMeId] = useState<string>("")
  const [loaded, setLoaded] = useState(false)

  // Chargement / sauvegarde
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        if (typeof d.target === "string") setTarget(d.target)
        if (isLang(d.lang)) setLang(d.lang)
        if (d.tab === "utc" || d.tab === "quick") setTab(d.tab)
        if (Array.isArray(d.leaders) && d.leaders.length) {
          setLeaders(
            d.leaders.map((l: Partial<LeaderInput>) => ({
              id: typeof l.id === "string" ? l.id : newId(),
              name: String(l.name ?? ""),
              march: String(l.march ?? ""),
            }))
          )
        }
        if (typeof d.meId === "string") setMeId(d.meId)
      }
    } catch {
      // stockage indisponible : valeurs par défaut
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ target, lang, tab, leaders, meId }))
    } catch {
      // ignore
    }
  }, [target, lang, tab, leaders, meId, loaded])

  // Son autorisé dès la première interaction
  useEffect(() => {
    const h = () => unlockAudio()
    window.addEventListener("pointerdown", h, { once: true })
    return () => window.removeEventListener("pointerdown", h)
  }, [])

  const updateLeader = (id: string, patch: Partial<LeaderInput>) =>
    setLeaders((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const removeLeader = (id: string) => {
    setLeaders((ls) => (ls.length > 1 ? ls.filter((l) => l.id !== id) : [emptyLeader()]))
    if (meId === id) setMeId("")
  }

  // Rendu seulement côté appareil : l'heure, la langue et les données
  // enregistrées n'existent pas dans la page pré-générée.
  if (!loaded) return null

  return (
    <div className="space-y-6">
      <p className="text-center text-sm text-muted-foreground">{t.subtitle}</p>

      {/* Langues, cible */}
      <Card className={cardCls}>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t.targetName}</Label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Castle"
              className="border-border/50 bg-input text-lg"
            />
            <div className="flex flex-wrap gap-2">
              {TARGET_PRESETS.map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={target === p ? "default" : "outline"}
                  onClick={() => setTarget(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="msg-lang" className="text-xs text-muted-foreground">
              {t.messageLanguage}
            </Label>
            <LangSelect id="msg-lang" value={lang} onChange={setLang} />
          </div>
          <p className="text-xs text-muted-foreground">{t.prepNote}</p>
        </CardContent>
      </Card>

      {/* Leaders (partagés par les deux onglets) */}
      <Card className={cardCls}>
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className={titleCls}>
            <Users className="h-4 w-4" />
            {t.leaders}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          <p className="text-xs text-muted-foreground">{t.marchHelp}</p>
          {leaders.map((l, i) => {
            const sec = parseDuration(l.march)
            const invalid = l.march.trim() !== "" && sec === null
            return (
              <div key={l.id} className="flex items-start gap-2">
                <Input
                  value={l.name}
                  onChange={(e) => updateLeader(l.id, { name: e.target.value })}
                  placeholder={`Leader ${i + 1}`}
                  className="min-w-0 flex-1 border-border/50 bg-input"
                />
                <div className="w-28 shrink-0">
                  <Input
                    value={l.march}
                    onChange={(e) => updateLeader(l.id, { march: e.target.value })}
                    placeholder="1m30s"
                    className={cn(
                      "border-border/50 bg-input text-center font-mono",
                      invalid && "border-red-500"
                    )}
                  />
                  <p
                    className={cn(
                      "mt-1 text-center text-[11px]",
                      invalid ? "text-red-400" : "text-muted-foreground"
                    )}
                  >
                    {invalid ? t.invalid : sec !== null ? `= ${formatDuration(sec)}` : " "}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLeader(l.id)}
                  aria-label={t.remove}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setLeaders((ls) => [...ls, emptyLeader()])}
          >
            <Plus className="h-4 w-4" />
            {t.addLeader}
          </Button>

          <div className="flex items-center gap-2 border-t border-border/50 pt-3">
            <UserRound className="h-4 w-4 shrink-0 text-primary" />
            <Label htmlFor="me" className="shrink-0 text-sm">
              {t.me}
            </Label>
            <select
              id="me"
              value={meId}
              onChange={(e) => setMeId(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md border border-border/50 bg-input px-2 text-sm"
            >
              <option value="">{t.none}</option>
              {leaders.map((l, i) => (
                <option key={l.id} value={l.id}>
                  {l.name.trim() || `Leader ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Onglets */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/50 bg-card/80 p-1">
        {(
          [
            ["utc", "Exact UTC", Clock],
            ["quick", "Quick Sync", Zap],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-wide transition",
              tab === id
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "utc" ? (
        <ExactUtcTab
          t={t}
          clock={clock}
          target={target}
          lang={lang}
          leaders={leaders}
          meId={meId}
        />
      ) : (
        <QuickSyncTab t={t} target={target} lang={lang} leaders={leaders} meId={meId} now={now} />
      )}
    </div>
  )
}

// =====================================================================
// Onglet 1 — Exact UTC

function ExactUtcTab({
  t,
  clock,
  target,
  lang,
  leaders,
  meId,
}: {
  t: UiText
  clock: UtcClock
  target: string
  lang: Lang
  leaders: LeaderInput[]
  meId: string
}) {
  const { now } = clock
  const [arrival, setArrival] = useState(() => formatUtc(now))
  const [touched, setTouched] = useState(false)

  // Préremplissage avec l'heure UTC synchronisée tant que rien n'est saisi
  useEffect(() => {
    if (!touched && clock.sync) setArrival(formatUtc(monotonicNow() + clock.sync.offsetMs))
  }, [clock.sync, touched])

  const tod = parseTimeOfDay(arrival)
  const arrivalMs = tod === null ? null : resolveArrival(tod, now)
  const rows = useMemo(
    () => (arrivalMs === null ? [] : computePlan(leaders, arrivalMs)),
    [leaders, arrivalMs]
  )
  const message =
    arrivalMs !== null && rows.length ? buildMessage(target, arrivalMs, rows, lang) : ""
  const me = rows.find((r) => r.id === meId) ?? null
  const meRemaining = me ? me.departMs - now : null

  useCountdownAlerts(meRemaining, me?.departMs ?? null, false)

  const setValue = (v: string) => {
    setTouched(true)
    setArrival(v)
  }
  const shift = (sec: number) => setValue(formatUtc((arrivalMs ?? now) + sec * 1000))
  const passed = rows.filter((r) => r.departMs <= now).length

  return (
    <div className="space-y-6">
      {/* Horloge UTC */}
      <Card className={cardCls}>
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.utcTime}
          </div>
          <div className="font-mono text-6xl font-black tabular-nums tracking-tight sm:text-7xl">
            {formatUtc(now)}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <SyncBadge clock={clock} t={t} />
            <Button
              variant="outline"
              size="sm"
              onClick={clock.resync}
              disabled={clock.state === "syncing"}
            >
              <RefreshCw className={cn("h-4 w-4", clock.state === "syncing" && "animate-spin")} />
              {t.resync}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Arrivée */}
      <Card className={cardCls}>
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className={titleCls}>
            <Crosshair className="h-4 w-4" />
            {t.arrivalTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-6">
          <Input
            value={arrival}
            onChange={(e) => setValue(e.target.value)}
            inputMode="numeric"
            placeholder="12:30:00"
            aria-label={t.arrivalAria}
            className={cn(
              "h-14 border-border/50 bg-input text-center font-mono text-3xl tabular-nums",
              tod === null && "border-red-500"
            )}
          />
          {tod === null && <p className="text-xs text-red-400">{t.arrivalFormat}</p>}
          <div className="grid grid-cols-4 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setValue(formatUtc(now))}>
              {t.now}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => shift(30)}>
              +30 s
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => shift(60)}>
              +1 min
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => shift(300)}>
              +5 min
            </Button>
          </div>
          {arrivalMs !== null && (
            <p className="text-xs text-muted-foreground">
              {arrivalMs > now
                ? t.impactIn(formatDuration((arrivalMs - now) / 1000))
                : t.arrivalPassed(formatDuration((now - arrivalMs) / 1000))}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Moi */}
      {me && (
        <MeCard
          t={t}
          name={me.name}
          big={me.departMs > now ? formatDuration(Math.ceil((me.departMs - now) / 1000)) : t.go}
          go={me.departMs <= now}
          detail={`${t.departAt(formatUtc(me.departMs))} · ${precisionLabel(clock, t)}`}
        />
      )}

      {/* Départs */}
      <Card className={cardCls}>
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className={titleCls}>
            <Clock className="h-4 w-4" />
            {t.departures}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          {rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">{t.emptyUtc}</p>
          ) : (
            <>
              {passed > 0 && <Banner tone="red">{t.passed(passed)}</Banner>}
              {rows.some((r) => r.duplicate) && <Banner tone="yellow">{t.duplicates}</Banner>}
              <ul className="divide-y divide-border/50">
                {rows.map((r) => {
                  const diff = r.departMs - now
                  const isPassed = diff <= 0
                  const soon = !isPassed && diff <= 30_000
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        "space-y-1 px-3 py-3",
                        isPassed && "rounded-lg bg-red-500/10",
                        r.id === meId && "rounded-lg ring-2 ring-primary/60"
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span
                          className={cn(
                            "font-mono text-3xl font-black tabular-nums sm:text-4xl",
                            isPassed ? "text-red-400 line-through" : soon ? "text-primary" : ""
                          )}
                        >
                          {formatUtc(r.departMs)}
                        </span>
                        <span
                          className={cn(
                            "flex shrink-0 items-center gap-1 font-mono text-xs tabular-nums sm:text-sm",
                            isPassed
                              ? "font-bold text-red-400"
                              : soon
                                ? "font-bold text-primary"
                                : "text-muted-foreground"
                          )}
                        >
                          {isPassed ? (
                            <>
                              <AlertTriangle className="h-4 w-4" />
                              {t.passedBy(formatDuration(-diff / 1000))}
                            </>
                          ) : (
                            t.inTime(formatDuration(Math.ceil(diff / 1000)))
                          )}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="min-w-0 truncate text-lg font-semibold">{r.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t.march(formatDuration(r.marchSec))}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <FloatingPanel
        t={t}
        mode="utc"
        meName={me?.name ?? null}
        disabledReason={!me ? t.chooseMe : me.departMs <= now ? t.ownPassed : null}
        params={
          me
            ? {
                key: `${me.id}|${me.departMs}`,
                delayMs: me.departMs - now,
                subtitle: t.departAt(formatUtc(me.departMs)),
                precision: precisionLabel(clock, t),
              }
            : null
        }
      />

      <MessageCard t={t} message={message} />
    </div>
  )
}

function SyncBadge({ clock, t }: { clock: UtcClock; t: UiText }) {
  if (clock.sync) {
    const ms = Math.max(1, Math.ceil(clock.sync.uncertaintyMs))
    return (
      <span
        className={cn(
          "rounded-full border px-3 py-1 text-xs font-semibold",
          ms <= 250
            ? "border-green-500/50 bg-green-500/10 text-green-400"
            : "border-yellow-500/50 bg-yellow-500/10 text-yellow-300"
        )}
        title={t.sourceTip(clock.sync.source, clock.sync.samples)}
      >
        {clock.state === "syncing" ? t.resyncing : t.synced(ms)}
        {clock.state === "error" && t.resyncFailed}
        <span className="ml-1 font-normal opacity-70">({clock.sync.source})</span>
      </span>
    )
  }
  if (clock.state === "syncing") {
    return (
      <span className="rounded-full border border-border/50 px-3 py-1 text-xs text-muted-foreground">
        {t.syncing}
      </span>
    )
  }
  return (
    <span
      className="rounded-full border border-red-500/50 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400"
      title={clock.error}
    >
      {t.notSynced}
    </span>
  )
}

// =====================================================================
// Onglet 2 — Quick Sync

function QuickSyncTab({
  t,
  target,
  lang,
  leaders,
  meId,
  now,
}: {
  t: UiText
  target: string
  lang: Lang
  leaders: LeaderInput[]
  meId: string
  now: number // sert seulement à rafraîchir l'affichage
}) {
  const plan = useMemo(() => computeQuickSync(leaders), [leaders])
  const message = plan ? buildQuickMessage(target, plan, lang) : ""
  const [startedAt, setStartedAt] = useState<number | null>(null)
  void now
  const elapsed = startedAt === null ? null : monotonicNow() - startedAt

  // Changement de la liste → arrêt du chrono
  useEffect(() => setStartedAt(null), [plan])

  const me = plan?.rows.find((r) => r.id === meId) ?? null
  const meRemaining = me && elapsed !== null ? me.offsetSec * 1000 - elapsed : null

  // Sans « Moi » : une alerte quand chaque carte s'illumine ;
  // avec « Moi » : T−3, T−2, T−1 puis GO pour sa propre carte uniquement.
  useCountdownAlerts(meRemaining, startedAt, true)
  const lit = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (startedAt === null || !plan) {
      lit.current = new Set()
      return
    }
    let fired = false
    for (const r of plan.rows) {
      if (!lit.current.has(r.id) && (elapsed ?? 0) >= r.offsetSec * 1000) {
        lit.current.add(r.id)
        fired = true
      }
    }
    if (fired && !me) alertTick(true)
  })

  const start = () => {
    unlockAudio()
    lit.current = new Set()
    setStartedAt(monotonicNow())
  }

  return (
    <div className="space-y-6">
      <Card className={cardCls}>
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className={titleCls}>
            <Zap className="h-4 w-4" />
            {t.quickTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {!plan ? (
            <p className="text-center text-sm text-muted-foreground">{t.emptyQuick}</p>
          ) : (
            <>
              <p className="text-sm">
                <span className="font-bold text-primary">{plan.first.name}</span>
                {t.firstExplain(formatDuration(plan.first.marchSec))}
              </p>
              {plan.rows.some((r) => r.duplicate) && <Banner tone="yellow">{t.duplicates}</Banner>}

              <div className="flex gap-2">
                {startedAt === null ? (
                  <Button type="button" className="h-14 flex-1 text-lg font-bold" onClick={start}>
                    <Play className="h-5 w-5" />
                    {t.startBtn(plan.first.name)}
                  </Button>
                ) : (
                  <>
                    <div className="flex h-14 flex-1 items-center justify-center rounded-md border border-primary/50 font-mono text-2xl font-black tabular-nums">
                      +{((elapsed ?? 0) / 1000).toFixed(1)}s
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-14"
                      onClick={() => setStartedAt(null)}
                    >
                      <RotateCcw className="h-5 w-5" />
                      {t.reset}
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t.startHelp(plan.first.name)}</p>

              <div className="grid gap-3 sm:grid-cols-2">
                {plan.rows.map((r) => {
                  const remaining = elapsed === null ? null : r.offsetSec * 1000 - elapsed
                  const isLit = remaining !== null && remaining <= 0
                  const isFirst = r.id === plan.first.id
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "rounded-xl border p-4 transition-colors duration-200",
                        isLit
                          ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/40"
                          : "border-border/50 bg-input",
                        r.id === meId && !isLit && "ring-2 ring-primary/60"
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-4xl font-black tabular-nums">
                          {isFirst ? t.firstBadge : formatOffset(r.offsetSec)}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-sm tabular-nums",
                            isLit ? "font-bold" : "text-muted-foreground"
                          )}
                        >
                          {remaining === null
                            ? ""
                            : isLit
                              ? t.go
                              : t.inSec(Math.ceil(remaining / 1000))}
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="min-w-0 truncate text-lg font-semibold">{r.name}</span>
                        <span className={cn("shrink-0 text-xs", isLit ? "" : "text-muted-foreground")}>
                          {t.march(formatDuration(r.marchSec))}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {me && plan && (
        <MeCard
          t={t}
          name={me.name}
          big={
            me.id === plan.first.id
              ? t.firstBadge
              : meRemaining === null
                ? formatOffset(me.offsetSec)
                : meRemaining > 0
                  ? formatDuration(Math.ceil(meRemaining / 1000))
                  : t.go
          }
          go={meRemaining !== null && meRemaining <= 0}
          detail={
            me.id === plan.first.id
              ? t.meFirst
              : t.meOffset(formatOffset(me.offsetSec), plan.first.name)
          }
        />
      )}

      <FloatingPanel
        t={t}
        mode="quick"
        meName={me?.name ?? null}
        disabledReason={!me ? t.chooseMe : null}
        params={
          me && plan
            ? {
                key: `${me.id}|${me.offsetSec}|${plan.first.id}`,
                offsetMs: me.offsetSec * 1000,
                subtitle:
                  me.id === plan.first.id
                    ? t.bubbleFirst
                    : t.bubbleAfter(formatOffset(me.offsetSec), plan.first.name),
                precision: t.precQuick,
              }
            : null
        }
      />

      <MessageCard t={t} message={message} />
    </div>
  )
}

// =====================================================================
// Mode flottant (Android)

function FloatingPanel({
  t,
  mode,
  meName,
  disabledReason,
  params,
}: {
  t: UiText
  mode: "utc" | "quick"
  meName: string | null
  disabledReason: string | null
  params: {
    key: string
    delayMs?: number
    offsetMs?: number
    subtitle: string
    precision: string
  } | null
}) {
  const [native, setNative] = useState(false)
  const [overlay, setOverlay] = useState<boolean | null>(null)
  const [active, setActive] = useState(false)
  const [info, setInfo] = useState("")
  const sentKey = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const s = await RallyOverlay.status()
      setOverlay(s.overlay)
      setActive(s.running)
    } catch {
      // plugin indisponible
    }
  }, [])

  useEffect(() => {
    const n = floatingAvailable()
    setNative(n)
    if (!n) return
    refresh()
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [refresh])

  const launch = useCallback(async () => {
    if (!params || !meName) return
    try {
      await RallyOverlay.requestNotifications()
      const r = await RallyOverlay.start({
        mode,
        name: meName,
        subtitle: params.subtitle,
        precision: params.precision,
        delayMs: params.delayMs,
        offsetMs: params.offsetMs,
        texts: { ...t.native, modeLabel: mode === "utc" ? "Exact UTC" : "Quick Sync" },
      })
      sentKey.current = params.key
      setActive(true)
      setInfo(r.overlay ? t.bubbleOn : t.notifFallback)
    } catch (e) {
      setInfo(t.error(e instanceof Error ? e.message : String(e)))
    }
  }, [mode, meName, params, t])

  // Bulle active et calcul modifié (heure d'arrivée, marche…) → mise à jour
  useEffect(() => {
    if (active && params && sentKey.current !== null && sentKey.current !== params.key) launch()
  }, [active, params, launch])

  const stop = async () => {
    try {
      await RallyOverlay.stop()
    } catch {
      // ignore
    }
    sentKey.current = null
    setActive(false)
    setInfo("")
  }

  if (!native) return null

  return (
    <Card className={cn(cardCls, "border-primary/40")}>
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className={titleCls}>
          <Layers className="h-4 w-4" />
          {t.floatTitle(mode === "utc" ? "Exact UTC" : "Quick Sync")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-6">
        <p className="text-xs text-muted-foreground">
          {mode === "utc" ? t.floatUtcHelp : t.floatQuickHelp} {t.alertsHelp}
        </p>
        {overlay === false && (
          <div className="space-y-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-xs text-yellow-200">
            <p>{t.overlayMissing}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => RallyOverlay.openOverlaySettings()}
            >
              {t.allowOverlay}
            </Button>
          </div>
        )}
        {active ? (
          <Button type="button" variant="outline" className="h-12 w-full" onClick={stop}>
            <Square className="h-4 w-4" />
            {t.stopBubble}
          </Button>
        ) : (
          <Button
            type="button"
            className="h-12 w-full font-bold"
            disabled={!!disabledReason}
            onClick={launch}
          >
            <Layers className="h-4 w-4" />
            {t.launchBubble(meName)}
          </Button>
        )}
        {disabledReason && !active && (
          <p className="text-xs text-muted-foreground">{disabledReason}</p>
        )}
        {info && <p className="text-xs text-muted-foreground">{info}</p>}
      </CardContent>
    </Card>
  )
}

// =====================================================================
// Éléments communs

function MeCard({
  t,
  name,
  big,
  go,
  detail,
}: {
  t: UiText
  name: string
  big: string
  go: boolean
  detail: string
}) {
  return (
    <Card className={cn(cardCls, "border-primary/60")}>
      <CardContent className="flex flex-col items-center gap-1 py-5 text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t.meCard(name)}
        </div>
        <div
          className={cn(
            "font-mono text-6xl font-black tabular-nums",
            go ? "text-green-400" : "text-foreground"
          )}
        >
          {big}
        </div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  )
}

function MessageCard({ t, message }: { t: UiText; message: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    if (!message) return
    const ok = await copyText(message)
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Card className={cardCls}>
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className={titleCls}>
          <Copy className="h-4 w-4" />
          {t.copyTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <pre className="min-h-24 whitespace-pre-wrap rounded-lg border border-border/50 bg-input p-4 font-mono text-base">
          {message || "—"}
        </pre>
        <Button
          type="button"
          className="h-14 w-full text-lg font-bold"
          onClick={onCopy}
          disabled={!message}
        >
          {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          {copied ? t.copied : t.copy}
        </Button>
      </CardContent>
    </Card>
  )
}

function Banner({ tone, children }: { tone: "red" | "yellow"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border p-3 text-sm",
        tone === "red"
          ? "border-red-500/50 bg-red-500/10 text-red-300"
          : "border-yellow-500/50 bg-yellow-500/10 text-yellow-300"
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {children}
    </div>
  )
}
