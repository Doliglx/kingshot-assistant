// March ratio: split a troop total by percentages.

export interface Shares {
  inf: number
  cav: number
  arc: number
}

/**
 * Each share is rounded down; when the percentages add up to 100, the few
 * troops lost to rounding go to the largest fractional parts, so the three
 * numbers always add up to the total. With any other sum each share simply
 * follows its own percentage (the UI warns that the sum is not 100).
 */
export function splitTroops(total: number, pct: Shares): Shares {
  const keys = ["inf", "cav", "arc"] as const
  const exact = keys.map((k) => (total * pct[k]) / 100)
  const out = exact.map(Math.floor)
  if (pct.inf + pct.cav + pct.arc === 100) {
    let left = total - out.reduce((a, b) => a + b, 0)
    const order = keys
      .map((_, i) => i)
      .sort((a, b) => exact[b] - out[b] - (exact[a] - out[a]) || a - b)
    for (const i of order) {
      if (left <= 0) break
      out[i]++
      left--
    }
  }
  return { inf: out[0], cav: out[1], arc: out[2] }
}
