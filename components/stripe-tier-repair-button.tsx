'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function StripeTierRepairButton({
  tierId,
}: {
  tierId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRepair() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/memberships/repair-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Stripe-Reparatur fehlgeschlagen.')
      }

      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Stripe-Reparatur fehlgeschlagen.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleRepair}
        disabled={loading}
        className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-200 transition hover:bg-amber-400/20 disabled:opacity-50"
      >
        {loading ? 'Repariert...' : 'Stripe reparieren'}
      </button>

      {error ? (
        <div className="max-w-[220px] text-right text-[11px] text-red-300">
          {error}
        </div>
      ) : null}
    </div>
  )
}