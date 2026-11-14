import { Capacitor } from "@capacitor/core"
import { Haptics } from "@capacitor/haptics"

// Alertes sonores + vibration dans l'écran de l'application.

let ctx: AudioContext | null = null

/** À appeler sur une action utilisateur pour autoriser le son. */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      ctx = new AC()
    }
    if (ctx.state === "suspended") void ctx.resume()
  } catch {
    // son indisponible
  }
}

function beep(freq: number, ms: number) {
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "square"
    osc.frequency.value = freq
    gain.gain.value = 0.15
    osc.connect(gain)
    gain.connect(ctx.destination)
    const t = ctx.currentTime
    osc.start(t)
    gain.gain.setValueAtTime(0.15, t + ms / 1000 - 0.02)
    gain.gain.linearRampToValueAtTime(0, t + ms / 1000)
    osc.stop(t + ms / 1000)
  } catch {
    // ignore
  }
}

function vibrate(ms: number) {
  try {
    if (Capacitor.isNativePlatform()) void Haptics.vibrate({ duration: ms })
    else navigator.vibrate?.(ms)
  } catch {
    // ignore
  }
}

/** Bip court (T−3, T−2, T−1) ou long (GO). */
export function alertTick(go = false) {
  beep(go ? 1320 : 880, go ? 600 : 140)
  vibrate(go ? 600 : 140)
}
