import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { EXAMPLE_ID, defaultLibrary } from "../lib/default-art"
import {
  EXAMPLE_ART,
  graphemes,
  isWide,
  layoutChat,
  sanitizeLibrary,
  textStats,
} from "../lib/text-art"

const row = (chars: string[]) => chars.join("")

describe("chat layout", () => {
  // Reference: in-game screenshot of EXAMPLE_ART in a private chat bubble.
  // Each line below is what the bubble shows, indentation included.
  const expected = [
    "　　　　　　　　◼◼◼◼",
    "　　　　　　◼◼🍀🍀🍀🍀◼",
    "　　　　　◼🍀🍀🍀🍀🍀⚪🍀◼",
    "　　　　◼🍀🍀🍀🍀🍀⚪⚪⚪◼",
    "　　◼◼🍀🍀🍀🍀🍀◼◼◼◼🍀◼",
    "　◼🍀🍀🍀🍀🍀🍀◼🍀🍀🍀🍀🍀🍀◼",
    "　◼🍀🍀🍀◼◼◼◻◻📜◻◻◼◼　",
    "　◼🍀🍀🍀◼📜📜◻◼📜◼◻◼　　",
    "　　◼◼◼◼📜📜◻◼📜◼◻◼　　",
    "　　◼📜📜◼◼📜📜📜📜📜📜📜◼　",
    "　　◼📜📜◼📜📜◼📜📜📜📜📜◼　",
    "　　　◼📜📜📜◼◼◼◼📜📜◼◼　",
    "　　◼◼◼📜📜📜📜◼◼◼◼◼　　",
    "　　　　　◼📜📜📜📜📜📜◼　　　",
    "　　　　◼🍀◼📜📜📜📜◼　　　　",
    "　　　◼🍀🍀◼◼◼◼◼◼　　　　",
    "　　◼🍀🍀🍀💙🍀🍀🍀💙🍀◼　　　",
    "　　◼🍀🍀🍀💙🍀🍀🍀💙🍀◼　　　",
    "　◼🍀🍀🍀🍀💙💙🍀🍀💙🍀◼　　　",
    "　◼◼🍀🍀🍀💙💙💙💙💙◼🍀◼　　",
    "◼⚪⚪🍀🍀💙🌕🌕💙💙💙🌕🍀◼　　",
    "◼⚪⚪⚪⚪◼🌕🌕💙💙💙🌕◼⚪◼　",
    "◼⚪⚪⚪⚪◼💙💙💙💙💙◼⚪◼",
  ]

  it("reproduces the in-game picture line by line", () => {
    const lines = layoutChat(EXAMPLE_ART)
    assert.equal(lines.length, expected.length)
    lines.forEach((line, i) => assert.equal(row(line.chars), expected[i], `line ${i + 1}`))
  })

  it("never puts more than 16 wide characters on a line", () => {
    for (const line of layoutChat(EXAMPLE_ART)) assert.ok(line.chars.length <= 16)
  })

  it("breaks at ordinary spaces and drops the space at the end of a line", () => {
    const lines = layoutChat("◼◼◼◼◼◼◼◼◼◼ ◼◼◼◼◼◼◼◼◼◼")
    assert.deepEqual(lines.map((l) => row(l.chars)), ["◼◼◼◼◼◼◼◼◼◼", "◼◼◼◼◼◼◼◼◼◼"])
  })

  it("keeps words together on a line when they fit", () => {
    assert.deepEqual(layoutChat("Rally at 12:30 UTC").map((l) => row(l.chars)), ["Rally at 12:30 UTC"])
  })

  it("starts a new line on a newline", () => {
    const lines = layoutChat("◼◼\n◼")
    assert.equal(lines.length, 2)
    assert.equal(lines[0].hardBreak, true)
  })

  it("follows a different bubble width", () => {
    assert.equal(layoutChat("◼".repeat(20), 10).length, 2)
  })
})

