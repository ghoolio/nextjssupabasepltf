'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type PayoutCancelButtonProps = {
  payoutId: string
}

export default function PayoutCancelButton({
  payoutId,
}: PayoutCancelButtonProps) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function onCancel() {
    setError(null)
    setSuccess(null)

    const confirmed = window.confirm(
      'Dieses Payout wird storniert und alle gebundenen Posten werden wieder freigegeben. Fortfahren?'
    )

    if (!confirmed) return

    const res = await fetch('/api/platform/payouts/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payoutId, reason }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setError(data?.error || 'Payout konnte nicht storniert werden.')
      return
    }

    setSuccess('Payout wurde storniert.')

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="flex min-w-[260px] flex-col gap-2">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Storno-Grund"
        className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
      />

      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        className="rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? 'Storniert...' : 'Payout stornieren'}
      </button>

      {error ? <div className="text-xs text-red-300">{error}</div> : null}
      {success ? <div className="text-xs text-emerald-300">{success}</div> : null}
    </div>
  )
}