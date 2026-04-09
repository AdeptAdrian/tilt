import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPlayerByUsername } from '@/lib/db/players'
import { getMatchesByPlayer, getMatchPlayersByPlayer, getRecentSessions } from '@/lib/db/matches'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Platform, Match, MatchPlayer, Session } from '@/types'

interface Props {
  params: { username: string }
  searchParams: { platform?: string }
}

function placementLabel(n: number) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

function placementVariant(n: number): 'success' | 'warning' | 'outline' {
  if (n === 1) return 'success'
  if (n <= 5) return 'warning'
  return 'outline'
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

function sessionAvgPlacement(session: Session, matchesById: Map<string, Match>) {
  const placements = session.match_ids
    .map((id) => matchesById.get(id)?.placement)
    .filter((p): p is number => p !== undefined)
  if (placements.length === 0) return null
  return (placements.reduce((a, b) => a + b, 0) / placements.length).toFixed(1)
}

export default async function MatchesPage({ params, searchParams }: Props) {
  const username = decodeURIComponent(params.username)
  const platform = (searchParams.platform ?? 'PC') as Platform

  const player = await getPlayerByUsername(username, platform)
  if (!player) notFound()

  const [matches, matchPlayers, sessions] = await Promise.all([
    getMatchesByPlayer(player.id, 100),
    getMatchPlayersByPlayer(player.id, 100),
    getRecentSessions(player.id, 20),
  ])

  const matchById = new Map<string, Match>(matches.map((m) => [m.id, m]))
  const statsByMatch = new Map<string, MatchPlayer>(
    matchPlayers.map((mp) => [mp.match_id, mp])
  )
  // Build a set of match IDs that belong to each session, for fatigue indicator
  const fatigueSessionIds = new Set<string>()
  for (const session of sessions) {
    if (session.match_ids.length >= 4) {
      const half = Math.floor(session.match_ids.length / 2)
      const sorted = session.match_ids
        .map((id) => matchById.get(id))
        .filter((m): m is Match => m !== undefined)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const earlyAvg =
        sorted.slice(0, half).reduce((a, m) => a + m.placement, 0) / half
      const lateAvg =
        sorted.slice(half).reduce((a, m) => a + m.placement, 0) / (sorted.length - half)
      if (lateAvg - earlyAvg >= 3) fatigueSessionIds.add(session.id)
    }
  }

  // Group matches by session for display
  const sessionMatchSets = new Map<string, Set<string>>()
  for (const session of sessions) {
    sessionMatchSets.set(session.id, new Set(session.match_ids))
  }

  function getSessionForMatch(matchId: string): Session | undefined {
    return sessions.find((s) => sessionMatchSets.get(s.id)?.has(matchId))
  }

  // Sort matches newest first
  const sortedMatches = [...matches].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  // Group into session blocks for rendering
  const renderedSessionIds = new Set<string>()
  const blocks: Array<{ session: Session | null; matches: Match[] }> = []

  for (const match of sortedMatches) {
    const session = getSessionForMatch(match.id)
    if (session) {
      if (!renderedSessionIds.has(session.id)) {
        renderedSessionIds.add(session.id)
        const sessionMatches = session.match_ids
          .map((id) => matchById.get(id))
          .filter((m): m is Match => m !== undefined)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        blocks.push({ session, matches: sessionMatches })
      }
    } else {
      blocks.push({ session: null, matches: [match] })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
            tilt
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <Link
            href={`/dashboard/${encodeURIComponent(username)}?platform=${platform}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {username}
          </Link>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="text-sm text-foreground">Match History</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">
            Match History
            <span className="text-muted-foreground font-normal text-base ml-2">
              ({matches.length} games)
            </span>
          </h1>
          <Link href={`/dashboard/${encodeURIComponent(username)}?platform=${platform}`}>
            <Button variant="outline" size="sm">← Dashboard</Button>
          </Link>
        </div>

        {blocks.map(({ session, matches: blockMatches }, blockIdx) => (
          <div key={blockIdx} className="space-y-2">
            {/* Session header */}
            {session && (
              <div className="flex items-center gap-3 px-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Session — {blockMatches.length} games
                </span>
                {sessionAvgPlacement(session, matchById) && (
                  <span className="text-xs text-muted-foreground">
                    avg {sessionAvgPlacement(session, matchById)} placement
                  </span>
                )}
                {fatigueSessionIds.has(session.id) && (
                  <Badge variant="warning" className="text-[10px]">Fatigue detected</Badge>
                )}
              </div>
            )}

            {/* Match rows */}
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
              {blockMatches.map((match) => {
                const stats = statsByMatch.get(match.id)
                return (
                  <div
                    key={match.id}
                    className="flex items-center gap-4 px-4 py-3 bg-card hover:bg-muted/40 transition-colors"
                  >
                    <Badge variant={placementVariant(match.placement)} className="w-10 justify-center shrink-0">
                      {placementLabel(match.placement)}
                    </Badge>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {stats?.legend && (
                          <span className="text-sm font-medium text-foreground">{stats.legend}</span>
                        )}
                        {match.map && (
                          <span className="text-xs text-muted-foreground">{match.map}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(match.date)}
                      </div>
                    </div>

                    {stats && (
                      <div className="flex items-center gap-4 text-sm text-right shrink-0">
                        <div>
                          <div className="font-medium text-foreground">{stats.kills}</div>
                          <div className="text-[10px] text-muted-foreground">kills</div>
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{stats.damage.toLocaleString()}</div>
                          <div className="text-[10px] text-muted-foreground">dmg</div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {matches.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No matches found. Try refreshing your data from the dashboard.
          </div>
        )}
      </main>
    </div>
  )
}
