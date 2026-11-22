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

const WIDE =
  /\p{Extended_Pictographic}|\p{Regional_Indicator}|[ᄀ-ᅟ☀-➿⬀-⯿■-◿⺀-〿぀-㏿㐀-䶿一-鿿ꥠ-꥿가-힯豈-﫿︰-﹏＀-｠￠-￦]/u

/** True for a character that takes a full cell in the chat (emoji, squares, CJK, ideographic space). */
export function isWide(g: string): boolean {
  return WIDE.test(g)
}

/**
 * Width of a character in cells (1 cell = one emoji).
 * Narrow widths are estimates for the game's bold sans-serif font.
 */
export function cellWidth(g: string): number {
  if (g === " ") return 0.3
  if (g === "\t") return 1.2
  if (isWide(g)) return 1
  if (/[iljI.,:;'!|`]/.test(g)) return 0.28
  if (/[mwMW@]/.test(g)) return 0.85
  if (/[A-Z0-9]/.test(g)) return 0.62
  return 0.52
}

// ---------------------------------------------------------------------
// Chat layout

/** Measured: 16 wide characters fit on a line, 17 do not. */
export const DEFAULT_LINE_CELLS = 16
/** Lines hold up to this many cells (between 16 and 17 for the default). */
const capacity = (cells: number) => cells + 0.5

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
export function layoutChat(text: string, cells = DEFAULT_LINE_CELLS): LaidOutLine[] {
  const max = capacity(cells)
  const lines: LaidOutLine[] = []
  const paragraphs = text.replace(/\r\n?/g, "\n").split("\n")

  paragraphs.forEach((para, p) => {
    let line: string[] = []
    let width = 0
    const flush = () => {
      while (line.length && line[line.length - 1] === " ") line.pop()
      lines.push({ chars: line, hardBreak: false })
      line = []
      width = 0
    }

    const words = para.split(" ")
    words.forEach((word, w) => {
      const chars = graphemes(word)
      const wordWidth = chars.reduce((sum, g) => sum + cellWidth(g), 0)
      const space = w > 0 ? cellWidth(" ") : 0

      if (line.length > 0 && width + space + wordWidth > max) flush()
      else if (w > 0 && line.length > 0) {
        line.push(" ")
        width += space
      }

      if (wordWidth <= max - width) {
        line.push(...chars)
        width += wordWidth
        return
      }
      // Longer than a whole line: cut it wherever the line is full.
      for (const g of chars) {
        const gw = cellWidth(g)
        if (width + gw > max && line.length > 0) flush()
        line.push(g)
        width += gw
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
