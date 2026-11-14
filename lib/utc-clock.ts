// Horloge UTC synchronisée sur une source externe (principe NTP simplifié).
//
// - Horloge locale de référence : performance.timeOrigin + performance.now(),
//   monotone, donc insensible aux changements d'heure du téléphone.
// - Chaque échantillon mesure l'aller-retour (RTT) d'une requête vers une
//   source d'heure ; l'heure serveur est supposée prise au milieu du trajet.
// - On garde l'échantillon au plus petit RTT : incertitude = RTT/2
//   + résolution de la source.

import { Capacitor, CapacitorHttp } from "@capacitor/core"

export interface ClockSample {
  offsetMs: number // heure UTC réelle − horloge locale monotone
  uncertaintyMs: number
  rttMs: number
}

export interface ClockSync {
  offsetMs: number
  uncertaintyMs: number
  source: string
  syncedAt: number // horloge monotone locale au moment de la synchro
  samples: number
}

interface TimeSource {
  name: string
  /** Renvoie l'heure serveur (ms epoch) et sa résolution (ms). */
  read: () => Promise<{ serverMs: number; resolutionMs: number }>
}

/** Horloge locale monotone (ms, même échelle qu'epoch au chargement). */
export function monotonicNow(): number {
  return performance.timeOrigin + performance.now()
}

/** Construit un échantillon à partir d'une mesure. */
export function makeSample(
  t0: number,
  t1: number,
  serverMs: number,
  resolutionMs: number
): ClockSample {
  const rtt = Math.max(0, t1 - t0)
  // serverMs = début de l'intervalle de résolution → on vise son milieu
  const serverMid = serverMs + resolutionMs / 2
  return {
    offsetMs: serverMid + rtt / 2 - t1,
    uncertaintyMs: rtt / 2 + resolutionMs / 2,
    rttMs: rtt,
  }
}

/** Meilleur échantillon = plus petite incertitude. */
export function bestSample(samples: ClockSample[]): ClockSample | null {
  return samples.reduce<ClockSample | null>(
    (best, s) => (!best || s.uncertaintyMs < best.uncertaintyMs ? s : best),
    null
  )
}

// ---------- Sources ----------

async function httpGetText(url: string): Promise<{ text: string; date: string | null }> {
  if (Capacitor.isNativePlatform()) {
    const r = await CapacitorHttp.get({
      url,
      responseType: "text",
      headers: { "Cache-Control": "no-cache" },
      connectTimeout: 5000,
      readTimeout: 5000,
    })
    if (r.status < 200 || r.status >= 400) throw new Error(`HTTP ${r.status}`)
    const dateKey = Object.keys(r.headers ?? {}).find((k) => k.toLowerCase() === "date")
    return {
      text: typeof r.data === "string" ? r.data : JSON.stringify(r.data),
      date: dateKey ? r.headers[dateKey] : null,
    }
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  try {
    const r = await fetch(url, { cache: "no-store", signal: ctrl.signal })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return { text: await r.text(), date: r.headers.get("date") }
  } finally {
    clearTimeout(timer)
  }
}

/** Cloudflare /cdn-cgi/trace : ligne « ts=1700000000.123 » (résolution ms). */
function cloudflareSource(url: string): TimeSource {
  return {
    name: new URL(url).host,
    read: async () => {
      const { text } = await httpGetText(url)
      const m = text.match(/^ts=(\d+(?:\.\d+)?)$/m)
      if (!m) throw new Error("ts absent")
      return { serverMs: Math.floor(parseFloat(m[1]) * 1000), resolutionMs: 1 }
    },
  }
}

/** En-tête HTTP Date (résolution 1 s) : source de secours. */
function dateHeaderSource(url: string): TimeSource {
  return {
    name: new URL(url).host + " (Date)",
    read: async () => {
      const { date } = await httpGetText(url)
      const ms = date ? Date.parse(date) : NaN
      if (!isFinite(ms)) throw new Error("Date absente")
      return { serverMs: ms, resolutionMs: 1000 }
    },
  }
}

/** Route /api/time de la version web (serveur Next.js). */
function appServerSource(): TimeSource {
  return {
    name: "serveur de l'app",
    read: async () => {
      const { text } = await httpGetText("/api/time")
      const now = (JSON.parse(text) as { now?: number }).now
      if (typeof now !== "number") throw new Error("réponse invalide")
      return { serverMs: now, resolutionMs: 1 }
    },
  }
}

export function defaultSources(): TimeSource[] {
  const cf = [
    cloudflareSource("https://www.cloudflare.com/cdn-cgi/trace"),
    cloudflareSource("https://1.1.1.1/cdn-cgi/trace"),
  ]
  const fallback = dateHeaderSource("https://www.google.com/generate_204")
  // App Android : requêtes natives (pas de CORS) → Cloudflare directement.
  // Version web : la route /api/time de l'app d'abord.
  return Capacitor.isNativePlatform() ? [...cf, fallback] : [appServerSource(), ...cf]
}

/**
 * Synchronise : essaie les sources dans l'ordre, prend `samples` mesures
 * sur la première qui répond (la 1ʳᵉ sert à ouvrir la connexion et n'est
 * pas retenue) et garde la meilleure.
 */
export async function synchronize(
  sources: TimeSource[] = defaultSources(),
  samples = 6
): Promise<ClockSync> {
  const errors: string[] = []
  for (const src of sources) {
    const got: ClockSample[] = []
    for (let i = 0; i < samples; i++) {
      try {
        const t0 = monotonicNow()
        const { serverMs, resolutionMs } = await src.read()
        const t1 = monotonicNow()
        if (i > 0 || samples === 1) got.push(makeSample(t0, t1, serverMs, resolutionMs))
      } catch (e) {
        errors.push(`${src.name}: ${e instanceof Error ? e.message : e}`)
        if (got.length === 0 && i === 0) break // source injoignable : suivante
      }
    }
    const best = bestSample(got)
    if (best) {
      return {
        offsetMs: best.offsetMs,
        uncertaintyMs: best.uncertaintyMs,
        source: src.name,
        syncedAt: monotonicNow(),
        samples: got.length,
      }
    }
  }
  throw new Error(errors.join(" · ") || "aucune source")
}
