"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { Haptics, ImpactStyle } from "@capacitor/haptics"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { DevBadge, NewBadge } from "@/components/badges"
import { moveModule } from "@/lib/module-order"

export interface TileDef {
  id: string
  icon: LucideIcon
  /** "dev": still being tested. "new": just arrived. */
  badge?: "dev" | "new"
  name: string
  desc: string
}

const HOLD_MS = 450 // press and hold to start moving a tile from the normal screen
const HOLD_MS_EDIT = 160 // already in the move mode: a short hold tells a drag from a scroll
const SLOP_PX = 10 // a finger that moves more than this before the hold is a scroll
const EDGE_PX = 90 // distance from the screen edge where dragging scrolls the page
const SWAP_COOLDOWN_MS = 140

const buzz = (style: ImpactStyle) => {
  if (Capacitor.isNativePlatform()) void Haptics.impact({ style }).catch(() => undefined)
}

const Badge = ({ kind, className }: { kind?: "dev" | "new"; className?: string }) =>
  kind === "dev" ? <DevBadge className={className} /> : kind === "new" ? <NewBadge className={className} /> : null

/** What a tile shows (also used for the copy that follows the finger). */
function TileBody({ tile }: { tile: TileDef }) {
  const Icon = tile.icon
  return (
    <>
      {tile.badge === "new" && (
        <>
          <span className="tile-ring" aria-hidden>
            <i />
          </span>
          <span className="tile-cover" aria-hidden />
        </>
      )}
      <Badge kind={tile.badge} className="absolute right-2 top-2" />
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary transition duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-7 w-7" />
      </span>
      <span className="text-sm font-bold leading-tight">{tile.name}</span>
      <span className="text-xs leading-snug text-muted-foreground">{tile.desc}</span>
    </>
  )
}

const baseCls =
  "group relative flex flex-col items-center gap-3 rounded-2xl border px-3 pb-5 pt-8 text-center transition-[border-color,box-shadow,transform] duration-200"

interface Press {
  id: string
  pointerId: number
  type: string
  startX: number
  startY: number
  x: number
  y: number
  offX: number
  offY: number
  active: boolean
  lastSwap: number
  timer: ReturnType<typeof setTimeout> | null
}

/**
 * The module tiles of the home screen.
 *
 * Moving: press and hold a tile, then drag it (the other tiles shake and make
 * room). The same works from the "reorder" button. Tapping a tile and then
 * another place also moves it, and the arrow keys move the focused tile.
 */
