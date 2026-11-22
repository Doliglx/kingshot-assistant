import assert from "node:assert/strict"
import { describe, it } from "node:test"
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

describe("characters", () => {
  it("counts an emoji with modifiers as one character", () => {
    assert.deepEqual(graphemes("👍🏽◼️🇫🇷"), ["👍🏽", "◼️", "🇫🇷"])
  })

  it("knows which characters are wide", () => {
    for (const g of ["◼", "◻", "🍀", "⚪", "💙", "🌕", "📜", "　", "漢"]) assert.ok(isWide(g), g)
    for (const g of ["a", "Z", "1", " "]) assert.ok(!isWide(g), g)
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
