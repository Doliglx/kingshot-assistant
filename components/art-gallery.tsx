"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, Copy, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GameBubble } from "@/components/game-bubble"
import { onBack } from "@/lib/back-stack"
import type { TextArt } from "@/lib/text-art"

const SETTLE_MS = 220

interface Labels {
  copy: string
  edit: string
  back: string
  close: string
  untitled: string
}

/**
 * Full-screen viewer for the templates of the list: one at a time, swipe left
 * or right to move to the neighbouring template (the arrow keys work too, on a keyboard).
 *
 * It is drawn in a portal on <body>. Inside a module it would not be full
 * screen: a module is a transformed, scrolling box, and a fixed element in
 * such a box scrolls along with its content.
 */
export function ArtGallery({
  items,
  startId,
  cells,
  folderOf,
  labels,
  onCopy,
  onEdit,
  onClose,
}: {
  items: TextArt[]
  startId: string
  cells: number
  folderOf: (art: TextArt) => string
  labels: Labels
  onCopy: (art: TextArt) => void
  onEdit: (art: TextArt) => void
  onClose: () => void
}) {
  const [index, setIndex] = useState(() => Math.max(0, items.findIndex((i) => i.id === startId)))
  const [dx, setDx] = useState(0)
  const [settling, setSettling] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const drag = useRef<{ x: number; y: number; t: number; lastX: number; lastT: number; horizontal: boolean | null } | null>(null)

  // Android back button and Escape close the viewer, not the module behind it.
  useEffect(() => onBack(onClose), [onClose])
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  const last = items.length - 1
  const art = items[index]

  const springBack = useCallback(() => {
    if (timer.current) return
    setSettling(true)
    setDx(0)
    timer.current = setTimeout(() => {
      timer.current = null
      setSettling(false)
    }, SETTLE_MS)
  }, [])

  /** Slides to the neighbour in `dir` (+1 = next), or springs back at either end. */
  const go = useCallback(
    (dir: -1 | 1) => {
      if (timer.current) return
      const target = index + dir
      if (target < 0 || target > last) return springBack()
      const width = viewport.current?.clientWidth ?? 0
      setSettling(true)
      setDx(-dir * width)
      timer.current = setTimeout(() => {
        timer.current = null
        // Same render: switch slide and put the track back without animating.
        setSettling(false)
        setIndex(target)
        setDx(0)
      }, SETTLE_MS)
    },
    [index, last, springBack]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1)
      else if (e.key === "ArrowRight") go(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go])

  const onPointerDown = (e: React.PointerEvent) => {
    if (timer.current) return
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, lastX: e.clientX, lastT: e.timeStamp, horizontal: null }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const mx = e.clientX - d.x
    const my = e.clientY - d.y
    d.lastX = e.clientX
    d.lastT = e.timeStamp
    if (d.horizontal === null) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return
      d.horizontal = Math.abs(mx) > Math.abs(my) * 1.2
      if (d.horizontal) e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (!d.horizontal) return
    // Resistance when there is nothing further in that direction.
    const blocked = (mx > 0 && index === 0) || (mx < 0 && index === last)
    setDx(blocked ? mx * 0.3 : mx)
  }

  const endDrag = (e: React.PointerEvent, cancelled: boolean) => {
    const d = drag.current
    drag.current = null
    if (!d || !d.horizontal) return
    // The last position reported while moving: the lift event may carry no usable coordinates.
    const mx = d.lastX - d.x
    const width = viewport.current?.clientWidth ?? 1
    const speed = Math.abs(mx) / Math.max(1, d.lastT - d.t)
    const commit = !cancelled && (Math.abs(mx) > Math.max(60, width * 0.2) || (speed > 0.5 && Math.abs(mx) > 24))
    if (commit) go(mx < 0 ? 1 : -1)
    else springBack()
  }

  if (!art || typeof document === "undefined") return null

  const slides = [items[index - 1], art, items[index + 1]]

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={art.name || labels.untitled}
      className="fade-enter fixed inset-0 z-50 flex select-none flex-col bg-background [-webkit-touch-callout:none]"
    >
      <div className="flex items-center gap-3 border-b border-border/50 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.back}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-card/80 transition active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{art.name || labels.untitled}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[folderOf(art), `${index + 1} / ${items.length}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.close}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-card/80 transition active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Three slides side by side: previous, current, next. The track follows the finger. */}
      <div
        ref={viewport}
        className="min-h-0 flex-1 overflow-hidden"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
      >
        <div
          className="flex h-full"
          style={{
            width: "300%",
            transform: `translate3d(calc(-33.3333% + ${dx}px), 0, 0)`,
            transition: settling ? `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0.9, 0.25, 1)` : "none",
            willChange: "transform",
          }}
        >
          {slides.map((s, k) => (
            <div key={s ? s.id : `empty-${k}`} className="art-slide flex h-full w-1/3 shrink-0 flex-col overflow-y-auto overscroll-y-contain px-3 py-4">
              {s && (
                <div className="mx-auto my-auto w-full max-w-xl rounded-xl bg-[#2a1d12] p-3">
                  <GameBubble text={s.text} cells={cells} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-xl items-center gap-2 border-t border-border/50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Button type="button" className="h-11 flex-1 font-bold" onClick={() => onCopy(art)} disabled={!art.text}>
          <Copy className="h-4 w-4" />
          {labels.copy}
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={() => onEdit(art)}>
          <Pencil className="h-4 w-4" />
          {labels.edit}
        </Button>
      </div>
    </div>,
    document.body
  )
}
