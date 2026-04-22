'use client'

import { useState } from 'react'

export default function JoinMembershipButton({
  tierId,
  label,
}: {
  tierId: string
  label?: string
}) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    try {
      setLoading(true)

      const res = await fetch('/api/stripe/membership-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Checkout konnte nicht gestartet werden.')
        setLoading(false)
        return
      }

      if (data.url) {
        window.location.href = data.url
        return
      }

      alert('Keine Checkout-URL erhalten.')
      setLoading(false)
    } catch {
      alert('Checkout konnte nicht gestartet werden.')
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleClick}
      className="w-full rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-60"
    >
      {loading ? 'Weiter zu Stripe...' : label || 'Mitglied werden'}
    </button>
  )
}