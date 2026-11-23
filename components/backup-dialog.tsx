"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ClipboardPaste, Copy, Eye, EyeOff, FileUp, Lock, Share2, ShieldAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSettings } from "@/components/app-settings"
import { onBack } from "@/lib/back-stack"
import { copyText, readText } from "@/lib/clipboard"
import {
  BackupError,
  MAX_BACKUP_CHARS,
  MIN_PASSWORD,
  createBackup,
  openBackup,
  parseBackup,
  summarize,
  type BackupData,
} from "@/lib/backup"
import { applyBackupData, collectBackupData } from "@/lib/backup-storage"
import { readBackupFile, saveBackupFile } from "@/lib/backup-io"

/** The system clipboard cannot carry much (Android refuses around 1 MB). */
const MAX_COPY_CHARS = 400_000

type Mode = "export" | "import"

/** Export or import of everything the app keeps, as a bottom sheet. */
export function BackupDialog({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const { t } = useSettings()
  const b = t.backup
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)

  // Android back button and Escape close this sheet before the settings behind it.
  useEffect(() => onBack(onClose), [onClose])

  const fail = (e: unknown) => {
    const code = e instanceof BackupError ? e.code : "generic"
    const text =
      code === "not-backup" || code === "unsupported"
        ? b.errNotBackup
        : code === "newer"
          ? b.errNewer
          : code === "too-big"
            ? b.errTooBig
            : code === "corrupt"
              ? b.errCorrupt
              : code === "bad-password"
                ? b.errPassword
                : b.errGeneric
    setMessage({ kind: "error", text })
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button type="button" aria-label={t.common.close} onClick={onClose} className="fade-enter absolute inset-0 bg-black/70" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "export" ? b.exportTitle : b.importTitle}
        className="sheet-enter relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-b-0 border-border/60 bg-card p-6 pb-8 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black uppercase tracking-tight">
            {mode === "export" ? b.exportTitle : b.importTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/50 transition active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === "export" ? (
          <ExportPanel busy={busy} setBusy={setBusy} setMessage={setMessage} fail={fail} />
        ) : (
          <ImportPanel busy={busy} setBusy={setBusy} setMessage={setMessage} fail={fail} onClose={onClose} />
        )}

        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={
              "mt-4 rounded-lg border p-3 text-sm " +
              (message.kind === "error"
                ? "border-red-500/50 bg-red-500/10 text-red-300"
                : "border-primary/40 bg-primary/10 text-foreground")
            }
          >
            {message.text}
          </p>
        )}
      </div>
    </div>,
    document.body
  )
}

interface PanelProps {
  busy: boolean
  setBusy: (v: boolean) => void
  setMessage: (m: { kind: "ok" | "error"; text: string } | null) => void
  fail: (e: unknown) => void
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  shown,
  autoFocus,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  shown: boolean
  autoFocus?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="h-11 border-border/50 bg-input"
      />
    </div>
  )
}

