import { Capacitor } from "@capacitor/core"
import { Clipboard } from "@capacitor/clipboard"

/** Copie un texte : presse-papier natif sur Android, API web sinon. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Clipboard.write({ string: text })
      return true
    }
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // on tente la méthode de secours
  }
  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.style.position = "fixed"
    ta.style.opacity = "0"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** Reads plain text from the clipboard, unchanged; null when not allowed or empty. */
export async function readText(): Promise<string | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { type, value } = await Clipboard.read()
      return type.startsWith("text") && value ? value : null
    }
    if (navigator.clipboard?.readText) return (await navigator.clipboard.readText()) || null
  } catch {
    // permission refused or no text
  }
  return null
}
