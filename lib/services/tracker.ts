/**
 * Tracker.gg API service
 * All calls are cached in Supabase — never hit Tracker.gg twice for the same player within 24 hours.
 * Rate limit: respect the free tier (10 req/s, 1000 req/day).
 */

import type { Platform, RankTier, Player } from '@/types'

const BASE_URL = 'https://public-api.tracker.gg/v2/apex/standard'

// ---- Tracker.gg response shapes (partial) --------------------------------

interface TrackerSegment {
  type: string
  metadata: { name: string }
  stats: Record<string, { value: number; displayValue: string } | undefined>
}

interface TrackerProfileResponse {
  data: {
    platformInfo: { platformUserHandle: string; platformSlug: string }
    segments: TrackerSegment[]
  }
}

// ---- Internal fetch -------------------------------------------------------

async function trackerFetch(path: string): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'TRN-Api-Key': process.env.TRACKER_GG_API_KEY!,
    },
    next: { revalidate: 0 }, // caching handled manually in Supabase
  })
  if (!res.ok) {
    throw new Error(`Tracker.gg API error: ${res.status} ${res.statusText}`)
  }
  return res
}

// ---- Rank normalization ---------------------------------------------------

const RANK_TIER_MAP: Record<string, RankTier> = {
  rookie: 'Rookie',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  master: 'Master',
  predator: 'Predator',
}

function parseRankTier(displayValue: string): RankTier | null {
  const lower = displayValue.toLowerCase()
  for (const key of Object.keys(RANK_TIER_MAP)) {
    if (lower.includes(key)) return RANK_TIER_MAP[key]
  }
  return null
}

// ---- Public API -----------------------------------------------------------

export async function getPlayerProfile(
  username: string,
  platform: Platform
): Promise<TrackerProfileResponse> {
  const encoded = encodeURIComponent(username)
  const res = await trackerFetch(`/profile/${platform}/${encoded}`)
  return res.json()
}

/**
 * Fetches and normalizes a Tracker.gg profile into a partial Player record.
 * Does not include `id`, `created_at`, or `cached_at` — those are set by the DB layer.
 */
export async function normalizePlayerProfile(
  username: string,
  platform: Platform
): Promise<Omit<Player, 'id' | 'created_at' | 'cached_at'>> {
  const profile = await getPlayerProfile(username, platform)

  const overview = profile.data.segments.find((s) => s.type === 'overview')

  const rankScoreDisplay =
    overview?.stats['rankScore']?.displayValue ?? ''
  const rankTier = parseRankTier(rankScoreDisplay)
  const rankLp = overview?.stats['rankScore']?.value ?? null

  return {
    username: profile.data.platformInfo.platformUserHandle || username,
    platform,
    rank_tier: rankTier,
    rank_lp: rankLp != null ? Math.round(rankLp) : null,
  }
}
