/**
 * Legend chemistry calculator.
 *
 * Analyzes which legend the player performs best on, using their own
 * match_players records. Requires ≥ 20 matches before producing insights.
 */

import type { MatchPlayer } from '@/types'

export const CHEMISTRY_MIN_MATCHES = 20
const MIN_GAMES_PER_LEGEND = 3

export interface LegendStats {
  legend: string
  games: number
  avgPlacement: number
  avgKills: number
  avgDamage: number
}

export interface ChemistryContext {
  totalMatches: number
  topLegends: LegendStats[]
  worstLegends: LegendStats[]
  bestLegend: LegendStats
  worstLegend: LegendStats
}

/**
 * `matchPlayers` — all MatchPlayer rows for this player
 * `placements`   — map of match UUID → placement (integer, 1 = win)
 */
export function calculateChemistry(
  matchPlayers: MatchPlayer[],
  placements: Map<string, number>
): ChemistryContext | null {
  if (matchPlayers.length < CHEMISTRY_MIN_MATCHES) return null

  // Group by legend
  const byLegend = new Map<string, MatchPlayer[]>()
  for (const mp of matchPlayers) {
    const list = byLegend.get(mp.legend) ?? []
    list.push(mp)
    byLegend.set(mp.legend, list)
  }

  const stats: LegendStats[] = []
  for (const [legend, entries] of Array.from(byLegend.entries())) {
    if (entries.length < MIN_GAMES_PER_LEGEND) continue

    const placementValues = entries
      .map((e) => placements.get(e.match_id))
      .filter((p): p is number => p !== undefined)

    if (placementValues.length === 0) continue

    stats.push({
      legend,
      games: entries.length,
      avgPlacement:
        placementValues.reduce((a: number, b: number) => a + b, 0) / placementValues.length,
      avgKills:
        entries.reduce((a: number, b: MatchPlayer) => a + b.kills, 0) / entries.length,
      avgDamage:
        entries.reduce((a: number, b: MatchPlayer) => a + b.damage, 0) / entries.length,
    })
  }

  if (stats.length === 0) return null

  // Sort by avg placement ascending (lower = better)
  const sorted = [...stats].sort((a, b) => a.avgPlacement - b.avgPlacement)
  const topLegends = sorted.slice(0, 3)
  const worstLegends = [...sorted].reverse().slice(0, 3)

  return {
    totalMatches: matchPlayers.length,
    topLegends,
    worstLegends,
    bestLegend: topLegends[0],
    worstLegend: worstLegends[0],
  }
}
