import type { Lang } from "@/lib/messages"
import type { AppText } from "./types"
import { en } from "./en"
import { fr } from "./fr"
import { de } from "./de"
import { es } from "./es"
import { pt } from "./pt"
import { it } from "./it"
import { tr } from "./tr"
import { ru } from "./ru"

export type { AppText } from "./types"

export const APP_TEXT: Record<Lang, AppText> = { en, fr, de, es, pt, it, tr, ru }

/** BCP 47 tag used for number and date formatting. */
export const LOCALE_TAG: Record<Lang, string> = {
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES",
  pt: "pt-BR",
  it: "it-IT",
  tr: "tr-TR",
  ru: "ru-RU",
}
