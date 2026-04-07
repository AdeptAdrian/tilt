/**
 * Teammate enrichment endpoint.
 * Called fire-and-forget from /api/players/sync — never blocks page load.
 *
 * For each unique teammate seen in match_players, fetches their profile
 * from Tracker.gg and upserts them as players (without a user_id).
 * This enriches chemistry insight data over time.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/db/supabase-server'
import { normalizePlayerProfile } from '@/lib/services/tracker'
import { getPlayerByUsername, upsertPlayer, isPlayerCacheStale } from '@/lib/db/players'
import type { Platform } from '@/types'

// Enrich at most this many new teammates per sync to respect rate limits
const MAX_ENRICHMENTS_PER_RUN = 5

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { player_id } = body as { player_id?: string }
  if (!player_id) {
    return NextResponse.json({ error: 'player_id is required' }, { status: 400 })
  }

  try {
    const supabase = createSupabaseServiceClient()

    // Find unique teammate player_ids from match_players for matches owned by this player
    const { data: teammateRows, error } = await supabase
      .from('match_players')
      .select('player_id')
      .neq('player_id', player_id)
      .limit(MAX_ENRICHMENTS_PER_RUN * 10) // fetch more, filter below

    if (error) throw error

    // Deduplicate
    const uniqueTeammateIds = [
      ...new Set((teammateRows ?? []).map((r: { player_id: string }) => r.player_id)),
    ].slice(0, MAX_ENRICHMENTS_PER_RUN)

    if (uniqueTeammateIds.length === 0) {
      return NextResponse.json({ enriched: 0 })
    }

    // Fetch existing teammate records to get username/platform
    const { data: teammatePlayerRows, error: tErr } = await supabase
      .from('players')
      .select('id, username, platform, cached_at')
      .in('id', uniqueTeammateIds)

    if (tErr) throw tErr

    let enriched = 0

    for (const teammate of teammatePlayerRows ?? []) {
      const existing = await getPlayerByUsername(
        teammate.username,
        teammate.platform as Platform
      )
      if (existing && !isPlayerCacheStale(existing)) continue

      try {
        const profileData = await normalizePlayerProfile(
          teammate.username,
          teammate.platform as Platform
        )
        await upsertPlayer(profileData)
        enriched++
      } catch (enrichErr) {
        // Log but don't fail — enrichment is best-effort
        console.warn(
          `[api/players/enrich] Failed to enrich ${teammate.username}:`,
          enrichErr
        )
      }
    }

    return NextResponse.json({ enriched })
  } catch (err) {
    console.error('[api/players/enrich]', err)
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 })
  }
}
