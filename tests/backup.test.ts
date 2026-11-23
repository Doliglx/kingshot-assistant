import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BackupError,
  MAX_BACKUP_CHARS,
  createBackup,
  openBackup,
  parseBackup,
  sanitizeBackupData,
  summarize,
  type BackupData,
} from "../lib/backup"
import { EXAMPLE_ART } from "../lib/text-art"

const sample = (): BackupData => ({
  settings: { lang: "fr", hue: 345 },
  order: ["textart", "rss", "fraki", "ratio", "buff", "gather", "rally", "clicker"],
  textArt: {
    folders: [{ id: "f1", name: "Pixel Art" }],
    items: [{ id: "a1", name: "Hero", folderId: "f1", text: EXAMPLE_ART, updatedAt: 5 }],
  },
  textArtWidth: 16,
  rally: { target: "Castle", lang: "fr", tab: "quick", leaders: [{ id: "l1", name: "Carl", march: "60" }], meId: "l1" },
  rallyGuideHidden: true,
  gatherSpeed: 25,
})

const code = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    return e instanceof BackupError ? e.code : `other:${String(e)}`
  }
  return "no error"
}

describe("backup: round trip", () => {
  it("restores a plain backup exactly, text art included byte for byte", async () => {
    const out = await openBackup(await createBackup(sample()))
    assert.equal(out.textArt?.items[0].text, EXAMPLE_ART)
    assert.deepEqual(out.settings, { lang: "fr", hue: 345 })
    assert.deepEqual(out.order, sample().order)
    assert.equal(out.rally?.leaders[0].name, "Carl")
    assert.equal(out.rallyGuideHidden, true)
  })

  it("restores an encrypted backup with the right password", async () => {
    const text = await createBackup(sample(), "correct horse battery")
    assert.equal(parseBackup(text).encrypted, true)
    const out = await openBackup(text, "correct horse battery")
    assert.equal(out.textArt?.items[0].text, EXAMPLE_ART)
  })

  it("does not show the data in an encrypted file", async () => {
    const text = await createBackup(sample(), "correct horse battery")
    assert.ok(!text.includes("Carl") && !text.includes("Pixel Art") && !text.includes("🍀"))
  })

  it("gives a different file each time (random salt and IV)", async () => {
    const a = await createBackup(sample(), "correct horse battery")
    const b = await createBackup(sample(), "correct horse battery")
    assert.notEqual(JSON.parse(a).payload, JSON.parse(b).payload)
    assert.notEqual(JSON.parse(a).kdf.salt, JSON.parse(b).kdf.salt)
  })

  it("treats accents typed in different forms as the same password", async () => {
    const text = await createBackup(sample(), "mot de passe é2024")
    const out = await openBackup(text, "mot de passe é" + "2024")
    assert.ok(out.settings)
  })
})

describe("backup: refuses what it should", () => {
  it("rejects a wrong or missing password", async () => {
    const text = await createBackup(sample(), "correct horse battery")
    assert.equal(await code(openBackup(text, "wrong password!")), "bad-password")
    assert.equal(await code(openBackup(text)), "bad-password")
  })

  it("rejects a password that is too short when encrypting", async () => {
    assert.equal(await code(createBackup(sample(), "short")), "bad-password")
  })

  it("detects a changed payload or a changed header", async () => {
    const text = await createBackup(sample(), "correct horse battery")
    const f = JSON.parse(text)
    const bytes = Buffer.from(f.payload, "base64")
    bytes[bytes.length - 1] ^= 1
    assert.equal(await code(openBackup(JSON.stringify({ ...f, payload: bytes.toString("base64") }), "correct horse battery")), "bad-password")
    const g = { ...f, kdf: { ...f.kdf, iterations: f.kdf.iterations + 1 } }
    assert.equal(await code(openBackup(JSON.stringify(g), "correct horse battery")), "bad-password")
  })

  it("refuses absurd key-derivation settings instead of freezing", async () => {
    const f = JSON.parse(await createBackup(sample(), "correct horse battery"))
    for (const iterations of [1_000_000_000, 5, -1, 1.5]) {
      assert.equal(await code(openBackup(JSON.stringify({ ...f, kdf: { ...f.kdf, iterations } }), "correct horse battery")), "corrupt")
    }
  })

  it("rejects text that is not one of our backups", () => {
    for (const t of ["", "hello", "[]", "null", '{"app":"other","format":1,"data":{}}', '{"app":"kingshot-assistant"}']) {
      assert.throws(() => parseBackup(t), (e: unknown) => e instanceof BackupError && e.code === "not-backup", t)
    }
  })

  it("rejects a newer format and an oversized text", () => {
    assert.throws(() => parseBackup('{"app":"kingshot-assistant","format":99,"data":{}}'), (e: unknown) => (e as BackupError).code === "newer")
    assert.throws(() => parseBackup("x".repeat(MAX_BACKUP_CHARS + 1)), (e: unknown) => (e as BackupError).code === "too-big")
  })
})

describe("backup: hostile content is cleaned", () => {
  it("drops unknown sections and clamps values", () => {
    const d = sanitizeBackupData({
      settings: { lang: "de", hue: 99999 },
      evil: { run: "this" },
      __proto__: { polluted: true },
      textArtWidth: 500,
      gatherSpeed: -5,
      order: ["nope", "rss", "rss", 7],
      rally: { target: "x".repeat(1000), lang: "ru", tab: "nope", leaders: "no", meId: 5 },
    })
    assert.deepEqual(Object.keys(d).sort(), ["gatherSpeed", "order", "rally", "settings", "textArtWidth"])
    assert.deepEqual(d.settings, { lang: "en", hue: 360 })
    assert.equal(d.textArtWidth, 30)
    assert.equal(d.gatherSpeed, 0)
    assert.equal(d.order?.[0], "rss")
    assert.equal(d.order?.length, 8)
    assert.equal(d.rally?.target.length, 80)
    assert.equal(d.rally?.lang, "en")
    assert.equal(d.rally?.tab, "utc")
    assert.equal(({} as Record<string, unknown>).polluted, undefined)
  })

  it("keeps macros inside the same limits as the modules", () => {
    const d = sanitizeBackupData({
      clicker: {
        configs: [
          { id: "m1", name: "x".repeat(500), mode: "multi", intervalMs: 5, targets: [{ id: "t", type: "tap", x: 10, y: 20, tapMs: 99999 }] },
          "garbage",
          null,
        ],
        appearance: { markerSize: 9999, panelOpacity: -3 },
      },
    })
    assert.equal(d.clicker?.configs.length, 1)
    assert.ok(d.clicker!.configs[0].name.length <= 40)
    assert.ok(d.clicker!.configs[0].targets[0].tapMs <= 500)
    assert.equal(d.clicker?.appearance.markerSize, 96)
  })

  it("summarises what a backup holds", async () => {
    const s = summarize(await openBackup(await createBackup(sample())))
    assert.deepEqual(s, { templates: 1, folders: 1, macros: 0, leaders: 1, hasSettings: true, hasOrder: true })
  })
})
