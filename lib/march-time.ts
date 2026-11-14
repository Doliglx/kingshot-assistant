// KS Rally Timing : calcul des lancements de rallies pour une arrivée
// simultanée sur une cible. Logique pure (sans React), heures en UTC.
//
// - Exact UTC  : départ_i = T − marche_i (heure absolue)
// - Quick Sync : décalage_i = marche_max − marche_i (relatif au 1er lancement)

import { MESSAGES, type Lang } from "./messages"

const DAY_MS = 24 * 3600 * 1000

export type MessageLang = Lang

export interface LeaderInput {
  id: string
  name: string
  march: string // saisie brute : "125", "2:05", "1m30s"…
}

export interface NamedLeader {
  id: string
  name: string // nom affiché (pseudos en double numérotés)
  duplicate: boolean
  marchSec: number
  index: number // position dans la saisie
}

export interface PlanRow extends NamedLeader {
  departMs: number
}

export interface QuickRow extends NamedLeader {
  offsetSec: number
}

export interface QuickPlan {
  first: QuickRow // marche la plus longue : lance en premier
  rows: QuickRow[] // tous les leaders, triés par décalage croissant (first inclus)
}

const pad = (n: number) => n.toString().padStart(2, "0")

/**
 * Durée de marche → secondes.
 * Formats acceptés : "125", "2:05", "1:02:05", "1m30s", "1m 30s", "90s",
 * "2m", "1h2m3s". Renvoie null si la saisie est vide ou invalide.
 */
export function parseDuration(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "")
  if (!s) return null

  if (/^\d+$/.test(s)) return parseInt(s, 10)

  const colon = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/)
  if (colon) {
    const a = parseInt(colon[1], 10)
    const b = parseInt(colon[2], 10)
    if (colon[3] === undefined) {
      if (b > 59) return null
      return a * 60 + b
    }
    const c = parseInt(colon[3], 10)
    if (b > 59 || c > 59) return null
    return a * 3600 + b * 60 + c
  }

  const units = s.match(/^(?:(\d+)h)?(?:(\d+)m(?:in)?)?(?:(\d+)s(?:ec)?)?$/)
  if (units && (units[1] || units[2] || units[3])) {
    const h = parseInt(units[1] ?? "0", 10)
    const m = parseInt(units[2] ?? "0", 10)
    const sec = parseInt(units[3] ?? "0", 10)
    return h * 3600 + m * 60 + sec
  }

  return null
}

/** "HH:MM:SS" (ou "HH:MM") → secondes depuis minuit, ou null. */
export function parseTimeOfDay(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const sec = m[3] === undefined ? 0 : parseInt(m[3], 10)
  if (h > 23 || min > 59 || sec > 59) return null
  return h * 3600 + min * 60 + sec
}

/**
 * Heure du jour T → instant d'arrivée absolu (ms).
 * On retient l'occurrence de T la plus proche de maintenant (± 12 h) :
 * à 23:58 UTC, « 00:01:00 » désigne le lendemain ; à 00:02 UTC,
 * « 23:59:00 » désigne la veille.
 */
export function resolveArrival(timeOfDaySec: number, nowMs: number): number {
  const dayStart = Math.floor(nowMs / DAY_MS) * DAY_MS
  let best = dayStart + timeOfDaySec * 1000
  for (const c of [best - DAY_MS, best + DAY_MS]) {
    if (Math.abs(c - nowMs) < Math.abs(best - nowMs)) best = c
  }
  return best
}

