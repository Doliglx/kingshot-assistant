import type { Lang } from "@/lib/messages"
import type { AppText } from "./types"
import { en } from "./en"
import { fr } from "./fr"

export type { AppText } from "./types"

export const APP_TEXT: Record<Lang, AppText> = { en, fr }

/** BCP 47 tag used for number and date formatting. */
export const LOCALE_TAG: Record<Lang, string> = {
  en: "en-US",
  fr: "fr-FR",
}
