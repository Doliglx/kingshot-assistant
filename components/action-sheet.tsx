"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { LucideIcon } from "lucide-react"
import { Hand } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSettings } from "@/components/app-settings"
import { onBack } from "@/lib/back-stack"

// One look for every menu in the app. What is held opens a bottom sheet with the
// actions for that item; a delete always asks first; a rename asks for the new name.

export interface MenuAction {
  id: string
  label: string
  icon: LucideIcon
  /** Red: removes something. */
  danger?: boolean
  onSelect: () => void
}

export interface MenuSpec {
  title: string
  subtitle?: string
  actions: MenuAction[]
}

export interface ConfirmSpec {
  title: string
  message?: string
  confirmLabel: string
}

export interface PromptSpec {
  title: string
  label: string
  value: string
  confirmLabel: string
  maxLength?: number
}

interface Sheets {
  openMenu: (spec: MenuSpec) => void
  confirm: (spec: ConfirmSpec) => Promise<boolean>
  prompt: (spec: PromptSpec) => Promise<string | null>
  toast: (message: string) => void
}

const Ctx = createContext<Sheets | null>(null)

export function useSheets(): Sheets {
  const v = useContext(Ctx)
  if (!v) throw new Error("useSheets must be used inside <SheetsProvider>")
  return v
}

type Layer =
  | { kind: "menu"; spec: MenuSpec }
  | { kind: "confirm"; spec: ConfirmSpec; done: (ok: boolean) => void }
  | { kind: "prompt"; spec: PromptSpec; done: (value: string | null) => void }

export function SheetsProvider({ children }: { children: React.ReactNode }) {
  const [layer, setLayer] = useState<Layer | null>(null)
  const [toastText, setToastText] = useState("")
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The latest layer, for the promise of a sheet that is replaced or closed from outside.
  const layerRef = useRef<Layer | null>(null)
  layerRef.current = layer

  const close = useCallback(() => {
    const l = layerRef.current
    setLayer(null)
    if (l?.kind === "confirm") l.done(false)
    if (l?.kind === "prompt") l.done(null)
  }, [])

  const api = useMemo<Sheets>(
    () => ({
      openMenu: (spec) => setLayer({ kind: "menu", spec }),
      confirm: (spec) => new Promise((done) => setLayer({ kind: "confirm", spec, done })),
      prompt: (spec) => new Promise((done) => setLayer({ kind: "prompt", spec, done })),
      toast: (message) => {
        setToastText(message)
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToastText(""), 1800)
      },
    }),
    []
  )

  // Android back button and Escape close the sheet first.
  useEffect(() => (layer ? onBack(close) : undefined), [layer, close])

  return (
    <Ctx.Provider value={api}>
      {children}
      {layer?.kind === "menu" && (
        <MenuSheet
          spec={layer.spec}
          onClose={close}
          onSelect={(a) => {
            setLayer(null)
            a.onSelect()
          }}
        />
      )}
      {layer?.kind === "confirm" && (
        <ConfirmSheet
          spec={layer.spec}
          onClose={close}
          onConfirm={() => {
            setLayer(null)
            layer.done(true)
          }}
        />
      )}
      {layer?.kind === "prompt" && (
        <PromptSheet
          spec={layer.spec}
          onClose={close}
          onSubmit={(value) => {
            setLayer(null)
            layer.done(value)
          }}
        />
      )}
      {toastText &&
        createPortal(
          <div className="fade-enter pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex justify-center px-4">
            <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg">
              {toastText}
            </span>
          </div>,
          document.body
        )}
    </Ctx.Provider>
  )
}

/** The frame shared by all three sheets: a dimmed backdrop and a panel rising from the bottom. */
function Frame({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: React.ReactNode
}) {
  const { t } = useSettings()
  // The click that ends the press which opened the sheet must not reach it, however long the
  // finger stayed down: only a click that began with a press on the sheet itself counts.
  const pressed = useRef(false)
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center"
      onPointerDownCapture={() => {
        pressed.current = true
      }}
      onClickCapture={(e) => {
        // detail 0 is a click made by the keyboard (Enter in a field): that one is wanted.
        if (e.detail > 0 && !pressed.current) {
          e.preventDefault()
          e.stopPropagation()
        }
        pressed.current = false
      }}
    >
      <button
        type="button"
        aria-label={t.common.close}
        onClick={onClose}
        className="fade-enter absolute inset-0 bg-black/65"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="sheet-enter relative max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-b-0 border-border/60 bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
        {children}
      </div>
    </div>,
    document.body
  )
}

function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 min-w-0">
      <p className="truncate text-base font-black leading-tight">{title}</p>
      {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

function MenuSheet({
  spec,
  onClose,
  onSelect,
}: {
  spec: MenuSpec
  onClose: () => void
  onSelect: (a: MenuAction) => void
}) {
  return (
    <Frame label={spec.title} onClose={onClose}>
      <Heading title={spec.title} subtitle={spec.subtitle} />
      <div className="-mx-2 space-y-0.5">
        {spec.actions.map((a) => {
          const Icon = a.icon
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(a)}
              className={cn(
                "flex h-14 w-full items-center gap-3 rounded-xl px-2 text-left text-base transition active:bg-primary/10",
                a.danger ? "text-red-400" : "text-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  a.danger ? "bg-red-500/15 text-red-400" : "bg-primary/15 text-primary"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{a.label}</span>
            </button>
          )
        })}
      </div>
    </Frame>
  )
}

function ConfirmSheet({
  spec,
  onClose,
  onConfirm,
}: {
  spec: ConfirmSpec
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useSettings()
  return (
    <Frame label={spec.title} onClose={onClose}>
      <Heading title={spec.title} />
      {spec.message && <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{spec.message}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-12" onClick={onClose}>
          {t.menu.cancel}
        </Button>
        <Button
          type="button"
          autoFocus
          className="h-12 bg-red-500 font-bold text-white hover:bg-red-500/90"
          onClick={onConfirm}
        >
          {spec.confirmLabel}
        </Button>
      </div>
    </Frame>
  )
}

function PromptSheet({
  spec,
  onClose,
  onSubmit,
}: {
  spec: PromptSpec
  onClose: () => void
  onSubmit: (value: string) => void
}) {
  const { t } = useSettings()
  const [value, setValue] = useState(spec.value)
  const ok = value.trim().length > 0
  return (
    <Frame label={spec.title} onClose={onClose}>
      <Heading title={spec.title} />
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (ok) onSubmit(value.trim())
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor="sheet-prompt" className="text-xs text-muted-foreground">
            {spec.label}
          </label>
          <Input
            id="sheet-prompt"
            autoFocus
            value={value}
            maxLength={spec.maxLength}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="h-12 border-border/50 bg-input text-base"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-12" onClick={onClose}>
            {t.menu.cancel}
          </Button>
          <Button type="submit" className="h-12 font-bold" disabled={!ok}>
            {spec.confirmLabel}
          </Button>
        </div>
      </form>
    </Frame>
  )
}

/** One muted line under a list: tells that held items have more to offer. */
export function HoldHint({ className }: { className?: string }) {
  const { t } = useSettings()
  return (
    <p className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <Hand className="h-3.5 w-3.5 shrink-0" />
      {t.menu.holdHint}
    </p>
  )
}
