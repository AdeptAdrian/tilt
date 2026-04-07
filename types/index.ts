export type Platform = 'PC' | 'PS4' | 'X1' | 'Switch'

export type RankTier =
  | 'Rookie'
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Diamond'
  | 'Master'
  | 'Predator'

export interface Player {
  id: string
  username: string
  platform: Platform
  rank_tier: RankTier | null
  rank_lp: number | null
  cached_at: string | null
  created_at: string
}

export interface Match {
  id: string
  match_id: string
  player_id: string
  date: string
  placement: number
  map: string | null
  game_mode: string | null
}

export interface MatchPlayer {
  id: string
  match_id: string
  player_id: string
  legend: string
  kills: number
  damage: number
  assists: number | null
  survived_time: number | null
}

export interface Session {
  id: string
  player_id: string
  started_at: string
  ended_at: string | null
  match_ids: string[]
}

export type InsightType =
  | 'legend_chemistry'
  | 'session_fatigue'
  | 'ranked_momentum'
  | 'squad_role_gap'

export interface Insight {
  id: string
  player_id: string
  type: InsightType
  content: string
  generated_at: string
  seen: boolean
}
