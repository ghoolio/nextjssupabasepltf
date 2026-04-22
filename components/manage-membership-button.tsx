'use client'

import { useState } from 'react'

export default function ManageMembershipButton({
  creatorId,
  returnPath,
  label,
}: {
  creatorId: string
  returnPath?: string
  label?: string
}) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    try {
      setLoading(true)

      const res = await fetch('/api/stripe/membership-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId,
          returnPath: returnPath || `/channel/${creatorId}`,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Mitgliedschaft konnte nicht verwaltet werden.')
        setLoading(false)
        return
      }

      if (data.url) {
        window.location.href = data.url
        return
      }

      alert('Keine Portal-URL erhalten.')
      setLoading(false)
    } catch {
      alert('Mitgliedschaft konnte nicht verwaltet werden.')
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleClick}
      className="w-full rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-60"
    >
      {loading ? 'Öffnet...' : label || 'Mitgliedschaft verwalten'}
    </button>
  )
}