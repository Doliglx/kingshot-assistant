// Reads and writes the app's saved data for a backup (browser/phone side).

import { KEYS } from "./storage-keys"
import { loadAppearance, loadConfigs, saveAppearance, saveConfigs } from "./auto-clicker"
import { isDefaultOrder } from "./module-order"
import { sanitizeBackupData, type BackupData } from "./backup"

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const json = (key: string): unknown => {
  const raw = read(key)
  if (raw === null) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** Gathers what is saved on this device. Sections never saved are left out. */
export async function collectBackupData(): Promise<BackupData> {
  const speed = read(KEYS.gatherSpeed)
  const width = read(KEYS.textArtWidth)
  const guide = read(KEYS.rallyGuideHidden)
  return sanitizeBackupData({
    settings: json(KEYS.settings),
    order: json(KEYS.order),
    textArt: json(KEYS.textArt),
    textArtWidth: width === null ? undefined : Number(width),
    rally: json(KEYS.rally),
    rallyGuideHidden: guide === null ? undefined : guide === "1",
    gatherSpeed: speed === null ? undefined : Number(speed),
    // Macros live in the Android app's own storage, or in local storage on the web.
    clicker: { configs: await loadConfigs(), appearance: await loadAppearance() },
  })
}

/**
 * Writes a backup over what is saved. All or nothing: if anything fails, what
 * was there before is put back. The caller reloads the app afterwards.
 */
export async function applyBackupData(d: BackupData): Promise<void> {
  const writes: [string, string | null][] = []
  if (d.settings) writes.push([KEYS.settings, JSON.stringify(d.settings)])
  if (d.order) writes.push([KEYS.order, isDefaultOrder(d.order) ? null : JSON.stringify(d.order)])
  if (d.textArt) writes.push([KEYS.textArt, JSON.stringify(d.textArt)])
  if (d.textArtWidth !== undefined) writes.push([KEYS.textArtWidth, String(d.textArtWidth)])
  if (d.rally) writes.push([KEYS.rally, JSON.stringify(d.rally)])
  if (d.rallyGuideHidden !== undefined) writes.push([KEYS.rallyGuideHidden, d.rallyGuideHidden ? "1" : "0"])
  if (d.gatherSpeed !== undefined) writes.push([KEYS.gatherSpeed, String(d.gatherSpeed)])
  // The two ready-made macros must not come back on top of the restored ones.
  if (d.clicker) writes.push([KEYS.clickerSeeded, "1"])

  const before = writes.map(([key]) => [key, read(key)] as const)
  const previousClicker = d.clicker ? { configs: await loadConfigs(), appearance: await loadAppearance() } : null

  const restore = async () => {
    for (const [key, value] of before) {
      try {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
      } catch {
        // nothing more can be done
      }
    }
    if (previousClicker) {
      try {
        await saveConfigs(previousClicker.configs)
        await saveAppearance(previousClicker.appearance)
      } catch {
        // nothing more can be done
      }
    }
  }

  try {
    if (d.clicker) {
      await saveConfigs(d.clicker.configs)
      await saveAppearance(d.clicker.appearance)
    }
    for (const [key, value] of writes) {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    }
  } catch (e) {
    await restore()
    throw e
  }
}
