// Text art & message templates: storage, and a preview that lays text out the
// way Kingshot's chat does.
//
// How the chat lays text out was measured on a real screenshot (private chat,
// see tests/text-art.test.ts): a bubble holds 16 "wide" characters per line
// (emoji, ◼ ◻ squares, ideographic spaces), lines break at ordinary spaces,
// ideographic spaces (U+3000) never break and keep the indentation, and a run
// longer than a line is cut character by character. Narrow characters (Latin
// letters, digits, ordinary spaces) have estimated widths: no screenshot of
// them has been measured yet.

// ---------------------------------------------------------------------
// Model

export interface ArtFolder {
  id: string
  name: string
}

export interface TextArt {
  id: string
  name: string
  /** null = not in a folder */
  folderId: string | null
  /** Exactly what is copied: never trimmed or normalised. */
  text: string
  updatedAt: number
}

export interface ArtLibrary {
  folders: ArtFolder[]
  items: TextArt[]
}

export const ART_LIMITS = {
  items: 500,
  folders: 50,
  name: 60,
  text: 20_000,
} as const

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")

export function newArt(name: string, text = "", folderId: string | null = null): TextArt {
  return { id: newId(), name: name.slice(0, ART_LIMITS.name), folderId, text, updatedAt: Date.now() }
}

export function newFolder(name: string): ArtFolder {
  return { id: newId(), name: name.slice(0, ART_LIMITS.name) }
}

/** Rebuilds a library from untrusted data. The text itself is kept byte for byte. */
export function sanitizeLibrary(raw: unknown): ArtLibrary {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const folders: ArtFolder[] = (Array.isArray(o.folders) ? o.folders : [])
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .slice(0, ART_LIMITS.folders)
    .map((f) => ({ id: str(f.id, 64) || newId(), name: str(f.name, ART_LIMITS.name) }))
  const folderIds = new Set(folders.map((f) => f.id))
  const items: TextArt[] = (Array.isArray(o.items) ? o.items : [])
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
    .slice(0, ART_LIMITS.items)
    .map((i) => {
      const folderId = typeof i.folderId === "string" && folderIds.has(i.folderId) ? i.folderId : null
      return {
        id: str(i.id, 64) || newId(),
        name: str(i.name, ART_LIMITS.name),
        folderId,
        // Not .trim(): leading ideographic spaces and trailing spaces are part of the art.
        text: str(i.text, ART_LIMITS.text),
        updatedAt: typeof i.updatedAt === "number" && Number.isFinite(i.updatedAt) ? i.updatedAt : 0,
      }
    })
  return { folders, items }
}

const STORAGE_KEY = "ks-assist-textart-v1"

export function loadLibrary(): ArtLibrary | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === null ? null : sanitizeLibrary(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveLibrary(lib: ArtLibrary): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lib))
    return true
  } catch {
    // Storage full or unavailable
    return false
  }
}

/** Example added the first time the module is opened. */
export const EXAMPLE_ART =
  "　　　　　　　　◼◼◼◼ 　　　　　　◼◼🍀🍀🍀🍀◼ 　　　　　◼🍀🍀🍀🍀🍀⚪🍀◼ 　　　　◼🍀🍀🍀🍀🍀⚪⚪⚪◼ 　　◼◼🍀🍀🍀🍀🍀◼◼◼◼🍀◼ 　◼🍀🍀🍀🍀🍀🍀◼🍀🍀🍀🍀🍀🍀◼ 　◼🍀🍀🍀◼◼◼◻◻📜◻◻◼◼　　◼🍀🍀🍀◼📜📜◻◼📜◼◻◼　　　　◼◼◼◼📜📜◻◼📜◼◻◼　　　　◼📜📜◼◼📜📜📜📜📜📜📜◼　　　◼📜📜◼📜📜◼📜📜📜📜📜◼　　　　◼📜📜📜◼◼◼◼📜📜◼◼　　　◼◼◼📜📜📜📜◼◼◼◼◼　　　　　　　◼📜📜📜📜📜📜◼　　　　　　　◼🍀◼📜📜📜📜◼　　　　　　　◼🍀🍀◼◼◼◼◼◼　　　　　　◼🍀🍀🍀💙🍀🍀🍀💙🍀◼　　　　　◼🍀🍀🍀💙🍀🍀🍀💙🍀◼　　　　◼🍀🍀🍀🍀💙💙🍀🍀💙🍀◼　　　　◼◼🍀🍀🍀💙💙💙💙💙◼🍀◼　　◼⚪⚪🍀🍀💙🌕🌕💙💙💙🌕🍀◼　　◼⚪⚪⚪⚪◼🌕🌕💙💙💙🌕◼⚪◼　◼⚪⚪⚪⚪◼💙💙💙💙💙◼⚪◼"

// ---------------------------------------------------------------------
// Characters

/** Splits text into user-perceived characters (an emoji with modifiers is one). */
export function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" })
    return Array.from(seg.segment(text), (s) => s.segment)
  }
  return Array.from(text)
}

export const IDEOGRAPHIC_SPACE = "　"

// ---------------------------------------------------------------------
// Character widths

/**
 * The game's chat font looks like Nunito Bold (calibrated on screenshots of
 * long lines of letters and digits). Advance widths of printable ASCII
 * (U+0020 to U+007E) in Nunito 700, in thousandths of the font size.
 */
