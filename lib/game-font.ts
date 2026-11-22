import { Nunito } from "next/font/google"

/**
 * Close to the font of the game's chat (see lib/text-art.ts). Bundled at
 * build time, so the preview works offline.
 */
export const gameFont = Nunito({
  weight: "700",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "vietnamese"],
  display: "block",
  preload: false,
})
