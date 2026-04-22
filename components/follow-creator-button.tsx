'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function FollowCreatorButton({
  creatorId,
  initialFollowing,
}: {
  creatorId: string
  initialFollowing: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [following, setFollowing] = useState(initialFollowing)

  async function handleClick() {
    try {
      setLoading(true)

      const res = await fetch('/api/follows/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Follow-Status konnte nicht geändert werden.')
        setLoading(false)
        return
      }

      setFollowing(Boolean(data.following))
      router.refresh()
    } catch {
      alert('Follow-Status konnte nicht geändert werden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
        following
          ? 'border border-white/10 text-white hover:bg-white/10'
          : 'bg-white text-black hover:opacity-90'
      }`}
    >
      {loading ? 'Lädt...' : following ? 'Gefolgt' : 'Folgen'}
    </button>
  )
}