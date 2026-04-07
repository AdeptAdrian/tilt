import { createSupabaseServiceClient } from './supabase-server'
import type { Player, Platform } from '@/types'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function getPlayerByUsername(
  username: string,
  platform: Platform
): Promise<Player | null> {
  const supabase = createSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .eq('platform', platform)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // no rows
      throw error
    }
    return data as Player
  } catch (err) {
    console.error('[db/players] getPlayerByUsername failed:', err)
    throw err
  }
}

export async function upsertPlayer(
  player: Omit<Player, 'id' | 'created_at'> & { user_id?: string }
): Promise<Player> {
  const supabase = createSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('players')
      .upsert(
        { ...player, cached_at: new Date().toISOString() },
        { onConflict: 'username,platform', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error) throw error
    return data as Player
  } catch (err) {
    console.error('[db/players] upsertPlayer failed:', err)
    throw err
  }
}

export function isPlayerCacheStale(player: Player): boolean {
  if (!player.cached_at) return true
  return Date.now() - new Date(player.cached_at).getTime() > CACHE_TTL_MS
}

export async function getPlayerById(id: string): Promise<Player | null> {
  const supabase = createSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data as Player
  } catch (err) {
    console.error('[db/players] getPlayerById failed:', err)
    throw err
  }
}
