// Auto clicker: macro model, validation and storage.
//
// On Android the macros live in the app's private preferences, shared with the
// accessibility service that runs them (the floating markers write positions
// back). In a browser they are kept in localStorage so macros can be prepared
// and previewed, but nothing can be tapped.

import { Capacitor, registerPlugin } from "@capacitor/core"

export type TargetType = "tap" | "hold" | "swipe"
/** single: one point · multi: targets one after another · sync: all targets at once */
export type ClickMode = "single" | "multi" | "sync"
export type StopRule = "infinite" | "cycles" | "duration"

export interface ClickTarget {
  id: string
  label: string
  type: TargetType
  /** Screen pixels; null until the marker has been placed on screen. */
  x: number | null
  y: number | null
  /** Swipe end point. */
  x2: number | null
  y2: number | null
  /** Duration of a plain tap. */
  tapMs: number
  holdMs: number
  swipeMs: number
  delayAfterMs: number
  repeat: number
  /** Marker diameter in dp for this target; null = default size from the Look tab. */
  size: number | null
}

export interface ClickConfig {
  id: string
  name: string
  mode: ClickMode
  /** Single: time between taps. Multi: pause between two cycles. */
  intervalMs: number
  startDelaySec: number
  stop: StopRule
  cycles: number
  durationSec: number
  targets: ClickTarget[]
}

/** Marker diameter in dp. */
export const MARKER_RANGE = [16, 96] as const

// Hard limits, mirrored in AutoClickStore.java
export const LIMITS = {
  targets: 20,
  configs: 50,
  name: 40,
  intervalMs: [1, 3_600_000],
  startDelaySec: [0, 60],
  cycles: [1, 1_000_000],
  durationSec: [1, 86_400],
  tapMs: [1, 500],
  holdMs: [100, 10_000],
  swipeMs: [100, 5_000],
  delayAfterMs: [0, 600_000],
  repeat: [1, 1000],
} as const

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

const clamp = (v: unknown, [min, max]: readonly [number, number], fallback: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

const coord = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 20_000 ? Math.round(v) : null

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")

export function newTarget(label = ""): ClickTarget {
  return {
    id: newId(),
    label,
    type: "tap",
    x: null,
    y: null,
    x2: null,
    y2: null,
    tapMs: 20,
    holdMs: 600,
    swipeMs: 300,
    delayAfterMs: 500,
    repeat: 1,
    size: null,
  }
}

export function newConfig(name: string, mode: ClickMode, labels: string[] = []): ClickConfig {
  const count = mode === "single" ? 1 : Math.max(2, labels.length)
  return {
    id: newId(),
    name,
    mode,
    intervalMs: 1000,
    startDelaySec: 3,
    stop: "infinite",
    cycles: 10,
    durationSec: 60,
    targets: Array.from({ length: count }, (_, i) => newTarget(labels[i] ?? "")),
  }
}

/** Rebuilds a macro from untrusted data, clamping every value. */
export function sanitizeConfig(raw: unknown): ClickConfig | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const mode: ClickMode = o.mode === "multi" || o.mode === "sync" ? o.mode : "single"
  const rawTargets = Array.isArray(o.targets) ? o.targets : []
  const targets: ClickTarget[] = rawTargets
    .slice(0, mode === "single" ? 1 : LIMITS.targets)
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => ({
      id: text(t.id, 64) || newId(),
      label: text(t.label, LIMITS.name),
      type: t.type === "hold" || t.type === "swipe" ? t.type : "tap",
      x: coord(t.x),
      y: coord(t.y),
      x2: coord(t.x2),
      y2: coord(t.y2),
      tapMs: clamp(t.tapMs, LIMITS.tapMs, 20),
      holdMs: clamp(t.holdMs, LIMITS.holdMs, 600),
      swipeMs: clamp(t.swipeMs, LIMITS.swipeMs, 300),
      delayAfterMs: clamp(t.delayAfterMs, LIMITS.delayAfterMs, 500),
      repeat: clamp(t.repeat, LIMITS.repeat, 1),
      size: t.size == null ? null : clamp(t.size, MARKER_RANGE, 46),
    }))
  if (targets.length === 0) targets.push(newTarget())
  return {
    id: text(o.id, 64) || newId(),
    name: text(o.name, LIMITS.name),
    mode,
    intervalMs: clamp(o.intervalMs, LIMITS.intervalMs, 1000),
    startDelaySec: clamp(o.startDelaySec, LIMITS.startDelaySec, 3),
    stop: o.stop === "cycles" || o.stop === "duration" ? o.stop : "infinite",
    cycles: clamp(o.cycles, LIMITS.cycles, 10),
    durationSec: clamp(o.durationSec, LIMITS.durationSec, 60),
    targets,
  }
}

