import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { frakScore, optimise, type FrakStats } from "../lib/frakinator"
import { applyModifier, boostedDuration } from "../lib/modifiers"
import { toCount, toPercent } from "../lib/number-input"
import { splitTroops } from "../lib/ratio"

describe("number fields", () => {
  it("treats empty, invalid and negative input as 0", () => {
    assert.equal(toCount(""), 0)
    assert.equal(toCount("abc"), 0)
    assert.equal(toCount("-5"), 0)
    assert.equal(toCount("120", 59), 59)
    assert.equal(toPercent("7,5"), 7.5)
    assert.equal(toPercent("-3"), 0)
  })
})

describe("march ratio", () => {
  it("always adds up to the total when the percentages make 100", () => {
    for (const total of [0, 1, 7, 100, 55000, 123457]) {
      for (const pct of [
        { inf: 50, cav: 20, arc: 30 },
        { inf: 33, cav: 33, arc: 34 },
        { inf: 60, cav: 40, arc: 0 },
      ]) {
        const r = splitTroops(total, pct)
        assert.equal(r.inf + r.cav + r.arc, total, `${total} ${JSON.stringify(pct)}`)
      }
    }
  })

  it("gives the classic 50/20/30 split", () => {
    assert.deepEqual(splitTroops(55000, { inf: 50, cav: 20, arc: 30 }), { inf: 27500, cav: 11000, arc: 16500 })
  })

  it("follows each percentage when they do not make 100", () => {
    assert.deepEqual(splitTroops(1000, { inf: 50, cav: 20, arc: 20 }), { inf: 500, cav: 200, arc: 200 })
  })
})

describe("buff / debuff", () => {
  it("multiplies instead of adding", () => {
    const buff = applyModifier(200, 10)
    assert.ok(Math.abs(buff.finalStat - 230) < 1e-9)
    assert.ok(Math.abs(buff.variation - 30) < 1e-9)
    const debuff = applyModifier(200, -10)
    assert.ok(Math.abs(debuff.finalStat - 170) < 1e-9)
  })
})

describe("gather time", () => {
  it("removes the current bonus before applying the new one", () => {
    // 1 h shown at +50 % is 5400 s of work; at +100 % it takes 2700 s.
    assert.ok(Math.abs(boostedDuration(3600, 50, 50) - 2700) < 1e-9)
    assert.equal(boostedDuration(3600, 0, 0), 3600)
  })
})

describe("Frakinator", () => {
  const flat: FrakStats = {
    inf: { attack: 0, lethality: 0 },
    cav: { attack: 0, lethality: 0 },
    arc: { attack: 0, lethality: 0 },
  }

  it("finds a mix that adds up to 100 and beats its neighbours", () => {
    const best = optimise(flat, 1.1)
    assert.equal(best.inf + best.cav + best.arc, 100)
    for (const [di, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]]) {
      const inf = best.inf + di
      const cav = best.cav + dc
      const arc = 100 - inf - cav
      if (inf < 0 || cav < 0 || arc < 0) continue
      assert.ok(frakScore(flat, 1.1, inf, cav, arc) <= best.score + 1e-12)
    }
  })

  it("matches the closed-form optimum (share ∝ weight²)", () => {
    // Weights: 1/3, 1, 4/3·1.1·1.1 → shares proportional to their squares.
    const w = [1 / 3, 1, (4 / 3) * 1.1 * 1.1]
    const sum = w.reduce((a, b) => a + b * b, 0)
    const best = optimise(flat, 1.1)
    assert.ok(Math.abs(best.inf - (100 * w[0] ** 2) / sum) <= 1)
    assert.ok(Math.abs(best.cav - (100 * w[1] ** 2) / sum) <= 1)
    assert.ok(Math.abs(best.arc - (100 * w[2] ** 2) / sum) <= 1)
  })

  it("shifts towards the troop type with the better stats", () => {
    const cavHeavy = optimise({ ...flat, cav: { attack: 300, lethality: 300 } }, 1)
    assert.ok(cavHeavy.cav > optimise(flat, 1).cav)
  })
})
