// Getting a backup out of the app and back in: a file, or plain text.

import { Capacitor } from "@capacitor/core"
import { MAX_BACKUP_CHARS, backupFileName } from "./backup"

export type SaveResult = "saved" | "cancelled"

/**
 * Hands the backup to the user as a file.
 * Android: written to the app's cache, then offered through the system share
 * sheet (save to Files, Drive, send to oneself...). Web: a normal download.
 */
export async function saveBackupFile(text: string): Promise<SaveResult> {
  const name = backupFileName()
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem")
    const { Share } = await import("@capacitor/share")
    // Earlier backups left in the cache are removed first: they hold personal data.
    try {
      const { files } = await Filesystem.readdir({ path: "", directory: Directory.Cache })
      for (const f of files) {
        if (f.name.startsWith("kingshot-assistant-backup-")) {
          await Filesystem.deleteFile({ path: f.name, directory: Directory.Cache })
        }
      }
    } catch {
      // nothing to clean
    }
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })
    try {
      await Share.share({ title: name, files: [uri], dialogTitle: name })
    } catch (e) {
      // Closing the share sheet is not an error.
      if (/cancel/i.test(String(e))) return "cancelled"
      throw e
    }
    return "saved"
  }
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return "saved"
}

/** Reads a chosen file as text, refusing anything too large to be a backup. */
export async function readBackupFile(file: File): Promise<string> {
  if (file.size > MAX_BACKUP_CHARS * 4) throw new Error("too-big")
  return file.text()
}
