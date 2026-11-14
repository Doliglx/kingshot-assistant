// Frakinator: finds the troop mix (infantry / cavalry / archers, in %) that
// maximises a rally's damage score for a given leader's stats.
//
// Score model used by the community formula:
//   score = 1/3·A_inf·√inf + A_cav·√cav + 4/3·A_arc·√arc·1.1·tier
// where A = (1 + attack/100)·(1 + lethality/100) and the shares sum to 1.

export interface TroopStats {
  attack: number
  lethality: number
}

export interface FrakStats {
  inf: TroopStats
  cav: TroopStats
  arc: TroopStats
}

export interface FrakResult {
  inf: number
  cav: number
  arc: number
  score: number
  /** Score along the archer share, with infantry fixed at the optimum. */
  curve: { x: number; y: number }[]
}

const multiplier = (s: TroopStats) => (1 + s.attack / 100) * (1 + s.lethality / 100)

export function frakScore(stats: FrakStats, tier: number, inf: number, cav: number, arc: number) {
  return (
    (1 / 3) * multiplier(stats.inf) * Math.sqrt(inf / 100) +
    multiplier(stats.cav) * Math.sqrt(cav / 100) +
    (4 / 3) * multiplier(stats.arc) * Math.sqrt(arc / 100) * 1.1 * tier
  )
}

/** Exhaustive search on a 1 % grid (5 151 combinations). */
export function optimise(stats: FrakStats, tier: number): FrakResult {
  let best = { inf: 0, cav: 0, arc: 100, score: -Infinity }
  for (let inf = 0; inf <= 100; inf++) {
    for (let cav = 0; cav <= 100 - inf; cav++) {
      const arc = 100 - inf - cav
      const score = frakScore(stats, tier, inf, cav, arc)
      if (score > best.score) best = { inf, cav, arc, score }
    }
  }
  const curve: { x: number; y: number }[] = []
  for (let arc = 0; arc <= 100 - best.inf; arc += 2) {
    curve.push({ x: arc, y: frakScore(stats, tier, best.inf, 100 - best.inf - arc, arc) })
  }
  return { ...best, curve }
}
