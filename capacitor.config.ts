import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.doliglx.ksassist",
  appName: "KingShot Assistant",
  webDir: "out",
  backgroundColor: "#090504",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Barres système : icônes claires sur le fond sombre de l'application
    SystemBars: {
      style: "DARK",
    },
  },
}

export default config
