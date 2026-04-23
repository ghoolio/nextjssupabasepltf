'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type PayoutStatus = 'pending' | 'paid_out' | 'on_hold'

type PayoutStatusFormProps = {
  payoutId: string
  currentStatus: PayoutStatus
  currentNotes: string | null
}

export default function PayoutStatusForm({
  payoutId,
  currentStatus,
  currentNotes,
}: PayoutStatusFormProps) {
  const router = useRouter()
  const [status, setStatus] = useState<PayoutStatus>(currentStatus)
  const [notes, setNotes] = useState(currentNotes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function onSubmit() {
    setError(null)
    setSuccess(null)

    const res = await fetch('/api/platform/payouts/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payoutId, status, notes }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setError(data?.error || 'Payout konnte nicht aktualisiert werden.')
      return
    }

    setSuccess('Payout aktualisiert.')

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="flex min-w-[260px] flex-col gap-2">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as PayoutStatus)}
        className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
      >
        <option value="pending">pending</option>
        <option value="paid_out">paid_out</option>
        <option value="on_hold">on_hold</option>
      </select>

      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notiz"
        className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
      />

      <button
        type="button"
        onClick={onSubmit}
        disabled={isPending}
        className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? 'Speichert...' : 'Speichern'}
      </button>

      {error ? <div className="text-xs text-red-300">{error}</div> : null}
      {success ? <div className="text-xs text-emerald-300">{success}</div> : null}
    </div>
  )
}