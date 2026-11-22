// Press and hold (or right-click) on an item opens its menu: the same gesture everywhere in the app.
//
// Spread the result on the element:   <button {...longPress(() => openMenu(item))} ...>
// No React state is used, so a list of many items does not re-render while a finger is down.

import type { MouseEvent, PointerEvent } from "react"
import { Capacitor } from "@capacitor/core"
import { Haptics, ImpactStyle } from "@capacitor/haptics"

const HOLD_MS = 450
const SLOP_PX = 10 // a finger that moves more than this is scrolling, not holding
const SHOW_MS = 140 // the "pressed" look starts a little after the touch, so a plain tap does not flash

interface Hold {
  timer: ReturnType<typeof setTimeout>
  show: ReturnType<typeof setTimeout>
  x: number
  y: number
  fired: boolean
}

const holds = new WeakMap<Element, Hold>()
/** Until then, a click is the end of a long press and must not do its usual action. */
let swallowClickUntil = 0

const buzz = () => {
  if (Capacitor.isNativePlatform()) void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined)
}

function stop(el: HTMLElement) {
  const h = holds.get(el)
  if (!h) return
  clearTimeout(h.timer)
  clearTimeout(h.show)
  delete el.dataset.pressing
  if (h.fired) swallowClickUntil = Date.now() + 400
  holds.delete(el)
}

function fireOnce(el: HTMLElement, h: Hold, fire: (el: HTMLElement) => void) {
  if (h.fired) return
  h.fired = true
  clearTimeout(h.timer)
  clearTimeout(h.show)
  delete el.dataset.pressing
  swallowClickUntil = Date.now() + 1500 // refreshed when the finger lifts
  buzz()
  fire(el)
}

export function longPress(fire: (el: HTMLElement) => void) {
  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.pointerType === "mouse" && e.button !== 0) return
      const el = e.currentTarget
      stop(el)
      const h: Hold = {
        x: e.clientX,
        y: e.clientY,
        fired: false,
        show: setTimeout(() => {
          if (!h.fired) el.dataset.pressing = "true"
        }, SHOW_MS),
        timer: setTimeout(() => fireOnce(el, h, fire), HOLD_MS),
      }
      holds.set(el, h)
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const el = e.currentTarget
      const h = holds.get(el)
      if (h && !h.fired && Math.hypot(e.clientX - h.x, e.clientY - h.y) > SLOP_PX) stop(el)
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      stop(e.currentTarget)
    },
    onPointerCancel(e: PointerEvent<HTMLElement>) {
      stop(e.currentTarget)
    },
    // Right-click on a computer; on a phone Android also sends it after a long press (already handled).
    onContextMenu(e: MouseEvent<HTMLElement>) {
      e.preventDefault()
      const el = e.currentTarget
      const h = holds.get(el) ?? { timer: 0 as never, show: 0 as never, x: 0, y: 0, fired: false }
      fireOnce(el, h, fire)
      if (!holds.has(el)) swallowClickUntil = 0
    },
    onClickCapture(e: MouseEvent<HTMLElement>) {
      if (Date.now() < swallowClickUntil) {
        e.preventDefault()
        e.stopPropagation()
      }
    },
  }
}
