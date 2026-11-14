"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { isLang, type Lang } from "@/lib/messages"
import { APP_TEXT, LOCALE_TAG, type AppText } from "@/lib/locales"
import { UI, type UiText } from "@/lib/i18n"

const STORAGE_KEY = "ks-assist-settings-v1"

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
