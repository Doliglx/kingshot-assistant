// Backup of everything the app keeps on the phone, as a file or as text.
//
// No server is involved: the backup is a small JSON document the user keeps
// wherever they like. It can be protected with a password. Pure logic, no
// React and no storage access (see backup-storage.ts), so it can be tested.
//
// Security notes
//  - Encryption: AES-256-GCM, key derived from the password with PBKDF2-SHA256
//    (600 000 iterations, random 16-byte salt), random 12-byte IV per backup.
//    The header (format, algorithm, iterations) is authenticated too.
//  - A file is never trusted: size and shape are checked, the number of PBKDF2
//    iterations is bounded, and every value goes through the same sanitisers the
//    modules use when they load their own data. Unknown keys are dropped.

import { isLang, type Lang } from "./messages"
import { sanitizeLibrary, type ArtLibrary } from "./text-art"
import { LIMITS, sanitizeAppearance, sanitizeConfig, type Appearance, type ClickConfig } from "./auto-clicker"
import { sanitizeOrder } from "./module-order"

export const BACKUP_APP = "kingshot-assistant"
export const BACKUP_FORMAT = 1
/** Largest backup accepted, in characters. */
export const MAX_BACKUP_CHARS = 8_000_000
export const PBKDF2_ITERATIONS = 600_000
const MIN_ITERATIONS = 100_000
const MAX_ITERATIONS = 2_000_000
export const MIN_PASSWORD = 8

// ---------------------------------------------------------------------
// What a backup holds

export interface RallyState {
  target: string
  lang: Lang
  tab: "utc" | "quick"
  leaders: { id: string; name: string; march: string }[]
  meId: string
}

export interface BackupData {
  settings?: { lang: Lang; hue: number }
  order?: string[]
  textArt?: ArtLibrary
  textArtWidth?: number
  rally?: RallyState
  rallyGuideHidden?: boolean
  gatherSpeed?: number
  clicker?: { configs: ClickConfig[]; appearance: Appearance }
}

export type BackupErrorCode = "not-backup" | "too-big" | "newer" | "bad-password" | "corrupt" | "unsupported"

export class BackupError extends Error {
  constructor(public code: BackupErrorCode) {
    super(code)
    this.name = "BackupError"
  }
}

// ---------------------------------------------------------------------
// Validation: turn anything into data the app can safely use

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "")
const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null

export function sanitizeRally(raw: unknown): RallyState | undefined {
  const o = obj(raw)
  if (!o) return undefined
  const leaders = (Array.isArray(o.leaders) ? o.leaders : [])
    .slice(0, 60)
    .map(obj)
    .filter((l): l is Record<string, unknown> => l !== null)
    .map((l, i) => ({ id: str(l.id, 64) || `leader-${i}`, name: str(l.name, 60), march: str(l.march, 24) }))
  return {
    target: str(o.target, 80) || "Castle",
    lang: isLang(o.lang) ? o.lang : "en",
    tab: o.tab === "quick" ? "quick" : "utc",
    leaders,
    meId: str(o.meId, 64),
  }
}

/** Keeps only the sections the app knows, each one cleaned. */
export function sanitizeBackupData(raw: unknown): BackupData {
  const o = obj(raw)
  const out: BackupData = {}
  if (!o) return out

  const s = obj(o.settings)
  if (s) out.settings = { lang: isLang(s.lang) ? s.lang : "en", hue: num(s.hue, 0, 360, 35) }
  if (Array.isArray(o.order)) out.order = sanitizeOrder(o.order)
  if (obj(o.textArt)) out.textArt = sanitizeLibrary(o.textArt)
  if (typeof o.textArtWidth === "number") out.textArtWidth = Math.round(num(o.textArtWidth, 8, 30, 16))
  const rally = sanitizeRally(o.rally)
  if (rally) out.rally = rally
  if (typeof o.rallyGuideHidden === "boolean") out.rallyGuideHidden = o.rallyGuideHidden
  if (typeof o.gatherSpeed === "number") out.gatherSpeed = num(o.gatherSpeed, 0, 100_000, 0)
  const c = obj(o.clicker)
  if (c) {
    out.clicker = {
      configs: (Array.isArray(c.configs) ? c.configs : [])
        .slice(0, LIMITS.configs)
        .map(sanitizeConfig)
        .filter((x): x is ClickConfig => x !== null),
      appearance: sanitizeAppearance(c.appearance),
    }
  }
  return out
}

export interface BackupSummary {
  templates: number
  folders: number
  macros: number
  leaders: number
  hasSettings: boolean
  hasOrder: boolean
}

export function summarize(d: BackupData): BackupSummary {
  return {
    templates: d.textArt?.items.length ?? 0,
    folders: d.textArt?.folders.length ?? 0,
    macros: d.clicker?.configs.length ?? 0,
    leaders: d.rally?.leaders.length ?? 0,
    hasSettings: !!d.settings,
    hasOrder: !!d.order,
  }
}

// ---------------------------------------------------------------------
// File format

interface PlainFile {
  app: typeof BACKUP_APP
  format: number
  created: string
  encrypted: false
  data: unknown
}

interface EncryptedFile {
  app: typeof BACKUP_APP
  format: number
  created: string
  encrypted: true
  kdf: { name: "PBKDF2-SHA256"; iterations: number; salt: string }
  cipher: { name: "AES-256-GCM"; iv: string }
  payload: string
}

