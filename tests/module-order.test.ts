import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { MODULE_IDS, isDefaultOrder, moveModule, sanitizeOrder } from "../lib/module-order"

const DEFAULT = [...MODULE_IDS]

describe("module order", () => {
  it("falls back to the default order", () => {
    assert.deepEqual(sanitizeOrder(null), DEFAULT)
    assert.deepEqual(sanitizeOrder("rss"), DEFAULT)
    assert.deepEqual(sanitizeOrder([]), DEFAULT)
  })

  it("keeps a stored order", () => {
    const stored = [...DEFAULT].reverse()
    assert.deepEqual(sanitizeOrder(stored), stored)
  })

  it("drops unknown and repeated ids", () => {
    const order = sanitizeOrder(["textart", "nope", 3, "textart", "rss"])
    assert.deepEqual(order.slice(0, 2), ["textart", "rss"])
    assert.equal(order.length, DEFAULT.length)
    assert.equal(new Set(order).size, DEFAULT.length)
  })

  it("puts a module added by an update at the end, never hides it", () => {
    const old = DEFAULT.filter((id) => id !== "textart").reverse()
    const order = sanitizeOrder(old)
    assert.equal(order[order.length - 1], "textart")
    assert.equal(order.length, DEFAULT.length)
  })

  it("moves one place at a time and stops at the ends", () => {
    assert.deepEqual(moveModule(["a", "b", "c"], "b", -1), ["b", "a", "c"])
    assert.deepEqual(moveModule(["a", "b", "c"], "b", 1), ["a", "c", "b"])
    assert.deepEqual(moveModule(["a", "b", "c"], "a", -1), ["a", "b", "c"])
    assert.deepEqual(moveModule(["a", "b", "c"], "c", 1), ["a", "b", "c"])
    assert.deepEqual(moveModule(["a", "b", "c"], "zzz", 1), ["a", "b", "c"])
  })

  it("does not change the list it was given", () => {
    const order = ["a", "b", "c"]
    moveModule(order, "a", 1)
    assert.deepEqual(order, ["a", "b", "c"])
  })

  it("recognises the default order", () => {
    assert.ok(isDefaultOrder(DEFAULT))
    assert.ok(!isDefaultOrder(moveModule(DEFAULT, "rss", 1)))
  })
})
