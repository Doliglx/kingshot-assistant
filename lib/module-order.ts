// Order of the module tiles on the home screen, chosen by the user (pure logic, no React).

import { KEYS } from "./storage-keys"

export const MODULE_IDS = ["rss", "fraki", "ratio", "buff", "gather", "rally", "clicker", "textart"] as const
export type ModuleId = (typeof MODULE_IDS)[number]

export const ORDER_KEY = KEYS.order

/**
 * A usable order from whatever was stored: unknown or repeated ids are
 * dropped, and modules missing from it (added by an update) go at the end in
 * their default order, so a new module is never hidden.
 */
export function sanitizeOrder(raw: unknown, all: readonly string[] = MODULE_IDS): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  if (Array.isArray(raw)) {
    for (const id of raw) {
      if (typeof id === "string" && all.includes(id) && !seen.has(id)) {
        seen.add(id)
        out.push(id)
      }
    }
  }
  for (const id of all) if (!seen.has(id)) out.push(id)
  return out
}

/** Moves `id` by `delta` places (negative = earlier). Stops at either end. */
export function moveModule(order: readonly string[], id: string, delta: number): string[] {
  const from = order.indexOf(id)
  if (from < 0) return [...order]
  const to = Math.min(order.length - 1, Math.max(0, from + delta))
  if (to === from) return [...order]
  const next = [...order]
  next.splice(from, 1)
  next.splice(to, 0, id)
  return next
}

export const isDefaultOrder = (order: readonly string[]) => order.every((id, i) => id === MODULE_IDS[i])

export function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY)
    return sanitizeOrder(raw ? JSON.parse(raw) : null)
  } catch {
    return [...MODULE_IDS]
  }
}

export function saveOrder(order: readonly string[]): void {
  try {
    if (isDefaultOrder(order)) localStorage.removeItem(ORDER_KEY)
    else localStorage.setItem(ORDER_KEY, JSON.stringify(order))
  } catch {
    // storage unavailable: the order is kept for this session only
  }
}
