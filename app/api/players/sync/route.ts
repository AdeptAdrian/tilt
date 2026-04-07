import { NextRequest, NextResponse } from 'next/server'
import { normalizePlayerProfile } from '@/lib/services/tracker'
import { normalizeMatchHistory } from '@/lib/services/als'
import {
  getPlayerByUsername,
  upsertPlayer,
  isPlayerCacheStale,
} from '@/lib/db/players'
import {
  insertMatches,
  insertMatchPlayers,
  upsertSessionsFromMatches,
  getMatchCount,
} from '@/lib/db/matches'
import type { Platform } from '@/types'

const VALID_PLATFORMS = new Set<Platform>(['PC', 'PS4', 'X1', 'Switch'])

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { username, platform, user_id } = body as {
    username?: string
    platform?: string
    user_id?: string
  }

  if (!username || typeof username !== 'string' || username.trim() === '') {
    return NextResponse.json({ error: 'username is required' }, { status: 400 })
  }
  if (!platform || !VALID_PLATFORMS.has(platform as Platform)) {
    return NextResponse.json(
      { error: 'platform must be one of: PC, PS4, X1, Switch' },
      { status: 400 }
    )
  }

  const cleanUsername = username.trim()
  const cleanPlatform = platform as Platform

  try {
    // 1. Check cache
    const existing = await getPlayerByUsername(cleanUsername, cleanPlatform)
    if (existing && !isPlayerCacheStale(existing)) {
      const matchCount = await getMatchCount(existing.id)
      return NextResponse.json({
        player: existing,
        matchCount,
        synced: false,
        message: 'Data is fresh — skipping sync',
      })
    }

    // 2. Fetch and upsert player profile from Tracker.gg
    const profileData = await normalizePlayerProfile(cleanUsername, cleanPlatform)
    const player = await upsertPlayer({ ...profileData, user_id })

    // 3. Fetch and store match history from ALS
    const { matches, matchPlayers } = await normalizeMatchHistory(
      cleanUsername,
      cleanPlatform,
      player.id
    )

    const insertedMatches = await insertMatches(matches)
    await insertMatchPlayers(matchPlayers)
    await upsertSessionsFromMatches(player.id, insertedMatches)

    const matchCount = await getMatchCount(player.id)

    // 4. Fire-and-forget teammate enrichment (non-blocking)
    void fetch(`${req.nextUrl.origin}/api/players/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: player.id }),
    }).catch(() => {
      // enrichment is best-effort
    })

    return NextResponse.json({
      player,
      matchCount,
      newMatches: insertedMatches.length,
      synced: true,
    })
  } catch (err) {
    console.error('[api/players/sync]', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