function ExportPanel({ busy, setBusy, setMessage, fail }: PanelProps) {
  const { t } = useSettings()
  const b = t.backup
  const [password, setPassword] = useState("")
  const [again, setAgain] = useState("")
  const [shown, setShown] = useState(false)

  const problem = password
    ? password.length < MIN_PASSWORD
      ? b.passwordShort
      : password !== again
        ? b.passwordMismatch
        : ""
    : ""

  /** Builds the backup text, or null when the form is not valid. */
  const build = async (): Promise<string | null> => {
    if (problem) {
      setMessage({ kind: "error", text: problem })
      return null
    }
    return createBackup(await collectBackupData(), password || undefined)
  }

  const run = async (action: (text: string) => Promise<void>) => {
    setMessage(null)
    setBusy(true)
    try {
      const text = await build()
      if (text) await action(text)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{b.exportIntro}</p>

      <div className="space-y-3 rounded-xl border border-border/50 bg-input/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Lock className="h-4 w-4" />
            {b.protect}
          </span>
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-pressed={shown}
            className="flex items-center gap-1.5 rounded-lg border border-border/50 px-2.5 py-1 text-xs text-muted-foreground active:scale-95"
          >
            {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {shown ? b.hide : b.show}
          </button>
        </div>
        <PasswordField id="bk-pass" label={b.password} value={password} onChange={setPassword} shown={shown} />
        {password && (
          <PasswordField id="bk-pass2" label={b.confirm} value={again} onChange={setAgain} shown={shown} />
        )}
        {password && problem && <p className="text-xs text-red-300">{problem}</p>}
        <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {b.passwordHelp}
        </p>
      </div>

      <div className="grid gap-2">
        <Button
          type="button"
          className="h-12 gap-2 text-base font-bold"
          disabled={busy}
          onClick={() =>
            run(async (text) => {
              const result = await saveBackupFile(text)
              if (result === "saved") setMessage({ kind: "ok", text: b.saved })
            })
          }
        >
          <Share2 className="h-5 w-5" />
          {busy ? b.working : b.saveFile}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-2"
          disabled={busy}
          onClick={() =>
            run(async (text) => {
              if (text.length > MAX_COPY_CHARS) {
                setMessage({ kind: "error", text: b.textTooBig })
                return
              }
              setMessage(
                (await copyText(text)) ? { kind: "ok", text: b.copied } : { kind: "error", text: b.copyFailed }
              )
            })
          }
        >
          <Copy className="h-4 w-4" />
          {b.copyText}
        </Button>
      </div>
    </div>
  )
}

function ImportPanel({ busy, setBusy, setMessage, fail, onClose }: PanelProps & { onClose: () => void }) {
  const { t } = useSettings()
  const b = t.backup
  const fileInput = useRef<HTMLInputElement>(null)
  const [text, setText] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [password, setPassword] = useState("")
  const [shown, setShown] = useState(false)
  const [data, setData] = useState<BackupData | null>(null)

  /** Looks at the text: asks for the password if it is encrypted, otherwise shows what it holds. */
  const inspect = async (raw: string, pass?: string) => {
    setMessage(null)
    setBusy(true)
    try {
      if (raw.length > MAX_BACKUP_CHARS) throw new BackupError("too-big")
      const { encrypted } = parseBackup(raw)
      setText(raw)
      if (encrypted && !pass) {
        setLocked(true)
        setData(null)
        return
      }
      setData(await openBackup(raw, pass))
      setLocked(false)
    } catch (e) {
      if (e instanceof BackupError && e.code === "bad-password") setLocked(true)
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const restore = async () => {
    if (!data) return
    setMessage(null)
    setBusy(true)
    try {
      await applyBackupData(data)
      setMessage({ kind: "ok", text: b.restored })
      // Every module reads its data when it starts: start again from the restored data.
      setTimeout(() => window.location.reload(), 900)
    } catch (e) {
      fail(e)
      setBusy(false)
    }
  }

  const summary = data ? summarize(data) : null
  const line = summary ? b.summary(summary.templates, summary.folders, summary.macros, summary.leaders) : ""

  return (
    <div className="space-y-4">
      {!data && !locked && <p className="text-sm text-muted-foreground">{b.importIntro}</p>}

      {!data && !locked && (
        <div className="grid gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json,text/plain"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ""
              if (!file) return
              try {
                await inspect(await readBackupFile(file))
              } catch (err) {
                fail(err instanceof Error && err.message === "too-big" ? new BackupError("too-big") : err)
              }
            }}
          />
          <Button type="button" className="h-12 gap-2 text-base font-bold" disabled={busy} onClick={() => fileInput.current?.click()}>
            <FileUp className="h-5 w-5" />
            {b.chooseFile}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2"
            disabled={busy}
            onClick={async () => {
              const clip = await readText()
              if (clip) await inspect(clip)
              else fail(new BackupError("not-backup"))
            }}
          >
            <ClipboardPaste className="h-4 w-4" />
            {b.pasteText}
          </Button>
        </div>
      )}

      {locked && text && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void inspect(text, password)
          }}
        >
          <p className="flex items-center gap-2 text-sm">
            <Lock className="h-4 w-4 text-primary" />
            {b.locked}
          </p>
          <PasswordField id="bk-open" label={b.unlockPassword} value={password} onChange={setPassword} shown={shown} autoFocus />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShown((s) => !s)}
              aria-pressed={shown}
              className="flex h-11 items-center gap-1.5 rounded-lg border border-border/50 px-3 text-sm text-muted-foreground active:scale-95"
            >
              {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {shown ? b.hide : b.show}
            </button>
            <Button type="submit" className="h-11 flex-1 font-bold" disabled={busy || !password}>
              {busy ? b.working : b.unlock}
            </Button>
          </div>
        </form>
      )}

      {data && summary && (
        <div className="space-y-4">
          <div className="space-y-1.5 rounded-xl border border-border/50 bg-input/40 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{b.found}</p>
            {line && <p>{line}</p>}
            {(summary.hasSettings || summary.hasOrder) && <p className="text-muted-foreground">{b.settingsAndOrder}</p>}
          </div>
          <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {b.replaceWarning}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={onClose}>
              {b.cancel}
            </Button>
            <Button type="button" className="h-11 gap-2 font-bold" disabled={busy} onClick={restore}>
              <Check className="h-4 w-4" />
              {b.replace}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
