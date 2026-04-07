import { createSupabaseServiceClient } from './supabase-server'
import type { Match, MatchPlayer, Session } from '@/types'

// ============================================================
// Matches
// ============================================================

export async function getMatchesByPlayer(
  playerId: string,
  limit = 50
): Promise<Match[]> {
  const supabase = createSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('player_id', playerId)
      .order('date', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data ?? []) as Match[]
  } catch (err) {
    console.error('[db/matches] getMatchesByPlayer failed:', err)
    throw err
  }
}

/** Inserts new matches, ignoring duplicates (match_id + player_id conflict). */
export async function insertMatches(
  matches: Omit<Match, 'id' | 'created_at'>[]
): Promise<Match[]> {
  if (matches.length === 0) return []
  const supabase = createSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('matches')
      .upsert(matches, { onConflict: 'match_id,player_id', ignoreDuplicates: true })
      .select()

    if (error) throw error
    return (data ?? []) as Match[]
  } catch (err) {
    console.error('[db/matches] insertMatches failed:', err)
    throw err
  }
}

export async function getMatchCount(playerId: string): Promise<number> {
  const supabase = createSupabaseServiceClient()
  try {
    const { count, error } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', playerId)

    if (error) throw error
    return count ?? 0
  } catch (err) {
    console.error('[db/matches] getMatchCount failed:', err)
    throw err
  }
}

// ============================================================
// Match players (per-legend stats)
// ============================================================

export async function getMatchPlayersByMatch(matchId: string): Promise<MatchPlayer[]> {
  const supabase = createSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('match_players')
      .select('*')
      .eq('match_id', matchId)

    if (error) throw error
    return (data ?? []) as MatchPlayer[]
  } catch (err) {
    console.error('[db/matches] getMatchPlayersByMatch failed:', err)
    throw err
  }
}

export async function getMatchPlayersByPlayer(
  playerId: string,
  limit = 100
): Promise<MatchPlayer[]> {
  const supabase = createSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('match_players')
      .select('*')
      .eq('player_id', playerId)
      .limit(limit)

    if (error) throw error
    return (data ?? []) as MatchPlayer[]
  } catch (err) {
    console.error('[db/matches] getMatchPlayersByPlayer failed:', err)
    throw err
  }
}

export async function insertMatchPlayers(
  entries: Omit<MatchPlayer, 'id' | 'created_at'>[]
): Promise<void> {
  if (entries.length === 0) return
  const supabase = createSupabaseServiceClient()
  try {
    const { error } = await supabase
      .from('match_players')
      .upsert(entries, { onConflict: 'match_id,player_id', ignoreDuplicates: true })

    if (error) throw error
  } catch (err) {
    console.error('[db/matches] insertMatchPlayers failed:', err)
    throw err
  }
}

// ============================================================
// Sessions
// ============================================================

const SESSION_GAP_MS = 2 * 60 * 60 * 1000 // 2-hour gap = new session

/**
 * Groups an ordered (newest-first) list of matches into session records
 * and upserts them. Returns the created/updated sessions.
 */
export async function upsertSessionsFromMatches(
  playerId: string,
  matches: Match[]
): Promise<Session[]> {
  if (matches.length === 0) return []

  // Sort ascending for grouping
  const sorted = [...matches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const groups: Match[][] = []
  let current: Match[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const gap =
      new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()
    if (gap > SESSION_GAP_MS) {
      groups.push(current)
      current = []
    }
    current.push(sorted[i])
  }
  groups.push(current)

  const sessionRows = groups.map((group) => ({
    player_id: playerId,
    started_at: group[0].date,
    ended_at: group[group.length - 1].date,
    match_ids: group.map((m) => m.id),
  }))

  const supabase = createSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('sessions')
      .upsert(sessionRows, { onConflict: 'player_id,started_at' as never })
      .select()

    if (error) throw error
    return (data ?? []) as Session[]
  } catch (err) {
    console.error('[db/matches] upsertSessionsFromMatches failed:', err)
    throw err
  }
}

export async function getRecentSessions(
  playerId: string,
  limit = 10
): Promise<Session[]> {
  const supabase = createSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('player_id', playerId)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data ?? []) as Session[]
  } catch (err) {
    console.error('[db/matches] getRecentSessions failed:', err)
    throw err
  }
}
