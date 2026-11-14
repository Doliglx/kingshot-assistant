// Modèles du message à copier, par langue (logique pure, sans React).

export const LANGS = ["en", "fr", "de", "es", "pt", "it", "tr", "ru"] as const
export type Lang = (typeof LANGS)[number]

export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  pt: "Português (BR)",
  it: "Italiano",
  tr: "Türkçe",
  ru: "Русский",
}

export const isLang = (x: unknown): x is Lang =>
  typeof x === "string" && (LANGS as readonly string[]).includes(x)

/** Langue du téléphone si elle est proposée, sinon anglais. */
export function detectLang(): Lang {
  if (typeof navigator === "undefined") return "en"
  for (const l of navigator.languages ?? [navigator.language]) {
    const code = l.slice(0, 2).toLowerCase()
    if (isLang(code)) return code
  }
  return "en"
}

export interface MessageTemplates {
  /** Titre pour le château (cible par défaut). */
  castle: string
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
    target: (n) => `${n} HIT`,
    at: (title, t) => `${title} at ${t} UTC`,
    launchAt: "Launch your rally at:",
    firstLaunches: (n) => `${n} launches first.`,
    thenLaunch: "Then launch your rally:",
    countFrom: (n) => `(count from ${n}'s launch)`,
  },
  fr: {
    castle: "ATTAQUE DU CHÂTEAU",
    target: (n) => `ATTAQUE DE ${n}`,
    at: (title, t) => `${title} à ${t} UTC`,
    launchAt: "Lancez votre rally à :",
    firstLaunches: (n) => `${n} lance en premier.`,
    thenLaunch: "Ensuite, lancez votre rally :",
    countFrom: (n) => `(comptez depuis le lancement de ${n})`,
  },
  de: {
    castle: "ANGRIFF AUF DIE BURG",
    target: (n) => `ANGRIFF AUF ${n}`,
    at: (title, t) => `${title} um ${t} UTC`,
    launchAt: "Rally starten um:",
    firstLaunches: (n) => `${n} startet zuerst.`,
    thenLaunch: "Danach Rally starten:",
    countFrom: (n) => `(gezählt ab dem Start von ${n})`,
  },
  es: {
    castle: "ATAQUE AL CASTILLO",
    target: (n) => `ATAQUE A ${n}`,
    at: (title, t) => `${title} a las ${t} UTC`,
    launchAt: "Lanza tu rally a las:",
    firstLaunches: (n) => `${n} lanza primero.`,
    thenLaunch: "Después, lanza tu rally:",
    countFrom: (n) => `(cuenta desde el lanzamiento de ${n})`,
  },
  pt: {
    castle: "ATAQUE AO CASTELO",
    target: (n) => `ATAQUE A ${n}`,
    at: (title, t) => `${title} às ${t} UTC`,
    launchAt: "Lance seu rally às:",
    firstLaunches: (n) => `${n} lança primeiro.`,
    thenLaunch: "Depois, lance seu rally:",
    countFrom: (n) => `(conte a partir do lançamento de ${n})`,
  },
  it: {
    castle: "ATTACCO AL CASTELLO",
    target: (n) => `ATTACCO A ${n}`,
    at: (title, t) => `${title} alle ${t} UTC`,
    launchAt: "Lancia il tuo rally alle:",
    firstLaunches: (n) => `${n} lancia per primo.`,
    thenLaunch: "Poi lancia il tuo rally:",
    countFrom: (n) => `(conta dal lancio di ${n})`,
  },
  tr: {
    castle: "KALE SALDIRISI",
    target: (n) => `${n} SALDIRISI`,
    at: (title, t) => `${title} saat ${t} UTC'de`,
    launchAt: "Rally'ni şu saatte başlat:",
    firstLaunches: (n) => `${n} ilk başlatır.`,
    thenLaunch: "Ardından rally'ni başlat:",
    countFrom: (n) => `(${n} başlatınca saymaya başla)`,
  },
  ru: {
    castle: "АТАКА НА ЗАМОК",
    target: (n) => `АТАКА: ${n}`,
    at: (title, t) => `${title} в ${t} UTC`,
    launchAt: "Запуск ралли в:",
    firstLaunches: (n) => `${n} запускает первым.`,
    thenLaunch: "Затем запускайте ралли:",
    countFrom: (n) => `(отсчёт от запуска ${n})`,
  },
}
