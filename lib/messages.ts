// Modèles du message à copier, par langue (logique pure, sans React).

export const LANGS = ["en", "fr"] as const
export type Lang = (typeof LANGS)[number]

export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  fr: "Français",
}

export const isLang = (x: unknown): x is Lang =>
  typeof x === "string" && (LANGS as readonly string[]).includes(x)

/** Turret positions around the castle. */
export const TURRETS = ["n", "s", "e", "w"] as const
export type Turret = (typeof TURRETS)[number]

export interface MessageTemplates {
  /** Titre pour le château (cible par défaut). */
  castle: string
  /** Title for one of the four turrets. */
  turret: Record<Turret, string>
  /** Titre pour une autre cible (nom déjà en majuscules). */
  target: (upperName: string) => string
  /** Titre + heure (Exact UTC). */
  at: (title: string, time: string) => string
  launchAt: string
  firstLaunches: (name: string) => string
  thenLaunch: string
  countFrom: (name: string) => string
}

export const MESSAGES: Record<Lang, MessageTemplates> = {
  en: {
    castle: "CASTLE HIT",
    turret: { n: "NORTH TURRET HIT", s: "SOUTH TURRET HIT", e: "EAST TURRET HIT", w: "WEST TURRET HIT" },
    target: (n) => `${n} HIT`,
    at: (title, t) => `${title} at ${t} UTC`,
    launchAt: "Launch your rally at:",
    firstLaunches: (n) => `${n} launches first.`,
    thenLaunch: "Then launch your rally:",
    countFrom: (n) => `(count from ${n}'s launch)`,
  },
  fr: {
    castle: "ATTAQUE DU CHÂTEAU",
    turret: { n: "ATTAQUE DE LA TOURELLE NORD", s: "ATTAQUE DE LA TOURELLE SUD", e: "ATTAQUE DE LA TOURELLE EST", w: "ATTAQUE DE LA TOURELLE OUEST" },
    target: (n) => `ATTAQUE DE ${n}`,
    at: (title, t) => `${title} à ${t} UTC`,
    launchAt: "Lancez votre rally à :",
    firstLaunches: (n) => `${n} lance en premier.`,
    thenLaunch: "Ensuite, lancez votre rally :",
    countFrom: (n) => `(comptez depuis le lancement de ${n})`,
  },
}
