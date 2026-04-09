'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { Platform } from '@/types'

interface Props {
  username: string
  platform: Platform
}

export function RefreshButton({ username, platform }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRefresh() {
    setLoading(true)
    try {
      await fetch('/api/players/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, platform }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
      {loading ? 'Refreshing…' : 'Refresh data'}
    </Button>
  )
}
