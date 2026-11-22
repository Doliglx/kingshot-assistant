// Every key the app keeps in the browser's local storage, in one place.
// The backup (lib/backup-storage.ts) reads and writes exactly these.

export const KEYS = {
  settings: "ks-assist-settings-v1",
  order: "ks-assist-order-v1",
  textArt: "ks-assist-textart-v1",
  textArtWidth: "ks-assist-textart-width",
  rally: "ks-assist-rally-v1",
  rallyGuideHidden: "ks-assist-rally-guide-hidden",
  gatherSpeed: "gather-current-speed",
  clickerConfigs: "ks-assist-autoclicker-v1",
  clickerAppearance: "ks-assist-autoclicker-appearance-v1",
  clickerSeeded: "ks-assist-autoclicker-seeded-v1",
} as const
