"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  Copy,
  Eye,
  EyeOff,
  Folder,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useSettings } from "@/components/app-settings"
import { copyText, readText } from "@/lib/clipboard"
import {
  ART_LIMITS,
  DEFAULT_LINE_CELLS,
  EXAMPLE_ART,
  IDEOGRAPHIC_SPACE,
  cellWidth,
  isWide,
  layoutChat,
  loadLibrary,
  newArt,
  newFolder,
  saveLibrary,
  textStats,
  type ArtLibrary,
  type TextArt,
} from "@/lib/text-art"

const cardCls = "border-border/50 bg-card"
const titleCls = "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"
const WIDTH_KEY = "ks-assist-textart-width"

type FolderFilter = "all" | "none" | string

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

const EMOJI_FONT = '"Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji","Segoe UI Symbol",sans-serif'

const GameBubble = memo(function GameBubble({
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
    const all = layoutChat(text, cells)
    return maxLines ? all.slice(0, maxLines) : all
  }, [text, cells, maxLines])

  // The game's bubble is about (cells + 3) emoji wide, padding included.
  const cell = width > 0 ? Math.min(34, width / (cells + 3)) : 0

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
            <div key={i} className="flex" style={{ height: cell * 1.28, alignItems: "center" }}>
              {line.chars.map((g, j) => {
                const w = cellWidth(g) * cell
                if (g === IDEOGRAPHIC_SPACE || g === " ") {
                  return (
                    <span
                      key={j}
                      className="inline-block shrink-0"
                      style={{
                        width: w,
                        height: cell * 0.9,
                        outline: showSpaces ? "1px dashed rgb(59 42 26 / 0.35)" : undefined,
                        outlineOffset: -2,
                        background: showSpaces && g === " " ? "rgb(224 87 60 / 0.35)" : undefined,
                      }}
                    />
                  )
                }
                const tile = TILES[g.replace("\uFE0F", "")]
                if (tile) {
                  return (
                    <span key={j} className="inline-flex shrink-0 items-center justify-center" style={{ width: w }}>
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
                const wide = isWide(g)
                return (
                  <span
                    key={j}
                    className="inline-flex shrink-0 items-center justify-center overflow-visible leading-none"
                    style={{
                      width: w,
                      fontSize: wide ? cell * 0.94 : cell * 0.72,
                      fontFamily: wide ? EMOJI_FONT : undefined,
                      fontWeight: wide ? undefined : 700,
                    }}
                  >
                    {wide ? emojiForm(g) : g}
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

// ---------------------------------------------------------------------
// Module

export function TextArtModule() {
  const { t } = useSettings()
  const a = t.art
  const [lib, setLib] = useState<ArtLibrary>({ folders: [], items: [] })
  const [loaded, setLoaded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FolderFilter>("all")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<"recent" | "name">("recent")
  const [cells, setCells] = useState(DEFAULT_LINE_CELLS)
  const [toast, setToast] = useState("")
  const [folderInput, setFolderInput] = useState<{ mode: "new" | "rename"; value: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load, and add the example the very first time.
  useEffect(() => {
    let stored = loadLibrary()
    if (stored === null) {
      const folder = newFolder(a.exampleFolder)
      stored = { folders: [folder], items: [newArt(a.exampleName, EXAMPLE_ART, folder.id)] }
      saveLibrary(stored)
    }
    setLib(stored)
    try {
      const w = Number(localStorage.getItem(WIDTH_KEY))
      if (Number.isInteger(w) && w >= 8 && w <= 30) setCells(w)
    } catch {
      // storage unavailable
    }
    setLoaded(true)
    // Only once: the example is named in the language of the first visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flash = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(""), 1600)
  }, [])

  const commit = useCallback(
    (next: ArtLibrary) => {
      setLib(next)
      if (!saveLibrary(next)) flash(a.storageFull)
    },
    [a.storageFull, flash]
  )

  const copy = useCallback(
    async (text: string) => {
      // Exactly the stored string: no trim, no normalisation.
      flash((await copyText(text)) ? a.copied : a.copyFailed)
    },
    [a.copied, a.copyFailed, flash]
  )

  const changeCells = (n: number) => {
    setCells(n)
    try {
      localStorage.setItem(WIDTH_KEY, String(n))
    } catch {
      // ignore
    }
  }

  const folderName = (id: string | null) => lib.folders.find((f) => f.id === id)?.name ?? a.noFolder

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return lib.items
      .filter((i) => (filter === "all" ? true : filter === "none" ? i.folderId === null : i.folderId === filter))
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.text.toLowerCase().includes(q))
      .sort((x, y) => (sort === "name" ? x.name.localeCompare(y.name) : y.updatedAt - x.updatedAt))
  }, [lib.items, filter, query, sort])

  const createArt = () => {
    if (lib.items.length >= ART_LIMITS.items) return
    const folderId = filter !== "all" && filter !== "none" ? filter : null
    const art = newArt(a.untitled, "", folderId)
    commit({ ...lib, items: [art, ...lib.items] })
    setEditingId(art.id)
  }

  const submitFolder = () => {
    if (!folderInput) return
    const name = folderInput.value.trim().slice(0, ART_LIMITS.name)
    if (!name) return setFolderInput(null)
    if (folderInput.mode === "new") {
      if (lib.folders.length >= ART_LIMITS.folders) return
      const folder = newFolder(name)
      commit({ ...lib, folders: [...lib.folders, folder] })
      setFilter(folder.id)
    } else {
      commit({ ...lib, folders: lib.folders.map((f) => (f.id === filter ? { ...f, name } : f)) })
    }
    setFolderInput(null)
  }

  const deleteFolder = () => {
    if (filter === "all" || filter === "none") return
    if (!window.confirm(a.deleteFolderConfirm)) return
    commit({
      folders: lib.folders.filter((f) => f.id !== filter),
      items: lib.items.map((i) => (i.folderId === filter ? { ...i, folderId: null } : i)),
    })
    setFilter("all")
  }

  if (!loaded) return null

  const editing = editingId ? (lib.items.find((i) => i.id === editingId) ?? null) : null

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {editing ? (
        <ArtEditor
          art={editing}
          lib={lib}
          cells={cells}
          onCells={changeCells}
          onChange={(patch) =>
            commit({
              ...lib,
              items: lib.items.map((i) => (i.id === editing.id ? { ...i, ...patch, updatedAt: Date.now() } : i)),
            })
          }
          onCopy={() => copy(editing.text)}
          onDuplicate={() => {
            if (lib.items.length >= ART_LIMITS.items) return
            const copyArt = newArt(`${editing.name} 2`, editing.text, editing.folderId)
            commit({ ...lib, items: [copyArt, ...lib.items] })
            setEditingId(copyArt.id)
          }}
          onDelete={() => {
            if (!window.confirm(a.deleteConfirm)) return
            commit({ ...lib, items: lib.items.filter((i) => i.id !== editing.id) })
            setEditingId(null)
          }}
          onBack={() => setEditingId(null)}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{a.intro}</p>

          {/* Search and sort */}
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={a.search}
                className="border-border/50 bg-input pl-9"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "recent" | "name")}
              aria-label={a.sortRecent}
              className="h-9 shrink-0 rounded-md border border-border/50 bg-input px-2 text-sm"
            >
              <option value="recent">{a.sortRecent}</option>
              <option value="name">{a.sortName}</option>
            </select>
          </div>

          {/* Folders */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {(
              [
                ["all", a.all],
                ...lib.folders.map((f) => [f.id, f.name] as const),
                ...(lib.items.some((i) => i.folderId === null) ? [["none", a.noFolder] as const] : []),
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                aria-pressed={filter === id}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition",
                  filter === id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/50 bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {id !== "all" && <Folder className="h-3.5 w-3.5" />}
                {label || a.untitled}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFolderInput({ mode: "new", value: "" })}
              aria-label={a.newFolder}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              {a.newFolder}
            </button>
          </div>

          {folderInput && (
            <form
              className="fade-enter flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                submitFolder()
              }}
            >
              <Input
                autoFocus
                value={folderInput.value}
                maxLength={ART_LIMITS.name}
                placeholder={a.folderName}
                onChange={(e) => setFolderInput({ ...folderInput, value: e.target.value })}
                className="border-border/50 bg-input"
              />
              <Button type="submit" size="icon" aria-label="OK">
                <Check className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="outline" aria-label={t.common.close} onClick={() => setFolderInput(null)}>
                <X className="h-4 w-4" />
              </Button>
            </form>
          )}

          {filter !== "all" && filter !== "none" && !folderInput && (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setFolderInput({ mode: "rename", value: folderName(filter) })}
              >
                <Pencil className="h-3.5 w-3.5" />
                {a.rename}
              </Button>
              <Button type="button" size="sm" variant="outline" className="text-red-400" onClick={deleteFolder}>
                <Trash2 className="h-3.5 w-3.5" />
                {a.deleteFolder}
              </Button>
            </div>
          )}

          <Button type="button" className="w-full" onClick={createArt}>
            <Plus className="h-4 w-4" />
            {a.newArt}
          </Button>

          {/* Templates */}
          {visible.length === 0 ? (
            <p className="rounded-xl border border-border/50 bg-card p-4 text-center text-sm text-muted-foreground">
              {a.empty}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {visible.map((art) => (
                <ArtCard
                  key={art.id}
                  art={art}
                  folder={art.folderId ? folderName(art.folderId) : ""}
                  cells={cells}
                  copyLabel={a.copy}
                  untitled={a.untitled}
                  onOpen={() => setEditingId(art.id)}
                  onCopy={() => copy(art.text)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Copy confirmation */}
      {toast && (
        <div className="fade-enter pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg">
            {toast}
          </span>
        </div>
      )}
    </div>
  )
}

const ArtCard = memo(function ArtCard({
  art,
  folder,
  cells,
  copyLabel,
  untitled,
  onOpen,
  onCopy,
}: {
  art: TextArt
  folder: string
  cells: number
  copyLabel: string
  untitled: string
  onOpen: () => void
  onCopy: () => void
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card">
      <button type="button" onClick={onOpen} className="block text-left">
        <div className="pointer-events-none relative max-h-36 overflow-hidden bg-[#2a1d12] p-2">
          <GameBubble text={art.text} cells={cells} maxLines={8} />
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#2a1d12] to-transparent" />
        </div>
        <div className="px-3 pt-2">
          <span className="block truncate font-semibold">{art.name || untitled}</span>
          {folder && <span className="block truncate text-xs text-muted-foreground">{folder}</span>}
        </div>
      </button>
      <div className="p-3 pt-2">
        <Button type="button" size="sm" className="w-full" onClick={onCopy}>
          <Copy className="h-4 w-4" />
          {copyLabel}
        </Button>
      </div>
    </div>
  )
})

function ArtEditor({
  art,
  lib,
  cells,
  onCells,
  onChange,
  onCopy,
  onDuplicate,
  onDelete,
  onBack,
}: {
  art: TextArt
  lib: ArtLibrary
  cells: number
  onCells: (n: number) => void
  onChange: (patch: Partial<TextArt>) => void
  onCopy: () => void
  onDuplicate: () => void
  onDelete: () => void
  onBack: () => void
}) {
  const { t } = useSettings()
  const a = t.art
  const [showSpaces, setShowSpaces] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const stats = useMemo(() => textStats(art.text), [art.text])
  const lineCount = useMemo(() => layoutChat(art.text, cells).length, [art.text, cells])

  const paste = async () => {
    const clip = await readText()
    if (clip === null) return
    const el = areaRef.current
    const start = el?.selectionStart ?? art.text.length
    const end = el?.selectionEnd ?? art.text.length
    onChange({ text: (art.text.slice(0, start) + clip + art.text.slice(end)).slice(0, ART_LIMITS.text) })
  }

  return (
    <div className="fade-enter space-y-5">
      <Button type="button" variant="outline" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        {t.common.back}
      </Button>

      <Card className={cardCls}>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{a.name}</Label>
              <Input
                value={art.name}
                maxLength={ART_LIMITS.name}
                placeholder={a.untitled}
                onChange={(e) => onChange({ name: e.target.value })}
                className="border-border/50 bg-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{a.folder}</Label>
              <select
                value={art.folderId ?? ""}
                onChange={(e) => onChange({ folderId: e.target.value || null })}
                className="h-9 max-w-[10rem] rounded-md border border-border/50 bg-input px-2 text-sm"
              >
                <option value="">{a.noFolder}</option>
                {lib.folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name || a.untitled}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            ref={areaRef}
            value={art.text}
            maxLength={ART_LIMITS.text}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder={a.textPlaceholder}
            rows={6}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            className="w-full rounded-md border border-border/50 bg-input p-3 text-base leading-relaxed"
            style={{ fontFamily: EMOJI_FONT }}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {a.stats(stats.characters, lineCount)}
              <br />
              {a.spacesInfo(stats.ideographicSpaces, stats.spaces)}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={paste}>
              <ClipboardPaste className="h-4 w-4" />
              {a.paste}
            </Button>
          </div>
          {stats.broken > 0 && (
            <p className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-300">{a.broken}</p>
          )}
          {stats.newlines > 0 && (
            <p className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-xs text-yellow-200">
              {a.newlineNote}
            </p>
          )}

          <Button type="button" className="h-12 w-full text-base font-bold" onClick={onCopy} disabled={!art.text}>
            <Copy className="h-5 w-5" />
            {a.copy}
          </Button>
        </CardContent>
      </Card>

      <Card className={cardCls}>
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className={cn(titleCls, "justify-between")}>
            <span>{a.preview}</span>
            <Button
              type="button"
              size="sm"
              variant={showSpaces ? "default" : "outline"}
              onClick={() => setShowSpaces((s) => !s)}
              aria-pressed={showSpaces}
            >
              {showSpaces ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {a.showSpaces}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="rounded-xl bg-[#2a1d12] p-3">
            <GameBubble text={art.text} cells={cells} showSpaces={showSpaces} />
          </div>
          <p className="text-xs text-muted-foreground">{a.previewNote}</p>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{a.bubbleWidth(cells)}</Label>
            <input
              type="range"
              min={8}
              max={30}
              value={cells}
              onChange={(e) => onCells(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
              aria-label={a.bubbleWidth(cells)}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{a.measured}</span>
              {cells !== DEFAULT_LINE_CELLS && (
                <button type="button" className="underline" onClick={() => onCells(DEFAULT_LINE_CELLS)}>
                  16
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
          {a.duplicate}
        </Button>
        <Button type="button" variant="outline" className="text-red-400 hover:text-red-300" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          {a.delete}
        </Button>
      </div>
    </div>
  )
}
