'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Platform } from '@/types'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'PC', label: 'PC' },
  { value: 'PS4', label: 'PlayStation' },
  { value: 'X1', label: 'Xbox' },
  { value: 'Switch', label: 'Switch' },
]

export default function Home() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [platform, setPlatform] = useState<Platform>('PC')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/players/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), platform }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Sync failed')
      }

      router.push(`/dashboard/${encodeURIComponent(username.trim())}?platform=${platform}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / wordmark */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">tilt</h1>
          <p className="text-muted-foreground text-sm">
            Apex Legends ranked coaching — built for you
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPlatform(p.value)}
                className={[
                  'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                  platform === p.value
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-muted-foreground hover:border-foreground/40',
                ].join(' ')}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Input
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading || !username.trim()}
          >
            {loading ? 'Loading…' : 'View Dashboard'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Data sourced from Tracker.gg and ApexLegendsStatus
        </p>
      </div>
    </div>
  )
}
