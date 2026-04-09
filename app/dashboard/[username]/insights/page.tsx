import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPlayerByUsername } from '@/lib/db/players'
import { getInsightsByPlayer } from '@/lib/db/insights'
import { MarkSeenButton } from './mark-seen-button'
import { GenerateButton } from './generate-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Platform, InsightType } from '@/types'

interface Props {
  params: { username: string }
  searchParams: { platform?: string; type?: string }
}

const INSIGHT_LABELS: Record<InsightType, string> = {
  legend_chemistry: 'Legend Chemistry',
  session_fatigue:  'Session Fatigue',
  ranked_momentum:  'Ranked Momentum',
  squad_role_gap:   'Squad Role Gap',
}

const ALL_TYPES: InsightType[] = [
  'ranked_momentum',
  'session_fatigue',
  'legend_chemistry',
  'squad_role_gap',
]

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

export default async function InsightsPage({ params, searchParams }: Props) {
  const username = decodeURIComponent(params.username)
  const platform = (searchParams.platform ?? 'PC') as Platform
  const activeFilter = (searchParams.type ?? '') as InsightType | ''

  const player = await getPlayerByUsername(username, platform)
  if (!player) notFound()

  const insights = await getInsightsByPlayer(player.id)
  const filtered = activeFilter
    ? insights.filter((i) => i.type === activeFilter)
    : insights

  const unseenCount = insights.filter((i) => !i.seen).length

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
          <span className="text-sm text-foreground">Insights</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Title row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">Insights</h1>
            {unseenCount > 0 && (
              <Badge variant="default">{unseenCount} new</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unseenCount > 0 && (
              <MarkSeenButton playerId={player.id} />
            )}
            <Link href={`/dashboard/${encodeURIComponent(username)}?platform=${platform}`}>
              <Button variant="outline" size="sm">← Dashboard</Button>
            </Link>
          </div>
        </div>

        {/* Type filter tabs */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/${encodeURIComponent(username)}/insights?platform=${platform}`}
          >
            <button
              className={[
                'rounded-lg border px-3 py-1 text-xs font-medium transition-colors',
                !activeFilter
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/40',
              ].join(' ')}
            >
              All
            </button>
          </Link>
          {ALL_TYPES.map((t) => (
            <Link
              key={t}
              href={`/dashboard/${encodeURIComponent(username)}/insights?platform=${platform}&type=${t}`}
            >
              <button
                className={[
                  'rounded-lg border px-3 py-1 text-xs font-medium transition-colors',
                  activeFilter === t
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/40',
                ].join(' ')}
              >
                {INSIGHT_LABELS[t]}
              </button>
            </Link>
          ))}
        </div>

        {/* Generate new insight buttons */}
        <div className="flex flex-wrap gap-2">
          {ALL_TYPES.map((t) => (
            <GenerateButton key={t} playerId={player.id} type={t} label={INSIGHT_LABELS[t]} />
          ))}
        </div>

        <Separator />

        {/* Insight list */}
        <div className="space-y-3">
          {filtered.map((insight) => (
            <div
              key={insight.id}
              className={[
                'rounded-xl border p-4 space-y-2 transition-colors',
                !insight.seen ? 'border-ring/40 bg-ring/5' : 'border-border bg-card',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {INSIGHT_LABELS[insight.type]}
                  </Badge>
                  {!insight.seen && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">New</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDate(insight.generated_at)}
                </span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{insight.content}</p>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {activeFilter
                ? `No ${INSIGHT_LABELS[activeFilter]} insights yet. Click Generate above.`
                : 'No insights yet. Click Generate above to create your first insight.'}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
