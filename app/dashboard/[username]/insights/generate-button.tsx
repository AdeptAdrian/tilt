'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { InsightType } from '@/types'

interface Props {
  playerId: string
  type: InsightType
  label: string
}

export function GenerateButton({ playerId, type, label }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/insights/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, type }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Generation failed')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="outline"
        size="xs"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? `Generating…` : `↻ ${label}`}
      </Button>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  )
}
