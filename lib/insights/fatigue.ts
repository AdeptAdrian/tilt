/**
 * Session fatigue detector.
 *
 * Within a session, compares early-match performance vs late-match performance.
 * Flags sessions where the player's placements significantly worsen over time.
 */

import type { Match, Session } from '@/types'

// Placement delta threshold to flag a session as fatigued
const FATIGUE_PLACEMENT_DELTA = 3

export interface SessionFatigueStats {
  sessionId: string
  matchCount: number
  earlyAvgPlacement: number  // first half of session
  lateAvgPlacement: number   // second half
  placementDelta: number     // lateAvg - earlyAvg (positive = getting worse)
  isFatigued: boolean
  recommendedStopIndex: number | null // 0-based index into session matches
}

export interface FatigueContext {
  analyzedSessions: number
  fatiguedSessions: number
  worstSession: SessionFatigueStats | null
  // Average game index where performance starts dropping
  avgFatigueOnset: number | null
  recentSessions: SessionFatigueStats[]
}

export function calculateFatigue(
  sessions: Session[],
  matchesById: Map<string, Match>
): FatigueContext {
  const results: SessionFatigueStats[] = []

  for (const session of sessions) {
    const matches = session.match_ids
      .map((id) => matchesById.get(id))
      .filter((m): m is Match => m !== undefined)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    if (matches.length < 4) continue // not enough data

    const half = Math.floor(matches.length / 2)
    const early = matches.slice(0, half)
    const late = matches.slice(half)

    const earlyAvg = early.reduce((a, m) => a + m.placement, 0) / early.length
    const lateAvg = late.reduce((a, m) => a + m.placement, 0) / late.length
    const delta = lateAvg - earlyAvg
    const isFatigued = delta >= FATIGUE_PLACEMENT_DELTA

    // Find the first match index where a 3-game rolling avg starts deteriorating
    let recommendedStopIndex: number | null = null
    if (isFatigued && matches.length >= 6) {
      for (let i = 2; i < matches.length; i++) {
        const window = matches.slice(Math.max(0, i - 2), i + 1)
        const windowAvg =
          window.reduce((a, m) => a + m.placement, 0) / window.length
        if (windowAvg > earlyAvg + FATIGUE_PLACEMENT_DELTA) {
          recommendedStopIndex = i - 2
          break
        }
      }
    }

    results.push({
      sessionId: session.id,
      matchCount: matches.length,
      earlyAvgPlacement: earlyAvg,
      lateAvgPlacement: lateAvg,
      placementDelta: delta,
      isFatigued,
      recommendedStopIndex,
    })
  }

  const fatiguedSessions = results.filter((r) => r.isFatigued)

  const worstSession =
    fatiguedSessions.length > 0
      ? fatiguedSessions.reduce((a, b) =>
          b.placementDelta > a.placementDelta ? b : a
        )
      : null

  const fatigueOnsets = fatiguedSessions
    .map((s) => s.recommendedStopIndex)
    .filter((i): i is number => i !== null)

  const avgFatigueOnset =
    fatigueOnsets.length > 0
      ? fatigueOnsets.reduce((a, b) => a + b, 0) / fatigueOnsets.length
      : null

  return {
    analyzedSessions: results.length,
    fatiguedSessions: fatiguedSessions.length,
    worstSession,
    avgFatigueOnset,
    recentSessions: results.slice(0, 5),
  }
}