export function ModuleGrid({
  tiles,
  order,
  reordering,
  onReordering,
  onOrder,
  onCommit,
  onOpen,
}: {
  tiles: TileDef[]
  order: string[]
  reordering: boolean
  onReordering: (on: boolean) => void
  /** The order changed (live, while dragging). */
  onOrder: (order: string[]) => void
  /** The move is finished: save it. */
  onCommit: (order: string[]) => void
  onOpen: (id: string, el: HTMLElement) => void
}) {
  const nav = useRef<HTMLElement>(null)
  const els = useRef(new Map<string, HTMLElement>())
  const lastPos = useRef(new Map<string, { x: number; y: number }>())
  const press = useRef<Press | null>(null)
  const floatEl = useRef<HTMLDivElement>(null)
  const raf = useRef(0)
  const suppressClick = useRef(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [settling, setSettling] = useState(false)
  const [floatSize, setFloatSize] = useState({ w: 0, h: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [introDone, setIntroDone] = useState(false)

  // Latest values for the handlers that outlive a render.
  const live = useRef({ order, reordering, onOrder, onCommit, onReordering })
  live.current = { order, reordering, onOrder, onCommit, onReordering }

  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), 900)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!reordering) setSelectedId(null)
  }, [reordering])

  // Tiles glide to their new place instead of jumping (transform only, layout positions).
  useLayoutEffect(() => {
    const now = new Map<string, { x: number; y: number }>()
    els.current.forEach((el, id) => {
      const pos = { x: el.offsetLeft, y: el.offsetTop }
      now.set(id, pos)
      const before = lastPos.current.get(id)
      if (before && (before.x !== pos.x || before.y !== pos.y) && typeof el.animate === "function") {
        el.animate(
          [{ transform: `translate(${before.x - pos.x}px, ${before.y - pos.y}px)` }, { transform: "translate(0, 0)" }],
          { duration: 220, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" }
        )
      }
    })
    lastPos.current = now
  }, [order, reordering])

  /** Index of the tile under the pointer (its middle part, so tiles do not flip back and forth). */
  const tileAt = (x: number, y: number, skipId: string): number => {
    const box = nav.current?.getBoundingClientRect()
    if (!box) return -1
    const ids = live.current.order
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] === skipId) continue
      const el = els.current.get(ids[i])
      if (!el) continue
      const w = el.offsetWidth
      const h = el.offsetHeight
      const left = box.left + el.offsetLeft + w * 0.15
      const top = box.top + el.offsetTop + h * 0.15
      if (x >= left && x <= left + w * 0.7 && y >= top && y <= top + h * 0.7) return i
    }
    return -1
  }

  const placeFloat = () => {
    const p = press.current
    if (p && floatEl.current) {
      floatEl.current.style.transform = `translate3d(${p.x - p.offX}px, ${p.y - p.offY}px, 0) scale(1.07) rotate(2.5deg)`
    }
  }

  const dragStep = () => {
    const p = press.current
    if (!p || !p.active) return
    placeFloat()
    const ids = live.current.order
    const from = ids.indexOf(p.id)
    const to = tileAt(p.x, p.y, p.id)
    const now = performance.now()
    if (to >= 0 && to !== from && now - p.lastSwap > SWAP_COOLDOWN_MS) {
      p.lastSwap = now
      live.current.onOrder(moveModule(ids, p.id, to - from))
      buzz(ImpactStyle.Light)
    }
    // Near the top or bottom edge the page scrolls, so every tile can be reached.
    const bottomEdge = window.innerHeight - 140 // the bar at the bottom covers the last pixels
    let dy = 0
    if (p.y < EDGE_PX) dy = -Math.ceil(((EDGE_PX - p.y) / EDGE_PX) * 14)
    else if (p.y > bottomEdge) dy = Math.ceil(((p.y - bottomEdge) / EDGE_PX) * 14)
    if (dy) window.scrollBy(0, dy)
    raf.current = requestAnimationFrame(() => fns.current.dragStep())
  }

  const startDrag = () => {
    const p = press.current
    if (!p || p.active) return
    const el = els.current.get(p.id)
    if (!el) return
    p.timer = null
    const r = el.getBoundingClientRect()
    p.offX = p.x - r.left
    p.offY = p.y - r.top
    p.active = true
    suppressClick.current = true
    if (!live.current.reordering) live.current.onReordering(true)
    setSelectedId(null)
    setFloatSize({ w: r.width, h: r.height })
    setSettling(false)
    setDragId(p.id)
    buzz(ImpactStyle.Medium)
    raf.current = requestAnimationFrame(() => fns.current.dragStep())
  }

  /** The finger lifted (or the touch was taken over): drop the tile, or forget a press that never became a drag. */
  const endPress = () => {
    const p = press.current
    press.current = null
    if (!p) return
    if (p.timer) clearTimeout(p.timer)
    cancelAnimationFrame(raf.current)
    if (!p.active) return
    // The copy glides onto the empty place, then the real tile shows again.
    const el = els.current.get(p.id)
    const box = nav.current?.getBoundingClientRect()
    if (el && box && floatEl.current) {
      floatEl.current.style.transform = `translate3d(${box.left + el.offsetLeft}px, ${box.top + el.offsetTop}px, 0) scale(1) rotate(0deg)`
      setSettling(true)
    }
    live.current.onCommit(live.current.order)
    setTimeout(() => {
      setDragId(null)
      setSettling(false)
    }, 200)
    // The click that ends this touch must not open the module.
    setTimeout(() => (suppressClick.current = false), 350)
  }

  // The handlers below are registered once; they call the latest version of these functions.
  const fns = useRef({ startDrag, dragStep, endPress })
  fns.current = { startDrag, dragStep, endPress }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current
      if (!p || e.pointerId !== p.pointerId) return
      p.x = e.clientX
      p.y = e.clientY
      if (p.active) return
      const dist = Math.hypot(p.x - p.startX, p.y - p.startY)
      if (p.type === "mouse" && live.current.reordering && dist > 4) fns.current.startDrag()
      // A finger that moves before the hold is over wants to scroll: leave it alone.
      else if (dist > SLOP_PX) fns.current.endPress()
    }
    const up = (e: PointerEvent) => {
      if (press.current && e.pointerId === press.current.pointerId) fns.current.endPress()
    }
    // Once a tile is lifted, the page must not scroll under the finger (only our own edge scrolling).
    const stop = (ev: TouchEvent) => {
      if (press.current?.active && ev.cancelable) ev.preventDefault()
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
    window.addEventListener("touchmove", stop, { passive: false })
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
      window.removeEventListener("touchmove", stop)
      cancelAnimationFrame(raf.current)
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    if (press.current || (e.pointerType === "mouse" && e.button !== 0)) return
    press.current = {
      id,
      pointerId: e.pointerId,
      type: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      offX: 0,
      offY: 0,
      active: false,
      lastSwap: 0,
      timer: null,
    }
    // With a mouse in the move mode, dragging starts as soon as the pointer moves; otherwise a hold starts it.
    if (!(e.pointerType === "mouse" && live.current.reordering)) {
      press.current.timer = setTimeout(() => fns.current.startDrag(), live.current.reordering ? HOLD_MS_EDIT : HOLD_MS)
    }
  }

  const onClick = (e: React.MouseEvent<HTMLElement>, id: string) => {
    if (suppressClick.current) {
      e.preventDefault()
      return
    }
    if (!reordering) {
      onOpen(id, e.currentTarget)
      return
    }
    // Tap a tile, then the place where it should go.
    if (selectedId === null) setSelectedId(id)
    else if (selectedId === id) setSelectedId(null)
    else {
      const next = moveModule(order, selectedId, order.indexOf(id) - order.indexOf(selectedId))
      onOrder(next)
      onCommit(next)
      setSelectedId(null)
      buzz(ImpactStyle.Light)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (!reordering) return
    const delta = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" ? -2 : e.key === "ArrowDown" ? 2 : 0
    if (!delta) return
    e.preventDefault()
    const next = moveModule(order, id, delta)
    if (next.join() === order.join()) return
    onOrder(next)
    onCommit(next)
    // The tile keeps the focus through its new place.
    requestAnimationFrame(() => els.current.get(id)?.focus())
  }

  const byId = new Map(tiles.map((t) => [t.id, t]))
  const dragged = dragId ? byId.get(dragId) : undefined

  return (
    <>
      <nav ref={nav} className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {order.map((id, i) => {
          const tile = byId.get(id)
          if (!tile) return null
          const isDragged = id === dragId
          const isSelected = id === selectedId
          return (
            <button
              key={id}
              ref={(el) => {
                if (el) els.current.set(id, el)
                else els.current.delete(id)
              }}
              type="button"
              aria-pressed={reordering ? isSelected : undefined}
              onPointerDown={(e) => onPointerDown(e, id)}
              onClick={(e) => onClick(e, id)}
              onKeyDown={(e) => onKeyDown(e, id)}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                animationDelay: introDone ? undefined : `${i * 45}ms`,
                // each tile shakes out of step with its neighbours
                ...(reordering && !isDragged ? { animationDelay: `${-((i * 97) % 400)}ms` } : null),
                WebkitTouchCallout: "none",
              }}
              className={cn(
                baseCls,
                "select-none",
                !introDone && "tile-enter",
                tile.badge === "new" ? "tile-new border-transparent" : "border-border/50 bg-card/80",
                tile.badge === "dev" && !reordering && "tile-breathe",
                reordering && !isDragged && !isSelected && "tile-jig",
                reordering && "!border-dashed !border-primary/60",
                isSelected && "tile-lifted",
                isDragged && "tile-slot",
                !reordering && "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 active:scale-95"
              )}
            >
              <TileBody tile={tile} />
            </button>
          )
        })}
      </nav>

      {/* The copy of the tile that follows the finger */}
      {dragged && (
        <div
          ref={(el) => {
            floatEl.current = el
            if (el && !settling) placeFloat()
          }}
          aria-hidden
          className={cn(
            baseCls,
            "tile-float pointer-events-none fixed left-0 top-0 z-40 !border-solid",
            dragged.badge === "new" ? "tile-new border-transparent" : "border-primary bg-card"
          )}
          style={{ width: floatSize.w, height: floatSize.h, transition: settling ? "transform 200ms cubic-bezier(0.2, 0.9, 0.25, 1)" : "none" }}
        >
          <TileBody tile={dragged} />
        </div>
      )}
    </>
  )
}
