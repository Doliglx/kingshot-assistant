"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { gameFont } from "@/lib/game-font"
import { CELL_EM, IDEOGRAPHIC_SPACE, isCjk, isWide, layoutChat, type Measure } from "@/lib/text-art"

// ---------------------------------------------------------------------
// Preview: the text laid out like the game's chat bubble

/**
 * Symbols such as ◼ ◻ ⚪ also exist as plain text glyphs; the game draws them
 * as emoji. For display only, ask for the emoji form with U+FE0F.
 */
function emojiForm(g: string): string {
  if (g.length === 1 && /[←-⯿]/.test(g)) return g + "️"
  return g
}

/**
 * The game draws square "pixels" as full-cell glossy tiles, while Android's
 * emoji font draws ◼ ◻ as small squares. These few characters, the basis of
 * most chat art, are drawn as tiles that match the game's look (our own
 * drawing, not the game's images). Everything else uses the phone's emoji.
 */
const TILES: Record<string, { size: number; background: string; border: string }> = {
  "◼": { size: 0.94, background: "linear-gradient(#5b5b5b, #0d0d0d 55%)", border: "#000" },
  "⬛": { size: 0.94, background: "linear-gradient(#5b5b5b, #0d0d0d 55%)", border: "#000" },
  "▪": { size: 0.5, background: "linear-gradient(#5b5b5b, #0d0d0d 55%)", border: "#000" },
  "◻": { size: 0.94, background: "linear-gradient(#ffffff, #d6d6d6)", border: "#9a9a9a" },
  "⬜": { size: 0.94, background: "linear-gradient(#ffffff, #d6d6d6)", border: "#9a9a9a" },
  "▫": { size: 0.5, background: "linear-gradient(#ffffff, #d6d6d6)", border: "#9a9a9a" },
  "📜": { size: 0.94, background: "linear-gradient(135deg, #f1dfbe, #d9bd8c)", border: "#b89562" },
}

export const EMOJI_FONT = '"Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji","Segoe UI Symbol",sans-serif'
const GAME_FONT = `${gameFont.style.fontFamily}, sans-serif`

/**
 * Real widths of non-ASCII text characters (kaomoji parts, accents, box
 * drawing...) in the game-like font and the phone's fallback fonts, measured
 * once the font has loaded for that text. ASCII uses the built-in table.
 */
const widthCache = new Map<string, number>()
let measureCtx: CanvasRenderingContext2D | null = null
const measureEm: Measure = (g) => {
  if (g.length === 1 && g.charCodeAt(0) < 127) return undefined
  const hit = widthCache.get(g)
  if (hit !== undefined) return hit
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d")
    if (!measureCtx) return undefined
  }
  measureCtx.font = `700 100px ${GAME_FONT}`
  const em = measureCtx.measureText(g).width / 100
  if (!(em > 0)) return undefined
  widthCache.set(g, em)
  return em
}

/** Measuring is only reliable once the font (and its subsets for this text) has loaded. */
function useFontReady(text: string): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    const fonts = typeof document !== "undefined" ? document.fonts : undefined
    if (!fonts) return setReady(true)
    fonts
      .load(`700 16px ${GAME_FONT}`, text || "a")
      .catch(() => undefined)
      .then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [text])
  return ready
}

type Piece = { kind: "text"; text: string } | { kind: "cell"; g: string }

/** Groups a line into runs of text (drawn in the font) and fixed cells. */
function pieces(chars: string[], splitSpaces: boolean): Piece[] {
  const out: Piece[] = []
  for (const g of chars) {
    if (isWide(g)) {
      out.push({ kind: "cell", g })
      continue
    }
    const last = out[out.length - 1]
    const isSpace = g === " "
    if (last?.kind === "text" && !(splitSpaces && (isSpace || last.text.endsWith(" ")))) last.text += g
    else out.push({ kind: "text", text: g })
  }
  return out
}

export const GameBubble = memo(function GameBubble({
  text,
  cells,
  showSpaces = false,
  maxLines,
  className,
}: {
  text: string
  cells: number
  showSpaces?: boolean
  /** Only the first lines (list thumbnails). */
  maxLines?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const fontReady = useFontReady(text)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const lines = useMemo(() => {
    const all = layoutChat(text, cells, fontReady ? measureEm : undefined)
    return maxLines ? all.slice(0, maxLines) : all
  }, [text, cells, maxLines, fontReady])

  // The game's bubble is about (cells + 3) emoji wide, padding included.
  const cell = width > 0 ? Math.min(34, width / (cells + 3)) : 0
  const fontSize = cell / CELL_EM

  return (
    <div ref={ref} className={cn("w-full", className)}>
      {cell > 0 && (
        <div
          className="mx-auto rounded-2xl border-2 border-[#e0573c] bg-[#fdf6e6] text-[#3b2a1a] shadow-sm"
          style={{
            width: cell * (cells + 3),
            padding: `${cell * 0.55}px ${cell * 1.2}px`,
          }}
        >
          {lines.map((line, i) => (
            <div
              key={i}
              className="flex items-center whitespace-pre"
              style={{ height: cell * 1.28, fontFamily: GAME_FONT, fontWeight: 700, fontSize, fontKerning: "none" }}
            >
              {pieces(line.chars, showSpaces).map((piece, j) => {
                if (piece.kind === "text") {
                  const space = showSpaces && piece.text.startsWith(" ")
                  return (
                    <span
                      key={j}
                      className="shrink-0 leading-none"
                      style={space ? { background: "rgb(224 87 60 / 0.35)" } : undefined}
                    >
                      {piece.text}
                    </span>
                  )
                }
                const g = piece.g
                if (g === IDEOGRAPHIC_SPACE) {
                  return (
                    <span
                      key={j}
                      className="inline-block shrink-0"
                      style={{
                        width: cell,
                        height: cell * 0.9,
                        outline: showSpaces ? "1px dashed rgb(59 42 26 / 0.35)" : undefined,
                        outlineOffset: -2,
                      }}
                    />
                  )
                }
                const tile = TILES[g.replace("\uFE0F", "")]
                if (tile) {
                  return (
                    <span key={j} className="inline-flex shrink-0 items-center justify-center" style={{ width: cell }}>
                      <span
                        style={{
                          width: cell * tile.size,
                          height: cell * tile.size,
                          background: tile.background,
                          border: `1px solid ${tile.border}`,
                          borderRadius: cell * 0.12,
                          boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.35)",
                        }}
                      />
                    </span>
                  )
                }
                const cjk = isCjk(g)
                return (
                  <span
                    key={j}
                    className="inline-flex shrink-0 items-center justify-center overflow-visible leading-none"
                    style={{
                      width: cell,
                      fontSize: cjk ? fontSize : cell * 0.94,
                      fontFamily: cjk ? GAME_FONT : EMOJI_FONT,
                      fontWeight: cjk ? 700 : 400,
                    }}
                  >
                    {cjk ? g : emojiForm(g)}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
