// Parsing helpers for numeric form fields: empty or invalid input counts as 0
// and negative values are rejected, so a calculator never works on NaN.

/** Non-negative integer (troop counts, chests, seconds…). */
export function toCount(raw: string, max = Number.MAX_SAFE_INTEGER): number {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(n, max)
}

/** Non-negative decimal (percentages). */
export function toPercent(raw: string, max = 100_000): number {
  const n = parseFloat(raw.replace(",", "."))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(n, max)
}
