"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { monotonicNow, synchronize, type ClockSync } from "@/lib/utc-clock"

const RESYNC_MS = 5 * 60 * 1000

export type SyncState = "syncing" | "ok" | "error"

export interface UtcClock {
  /** Heure UTC courante (ms) : synchronisée, sinon horloge du téléphone. */
  now: number
  sync: ClockSync | null
  state: SyncState
  error: string
  resync: () => void
}

/** Horloge UTC synchronisée, rafraîchie toutes les `tickMs`. */
export function useUtcClock(tickMs = 100): UtcClock {
  const [sync, setSync] = useState<ClockSync | null>(null)
  const [state, setState] = useState<SyncState>("syncing")
  const [error, setError] = useState("")
  const [, setTick] = useState(0)
  const running = useRef(false)
  // Écart horloge système / horloge monotone au moment de la synchro :
  // un saut (mise en veille, changement d'heure) déclenche une resynchro.
  const driftRef = useRef<number | null>(null)

  const resync = useCallback(async () => {
    if (running.current) return
    running.current = true
    setState("syncing")
    try {
      const s = await synchronize()
      setSync(s)
      driftRef.current = Date.now() - monotonicNow()
      setState("ok")
      setError("")
    } catch (e) {
      setState("error")
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      running.current = false
    }
  }, [])

  useEffect(() => {
    resync()
    const every = setInterval(resync, RESYNC_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") resync()
    }
    document.addEventListener("visibilitychange", onVisible)
    const tick = setInterval(() => {
      setTick((t) => t + 1)
      const d = driftRef.current
      if (d !== null && Math.abs(Date.now() - monotonicNow() - d) > 1000) {
        driftRef.current = Date.now() - monotonicNow()
        resync()
      }
    }, tickMs)
    return () => {
      clearInterval(every)
      clearInterval(tick)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [resync, tickMs])

  const now = sync ? monotonicNow() + sync.offsetMs : Date.now()
  return { now, sync, state, error, resync }
}
