/**
 * Squad role gap analyzer.
 *
 * Maps each legend to a role category and analyzes which roles the player
 * tends to fill. Identifies gaps (missing roles) and correlates them with
 * worse placement outcomes.
 */

import type { Match, MatchPlayer } from '@/types'

export type LegendRole = 'Skirmisher' | 'Controller' | 'Support' | 'Recon' | 'Assault'

// Season 23 legend → role mapping (update as new legends release)
const LEGEND_ROLES: Record<string, LegendRole> = {
  // Assault
  Ash: 'Assault',
  Ballistic: 'Assault',
  Fuse: 'Assault',
  'Mad Maggie': 'Assault',
  Peacekeeper: 'Assault',
  Revenant: 'Assault',
  // Skirmisher
  Horizon: 'Skirmisher',
  Mirage: 'Skirmisher',
  Octane: 'Skirmisher',
  Pathfinder: 'Skirmisher',
  Valkyrie: 'Skirmisher',
  Wraith: 'Skirmisher',
  // Recon
  Bloodhound: 'Recon',
  Crypto: 'Recon',
  Seer: 'Recon',
  Vantage: 'Recon',
  // Controller
  Catalyst: 'Controller',
  Caustic: 'Controller',
  Rampart: 'Controller',
  Wattson: 'Controller',
  // Support
  'Bangalore': 'Support',
  Gibraltar: 'Support',
  Lifeline: 'Support',
  Loba: 'Support',
  Newcastle: 'Support',
  Conduit: 'Support',
}

function getLegendRole(legend: string): LegendRole | null {
  return LEGEND_ROLES[legend] ?? null
}

export interface RolePlayStats {
  role: LegendRole
  games: number
  avgPlacement: number
  fraction: number // share of total games
}

export interface SquadRoleContext {
  totalMatches: number
  playerRoles: RolePlayStats[]
  primaryRole: LegendRole | null
  missingRoles: LegendRole[]         // roles player never plays
  underplayedRoles: LegendRole[]     // roles played < 10% of games
  bestRoleByPlacement: LegendRole | null
  worstRoleByPlacement: LegendRole | null
}

const ALL_ROLES: LegendRole[] = ['Assault', 'Skirmisher', 'Recon', 'Controller', 'Support']

export function calculateSquadRole(
  matchPlayers: MatchPlayer[],
  placements: Map<string, number>
): SquadRoleContext | null {
  if (matchPlayers.length < 10) return null

  const byRole = new Map<LegendRole, MatchPlayer[]>()

  for (const mp of matchPlayers) {
    const role = getLegendRole(mp.legend)
    if (!role) continue
    const list = byRole.get(role) ?? []
    list.push(mp)
    byRole.set(role, list)
  }

  const total = matchPlayers.length
  const roleStats: RolePlayStats[] = []

  for (const role of ALL_ROLES) {
    const entries = byRole.get(role) ?? []
    if (entries.length === 0) continue

    const placementValues = entries
      .map((e) => placements.get(e.match_id))
      .filter((p): p is number => p !== undefined)

    roleStats.push({
      role,
      games: entries.length,
      avgPlacement:
        placementValues.length > 0
          ? placementValues.reduce((a, b) => a + b, 0) / placementValues.length
          : 0,
      fraction: entries.length / total,
    })
  }

  const missingRoles = ALL_ROLES.filter((r) => !byRole.has(r))
  const underplayedRoles = roleStats
    .filter((r) => r.fraction < 0.1)
    .map((r) => r.role)

  const sorted = [...roleStats].sort((a, b) => a.avgPlacement - b.avgPlacement)
  const primaryRole =
    roleStats.length > 0
      ? [...roleStats].sort((a, b) => b.games - a.games)[0].role
      : null

  return {
    totalMatches: total,
    playerRoles: roleStats,
    primaryRole,
    missingRoles,
    underplayedRoles,
    bestRoleByPlacement: sorted[0]?.role ?? null,
    worstRoleByPlacement: sorted[sorted.length - 1]?.role ?? null,
  }
}
