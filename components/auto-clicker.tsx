"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  Copy,
  HeartPulse,
  Info,
  Layers,
  ListPlus,
  MousePointerClick,
  Palette,
  Plus,
  Settings2,
  Share2,
  ShieldCheck,
  Skull,
  Square,
  Trash2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { accentHex, useSettings } from "@/components/app-settings"
import { copyText } from "@/lib/clipboard"
import {
  AutoClickerNative,
  DEFAULT_APPEARANCE,
  LIMITS,
  MARKER_RANGE,
  autoClickerAvailable,
  cycleDurationMs,
  exportConfig,
  healingTemplate,
  importConfigs,
  loadAppearance,
  loadConfigs,
  newConfig,
  newTarget,
  saveAppearance,
  saveConfigs,
  terrorTemplate,
  type Appearance,
  type ClickConfig,
  type ClickMode,
  type ClickTarget,
  type StopRule,
  type TargetType,
} from "@/lib/auto-clicker"

const cardCls = "border-border/50 bg-card/80 backdrop-blur"
const titleCls = "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"
const selectCls = "h-9 w-full rounded-md border border-border/50 bg-input px-2 text-sm"

/** Ready-made macros are added once, the first time the module is opened. */
const SEEDED_KEY = "ks-assist-autoclicker-seeded-v1"

type Section = "macros" | "edit" | "look" | "share"
type Unit = "ms" | "s" | "min"
const UNIT_MS: Record<Unit, number> = { ms: 1, s: 1000, min: 60_000 }

/** Most readable unit for a duration that the user did not set a unit for yet. */
function bestUnit(ms: number): Unit {
  if (ms >= 60_000 && ms % 60_000 === 0) return "min"
  if (ms >= 1000 && ms % 100 === 0) return "s"
  return "ms"
}

function formatMs(ms: number, units: { ms: string; s: string; min: string }): string {
  const unit = bestUnit(ms)
  const value = Math.round((ms / UNIT_MS[unit]) * 100) / 100
  return `${value} ${units[unit]}`
}

/** Whole-number field: the user types freely, the value is saved as soon as it is valid. */
function NumField({
  value,
  range,
  onCommit,
}: {
  value: number
  range: readonly [number, number]
  onCommit: (n: number) => void
}) {
  const [text, setText] = useState(String(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(String(value))
  }, [value])
  const change = (raw: string) => {
    setText(raw)
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n >= range[0] && n <= range[1] && n !== value) onCommit(n)
  }
  const commit = () => {
    focused.current = false
    const n = parseInt(text, 10)
    const v = Number.isFinite(n) ? Math.min(range[1], Math.max(range[0], n)) : value
    setText(String(v))
    if (v !== value) onCommit(v)
  }
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={range[0]}
      max={range[1]}
      value={text}
      onChange={(e) => change(e.target.value)}
      onFocus={() => (focused.current = true)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="border-border/50 bg-input text-center font-mono"
    />
  )
}

