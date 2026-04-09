import { NextRequest, NextResponse } from 'next/server'
import { generateInsight } from '@/lib/services/claude'
import { upsertInsight } from '@/lib/db/insights'
import { getPlayerById } from '@/lib/db/players'
import {
  getMatchesByPlayer,
  getMatchPlayersByPlayer,
  getRecentSessions,
} from '@/lib/db/matches'
import { calculateChemistry, CHEMISTRY_MIN_MATCHES } from '@/lib/insights/chemistry'
import { calculateFatigue } from '@/lib/insights/fatigue'
import { calculateMomentum } from '@/lib/insights/momentum'
import { calculateSquadRole } from '@/lib/insights/squad-role'
import type { InsightType, Match } from '@/types'

const VALID_TYPES = new Set<InsightType>([
  'legend_chemistry',
  'session_fatigue',
  'ranked_momentum',
  'squad_role_gap',
])

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { player_id, type } = body as { player_id?: string; type?: string }

  if (!player_id) {
    return NextResponse.json({ error: 'player_id is required' }, { status: 400 })
  }
  if (!type || !VALID_TYPES.has(type as InsightType)) {
    return NextResponse.json(
      { error: `type must be one of: ${[...VALID_TYPES].join(', ')}` },
      { status: 400 }
    )
  }

  const insightType = type as InsightType

  try {
    const player = await getPlayerById(player_id)
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    // Fetch raw data needed by all calculators
    const [matches, matchPlayers, sessions] = await Promise.all([
      getMatchesByPlayer(player_id, 100),
      getMatchPlayersByPlayer(player_id, 100),
      getRecentSessions(player_id, 20),
    ])

    // Build placement lookup used by chemistry + squad role
    const placementMap = new Map<string, number>(
      matches.map((m: Match) => [m.id, m.placement])
    )

    // Build match lookup used by fatigue
    const matchById = new Map(matches.map((m: Match) => [m.id, m]))

    let context: Record<string, unknown> | null = null

    switch (insightType) {
      case 'legend_chemistry': {
        if (matches.length < CHEMISTRY_MIN_MATCHES) {
          return NextResponse.json(
            {
              error: `Need at least ${CHEMISTRY_MIN_MATCHES} matches for chemistry insights (have ${matches.length})`,
            },
            { status: 422 }
          )
        }
        context = calculateChemistry(matchPlayers, placementMap) as unknown as Record<string, unknown>
        break
      }

      case 'session_fatigue': {
        context = calculateFatigue(sessions, matchById) as unknown as Record<string, unknown>
        break
      }

      case 'ranked_momentum': {
        const result = calculateMomentum(matches)
        if (!result) {
          return NextResponse.json(
            { error: 'Not enough matches for momentum analysis (need ≥ 5)' },
            { status: 422 }
          )
        }
        context = result as unknown as Record<string, unknown>
        break
      }

      case 'squad_role_gap': {
        const result = calculateSquadRole(matchPlayers, placementMap)
        if (!result) {
          return NextResponse.json(
            { error: 'Not enough matches for role analysis (need ≥ 10)' },
            { status: 422 }
          )
        }
        context = result as unknown as Record<string, unknown>
        break
      }
    }

    if (!context) {
      return NextResponse.json({ error: 'Could not compute insight context' }, { status: 422 })
    }

    // Generate AI insight via Claude
    const content = await generateInsight({
      type: insightType,
      playerUsername: player.username,
      context,
    })

    // Persist
    const insight = await upsertInsight({
      player_id,
      type: insightType,
      content,
    })

    return NextResponse.json({ insight })
  } catch (err) {
    console.error('[api/insights/generate]', err)
    return NextResponse.json({ error: 'Insight generation failed' }, { status: 500 })
  }
}
