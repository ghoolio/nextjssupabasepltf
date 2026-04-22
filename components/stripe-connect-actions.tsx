'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function StripeConnectActions({
  hasStripeAccount,
  onboardingCompleted,
}: {
  hasStripeAccount: boolean
  onboardingCompleted: boolean
}) {
  const router = useRouter()
  const [loadingStart, setLoadingStart] = useState(false)
  const [loadingSync, setLoadingSync] = useState(false)
  const [error, setError] = useState('')

  async function handleStart() {
    setLoadingStart(true)
    setError('')

    try {
      const res = await fetch('/api/stripe/connect/start', {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Stripe Connect konnte nicht gestartet werden.')
      }

      window.location.href = data.url
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Stripe Connect konnte nicht gestartet werden.'
      )
      setLoadingStart(false)
    }
  }

  async function handleSync() {
    setLoadingSync(true)
    setError('')

    try {
      const res = await fetch('/api/stripe/connect/status', {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Stripe-Status konnte nicht aktualisiert werden.')
      }

      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Stripe-Status konnte nicht aktualisiert werden.'
      )
    } finally {
      setLoadingSync(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={handleStart}
        disabled={loadingStart}
        className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-60"
      >
        {loadingStart
          ? 'Lädt...'
          : hasStripeAccount
            ? onboardingCompleted
              ? 'Stripe erneut öffnen'
              : 'Onboarding fortsetzen'
            : 'Stripe verbinden'}
      </button>

      <button
        type="button"
        onClick={handleSync}
        disabled={loadingSync}
        className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-60"
      >
        {loadingSync ? 'Aktualisiert...' : 'Status aktualisieren'}
      </button>

      {error ? <div className="w-full text-sm text-red-300">{error}</div> : null}
    </div>
  )
}