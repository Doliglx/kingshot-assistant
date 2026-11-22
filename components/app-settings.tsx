"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { isLang, type Lang } from "@/lib/messages"
import { APP_TEXT, LOCALE_TAG, type AppText } from "@/lib/locales"
import { UI, type UiText } from "@/lib/i18n"
import { KEYS } from "@/lib/storage-keys"

const STORAGE_KEY = KEYS.settings

/** Default accent: the app's original orange. */
export const DEFAULT_HUE = 35

export const ACCENT_PRESETS = [
  { id: "orange", hue: 35 },
  { id: "red", hue: 20 },
  { id: "gold", hue: 80 },
  { id: "green", hue: 150 },
  { id: "teal", hue: 190 },
  { id: "blue", hue: 250 },
  { id: "violet", hue: 295 },
  { id: "pink", hue: 345 },
] as const

/** CSS colour of the accent for a given hue (same lightness and chroma as the theme). */
export const accentColor = (hue: number) => `oklch(0.68 0.2 ${hue})`

/**
 * Same accent as "#rrggbb", for the native floating panels (Android views do
 * not understand oklch). OKLCH → OKLab → linear sRGB → gamma-encoded sRGB.
 */
export function accentHex(hue: number, l = 0.68, c = 0.2): string {
  const h = (hue * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  return (
    "#" +
    linear
      .map((v) => {
        const x = Math.min(1, Math.max(0, v))
        const srgb = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
        return Math.round(srgb * 255)
          .toString(16)
          .padStart(2, "0")
      })
      .join("")
  )
}

interface Settings {
  lang: Lang
  hue: number
}

interface SettingsContextValue extends Settings {
  /** App-wide texts in the current language. */
  t: AppText
  /** Rally Timer texts in the current language. */
  rallyText: UiText
  /** Locale tag for number and date formatting. */
  locale: string
  /** False until the saved settings have been read (avoids a flash of defaults). */
  ready: boolean
  setLang: (lang: Lang) => void
  setHue: (hue: number) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function applyAccent(hue: number) {
  const root = document.documentElement.style
  const primary = accentColor(hue)
  for (const name of ["--primary", "--ring", "--chart-1", "--sidebar-primary", "--sidebar-ring"]) {
    root.setProperty(name, primary)
  }
  // The secondary highlight keeps its original offset from the accent hue.
  const highlight = `oklch(0.85 0.15 ${(hue + 50) % 360})`
  root.setProperty("--accent", highlight)
  root.setProperty("--chart-2", highlight)
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // English is the default language until the user picks another one.
  const [settings, setSettings] = useState<Settings>({ lang: "en", hue: DEFAULT_HUE })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        setSettings({
          lang: isLang(d.lang) ? d.lang : "en",
          hue:
            typeof d.hue === "number" && isFinite(d.hue)
              ? Math.min(360, Math.max(0, d.hue))
              : DEFAULT_HUE,
        })
      }
    } catch {
      // Storage unavailable or corrupted: keep the defaults.
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    document.documentElement.lang = settings.lang
    applyAccent(settings.hue)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // ignore
    }
  }, [settings, ready])

  const setLang = useCallback((lang: Lang) => setSettings((s) => ({ ...s, lang })), [])
  const setHue = useCallback((hue: number) => setSettings((s) => ({ ...s, hue })), [])

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      t: APP_TEXT[settings.lang],
      rallyText: UI[settings.lang],
      locale: LOCALE_TAG[settings.lang],
      ready,
      setLang,
      setHue,
    }),
    [settings, ready, setLang, setHue]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>")
  return ctx
}