export function parseConfigs(json: string): ClickConfig[] {
  try {
    const data = JSON.parse(json)
    if (!Array.isArray(data)) return []
    return data
      .slice(0, LIMITS.configs)
      .map(sanitizeConfig)
      .filter((c): c is ClickConfig => c !== null)
  } catch {
    return []
  }
}

/** Length of one cycle in ms (gestures + waits), used for the summary line. */
export function cycleDurationMs(c: ClickConfig): number {
  const gesture = (t: ClickTarget) => (t.type === "hold" ? t.holdMs : t.type === "swipe" ? t.swipeMs : t.tapMs)
  // Simultaneous: every target is pressed together, the longest press sets the pace.
  if (c.mode === "sync") return Math.max(...c.targets.map(gesture)) + c.intervalMs
  const body = c.targets.reduce(
    (sum, t) => sum + t.repeat * (gesture(t) + (c.mode === "multi" ? t.delayAfterMs : 0)),
    0
  )
  return body + c.intervalMs
}

// ---------------------------------------------------------------------
// Ready-made macros

/** One target tapped every 20 ms: the heal button during batch healing. */
export function healingTemplate(name: string, label: string): ClickConfig {
  const c = newConfig(name, "single", [label])
  c.intervalMs = 20
  c.targets[0] = { ...c.targets[0], label, tapMs: 20 }
  return c
}

/**
 * Terror rallies, one every 2 minutes: search, pick the Terror, rally, confirm…
 * then wait 2 minutes on the last step. Positions were recorded on a
 * 1080 × 2340 screen; on another screen, move the markers once.
 */
const TERROR_STEPS: Array<[x: number, y: number, label: string, tapMs: number, delayAfterMs: number]> = [
  [66, 1736, "Loupe", 20, 900],
  [394, 1788, "", 20, 900],
  [576, 2247, "", 20, 900],
  [550, 1228, "", 20, 900],
  [551, 960, "", 20, 900],
  [567, 1513, "", 20, 900],
  [780, 271, "", 20, 900],
  [861, 2245, "", 500, 120_000],
]

export function terrorTemplate(name: string): ClickConfig {
  const c = newConfig(name, "multi")
  c.intervalMs = 1000
  c.targets = TERROR_STEPS.map(([x, y, label, tapMs, delayAfterMs]) => ({
    ...newTarget(label),
    x,
    y,
    tapMs,
    delayAfterMs,
  }))
  return c
}

// ---------------------------------------------------------------------
// Sharing macros

const EXPORT_KIND = "kingshot-assistant/macro"

/** Text to paste elsewhere (chat, another phone). */
export function exportConfig(c: ClickConfig): string {
  return JSON.stringify({ kind: EXPORT_KIND, version: 1, macro: c })
}

/**
 * Reads macros pasted by the user: an exported macro, a bare macro or a list.
 * Everything is re-validated and gets fresh ids, so an import never replaces
 * an existing macro. Returns null when nothing usable was found.
 */
