import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { LIMITS, cycleDurationMs, newConfig, parseConfigs, sanitizeConfig } from "../lib/auto-clicker"
import { UI } from "../lib/i18n"
import { APP_TEXT } from "../lib/locales"
import { LANGS } from "../lib/messages"

/** Lists "a.b.c" paths of an object, calling functions with sample arguments. */
function walk(node: unknown, path: string, out: Map<string, string>) {
  if (typeof node === "string") {
    out.set(path, node)
  } else if (typeof node === "function") {
    out.set(path, String((node as (...args: unknown[]) => unknown)(3, "Carl")))
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, out)
  }
}

describe("translations", () => {
  for (const [label, dict] of [["app", APP_TEXT], ["rally", UI]] as const) {
    const reference = new Map<string, string>()
    walk(dict.en, "", reference)

    for (const lang of LANGS) {
      it(`${label}/${lang} has every key, with real text`, () => {
        const found = new Map<string, string>()
        walk(dict[lang], "", found)
        assert.deepEqual([...found.keys()].sort(), [...reference.keys()].sort())
        for (const [key, value] of found) {
          assert.ok(value.trim().length > 0, `${key} is empty`)
          assert.ok(!/undefined|NaN|\[object/.test(value), `${key}: ${value}`)
        }
      })
    }
  }
})

describe("auto clicker macros", () => {
  it("creates valid macros", () => {
    const single = newConfig("One", "single")
    assert.equal(single.targets.length, 1)
    const heal = newConfig("Heal", "multi", ["Heal", "Help"])
    assert.deepEqual(heal.targets.map((t) => t.label), ["Heal", "Help"])
    assert.deepEqual(sanitizeConfig(heal), heal)
  })

  it("clamps hostile or corrupted values", () => {
    const c = sanitizeConfig({
      id: "x",
      name: "n".repeat(500),
      mode: "multi",
      intervalMs: 0,
      startDelaySec: 9999,
      stop: "whatever",
      cycles: -4,
      durationSec: "abc",
      targets: Array.from({ length: 80 }, () => ({
        type: "explode",
        x: -5,
        y: 1e9,
        holdMs: 1,
        delayAfterMs: -1,
        repeat: 1e9,
      })),
    })!
    assert.equal(c.name.length, LIMITS.name)
    assert.equal(c.intervalMs, LIMITS.intervalMs[0])
    assert.equal(c.startDelaySec, LIMITS.startDelaySec[1])
    assert.equal(c.stop, "infinite")
    assert.equal(c.cycles, LIMITS.cycles[0])
    assert.equal(c.durationSec, 60)
    assert.equal(c.targets.length, LIMITS.targets)
    const t = c.targets[0]
    assert.equal(t.type, "tap")
    assert.equal(t.x, null)
    assert.equal(t.y, null)
    assert.equal(t.holdMs, LIMITS.holdMs[0])
    assert.equal(t.delayAfterMs, 0)
    assert.equal(t.repeat, LIMITS.repeat[1])
  })

  it("survives broken storage", () => {
    assert.deepEqual(parseConfigs("not json"), [])
    assert.deepEqual(parseConfigs('{"a":1}'), [])
    assert.equal(parseConfigs('[null, 3, {"mode":"single"}]').length, 1)
    assert.equal(sanitizeConfig({ mode: "single", targets: [{}, {}, {}] })!.targets.length, 1)
  })

  it("estimates the length of a cycle", () => {
    const c = newConfig("Heal", "multi", ["Heal", "Help"])
    // 2 taps of 40 ms + 2 waits of 500 ms + 1000 ms pause
    assert.equal(cycleDurationMs(c), 2 * 40 + 2 * 500 + 1000)
  })
})
