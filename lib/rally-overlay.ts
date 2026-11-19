import { Capacitor, registerPlugin } from "@capacitor/core"

// Plugin natif Android (android/app/src/main/java/.../RallyOverlayPlugin.java)
export interface RallyOverlayPlugin {
  status(): Promise<{ overlay: boolean; notifications: boolean; running: boolean }>
  openOverlaySettings(): Promise<void>
  requestNotifications(): Promise<{ granted: boolean }>
  start(options: {
    mode: "utc" | "quick"
    name: string
    subtitle: string
    precision: string
    delayMs?: number // utc : temps restant avant le départ
    offsetMs?: number // quick : décalage après « Start »
    /** Textes traduits de la bulle et de la notification. */
    texts: {
      start: string
      launchIn: string
      go: string
      goNotif: string
      tapStart: string
      stop: string
      me: string
      channel: string
      modeLabel: string
      /** Accent colour, "#rrggbb". */
      accent: string
    }
  }): Promise<{ overlay: boolean }>
  stop(): Promise<void>
}

export const RallyOverlay = registerPlugin<RallyOverlayPlugin>("RallyOverlay")

/** Le mode flottant n'existe que dans l'application Android. */
export const floatingAvailable = () => Capacitor.getPlatform() === "android"