const NUNITO_ASCII = [
  271, 248, 448, 600, 600, 945, 726, 243, 358, 358, 453, 600, 248, 434, 248, 313, 600, 600, 600, 600, 600, 600, 600, 600,
  600, 600, 248, 248, 600, 600, 600, 459, 950, 744, 688, 680, 762, 597, 562, 736, 773, 282, 354, 665, 562, 868, 748, 785,
  652, 785, 686, 631, 621, 738, 713, 1113, 672, 618, 605, 354, 313, 354, 600, 500, 377, 547, 600, 472, 600, 542, 364, 604,
  585, 255, 259, 536, 319, 877, 585, 576, 600, 600, 392, 488, 384, 579, 527, 853, 546, 526, 474, 391, 288, 391, 600,
]

/** One emoji cell, in font sizes (measured: 36.6 px cells for 35.9 px text). */
export const CELL_EM = 1.02

/** Width in font sizes of a narrow character, or undefined when unknown. */
export type Measure = (g: string) => number | undefined

/** Without a measurement (tests, first render): ASCII table, otherwise an average width. */
export function estimateEm(g: string): number {
  const c = g.length === 1 ? g.charCodeAt(0) : 0
  if (c >= 32 && c < 127) return NUNITO_ASCII[c - 32] / 1000
  return 0.55
}

const CJK =
  /[ᄀ-ᅟ⺀-〿぀-ヿ㇀-㏿㐀-䶿一-鿿ꥠ-꥿가-힯豈-﫿︰-﹏＀-｠￠-￦]/u
const TEXT_DEFAULT = /^[©®™‼⁉#*0-9]$/

/**
 * True for a character drawn in a fixed square cell: emoji (the game draws
 * them like Apple's), the squares used for pixel art, CJK and fullwidth
 * characters, and the ideographic space. Everything else is text in the
 * game's font and keeps its own width.
 */
export function isCjk(g: string): boolean {
  return CJK.test(g)
}

export function isWide(g: string): boolean {
  if (/[\u{FE0F}\u{200D}\u{20E3}]|\p{Regional_Indicator}|\p{Emoji_Presentation}/u.test(g)) return true
  if (/\p{Extended_Pictographic}/u.test(g) && /\p{Emoji}/u.test(g) && !TEXT_DEFAULT.test(g)) return true
  return CJK.test(g)
}

/** Width of a character in cells (1 cell = one emoji). */
export function cellWidth(g: string, measure?: Measure): number {
  if (g === "\t") return 1.2
  if (isWide(g)) return 1
  return (measure?.(g) ?? estimateEm(g)) / CELL_EM
}

// ---------------------------------------------------------------------
// Chat layout

/** Measured: 16 emoji fit on a line, 17 do not. */
export const DEFAULT_LINE_CELLS = 16
/**
 * Room on a line, in cells. 16.55 cells for the default: fits 16 emoji and
 * reproduces 13 of the 16 measured breaks in long text exactly, the 3 others
 * by one character (the game's font is close to Nunito, not identical).
 */
const capacity = (cells: number) => cells + 0.55

export interface LaidOutLine {
  /** Characters on the line, trailing spaces removed (they are not drawn). */
  chars: string[]
  /** True when the line ends because of a newline typed in the text. */
  hardBreak: boolean
}

/**
 * Lays text out like the game's chat bubble:
 *  - ordinary spaces are break opportunities, and a space at the end of a line is dropped;
 *  - everything else, ideographic spaces included, sticks together;
 *  - a run longer than a whole line is cut character by character;
 *  - a newline always starts a new line.
 */
export function layoutChat(text: string, cells = DEFAULT_LINE_CELLS, measure?: Measure): LaidOutLine[] {
  const max = capacity(cells)
  const width = (g: string) => cellWidth(g, measure)
  const lines: LaidOutLine[] = []
  const paragraphs = text.replace(/\r\n?/g, "\n").split("\n")

  paragraphs.forEach((para, p) => {
    let line: string[] = []
    let used = 0
    const flush = () => {
      while (line.length && line[line.length - 1] === " ") line.pop()
      lines.push({ chars: line, hardBreak: false })
      line = []
      used = 0
    }

    const words = para.split(" ")
    words.forEach((word, w) => {
      const chars = graphemes(word)
      const wordWidth = chars.reduce((sum, g) => sum + width(g), 0)
      const space = w > 0 ? width(" ") : 0

      if (line.length > 0 && used + space + wordWidth > max) flush()
      else if (w > 0) {
        line.push(" ")
        used += space
      }

      if (wordWidth <= max - used) {
        line.push(...chars)
        used += wordWidth
        return
      }
      // Longer than a whole line: cut it wherever the line is full.
      for (const g of chars) {
        const gw = width(g)
        if (used + gw > max && line.length > 0) flush()
        line.push(g)
        used += gw
      }
    })
    flush()
    if (p < paragraphs.length - 1) lines[lines.length - 1].hardBreak = true
  })
  return lines
}

// ---------------------------------------------------------------------
// Checks that catch a damaged copy/paste

export interface TextStats {
  /** Characters as the eye counts them. */
  characters: number
  /** UTF-16 code units: what many chat inputs actually limit. */
  utf16: number
  ideographicSpaces: number
  spaces: number
  newlines: number
  /** U+FFFD: a character lost on the way (the paste is damaged). */
  broken: number
}

export function textStats(text: string): TextStats {
  let ideographicSpaces = 0
  let spaces = 0
  let newlines = 0
  let broken = 0
  for (const ch of text) {
    if (ch === IDEOGRAPHIC_SPACE) ideographicSpaces++
    else if (ch === " ") spaces++
    else if (ch === "\n") newlines++
    else if (ch === "�") broken++
  }
  return { characters: graphemes(text).length, utf16: text.length, ideographicSpaces, spaces, newlines, broken }
}