describe("text in the game's font", () => {
  // Measured on an in-game screenshot: one long message repeating these
  // 36 characters, and the number of characters the game put on each line.
  const S = "azertyuiopqsdfghjklmwxcvbn1234567890"
  const GAME = [31, 31, 30, 30, 30, 29, 31, 31, 30, 31, 30, 29, 31, 31, 30, 31]

  it("breaks long text like the game, at most one character off", () => {
    const lines = layoutChat(S.repeat(14))
    let pos = 0
    let exact = 0
    GAME.forEach((n, k) => {
      // Lay out each game line from where the game started it.
      const ours = layoutChat(S.repeat(14).slice(pos))[0].chars.length
      assert.ok(Math.abs(ours - n) <= 1, `line ${k + 1}: ${ours} vs ${n}`)
      if (ours === n) exact++
      pos += n
    })
    assert.ok(exact >= 13, `${exact} lines exact`)
    assert.ok(lines.length > 10)
  })

  it("keeps kaomoji narrow, as the game does", () => {
    // Widths of these characters in the phone's fallback font (measured).
    const em: Record<string, number> = { "ᐢ": 0.389, "•": 0.524, "ﻌ": 0.482 }
    const measure = (g: string) => em[g]
    const k = "\\(ᐢ•ﻌ•ᐢ)/"
    const f = (n: number) => "🔥".repeat(n)
    // In the game: " 🔥×6 K 🔥🔥 K 🔥" then "🔥🔥🔥 K 🔥×5 K .🔥".
    const lines = layoutChat(` ${f(6)}${k}${f(2)}${k}${f(4)}${k}${f(5)}${k}.${f(2)}`, 16, measure)
    assert.equal(row(lines[0].chars), ` ${f(6)}${k}${f(2)}${k}${f(1)}`)
    assert.equal(row(lines[1].chars), `${f(3)}${k}${f(5)}${k}.${f(1)}`)
  })

  it("keeps indentation at the start of a line", () => {
    assert.equal(row(layoutChat("  ab")[0].chars), "  ab")
  })
})

describe("characters", () => {
  it("counts an emoji with modifiers as one character", () => {
    assert.deepEqual(graphemes("👍🏽◼️🇫🇷"), ["👍🏽", "◼️", "🇫🇷"])
  })

  it("knows which characters are wide", () => {
    for (const g of ["◼", "◻", "🍀", "⚪", "💙", "🌕", "📜", "　", "漢"]) assert.ok(isWide(g), g)
    for (const g of ["a", "Z", "1", " ", "ᐢ", "•", "≡", "▬", "´"]) assert.ok(!isWide(g), g)
  })

  it("reports what a damaged paste would change", () => {
    const s = textStats(EXAMPLE_ART)
    assert.equal(s.ideographicSpaces, 92)
    assert.equal(s.spaces, 6)
    assert.equal(s.characters, 360)
    assert.equal(s.utf16, 504)
    assert.equal(textStats("a�b").broken, 1)
  })
})

describe("library storage", () => {
  it("keeps the text byte for byte", () => {
    const text = "　　◼ ◼  \n"
    const lib = sanitizeLibrary({ folders: [], items: [{ id: "a", name: "x", folderId: null, text, updatedAt: 1 }] })
    assert.equal(lib.items[0].text, text)
  })

  it("drops unknown folders and clamps hostile values", () => {
    const lib = sanitizeLibrary({
      folders: [{ id: "f1", name: "Hearts" }, null, 4],
      items: [
        { id: "a", name: "n".repeat(500), folderId: "f1", text: "x" },
        { id: "b", folderId: "nope", text: 42 },
      ],
    })
    assert.equal(lib.folders.length, 1)
    assert.equal(lib.items[0].folderId, "f1")
    assert.equal(lib.items[0].name.length, 60)
    assert.equal(lib.items[1].folderId, null)
    assert.equal(lib.items[1].text, "")
  })
})

describe("default templates", () => {
  const lib = defaultLibrary("Example: pixel hero")

  it("is valid as it is: nothing is changed or dropped by the checks", () => {
    assert.deepEqual(sanitizeLibrary(JSON.parse(JSON.stringify(lib))), lib)
  })

  it("has two folders and every template in one of them or none", () => {
    assert.deepEqual(lib.folders.map((f) => f.name), ["Pixel Art", "ASCII"])
    assert.ok(lib.items.length >= 30)
    const folderIds = new Set(lib.folders.map((f) => f.id))
    assert.ok(lib.items.every((i) => i.folderId === null || folderIds.has(i.folderId)))
  })

  it("has unique ids and no template left empty", () => {
    assert.equal(new Set(lib.items.map((i) => i.id)).size, lib.items.length)
    assert.ok(lib.items.every((i) => i.text.trim().length > 0))
  })

  it("keeps the pixel hero byte for byte and names it in the app's language", () => {
    const hero = lib.items.find((i) => i.id === EXAMPLE_ID)
    assert.equal(hero?.text, EXAMPLE_ART)
    assert.equal(hero?.name, "Example: pixel hero")
    assert.equal(defaultLibrary("Exemple").items.find((i) => i.id === EXAMPLE_ID)?.name, "Exemple")
  })

  it("gives a fresh copy each time", () => {
    const a = defaultLibrary("x")
    a.items[0].name = "changed"
    assert.notEqual(defaultLibrary("x").items[0].name, "changed")
  })
})
