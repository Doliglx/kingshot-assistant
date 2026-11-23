"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardPaste,
  Copy,
  Eye,
  EyeOff,
  Folder,
  FolderInput,
  FolderPlus,
  MoreHorizontal,
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
import { GameBubble, EMOJI_FONT } from "@/components/game-bubble"
import { ArtGallery } from "@/components/art-gallery"
import { onBack } from "@/lib/back-stack"
import { HoldHint, useSheets } from "@/components/action-sheet"
import { longPress } from "@/lib/long-press"
import {
  ART_LIMITS,
  DEFAULT_LINE_CELLS,
  layoutChat,
  loadLibrary,
  newArt,
  newFolder,
  saveLibrary,
  textStats,
  type ArtLibrary,
  type TextArt,
} from "@/lib/text-art"
import { KEYS } from "@/lib/storage-keys"
import { defaultLibrary } from "@/lib/default-art"

const cardCls = "border-border/50 bg-card"
const titleCls = "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"
const WIDTH_KEY = KEYS.textArtWidth

type FolderFilter = "all" | "none" | string

// ---------------------------------------------------------------------
// Module

export function TextArtModule() {
  const { t } = useSettings()
  const a = t.art
  const m = t.menu
  const sheets = useSheets()
  const [lib, setLib] = useState<ArtLibrary>({ folders: [], items: [] })
  const [loaded, setLoaded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FolderFilter>("all")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<"recent" | "name">("recent")
  const [cells, setCells] = useState(DEFAULT_LINE_CELLS)
  const [toast, setToast] = useState("")
  const [folderInput, setFolderInput] = useState<{ mode: "new"; value: string } | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load, and add the example the very first time.
  useEffect(() => {
    let stored = loadLibrary()
    if (stored === null) {
      stored = defaultLibrary(a.exampleName)
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
    }
    setFolderInput(null)
  }

  const renameFolder = async (id: string) => {
    const name = await sheets.prompt({
      title: m.rename,
      label: a.folderName,
      value: folderName(id),
      confirmLabel: m.rename,
      maxLength: ART_LIMITS.name,
    })
    if (name) commit({ ...lib, folders: lib.folders.map((f) => (f.id === id ? { ...f, name } : f)) })
  }

  /** Moves a folder one place in the row of chips. */
  const moveFolder = (id: string, delta: number) => {
    const from = lib.folders.findIndex((f) => f.id === id)
    const to = Math.min(lib.folders.length - 1, Math.max(0, from + delta))
    if (from < 0 || to === from) return
    const folders = [...lib.folders]
    const [f] = folders.splice(from, 1)
    folders.splice(to, 0, f)
    commit({ ...lib, folders })
  }

  const deleteFolder = async (id: string) => {
    const ok = await sheets.confirm({
      title: m.deleteTitle(folderName(id)),
      message: m.deleteFolder,
      confirmLabel: m.delete,
    })
    if (!ok) return
    commit({
      folders: lib.folders.filter((f) => f.id !== id),
      items: lib.items.map((i) => (i.folderId === id ? { ...i, folderId: null } : i)),
    })
    if (filter === id) setFilter("all")
  }

  const deleteArt = async (art: TextArt): Promise<boolean> => {
    const ok = await sheets.confirm({
      title: m.deleteTitle(art.name || a.untitled),
      message: m.deleteTemplate,
      confirmLabel: m.delete,
    })
    if (!ok) return false
    commit({ ...lib, items: lib.items.filter((i) => i.id !== art.id) })
    return true
  }

  const duplicateArt = (art: TextArt): TextArt | null => {
    if (lib.items.length >= ART_LIMITS.items) return null
    const copyArt = newArt(`${art.name} 2`, art.text, art.folderId)
    commit({ ...lib, items: [copyArt, ...lib.items] })
    return copyArt
  }

  /** Where a template goes: any folder, none, or a new one. */
  const openMoveMenu = (art: TextArt) => {
    const to = (folderId: string | null) =>
      commit({ ...lib, items: lib.items.map((i) => (i.id === art.id ? { ...i, folderId, updatedAt: Date.now() } : i)) })
    sheets.openMenu({
      title: m.moveTo,
      subtitle: art.name || a.untitled,
      actions: [
        ...lib.folders
          .filter((f) => f.id !== art.folderId)
          .map((f) => ({ id: f.id, label: f.name || a.untitled, icon: Folder, onSelect: () => to(f.id) })),
        ...(art.folderId !== null ? [{ id: "none", label: a.noFolder, icon: Folder, onSelect: () => to(null) }] : []),
        {
          id: "new",
          label: a.newFolder,
          icon: FolderPlus,
          onSelect: () =>
            void (async () => {
              if (lib.folders.length >= ART_LIMITS.folders) return
              const name = await sheets.prompt({
                title: a.newFolder,
                label: a.folderName,
                value: "",
                confirmLabel: m.ok,
                maxLength: ART_LIMITS.name,
              })
              if (!name) return
              const folder = newFolder(name)
              commit({
                folders: [...lib.folders, folder],
                items: lib.items.map((i) => (i.id === art.id ? { ...i, folderId: folder.id, updatedAt: Date.now() } : i)),
              })
            })(),
        },
      ],
    })
  }

  /** Held template: everything the card and the editor offer, in one place. */
  const openArtMenu = (art: TextArt) => {
    sheets.openMenu({
      title: art.name || a.untitled,
      subtitle: art.folderId ? folderName(art.folderId) : a.noFolder,
      actions: [
        { id: "preview", label: m.preview, icon: Eye, onSelect: () => setPreviewId(art.id) },
        { id: "edit", label: m.edit, icon: Pencil, onSelect: () => setEditingId(art.id) },
        { id: "copy", label: m.copy, icon: Copy, onSelect: () => void copy(art.text) },
        { id: "duplicate", label: m.duplicate, icon: Copy, onSelect: () => void duplicateArt(art) },
        { id: "move", label: m.moveTo, icon: FolderInput, onSelect: () => openMoveMenu(art) },
        { id: "delete", label: m.delete, icon: Trash2, danger: true, onSelect: () => void deleteArt(art) },
      ],
    })
  }

  /** Held folder chip. */
  const openFolderMenu = (id: string) => {
    const index = lib.folders.findIndex((f) => f.id === id)
    sheets.openMenu({
      title: folderName(id),
      subtitle: a.folder,
      actions: [
        { id: "rename", label: m.rename, icon: Pencil, onSelect: () => void renameFolder(id) },
        ...(index > 0 ? [{ id: "left", label: m.moveLeft, icon: ArrowLeft, onSelect: () => moveFolder(id, -1) }] : []),
        ...(index < lib.folders.length - 1
          ? [{ id: "right", label: m.moveRight, icon: ArrowRight, onSelect: () => moveFolder(id, 1) }]
          : []),
        { id: "delete", label: m.delete, icon: Trash2, danger: true, onSelect: () => void deleteFolder(id) },
      ],
    })
  }

  // Android back button / Escape: leave the editor before the module.
  useEffect(() => (editingId ? onBack(() => setEditingId(null)) : undefined), [editingId])

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
            const copyArt = duplicateArt(editing)
            if (copyArt) setEditingId(copyArt.id)
          }}
          onDelete={async () => {
            if (await deleteArt(editing)) setEditingId(null)
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
                {...(id !== "all" && id !== "none" ? longPress(() => openFolderMenu(id)) : {})}
                className={cn(
                  "hold-item flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition",
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
            <Button type="button" size="sm" variant="outline" onClick={() => openFolderMenu(filter)}>
              <MoreHorizontal className="h-4 w-4" />
              {m.folderOptions}
            </Button>
          )}

          <Button type="button" className="w-full" onClick={createArt}>
            <Plus className="h-4 w-4" />
            {a.newArt}
          </Button>

          {(lib.items.length > 0 || lib.folders.length > 0) && <HoldHint />}

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
                  previewLabel={a.preview}
                  untitled={a.untitled}
                  onOpen={() => setEditingId(art.id)}
                  onCopy={() => copy(art.text)}
                  onPreview={() => setPreviewId(art.id)}
                  onMenu={() => openArtMenu(art)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Full-screen viewer, one template at a time, swipe to go through the list */}
      {previewId && !editing && (
        <ArtGallery
          items={visible}
          startId={previewId}
          cells={cells}
          folderOf={(art) => (art.folderId ? folderName(art.folderId) : "")}
          labels={{
            copy: a.copy,
            edit: a.edit,
            back: t.common.back,
            close: t.common.close,
            untitled: a.untitled,
          }}
          onCopy={(art) => copy(art.text)}
          onEdit={(art) => {
            setPreviewId(null)
            setEditingId(art.id)
          }}
          onClose={() => setPreviewId(null)}
        />
      )}

      {/* Copy confirmation: on <body>, so it stays on screen whatever the scroll */}
      {toast &&
        createPortal(
          <div className="fade-enter pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
            <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg">
              {toast}
            </span>
          </div>,
          document.body
        )}
    </div>
  )
}

const ArtCard = memo(function ArtCard({
  art,
  folder,
  cells,
  copyLabel,
  previewLabel,
  untitled,
  onOpen,
  onCopy,
  onPreview,
  onMenu,
}: {
  art: TextArt
  folder: string
  cells: number
  copyLabel: string
  previewLabel: string
  untitled: string
  onOpen: () => void
  onCopy: () => void
  onPreview: () => void
  onMenu: () => void
}) {
  return (
    <div
      {...longPress(() => onMenu())}
      className="hold-item flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card"
    >
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
      <div className="flex gap-2 p-3 pt-2">
        <Button type="button" size="sm" className="flex-1" onClick={onCopy}>
          <Copy className="h-4 w-4" />
          {copyLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="px-3"
          onClick={onPreview}
          aria-label={previewLabel}
          title={previewLabel}
        >
          <Eye className="h-4 w-4" />
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