/** Duration stored in ms, typed in ms, seconds or minutes (decimals allowed). */
function DurationField({
  value,
  range,
  onCommit,
}: {
  value: number
  range: readonly [number, number]
  onCommit: (ms: number) => void
}) {
  const { t } = useSettings()
  const units = { ms: t.ac.unitMs, s: t.ac.unitS, min: t.ac.unitMin }
  const [unit, setUnit] = useState<Unit>(() => bestUnit(value))
  const shown = (ms: number, u: Unit) => String(Math.round((ms / UNIT_MS[u]) * 1000) / 1000)
  const [text, setText] = useState(() => shown(value, unit))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(shown(value, unit))
  }, [value, unit])

  const toMs = (raw: string) => {
    const n = parseFloat(raw.replace(",", "."))
    return Number.isFinite(n) ? Math.round(n * UNIT_MS[unit]) : NaN
  }
  const change = (raw: string) => {
    setText(raw)
    const ms = toMs(raw)
    if (ms >= range[0] && ms <= range[1] && ms !== value) onCommit(ms)
  }
  const commit = () => {
    focused.current = false
    const ms = toMs(text)
    const v = Number.isFinite(ms) ? Math.min(range[1], Math.max(range[0], ms)) : value
    setText(shown(v, unit))
    if (v !== value) onCommit(v)
  }

  return (
    <div className="flex gap-1">
      <Input
        type="number"
        inputMode="decimal"
        step="any"
        value={text}
        onChange={(e) => change(e.target.value)}
        onFocus={() => (focused.current = true)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="min-w-0 flex-1 border-border/50 bg-input text-center font-mono"
      />
      <select
        value={unit}
        onChange={(e) => setUnit(e.target.value as Unit)}
        aria-label="unit"
        className="h-9 w-16 shrink-0 rounded-md border border-border/50 bg-input px-1 text-sm"
      >
        {(["ms", "s", "min"] as const).map((u) => (
          <option key={u} value={u}>
            {units[u]}
          </option>
        ))}
      </select>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function AutoClicker() {
  const { t, hue } = useSettings()
  const a = t.ac
  const units = useMemo(() => ({ ms: a.unitMs, s: a.unitS, min: a.unitMin }), [a])
  const [section, setSection] = useState<Section>("macros")
  const [native, setNative] = useState(false)
  const [configs, setConfigs] = useState<ClickConfig[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [openTarget, setOpenTarget] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState({ enabled: false, panelShown: false, running: false, configId: "" })
  const [error, setError] = useState("")
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE)
  const [importText, setImportText] = useState("")
  const [shareInfo, setShareInfo] = useState("")
  const [aboutOpen, setAboutOpen] = useState(false)
  const statusRef = useRef(status)
  statusRef.current = status

  // Texts of the native floating panel, in the app language and accent colour.
  // Units are shown next to each value on the panel, so "(ms)" is dropped here.
  const noUnit = (label: string) => label.replace(/\s*\((ms|мс)\)\s*$/, "")
  const panelTexts: Record<string, string> = {
    ...a.native,
    accent: accentHex(hue),
    macro: a.configs,
    newMacro: a.single,
    interval: noUnit(a.interval),
    cyclePause: noUnit(a.cyclePause),
    startDelay: a.startDelay,
    stop: a.stopWhen,
    infinite: a.infinite,
    cycles: a.cycles,
    seconds: a.seconds,
    target: a.targets,
    action: a.type,
    tap: a.tap,
    hold: a.hold,
    swipe: a.swipe,
    tapMs: noUnit(a.tapMs),
    holdMs: noUnit(a.holdMs),
    swipeMs: noUnit(a.swipeMs),
    delayAfter: noUnit(a.delayAfter),
    repeat: a.repeat,
    mode: a.mode,
    sequence: a.sequence,
    simultaneous: a.sync,
    markerSize: a.markerSize,
    opacity: noUnit(a.opacity.replace(/\s*\(%\)\s*$/, "")),
    hideWhileRunning: a.hideWhileRunning,
    yes: a.yes,
    no: a.no,
  }
  const textsRef = useRef(panelTexts)
  textsRef.current = panelTexts

  const refresh = useCallback(async () => {
    try {
      let list = await loadConfigs()
      // First visit: add the two ready-made macros once.
      let seeded = true
      try {
        seeded = localStorage.getItem(SEEDED_KEY) === "1"
      } catch {
        // storage unavailable: do not seed
      }
      if (!seeded) {
        if (list.length === 0) {
          list = [healingTemplate(a.healName, a.healStep1), terrorTemplate(a.terrorName)]
          await saveConfigs(list)
        }
        try {
          localStorage.setItem(SEEDED_KEY, "1")
        } catch {
          // ignore
        }
      }
      setConfigs(list)
      setSelectedId((id) => (list.some((c) => c.id === id) ? id : (list[0]?.id ?? "")))
      setAppearance(await loadAppearance())
      if (autoClickerAvailable()) setStatus(await AutoClickerNative.status())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoaded(true)
  }, [a.healName, a.healStep1, a.terrorName])

  useEffect(() => {
    setNative(autoClickerAvailable())
    refresh()
    // Coming back from the game: positions may have been edited on the overlay.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [refresh])

  // A new accent colour or language reaches a panel that is already open.
  useEffect(() => {
    const s = statusRef.current
    if (!autoClickerAvailable() || !s.panelShown || s.running || !s.configId) return
    AutoClickerNative.showPanel({ configId: s.configId, texts: textsRef.current }).catch(() => {})
  }, [hue, t])

  /** Saves the list and, if the edited macro is on screen, reloads its panel. */
  const persist = useCallback(async (next: ClickConfig[], touchedId?: string) => {
    setConfigs(next)
    try {
      await saveConfigs(next)
      const s = statusRef.current
      if (autoClickerAvailable() && s.panelShown && touchedId && s.configId === touchedId) {
        if (next.some((c) => c.id === touchedId)) {
          await AutoClickerNative.showPanel({ configId: touchedId, texts: textsRef.current })
        } else {
          await AutoClickerNative.hidePanel()
        }
        setStatus(await AutoClickerNative.status())
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const selected = configs.find((c) => c.id === selectedId) ?? null

  const update = (patch: Partial<ClickConfig>) => {
    if (!selected) return
    void persist(
      configs.map((c) => (c.id === selected.id ? { ...c, ...patch } : c)),
      selected.id
    )
  }
  const updateTarget = (targetId: string, patch: Partial<ClickTarget>) => {
    if (!selected) return
    update({ targets: selected.targets.map((x) => (x.id === targetId ? { ...x, ...patch } : x)) })
  }

  const uniqueName = (base: string, list = configs) => {
    let name = base
    for (let i = 2; list.some((c) => c.name === name); i++) name = `${base} ${i}`
    return name
  }
  const add = (c: ClickConfig) => {
    if (configs.length >= LIMITS.configs) return
    const named = { ...c, name: uniqueName(c.name) }
    void persist([...configs, named])
    setSelectedId(named.id)
  }

  const setMode = (mode: ClickMode) => {
    if (!selected || selected.mode === mode) return
    const targets =
      mode === "single"
        ? selected.targets.slice(0, 1)
        : selected.targets.length >= 2
          ? selected.targets
          : [...selected.targets, newTarget()]
    update({ mode, targets })
  }

  const togglePanel = async () => {
    if (!selected) return
    setError("")
    try {
      if (status.panelShown && status.configId === selected.id) await AutoClickerNative.hidePanel()
      else await AutoClickerNative.showPanel({ configId: selected.id, texts: panelTexts })
      setStatus(await AutoClickerNative.status())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes("SERVICE_OFF") ? a.serviceOff : msg)
      refresh()
    }
  }

  const changeAppearance = (patch: Partial<Appearance>) => {
    const next = { ...appearance, ...patch }
    setAppearance(next)
    saveAppearance(next).catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }

  const shareSelected = async () => {
    if (!selected) return
    setShareInfo((await copyText(exportConfig(selected))) ? a.exported : "")
  }

  const doImport = () => {
    const list = importConfigs(importText)
    if (!list) {
      setShareInfo(a.importError)
      return
    }
    const room = Math.max(0, LIMITS.configs - configs.length)
    const added: ClickConfig[] = []
    for (const c of list.slice(0, room)) {
      added.push({ ...c, name: uniqueName(c.name || a[c.mode], [...configs, ...added]) })
    }
    if (added.length === 0) return
    void persist([...configs, ...added])
    setSelectedId(added[0].id)
    setImportText("")
    setShareInfo("")
    setSection("macros")
  }

  const targetSummary = (target: ClickTarget, mode: ClickMode) => {
    const action =
      target.type === "hold"
        ? `${a.hold} ${formatMs(target.holdMs, units)}`
        : target.type === "swipe"
          ? `${a.swipe} ${formatMs(target.swipeMs, units)}`
          : `${a.tap} ${formatMs(target.tapMs, units)}`
    if (mode !== "multi") return action
    const repeat = target.repeat > 1 ? ` · ×${target.repeat}` : ""
    return `${action} · ${a.waitShort} ${formatMs(target.delayAfterMs, units)}${repeat}`
  }

  if (!loaded) return null
  const panelOnSelected = status.panelShown && selected !== null && status.configId === selected.id
  const modeLabel = (c: ClickConfig) =>
    c.mode === "single"
      ? a.single
      : `${c.mode === "sync" ? a.sync : a.multi} · ${a.targetsCount.replace("{n}", String(c.targets.length))}`

  const SECTIONS: [Section, string, typeof Layers][] = [
    ["macros", a.tabMacros, Layers],
    ["edit", a.tabEdit, Settings2],
    ["look", a.tabLook, Palette],
    ["share", a.tabShare, Share2],
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Service state: always visible, it decides whether anything can run */}
      {native ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
            status.enabled ? "border-green-500/40 bg-green-500/5" : "border-yellow-500/50 bg-yellow-500/10"
          )}
        >
          {status.enabled ? (
            <span className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              {a.serviceOn}
            </span>
          ) : (
            <>
              <span className="flex items-center gap-2 text-sm text-yellow-200">
                <AlertTriangle className="h-4 w-4" />
                {a.serviceOff}
              </span>
              <Button type="button" size="sm" onClick={() => AutoClickerNative.openAccessibilitySettings()}>
                {a.enableService}
              </Button>
            </>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-border/50 bg-card/60 px-4 py-3 text-xs text-muted-foreground">
          {a.androidOnly}
        </p>
      )}

      {/* Sub-menus */}
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-border/50 bg-card/80 p-1">
        {SECTIONS.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            aria-pressed={section === id}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-bold uppercase tracking-wide transition",
              section === id
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="max-w-full truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* ---------------- Macros ---------------- */}
      {section === "macros" && (
        <div className="fade-enter space-y-5">
          <Card className={cardCls}>
            <CardContent className="space-y-3 pt-6">
              {configs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{a.noConfig}</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {configs.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      aria-pressed={c.id === selectedId}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left transition",
                        c.id === selectedId
                          ? "border-primary bg-primary/15"
                          : "border-border/50 bg-input hover:border-primary/30"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{c.name || "—"}</span>
                        <span className="text-xs text-muted-foreground">{modeLabel(c)}</span>
                      </span>
                      {status.panelShown && status.configId === c.id && (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {selected && (
                <div className="space-y-2 border-t border-border/50 pt-3">
                  <Button
                    type="button"
                    className="h-14 w-full text-base font-bold"
                    variant={panelOnSelected ? "outline" : "default"}
                    disabled={!native || (!status.enabled && !panelOnSelected)}
                    onClick={togglePanel}
                  >
                    {panelOnSelected ? <Square className="h-5 w-5" /> : <Layers className="h-5 w-5" />}
                    {panelOnSelected ? a.hidePanel : a.showPanel}
                  </Button>
                  <p className="text-xs text-muted-foreground">{a.panelHelp}</p>
                  <p className="text-xs text-muted-foreground">{a.compactHelp}</p>
                  {error && <p className="text-xs text-red-400">{error}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => add(newConfig(a.single, "single"))}>
              <MousePointerClick className="h-4 w-4" />
              {a.newSingle}
            </Button>
            <Button type="button" variant="outline" onClick={() => add(newConfig(a.multi, "multi"))}>
              <ListPlus className="h-4 w-4" />
              {a.newMulti}
            </Button>
          </div>

          <Card className={cardCls}>
            <CardHeader className="border-b border-border/50 pb-3">
              <CardTitle className={titleCls}>{a.templates}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <TemplateRow
                icon={<HeartPulse className="h-4 w-4" />}
                label={a.healTemplate}
                help={a.healHelp}
                onClick={() => add(healingTemplate(a.healName, a.healStep1))}
              />
              <TemplateRow
                icon={<Skull className="h-4 w-4" />}
                label={a.terrorTemplate}
                help={a.terrorHelp}
                onClick={() => add(terrorTemplate(a.terrorName))}
              />
            </CardContent>
          </Card>

          {/* What it is and what to know: folded away once read */}
          <div className="rounded-xl border border-yellow-500/50 bg-yellow-500/10 p-3 text-xs text-yellow-200">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{a.tosWarning}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAboutOpen((o) => !o)}
            aria-expanded={aboutOpen}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/50 bg-card/60 px-4 py-3 text-left text-sm"
          >
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              {a.about}
            </span>
            <ChevronDown className={cn("h-4 w-4 transition", aboutOpen && "rotate-180")} />
          </button>
          {aboutOpen && (
            <div className="fade-enter space-y-2 px-1 text-xs text-muted-foreground">
              <p>{a.intro}</p>
              <p className="flex gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  {a.privacy} {a.safety}
                </span>
              </p>
              <p>{a.speedNote}</p>
            </div>
          )}
        </div>
      )}

      {/* ---------------- Edit ---------------- */}
      {section === "edit" &&
        (!selected ? (
          <p className="rounded-xl border border-border/50 bg-card/60 p-4 text-sm text-muted-foreground">
            {a.editHint}
          </p>
        ) : (
          <div className="fade-enter space-y-5">
            <Card className={cardCls}>
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className={titleCls}>
                  <Settings2 className="h-4 w-4" />
                  {a.general}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <Field label={a.name}>
                  <Input
                    value={selected.name}
                    maxLength={LIMITS.name}
                    onChange={(e) => update({ name: e.target.value })}
                    className="border-border/50 bg-input"
                  />
                </Field>

                <Field label={a.mode}>
                  <div className="grid grid-cols-3 gap-2">
                    {(["single", "multi", "sync"] as const).map((m) => (
                      <Button
                        key={m}
                        type="button"
                        variant={selected.mode === m ? "default" : "outline"}
                        onClick={() => setMode(m)}
                        className="h-auto min-h-9 whitespace-normal px-2 py-2 text-xs leading-tight"
                      >
                        {a[m]}
                      </Button>
                    ))}
                  </div>
                  {selected.mode === "sync" && <p className="text-xs text-muted-foreground">{a.syncHelp}</p>}
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={(selected.mode === "multi" ? a.cyclePause : a.interval).replace(/\s*\((ms|мс)\)$/, "")}>
                    <DurationField
                      value={selected.intervalMs}
                      range={LIMITS.intervalMs}
                      onCommit={(n) => update({ intervalMs: n })}
                    />
                  </Field>
                  <Field label={a.startDelay}>
                    <NumField
                      value={selected.startDelaySec}
                      range={LIMITS.startDelaySec}
                      onCommit={(n) => update({ startDelaySec: n })}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={a.stopWhen}>
                    <select
                      value={selected.stop}
                      onChange={(e) => update({ stop: e.target.value as StopRule })}
                      className={selectCls}
                    >
                      <option value="infinite">{a.infinite}</option>
                      <option value="cycles">{a.afterCycles}</option>
                      <option value="duration">{a.afterDuration}</option>
                    </select>
                  </Field>
                  {selected.stop === "cycles" && (
                    <Field label={a.cycles}>
                      <NumField
                        value={selected.cycles}
                        range={LIMITS.cycles}
                        onCommit={(n) => update({ cycles: n })}
                      />
                    </Field>
                  )}
                  {selected.stop === "duration" && (
                    <Field label={a.seconds}>
                      <NumField
                        value={selected.durationSec}
                        range={LIMITS.durationSec}
                        onCommit={(n) => update({ durationSec: n })}
                      />
                    </Field>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  ≈ {formatMs(cycleDurationMs(selected), units)} / {a.cycles.toLowerCase()}
                </p>
              </CardContent>
            </Card>

            <Card className={cardCls}>
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className={titleCls}>
                  <Layers className="h-4 w-4" />
                  {a.targets} · {selected.targets.length}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {selected.targets.map((target, i) => {
                  const open = openTarget === target.id
                  return (
                    <div
                      key={target.id}
                      className={cn("rounded-xl border bg-input/60", open ? "border-primary/60" : "border-border/50")}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenTarget(open ? null : target.id)}
                        aria-expanded={open}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {target.label || a.target(i + 1)}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {targetSummary(target, selected.mode)}
                          </span>
                        </span>
                        <ChevronDown className={cn("h-4 w-4 shrink-0 transition", open && "rotate-180")} />
                      </button>

                      {open && (
                        <div className="fade-enter space-y-3 border-t border-border/50 p-3">
                          <Field label={a.label}>
                            <Input
                              value={target.label}
                              maxLength={LIMITS.name}
                              placeholder={a.target(i + 1)}
                              onChange={(e) => updateTarget(target.id, { label: e.target.value })}
                              className="border-border/50 bg-input"
                            />
                          </Field>
                          <div className="grid grid-cols-2 gap-3">
                            <Field label={a.type}>
                              <select
                                value={target.type}
                                onChange={(e) => updateTarget(target.id, { type: e.target.value as TargetType })}
                                className={selectCls}
                              >
                                <option value="tap">{a.tap}</option>
                                <option value="hold">{a.hold}</option>
                                <option value="swipe">{a.swipe}</option>
                              </select>
                            </Field>
                            {target.type === "tap" && (
                              <Field label={a.tapMs.replace(/\s*\((ms|мс)\)$/, "")}>
                                <DurationField
                                  value={target.tapMs}
                                  range={LIMITS.tapMs}
                                  onCommit={(n) => updateTarget(target.id, { tapMs: n })}
                                />
                              </Field>
                            )}
                            {target.type === "hold" && (
                              <Field label={a.holdMs.replace(/\s*\((ms|мс)\)$/, "")}>
                                <DurationField
                                  value={target.holdMs}
                                  range={LIMITS.holdMs}
                                  onCommit={(n) => updateTarget(target.id, { holdMs: n })}
                                />
                              </Field>
                            )}
                            {target.type === "swipe" && (
                              <Field label={a.swipeMs.replace(/\s*\((ms|мс)\)$/, "")}>
                                <DurationField
                                  value={target.swipeMs}
                                  range={LIMITS.swipeMs}
                                  onCommit={(n) => updateTarget(target.id, { swipeMs: n })}
                                />
                              </Field>
                            )}
                            {selected.mode === "multi" && (
                              <>
                                <Field label={a.delayAfter.replace(/\s*\((ms|мс)\)$/, "")}>
                                  <DurationField
                                    value={target.delayAfterMs}
                                    range={LIMITS.delayAfterMs}
                                    onCommit={(n) => updateTarget(target.id, { delayAfterMs: n })}
                                  />
                                </Field>
                                <Field label={a.repeat}>
                                  <NumField
                                    value={target.repeat}
                                    range={LIMITS.repeat}
                                    onCommit={(n) => updateTarget(target.id, { repeat: n })}
                                  />
                                </Field>
                              </>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              {target.x !== null && target.y !== null ? a.placedAt(target.x, target.y) : a.notPlaced}
                            </p>
                            {selected.mode !== "single" && selected.targets.length > 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300"
                                onClick={() => {
                                  update({ targets: selected.targets.filter((x) => x.id !== target.id) })
                                  setOpenTarget(null)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                {a.remove}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {selected.mode !== "single" && selected.targets.length < LIMITS.targets && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const target = newTarget()
                      update({ targets: [...selected.targets, target] })
                      setOpenTarget(target.id)
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    {a.addTarget}
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  add({
                    ...selected,
                    id: newConfig("", selected.mode).id,
                    name: selected.name || a[selected.mode],
                    targets: selected.targets.map((x) => ({ ...x, id: newTarget().id })),
                  })
                }
              >
                <Copy className="h-4 w-4" />
                {a.duplicate}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-red-400 hover:text-red-300"
                onClick={() => {
                  const next = configs.filter((c) => c.id !== selected.id)
                  void persist(next, selected.id)
                  setSelectedId(next[0]?.id ?? "")
                  setSection("macros")
                }}
              >
                <Trash2 className="h-4 w-4" />
                {a.remove}
              </Button>
            </div>
          </div>
        ))}

      {/* ---------------- Look ---------------- */}
      {section === "look" && (
        <Card className={cn(cardCls, "fade-enter")}>
          <CardContent className="space-y-5 pt-6">
            <Field label={`${a.markerSize} · ${appearance.markerSize} dp`}>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={MARKER_RANGE[0]}
                  max={MARKER_RANGE[1]}
                  step={2}
                  value={appearance.markerSize}
                  onChange={(e) => changeAppearance({ markerSize: Number(e.target.value) })}
                  className="min-w-0 flex-1 accent-[var(--primary)]"
                  aria-label={a.markerSize}
                />
                {/* Live preview at real size (1 dp ≈ 1 CSS px) */}
                <span className="flex h-24 w-24 shrink-0 items-center justify-center">
                  <span
                    className="flex items-center justify-center rounded-full border-2 border-white bg-primary/70 font-bold text-white"
                    style={{
                      width: appearance.markerSize,
                      height: appearance.markerSize,
                      fontSize: Math.max(8, appearance.markerSize * 0.36),
                    }}
                  >
                    1
                  </span>
                </span>
              </div>
            </Field>
            <Field label={`${a.opacity} · ${appearance.panelOpacity}`}>
              <input
                type="range"
                min={30}
                max={100}
                step={5}
                value={appearance.panelOpacity}
                onChange={(e) => changeAppearance({ panelOpacity: Number(e.target.value) })}
                className="w-full accent-[var(--primary)]"
                aria-label={a.opacity}
              />
            </Field>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{a.hideWhileRunning}</span>
              <input
                type="checkbox"
                checked={appearance.hideWhileRunning}
                onChange={(e) => changeAppearance({ hideWhileRunning: e.target.checked })}
                className="h-5 w-5 accent-[var(--primary)]"
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* ---------------- Share ---------------- */}
      {section === "share" && (
        <Card className={cn(cardCls, "fade-enter")}>
          <CardContent className="space-y-3 pt-6">
            <Button type="button" variant="outline" className="w-full" disabled={!selected} onClick={shareSelected}>
              <Copy className="h-4 w-4" />
              {a.exportBtn}
              {selected ? ` · ${selected.name}` : ""}
            </Button>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={a.importPlaceholder}
              rows={4}
              spellCheck={false}
              className="w-full rounded-md border border-border/50 bg-input p-3 font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={!importText.trim() || configs.length >= LIMITS.configs}
              onClick={doImport}
            >
              <ClipboardPaste className="h-4 w-4" />
              {a.importBtn}
            </Button>
            {shareInfo && <p className="text-xs text-muted-foreground">{shareInfo}</p>}
            <p className="text-xs text-muted-foreground">{a.positionsNote}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TemplateRow({
  icon,
  label,
  help,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  help: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border border-border/50 bg-input/60 p-3 text-left transition hover:border-primary/40"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{help}</span>
      </span>
    </button>
  )
}
