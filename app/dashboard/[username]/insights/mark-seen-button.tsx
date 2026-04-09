'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function MarkSeenButton({ playerId }: { playerId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleMarkAll() {
    setLoading(true)
    try {
      await fetch('/api/insights/mark-seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleMarkAll} disabled={loading}>
      {loading ? 'Marking…' : 'Mark all seen'}
    </Button>
  )
}