type BackupFile = PlainFile | EncryptedFile

/** Reads the envelope of a backup. Throws BackupError when it is not one of ours. */
export function parseBackup(text: string): { encrypted: boolean; file: BackupFile } {
  if (typeof text !== "string" || text.length > MAX_BACKUP_CHARS) throw new BackupError("too-big")
  let raw: unknown
  try {
    raw = JSON.parse(text.trim())
  } catch {
    throw new BackupError("not-backup")
  }
  const o = obj(raw)
  if (!o || o.app !== BACKUP_APP || typeof o.format !== "number") throw new BackupError("not-backup")
  if (o.format > BACKUP_FORMAT) throw new BackupError("newer")
  if (o.format !== BACKUP_FORMAT) throw new BackupError("unsupported")
  const created = str(o.created, 40)

  if (o.encrypted === true) {
    const kdf = obj(o.kdf)
    const cipher = obj(o.cipher)
    if (
      !kdf ||
      !cipher ||
      kdf.name !== "PBKDF2-SHA256" ||
      cipher.name !== "AES-256-GCM" ||
      typeof kdf.iterations !== "number" ||
      !Number.isInteger(kdf.iterations) ||
      kdf.iterations < MIN_ITERATIONS ||
      kdf.iterations > MAX_ITERATIONS ||
      typeof kdf.salt !== "string" ||
      typeof cipher.iv !== "string" ||
      typeof o.payload !== "string"
    ) {
      throw new BackupError("corrupt")
    }
    const file: EncryptedFile = {
      app: BACKUP_APP,
      format: BACKUP_FORMAT,
      created,
      encrypted: true,
      kdf: { name: "PBKDF2-SHA256", iterations: kdf.iterations, salt: kdf.salt },
      cipher: { name: "AES-256-GCM", iv: cipher.iv },
      payload: o.payload,
    }
    return { encrypted: true, file }
  }
  if (!obj(o.data)) throw new BackupError("corrupt")
  return { encrypted: false, file: { app: BACKUP_APP, format: BACKUP_FORMAT, created, encrypted: false, data: o.data } }
}

// ---------------------------------------------------------------------
// Encryption

const enc = new TextEncoder()
const dec = new TextDecoder()

function toB64(bytes: Uint8Array): string {
  let s = ""
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromB64(b64: string): Uint8Array {
  try {
    const s = atob(b64)
    const out = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
    return out
  } catch {
    throw new BackupError("corrupt")
  }
}

/** The same password must give the same key whatever the keyboard did to accents. */
const normalisePassword = (p: string) => p.normalize("NFKC")

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(normalisePassword(password)), "PBKDF2", false, [
    "deriveKey",
  ])
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

/** What the cipher authenticates besides the data: tampering with the header is detected. */
const header = (iterations: number) => enc.encode(`${BACKUP_APP}|${BACKUP_FORMAT}|PBKDF2-SHA256|${iterations}|AES-256-GCM`)

/** Builds the text of a backup. With a password it is encrypted, without it readable. */
export async function createBackup(data: BackupData, password?: string, now = new Date()): Promise<string> {
  const created = now.toISOString()
  if (!password) {
    const file: PlainFile = { app: BACKUP_APP, format: BACKUP_FORMAT, created, encrypted: false, data }
    return JSON.stringify(file, null, 1)
  }
  if (password.length < MIN_PASSWORD) throw new BackupError("bad-password")
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS)
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: header(PBKDF2_ITERATIONS) as BufferSource },
    key,
    enc.encode(JSON.stringify(data))
  )
  const file: EncryptedFile = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    created,
    encrypted: true,
    kdf: { name: "PBKDF2-SHA256", iterations: PBKDF2_ITERATIONS, salt: toB64(salt) },
    cipher: { name: "AES-256-GCM", iv: toB64(iv) },
    payload: toB64(new Uint8Array(cipher)),
  }
  return JSON.stringify(file, null, 1)
}

/** Opens a backup. Throws BackupError ("bad-password" also covers a damaged file). */
export async function openBackup(text: string, password?: string): Promise<BackupData> {
  const { encrypted, file } = parseBackup(text)
  if (!encrypted) return sanitizeBackupData((file as PlainFile).data)
  if (!password) throw new BackupError("bad-password")
  const f = file as EncryptedFile
  const salt = fromB64(f.kdf.salt)
  const iv = fromB64(f.cipher.iv)
  if (salt.length !== 16 || iv.length !== 12) throw new BackupError("corrupt")
  const key = await deriveKey(password, salt, f.kdf.iterations)
  let plain: ArrayBuffer
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource, additionalData: header(f.kdf.iterations) as BufferSource },
      key,
      fromB64(f.payload) as BufferSource
    )
  } catch {
    // Wrong password, or the file was changed: GCM cannot tell which, and says nothing more.
    throw new BackupError("bad-password")
  }
  let data: unknown
  try {
    data = JSON.parse(dec.decode(plain))
  } catch {
    throw new BackupError("corrupt")
  }
  return sanitizeBackupData(data)
}

/** File name proposed when saving: no personal data in it. */
export const backupFileName = (now = new Date()) =>
  `kingshot-assistant-backup-${now.toISOString().slice(0, 10)}.json`
