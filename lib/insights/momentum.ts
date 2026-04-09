/**
 * Ranked momentum tracker.
 *
 * Analyzes placement trends over recent matches to detect positive/negative
 * momentum and tilt streaks (consecutive bad games).
 *
 * NOTE: ALS does not return LP deltas directly. We approximate momentum
 * from placement outcomes: placement ≤ 5 = positive, > 5 = negative.
 */

import type { Match } from '@/types'

// Placement threshold for a "positive" ranked outcome
const POSITIVE_PLACEMENT_THRESHOLD = 5
// Consecutive negative outcomes to flag a tilt streak
const TILT_STREAK_THRESHOLD = 3

export type TrendDirection = 'improving' | 'declining' | 'stable'

export interface MomentumContext {
  totalAnalyzed: number
  recentPlacements: number[]       // last 10 placements, newest first
  avgPlacement10: number           // rolling avg over last 10
  avgPlacement20: number | null    // rolling avg over last 20 (null if < 20 matches)
  trend: TrendDirection
  tiltStreak: number               // current consecutive negative outcomes
  isTilting: boolean
  positiveRate: number             // 0–1, fraction of matches with placement ≤ 5
}

export function calculateMomentum(
  matches: Match[] // should be sorted newest-first
): MomentumContext | null {
  if (matches.length < 5) return null

  const sorted = [...matches].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const recent10 = sorted.slice(0, 10)
  const recent20 = sorted.slice(0, 20)
  const recentPlacements = recent10.map((m) => m.placement)

  const avg10 =
    recent10.reduce((a, m) => a + m.placement, 0) / recent10.length
  const avg20 =
    sorted.length >= 20
      ? recent20.reduce((a, m) => a + m.placement, 0) / recent20.length
      : null

  // Trend: compare first half vs second half of last 10
  let trend: TrendDirection = 'stable'
  if (recent10.length >= 6) {
    const half = Math.floor(recent10.length / 2)
    const recentHalf = recent10.slice(0, half)   // newer
    const olderHalf = recent10.slice(half)         // older
    const recentAvg =
      recentHalf.reduce((a, m) => a + m.placement, 0) / recentHalf.length
    const olderAvg =
      olderHalf.reduce((a, m) => a + m.placement, 0) / olderHalf.length
    const delta = recentAvg - olderAvg
    if (delta <= -2) trend = 'improving'     // placements going down = better
    else if (delta >= 2) trend = 'declining'
  }

  // Tilt streak: count consecutive negative outcomes from most recent
  let tiltStreak = 0
  for (const match of sorted) {
    if (match.placement > POSITIVE_PLACEMENT_THRESHOLD) {
      tiltStreak++
    } else {
      break
    }
  }

  const positiveCount = recent10.filter(
    (m) => m.placement <= POSITIVE_PLACEMENT_THRESHOLD
  ).length
  const positiveRate = positiveCount / recent10.length

  return {
    totalAnalyzed: sorted.length,
    recentPlacements,
    avgPlacement10: avg10,
    avgPlacement20: avg20,
    trend,
    tiltStreak,
    isTilting: tiltStreak >= TILT_STREAK_THRESHOLD,
    positiveRate,
  }
}
