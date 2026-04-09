import { NextRequest, NextResponse } from 'next/server'
import { markAllInsightsSeen, markInsightSeen } from '@/lib/db/insights'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { player_id, insight_id } = body as {
    player_id?: string
    insight_id?: string
  }

  try {
    if (insight_id) {
      await markInsightSeen(insight_id)
    } else if (player_id) {
      await markAllInsightsSeen(player_id)
    } else {
      return NextResponse.json(
        { error: 'player_id or insight_id is required' },
        { status: 400 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/insights/mark-seen]', err)
    return NextResponse.json({ error: 'Failed to mark seen' }, { status: 500 })
  }
}
