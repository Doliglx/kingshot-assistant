"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  HeartPulse,
  Layers,
  ListPlus,
  MousePointerClick,
  Palette,
  Plus,
  Share2,
  ShieldCheck,
  Square,
  Trash2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useSettings } from "@/components/app-settings"
import { copyText } from "@/lib/clipboard"
import {
  AutoClickerNative,
  DEFAULT_APPEARANCE,
  LIMITS,
  autoClickerAvailable,
  cycleDurationMs,
  exportConfig,
  importConfigs,
  loadAppearance,
  loadConfigs,
  newConfig,
  newTarget,
  saveAppearance,
  saveConfigs,
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

/** Number field that lets the user type freely and clamps when leaving the field. */
function NumField({
  id,
  value,
  range,
  onCommit,
}: {
  id?: string
  value: number
  range: readonly [number, number]
  onCommit: (n: number) => void
}) {
  const [text, setText] = useState(String(value))
  const focused = useRef(false)
  // Do not rewrite the field while the user is typing in it.
  useEffect(() => {
    if (!focused.current) setText(String(value))
  }, [value])
  const change = (raw: string) => {
    setText(raw)
    // Save as soon as the value is usable: leaving the app without leaving
    // the field must not lose it.
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
      id={id}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function AutoClicker() {
  const { t } = useSettings()
  const a = t.ac
  const [native, setNative] = useState(false)
  const [configs, setConfigs] = useState<ClickConfig[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState({ enabled: false, panelShown: false, running: false, configId: "" })
  const [error, setError] = useState("")
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE)
  const [importText, setImportText] = useState("")
  const [shareInfo, setShareInfo] = useState("")
  const statusRef = useRef(status)
  statusRef.current = status

  // Texts of the native floating panel, in the app language.
  const panelTexts: Record<string, string> = {
    ...a.native,
    macro: a.configs,
    newMacro: a.single,
    interval: a.interval,
    cyclePause: a.cyclePause,
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
    tapMs: a.tapMs,
    holdMs: a.holdMs,
    swipeMs: a.swipeMs,
    delayAfter: a.delayAfter,
    repeat: a.repeat,
    mode: a.mode,
    sequence: a.sequence,
    simultaneous: a.sync,
    markerSize: a.markerSize,
    small: a.small,
    medium: a.medium,
    large: a.large,
    opacity: a.opacity,
    hideWhileRunning: a.hideWhileRunning,
    yes: a.yes,
    no: a.no,
  }
  const textsRef = useRef(panelTexts)
  textsRef.current = panelTexts

  const refresh = useCallback(async () => {
    try {
      const list = await loadConfigs()
      setConfigs(list)
      setAppearance(await loadAppearance())
      setSelectedId((id) => (list.some((c) => c.id === id) ? id : (list[0]?.id ?? "")))
      if (autoClickerAvailable()) setStatus(await AutoClickerNative.status())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoaded(true)
  }, [])

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

  /** Saves the list and, if the edited macro is on screen, reloads its panel. */
  const persist = useCallback(
    async (next: ClickConfig[], touchedId?: string) => {
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
    },
    []
  )

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

  const add = (c: ClickConfig) => {
    if (configs.length >= LIMITS.configs) return
    void persist([...configs, c])
    setSelectedId(c.id)
  }
  const uniqueName = (base: string) => {
    let name = base
    for (let i = 2; configs.some((c) => c.name === name); i++) name = `${base} ${i}`
    return name
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
    const added = list.slice(0, room).map((c) => ({ ...c, name: uniqueName(c.name || a[c.mode]) }))
    if (added.length === 0) return
    void persist([...configs, ...added])
    setSelectedId(added[0].id)
    setImportText("")
    setShareInfo("")
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

  if (!loaded) return null
  const panelOnSelected = status.panelShown && selected !== null && status.configId === selected.id

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* What it is, and what to know before using it */}
      <Card className={cardCls}>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm">{a.intro}</p>
          <div className="flex gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-xs text-yellow-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{a.tosWarning}</span>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            <span>
              {a.privacy} {a.safety}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Service state */}
      {native ? (
        <Card className={cn(cardCls, !status.enabled && "border-yellow-500/50")}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
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
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-lg border border-border/50 bg-card/60 p-3 text-xs text-muted-foreground">
          {a.androidOnly}
        </p>
      )}

      {/* Saved macros */}
      <Card className={cardCls}>
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className={titleCls}>
            <Layers className="h-4 w-4" />
            {a.configs}
          </CardTitle>
        </CardHeader>
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
                    <span className="text-xs text-muted-foreground">
                      {c.mode === "single" ? a.single : `${c.mode === "sync" ? a.sync : a.multi} · ${c.targets.length}`}
                    </span>
                  </span>
                  {status.panelShown && status.configId === c.id && (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-400" />
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => add(newConfig(uniqueName(a.single), "single"))}
            >
              <MousePointerClick className="h-4 w-4" />
              {a.newSingle}
            </Button>
            <Button type="button" variant="outline" onClick={() => add(newConfig(uniqueName(a.multi), "multi"))}>
              <ListPlus className="h-4 w-4" />
              {a.newMulti}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                add({
                  ...newConfig(uniqueName(a.healName), "multi", [a.healStep1, a.healStep2]),
                  intervalMs: 1000,
                })
              }
            >
              <HeartPulse className="h-4 w-4" />
              {a.healTemplate}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      {selected && (
        <>
          <Card className={cardCls}>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className={titleCls}>
                <MousePointerClick className="h-4 w-4" />
                {t.common.configuration}
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
                <Field label={selected.mode === "single" ? a.interval : a.cyclePause}>
                  <NumField
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
                ≈ {(cycleDurationMs(selected) / 1000).toFixed(2)} s / {a.cycles.toLowerCase()}
              </p>
            </CardContent>
          </Card>

          <Card className={cardCls}>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className={titleCls}>
                <Layers className="h-4 w-4" />
                {a.targets}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {selected.targets.map((target, i) => (
                <div key={target.id} className="space-y-3 rounded-xl border border-border/50 bg-input/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <Input
                      value={target.label}
                      maxLength={LIMITS.name}
                      placeholder={a.target(i + 1)}
                      aria-label={a.label}
                      onChange={(e) => updateTarget(target.id, { label: e.target.value })}
                      className="min-w-0 flex-1 border-border/50 bg-input"
                    />
                    {selected.mode !== "single" && selected.targets.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={a.remove}
                        onClick={() => update({ targets: selected.targets.filter((x) => x.id !== target.id) })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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
                      <Field label={a.tapMs}>
                        <NumField
                          value={target.tapMs}
                          range={LIMITS.tapMs}
                          onCommit={(n) => updateTarget(target.id, { tapMs: n })}
                        />
                      </Field>
                    )}
                    {target.type === "hold" && (
                      <Field label={a.holdMs}>
                        <NumField
                          value={target.holdMs}
                          range={LIMITS.holdMs}
                          onCommit={(n) => updateTarget(target.id, { holdMs: n })}
                        />
                      </Field>
                    )}
                    {target.type === "swipe" && (
                      <Field label={a.swipeMs}>
                        <NumField
                          value={target.swipeMs}
                          range={LIMITS.swipeMs}
                          onCommit={(n) => updateTarget(target.id, { swipeMs: n })}
                        />
                      </Field>
                    )}
                    {selected.mode === "multi" && (
                      <>
                        <Field label={a.delayAfter}>
                          <NumField
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
                  <p className="text-xs text-muted-foreground">
                    {target.x !== null && target.y !== null ? a.placedAt(target.x, target.y) : a.notPlaced}
                  </p>
                </div>
              ))}
              {selected.mode !== "single" && selected.targets.length < LIMITS.targets && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => update({ targets: [...selected.targets, newTarget()] })}
                >
                  <Plus className="h-4 w-4" />
                  {a.addTarget}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className={cn(cardCls, "border-primary/40")}>
            <CardContent className="space-y-3 pt-6">
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
              <p className="text-xs text-muted-foreground">{a.speedNote}</p>
              <p className="text-xs text-muted-foreground">{a.compactHelp}</p>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    add({
                      ...selected,
                      id: newConfig("", selected.mode).id,
                      name: uniqueName(selected.name || a[selected.mode]),
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
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  {a.remove}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Look of the markers and of the floating panel */}
      <Card className={cardCls}>
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className={titleCls}>
            <Palette className="h-4 w-4" />
            {a.appearance}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <Field label={a.markerSize}>
            <div className="grid grid-cols-3 gap-2">
              {(["s", "m", "l"] as const).map((size) => (
                <Button
                  key={size}
                  type="button"
                  variant={appearance.markerSize === size ? "default" : "outline"}
                  onClick={() => changeAppearance({ markerSize: size })}
                >
                  {size === "s" ? a.small : size === "m" ? a.medium : a.large}
                </Button>
              ))}
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

      {/* Share a macro with someone else, or bring one in */}
      <Card className={cardCls}>
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className={titleCls}>
            <Share2 className="h-4 w-4" />
            {a.share}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          <Button type="button" variant="outline" className="w-full" disabled={!selected} onClick={shareSelected}>
            <Copy className="h-4 w-4" />
            {a.exportBtn}
          </Button>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={a.importPlaceholder}
            rows={3}
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
    </div>
  )
}
