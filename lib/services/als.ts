/**
 * ApexLegendsStatus (mozambiquehe.re) API service
 * Used for match history and legend data.
 */

import type { Platform, Match, MatchPlayer } from '@/types'

const BASE_URL = 'https://api.mozambiquehe.re'

const PLATFORM_MAP: Record<Platform, string> = {
  PC: 'PC',
  PS4: 'PS4',
  X1: 'X1',
  Switch: 'Switch',
}

// ---- ALS response shapes (partial) ----------------------------------------

interface ALSGamePlayer {
  nucleusHash?: string
  handle?: string
  character?: string
  characterHash?: string
  kills?: number
  damage_done?: number
  assists?: number
  time_survived?: number // seconds
}

interface ALSGame {
  gameId?: string
  timestamp?: number // unix seconds
  currentSeason?: number
  map?: string
  game_length?: number
  placement?: number
  teams?: {
    players?: ALSGamePlayer[]
  }[]
  ownPlayer?: ALSGamePlayer
}

interface ALSGamesResponse {
  games?: ALSGame[]
}

// ---- Internal fetch -------------------------------------------------------

async function alsFetch(path: string): Promise<Response> {
  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set('auth', process.env.ALS_API_KEY!)
  const res = await fetch(url.toString(), {
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    throw new Error(`ALS API error: ${res.status} ${res.statusText}`)
  }
  return res
}

// ---- Public API -----------------------------------------------------------

export async function getPlayerBridge(username: string, platform: Platform) {
  const res = await alsFetch(
    `/bridge?player=${encodeURIComponent(username)}&platform=${PLATFORM_MAP[platform]}`
  )
  return res.json()
}

export async function getMatchHistory(
  username: string,
  platform: Platform
): Promise<ALSGamesResponse> {
  const res = await alsFetch(
    `/games?player=${encodeURIComponent(username)}&platform=${PLATFORM_MAP[platform]}`
  )
  return res.json()
}

// ---- Normalization --------------------------------------------------------

export interface NormalizedMatchHistory {
  matches: Omit<Match, 'id' | 'created_at'>[]
  matchPlayers: Omit<MatchPlayer, 'id' | 'created_at'>[]
}

/**
 * Fetches and normalizes ALS match history for a player.
 * Returns flat arrays ready for DB insertion.
 * `playerId` is the Supabase player UUID.
 */
export async function normalizeMatchHistory(
  username: string,
  platform: Platform,
  playerId: string
): Promise<NormalizedMatchHistory> {
  const response = await getMatchHistory(username, platform)
  const games = response.games ?? []

  const matches: Omit<Match, 'id' | 'created_at'>[] = []
  const matchPlayers: Omit<MatchPlayer, 'id' | 'created_at'>[] = []

  for (const game of games) {
    const matchId = game.gameId ?? `${game.timestamp}-${playerId}`
    const date = game.timestamp
      ? new Date(game.timestamp * 1000).toISOString()
      : new Date().toISOString()

    matches.push({
      match_id: matchId,
      player_id: playerId,
      date,
      placement: game.placement ?? 0,
      map: game.map ?? null,
      game_mode: null, // ALS does not expose game mode in free tier
    })

    // Own player stats
    const own = game.ownPlayer
    if (own) {
      matchPlayers.push({
        match_id: matchId,
        player_id: playerId,
        legend: own.character ?? 'Unknown',
        kills: own.kills ?? 0,
        damage: own.damage_done ?? 0,
        assists: own.assists ?? null,
        survived_time: own.time_survived ?? null,
      })
    }
  }

  return { matches, matchPlayers }
}
