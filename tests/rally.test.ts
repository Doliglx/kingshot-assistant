import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildMessage,
  buildQuickMessage,
  computePlan,
  computeQuickSync,
  formatOffset,
  formatUtc,
  parseDuration,
  parseTimeOfDay,
  resolveArrival,
} from "../lib/march-time"
import { LANGS } from "../lib/messages"
import { bestSample, makeSample } from "../lib/utc-clock"

const leaders = [
  { id: "a", name: "Alex", march: "0:45" },
  { id: "b", name: "Bea", march: "1:10" },
  { id: "c", name: "Carl", march: "2:05" },
]
const noon = Date.UTC(2026, 10, 12, 12, 20, 0)

describe("march time parsing", () => {
  it("accepts seconds, mm:ss, h:mm:ss and unit notations", () => {
    const cases: Array<[string, number | null]> = [
      ["125", 125], ["2:05", 125], ["1m30s", 90], ["1m 30s", 90], ["90s", 90], ["2m", 120],
      ["1h2m3s", 3723], ["1:02:05", 3725], ["", null], ["abc", null], ["1:75", null], ["1m30", null],
    ]
    for (const [input, expected] of cases) assert.equal(parseDuration(input), expected, input)
  })

  it("parses a UTC time of day", () => {
    assert.equal(parseTimeOfDay("12:30:00"), 45000)
    assert.equal(parseTimeOfDay("12:30"), 45000)
    assert.equal(parseTimeOfDay("24:00:00"), null)
  })
})

describe("Exact UTC", () => {
  const arrival = resolveArrival(parseTimeOfDay("12:30:00")!, noon)
  const rows = computePlan(leaders, arrival)

  it("launch = arrival − march, slowest first", () => {
    assert.deepEqual(rows.map((r) => formatUtc(r.departMs)), ["12:27:55", "12:28:50", "12:29:15"])
    assert.deepEqual(rows.map((r) => r.name), ["Carl", "Bea", "Alex"])
  })

  it("builds the reference messages", () => {
    assert.equal(
      buildMessage("Castle", arrival, rows, "en"),
      "CASTLE HIT at 12:30:00 UTC\nLaunch your rally at:\n12:27:55 Carl\n12:28:50 Bea\n12:29:15 Alex"
    )
    assert.equal(
      buildMessage("Castle", arrival, rows, "fr"),
      "ATTAQUE DU CHÂTEAU à 12:30:00 UTC\nLancez votre rally à :\n12:27:55 Carl\n12:28:50 Bea\n12:29:15 Alex"
    )
    assert.ok(buildMessage("North Tower", arrival, rows, "en").startsWith("NORTH TOWER HIT at"))
  })

  it("handles midnight UTC in both directions", () => {
    const late = Date.UTC(2026, 10, 12, 23, 58, 30)
    const next = resolveArrival(parseTimeOfDay("00:01:00")!, late)
    assert.equal(next, Date.UTC(2026, 10, 13, 0, 1, 0))
    const plan = computePlan(
      [{ id: "x", name: "X", march: "2:30" }, { id: "y", name: "Y", march: "30" }],
      next
    )
    assert.deepEqual(plan.map((r) => formatUtc(r.departMs)), ["23:58:30", "00:00:30"])
    const early = Date.UTC(2026, 10, 13, 0, 2, 0)
    assert.equal(resolveArrival(parseTimeOfDay("23:59:00")!, early), Date.UTC(2026, 10, 12, 23, 59, 0))
  })

  it("numbers duplicate names and skips invalid march times", () => {
    const plan = computePlan(
      [
        { id: "1", name: "Alex", march: "60" },
        { id: "2", name: " alex ", march: "90" },
        { id: "3", name: "", march: "60" },
        { id: "4", name: "Zed", march: "???" },
      ],
      arrival
    )
    assert.deepEqual(plan.map((r) => r.name), ["alex (2)", "Alex (1)", "Leader 3"])
  })
})

describe("Quick Sync", () => {
  const plan = computeQuickSync([
    { id: "1", name: "Alex", march: "50" },
    { id: "2", name: "Carl", march: "60" },
    { id: "3", name: "Bea", march: "55s" },
  ])!

  it("the longest march launches first, others get an offset", () => {
    assert.equal(plan.first.name, "Carl")
    assert.deepEqual(
      plan.rows.map((r) => [r.name, formatOffset(r.offsetSec)]),
      [["Carl", "+0s"], ["Bea", "+5s"], ["Alex", "+10s"]]
    )
  })

  it("formats offsets", () => {
    assert.equal(formatOffset(59), "+59s")
    assert.equal(formatOffset(65), "+1m05s")
  })

  it("builds the reference messages", () => {
    assert.equal(
      buildQuickMessage("Castle", plan, "en"),
      "CASTLE HIT\nCarl launches first.\nThen launch your rally:\n+5s Bea\n+10s Alex\n(count from Carl's launch)"
    )
    assert.equal(
      buildQuickMessage("Castle", plan, "fr"),
      "ATTAQUE DU CHÂTEAU\nCarl lance en premier.\nEnsuite, lancez votre rally :\n+5s Bea\n+10s Alex\n(comptez depuis le lancement de Carl)"
    )
  })

  it("equal marches share +0s and a lone leader gets a short message", () => {
    const tie = computeQuickSync([
      { id: "1", name: "Dan", march: "1:00" },
      { id: "2", name: "Eve", march: "60" },
    ])!
    assert.equal(tie.first.name, "Dan")
    assert.equal(formatOffset(tie.rows[1].offsetSec), "+0s")
    const solo = computeQuickSync([{ id: "1", name: "Solo", march: "30" }])!
    assert.equal(buildQuickMessage("Castle", solo, "en"), "CASTLE HIT\nSolo launches first.")
    assert.equal(computeQuickSync([{ id: "1", name: "X", march: "" }]), null)
  })

  it("every language yields a complete message", () => {
    for (const lang of LANGS) {
      const msg = buildQuickMessage("North Tower", plan, lang)
      assert.ok(!/undefined|\$\{/.test(msg), lang)
      assert.ok(msg.includes("NORTH TOWER") && msg.includes("+5s Bea"), lang)
    }
    assert.equal(buildQuickMessage("Burg", plan, "de").split("\n")[0], "ANGRIFF AUF DIE BURG")
  })
})

describe("clock synchronisation", () => {
  it("corrects the offset assuming the server answered mid-trip", () => {
    // Local clock 5 s behind the server, 80 ms round trip.
    const s = makeSample(1000, 1080, 6040, 1)
    assert.ok(Math.abs(s.offsetMs - 5000) < 2)
    assert.ok(s.uncertaintyMs <= 41)
  })

  it("keeps the sample with the smallest uncertainty", () => {
    const fast = makeSample(0, 20, 5010, 1)
    const slow = makeSample(0, 400, 5200, 1)
    assert.equal(bestSample([slow, fast]), fast)
    assert.equal(bestSample([]), null)
  })
})