export function importConfigs(text: string): ClickConfig[] | null {
  let data: unknown
  try {
    data = JSON.parse(text.trim())
  } catch {
    return null
  }
  if (data && typeof data === "object" && (data as { kind?: unknown }).kind === EXPORT_KIND) {
    data = (data as { macro?: unknown }).macro
  }
  const list = (Array.isArray(data) ? data : [data])
    .slice(0, LIMITS.configs)
    .map(sanitizeConfig)
    .filter((c): c is ClickConfig => c !== null)
    .map((c) => ({ ...c, id: newId(), targets: c.targets.map((t) => ({ ...t, id: newId() })) }))
  return list.length ? list : null
}

// ---------------------------------------------------------------------
// Appearance of the markers and of the floating panel (shared by all macros)

export interface Appearance {
  /** Marker diameter in dp. */
  markerSize: number
  /** Percent. */
  panelOpacity: number
  hideWhileRunning: boolean
}

export const DEFAULT_APPEARANCE: Appearance = { markerSize: 46, panelOpacity: 94, hideWhileRunning: false }

// Older versions stored the marker size as "s", "m" or "l".
const LEGACY_MARKER: Record<string, number> = { s: 34, m: 46, l: 60 }

export function sanitizeAppearance(raw: unknown): Appearance {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  return {
    markerSize:
      typeof o.markerSize === "string" && o.markerSize in LEGACY_MARKER
        ? LEGACY_MARKER[o.markerSize]
        : clamp(o.markerSize, MARKER_RANGE, DEFAULT_APPEARANCE.markerSize),
    panelOpacity: clamp(o.panelOpacity, [30, 100], DEFAULT_APPEARANCE.panelOpacity),
    hideWhileRunning: o.hideWhileRunning === true,
  }
}

// ---------------------------------------------------------------------
// Native bridge (android/app/src/main/java/.../AutoClickerPlugin.java)

export interface AutoClickerPlugin {
  status(): Promise<{ enabled: boolean; panelShown: boolean; running: boolean; configId: string }>
  openAccessibilitySettings(): Promise<void>
  loadConfigs(): Promise<{ json: string }>
  saveConfigs(options: { json: string }): Promise<void>
  showPanel(options: {
    configId: string
    /** Texts of the floating panel, in the app language. */
    texts: Record<string, string>
  }): Promise<void>
  hidePanel(): Promise<void>
  loadAppearance(): Promise<{ json: string }>
  saveAppearance(options: { json: string }): Promise<void>
}

export const AutoClickerNative = registerPlugin<AutoClickerPlugin>("AutoClicker")

export const autoClickerAvailable = () => Capacitor.getPlatform() === "android"

const WEB_KEY = "ks-assist-autoclicker-v1"

export async function loadConfigs(): Promise<ClickConfig[]> {
  if (autoClickerAvailable()) {
    const { json } = await AutoClickerNative.loadConfigs()
    return parseConfigs(json)
  }
  try {
    return parseConfigs(localStorage.getItem(WEB_KEY) ?? "[]")
  } catch {
    return []
  }
}

export async function saveConfigs(configs: ClickConfig[]): Promise<void> {
  const json = JSON.stringify(configs.slice(0, LIMITS.configs))
  if (autoClickerAvailable()) {
    await AutoClickerNative.saveConfigs({ json })
    return
  }
  try {
    localStorage.setItem(WEB_KEY, json)
  } catch {
    // storage unavailable
  }
}

const WEB_APPEARANCE_KEY = "ks-assist-autoclicker-appearance-v1"

export async function loadAppearance(): Promise<Appearance> {
  try {
    const json = autoClickerAvailable()
      ? (await AutoClickerNative.loadAppearance()).json
      : (localStorage.getItem(WEB_APPEARANCE_KEY) ?? "{}")
    return sanitizeAppearance(JSON.parse(json))
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export async function saveAppearance(a: Appearance): Promise<void> {
  const json = JSON.stringify(sanitizeAppearance(a))
  if (autoClickerAvailable()) {
    await AutoClickerNative.saveAppearance({ json })
    return
  }
  try {
    localStorage.setItem(WEB_APPEARANCE_KEY, json)
  } catch {
    // storage unavailable
  }
}