/** Instant (ms) → "HH:MM:SS" UTC. */
export function formatUtc(ms: number): string {
  const d = new Date(ms)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

/** Durée (s) → "m:ss" ou "h:mm:ss". */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

/** Décalage Quick Sync : « +5s », au-delà d'une minute « +1m05s ». */
export function formatOffset(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  if (s < 60) return `+${s}s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `+${h}h${pad(m)}m${pad(sec)}s` : `+${m}m${pad(sec)}s`
}

/**
 * Leaders valides (temps de marche lisible), avec pseudos affichés :
 * les doublons (casse et espaces ignorés) sont numérotés « Alex (1) »,
 * « Alex (2) » ; un pseudo vide devient « Leader N ».
 */
export function namedLeaders(leaders: LeaderInput[]): NamedLeader[] {
  const valid = leaders
    .map((l, index) => ({ l, index, marchSec: parseDuration(l.march) }))
    .filter(
      (x): x is { l: LeaderInput; index: number; marchSec: number } => x.marchSec !== null
    )

  const key = (n: string) => n.trim().toLowerCase()
  const counts = new Map<string, number>()
  for (const { l } of valid) {
    const k = key(l.name)
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const seen = new Map<string, number>()

  return valid.map(({ l, index, marchSec }) => {
    const k = key(l.name)
    const total = k ? counts.get(k)! : 0
    let name = l.name.trim() || `Leader ${index + 1}`
    if (total > 1) {
      const n = (seen.get(k) ?? 0) + 1
      seen.set(k, n)
      name = `${name} (${n})`
    }
    return { id: l.id, name, duplicate: total > 1, marchSec, index }
  })
}

/** Exact UTC : départs triés par heure croissante (le plus lent en premier). */
export function computePlan(leaders: LeaderInput[], arrivalMs: number): PlanRow[] {
  return namedLeaders(leaders)
    .map((l) => ({ ...l, departMs: arrivalMs - l.marchSec * 1000 }))
    .sort((a, b) => a.departMs - b.departMs || a.index - b.index)
}

/**
 * Quick Sync : le leader à la marche la plus longue lance en premier
 * (le premier saisi en cas d'égalité) ; les autres lancent après lui
 * avec décalage = marche_max − marche_i. Marches égales → +0s.
 */
export function computeQuickSync(leaders: LeaderInput[]): QuickPlan | null {
  const named = namedLeaders(leaders)
  if (named.length === 0) return null
  const max = Math.max(...named.map((l) => l.marchSec))
  const rows = named
    .map((l) => ({ ...l, offsetSec: max - l.marchSec }))
    .sort((a, b) => a.offsetSec - b.offsetSec || a.index - b.index)
  return { first: rows[0], rows }
}

// Le château est reconnu dans toutes les langues proposées
const CASTLE_NAMES = new Set([
  "castle", "château", "chateau", "burg", "schloss", "castillo", "castelo",
  "castello", "kale", "замок",
])

/** « CASTLE HIT » / « ATTAQUE DU CHÂTEAU » / « NORTH TOWER HIT »… */
export function targetTitle(target: string, lang: MessageLang): string {
  const name = target.trim() || "Castle"
  const m = MESSAGES[lang]
  return CASTLE_NAMES.has(name.toLowerCase()) ? m.castle : m.target(name.toUpperCase())
}

/** Titre Exact UTC : « CASTLE HIT at 12:30:00 UTC ». */
export function messageTitle(target: string, arrivalMs: number, lang: MessageLang): string {
  return MESSAGES[lang].at(targetTitle(target, lang), formatUtc(arrivalMs))
}

/** Message Exact UTC : une ligne par leader, triée par départ. */
export function buildMessage(
  target: string,
  arrivalMs: number,
  rows: PlanRow[],
  lang: MessageLang
): string {
  return [
    messageTitle(target, arrivalMs, lang),
    MESSAGES[lang].launchAt,
    ...rows.map((r) => `${formatUtc(r.departMs)} ${r.name}`),
  ].join("\n")
}

/** Message Quick Sync : décalages comptés depuis le lancement du premier. */
export function buildQuickMessage(target: string, plan: QuickPlan, lang: MessageLang): string {
  const m = MESSAGES[lang]
  const first = plan.first.name
  const others = plan.rows.filter((r) => r.id !== plan.first.id)
  const lines = [targetTitle(target, lang), m.firstLaunches(first)]
  if (others.length) {
    lines.push(m.thenLaunch)
    for (const r of others) lines.push(`${formatOffset(r.offsetSec)} ${r.name}`)
    lines.push(m.countFrom(first))
  }
  return lines.join("\n")
}
