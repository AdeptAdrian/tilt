import { createSupabaseServiceClient } from './supabase-server'
import type { Insight, InsightType } from '@/types'

export async function getInsightsByPlayer(playerId: string): Promise<Insight[]> {
  const supabase = createSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('insights')
      .select('*')
      .eq('player_id', playerId)
      .order('generated_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as Insight[]
  } catch (err) {
    console.error('[db/insights] getInsightsByPlayer failed:', err)
    throw err
  }
}

export async function getUnseenInsights(playerId: string): Promise<Insight[]> {
  const supabase = createSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('insights')
      .select('*')
      .eq('player_id', playerId)
      .eq('seen', false)
      .order('generated_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as Insight[]
  } catch (err) {
    console.error('[db/insights] getUnseenInsights failed:', err)
    throw err
  }
}

/** Returns the most recent insight of a given type for a player. */
export async function getLatestInsightByType(
  playerId: string,
  type: InsightType
): Promise<Insight | null> {
  const supabase = createSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('insights')
      .select('*')
      .eq('player_id', playerId)
      .eq('type', type)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data as Insight
  } catch (err) {
    console.error('[db/insights] getLatestInsightByType failed:', err)
    throw err
  }
}

export async function upsertInsight(
  insight: Omit<Insight, 'id' | 'generated_at' | 'seen'>
): Promise<Insight> {
  const supabase = createSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('insights')
      .insert({
        ...insight,
        generated_at: new Date().toISOString(),
        seen: false,
      })
      .select()
      .single()

    if (error) throw error
    return data as Insight
  } catch (err) {
    console.error('[db/insights] upsertInsight failed:', err)
    throw err
  }
}

export async function markInsightSeen(insightId: string): Promise<void> {
  const supabase = createSupabaseServiceClient()
  try {
    const { error } = await supabase
      .from('insights')
      .update({ seen: true })
      .eq('id', insightId)

    if (error) throw error
  } catch (err) {
    console.error('[db/insights] markInsightSeen failed:', err)
    throw err
  }
}

export async function markAllInsightsSeen(playerId: string): Promise<void> {
  const supabase = createSupabaseServiceClient()
  try {
    const { error } = await supabase
      .from('insights')
      .update({ seen: true })
      .eq('player_id', playerId)
      .eq('seen', false)

    if (error) throw error
  } catch (err) {
    console.error('[db/insights] markAllInsightsSeen failed:', err)
    throw err
  }
}
