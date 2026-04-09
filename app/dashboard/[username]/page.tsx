import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPlayerByUsername } from '@/lib/db/players'
import { getMatchCount, getRecentSessions } from '@/lib/db/matches'
import { getUnseenInsights, getLatestInsightByType } from '@/lib/db/insights'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { RefreshButton } from './refresh-button'
import type { Platform, InsightType } from '@/types'

const RANK_COLORS: Record<string, string> = {
  Rookie:   'text-zinc-400',
  Bronze:   'text-amber-700',
  Silver:   'text-zinc-300',
  Gold:     'text-yellow-400',
  Platinum: 'text-cyan-400',
  Diamond:  'text-blue-400',
  Master:   'text-purple-400',
  Predator: 'text-red-500',
}

const INSIGHT_LABELS: Record<InsightType, string> = {
  legend_chemistry: 'Legend Chemistry',
  session_fatigue:  'Session Fatigue',
  ranked_momentum:  'Ranked Momentum',
  squad_role_gap:   'Squad Role Gap',
}

const INSIGHT_DESCRIPTIONS: Record<InsightType, string> = {
  legend_chemistry: 'Which legends perform best for you',
  session_fatigue:  'When your performance drops in a session',
  ranked_momentum:  'LP trend and tilt risk',
  squad_role_gap:   'Role coverage gaps in your squads',
}

const ALL_INSIGHT_TYPES: InsightType[] = [
  'ranked_momentum',
  'session_fatigue',
  'legend_chemistry',
  'squad_role_gap',
]

interface Props {
  params: { username: string }
  searchParams: { platform?: string }
}

export default async function DashboardPage({ params, searchParams }: Props) {
  const username = decodeURIComponent(params.username)
  const platform = (searchParams.platform ?? 'PC') as Platform

  const player = await getPlayerByUsername(username, platform)
  if (!player) notFound()

  const [matchCount, sessions, unseenInsights, ...latestInsights] = await Promise.all([
    getMatchCount(player.id),
    getRecentSessions(player.id, 5),
    getUnseenInsights(player.id),
    ...ALL_INSIGHT_TYPES.map((t) => getLatestInsightByType(player.id, t)),
  ])

  const rankColor = player.rank_tier ? RANK_COLORS[player.rank_tier] ?? '' : ''
  const lastSession = sessions[0]
  const lastSessionMatchCount = lastSession?.match_ids.length ?? 0

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
            tilt
          </Link>
          <RefreshButton username={username} platform={platform} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Player hero */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{player.username}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{player.platform}</Badge>
              {player.rank_tier && (
                <span className={`text-sm font-medium ${rankColor}`}>
                  {player.rank_tier}
                  {player.rank_lp != null && (
                    <span className="text-muted-foreground font-normal ml-1">
                      {player.rank_lp.toLocaleString()} LP
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground space-y-0.5">
            <div>{matchCount} matches tracked</div>
            {lastSession && (
              <div>Last session: {lastSessionMatchCount} games</div>
            )}
          </div>
        </div>

        <Separator />

        {/* Unseen insights banner */}
        {unseenInsights.length > 0 && (
          <div className="rounded-lg border border-ring/30 bg-ring/5 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-foreground">
              {unseenInsights.length} new insight{unseenInsights.length > 1 ? 's' : ''} since your last visit
            </span>
            <Link href={`/dashboard/${encodeURIComponent(username)}/insights?platform=${platform}`}>
              <Button variant="outline" size="sm">View all</Button>
            </Link>
          </div>
        )}

        {/* Insight cards grid */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Insights
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ALL_INSIGHT_TYPES.map((type, i) => {
              const insight = latestInsights[i]
              return (
                <Card key={type} className={insight && !insight.seen ? 'border-ring/40' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{INSIGHT_LABELS[type]}</CardTitle>
                      {insight && !insight.seen && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">New</Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      {INSIGHT_DESCRIPTIONS[type]}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {insight ? (
                      <p className="text-sm text-foreground leading-relaxed line-clamp-4">
                        {insight.content}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        {matchCount < 5
                          ? 'Play more ranked games to unlock this insight'
                          : 'Not yet generated — refresh to generate'}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        <Separator />

        {/* Quick nav */}
        <div className="flex gap-3">
          <Link href={`/dashboard/${encodeURIComponent(username)}/matches?platform=${platform}`}>
            <Button variant="outline" size="sm">Match History</Button>
          </Link>
          <Link href={`/dashboard/${encodeURIComponent(username)}/insights?platform=${platform}`}>
            <Button variant="outline" size="sm">All Insights</Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
