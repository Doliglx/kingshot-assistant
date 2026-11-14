// Small game formulas shared by the calculators.

/**
 * Stats multiply: a +10 % buff on a stat shown as +200 % gives
 * (1 + 2.00) × (1 + 0.10) − 1 = +230 %, not +210 %.
 * Pass a negative modifier for a debuff.
 */
export function applyModifier(initialPct: number, modifierPct: number) {
  const finalStat = ((1 + initialPct / 100) * (1 + modifierPct / 100) - 1) * 100
  return { finalStat, variation: finalStat - initialPct }
}

/**
 * The game shows a gathering time already reduced by the current speed bonus.
 * Work to do = shown × (1 + current); with more bonus it takes
 * work / (1 + current + added).
 */
export function boostedDuration(shownSec: number, currentPct: number, addedPct: number): number {
  const now = 1 + currentPct / 100
  const next = now + addedPct / 100
  return next > 0 ? (shownSec * now) / next : 0
}
