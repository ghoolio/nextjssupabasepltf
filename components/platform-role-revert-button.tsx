'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type PlatformRoleRevertButtonProps = {
  auditLogId: string
  previousRole: string
}

export default function PlatformRoleRevertButton({
  auditLogId,
  previousRole,
}: PlatformRoleRevertButtonProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function onClick() {
    setError(null)

    const res = await fetch('/api/platform/admins/revert-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditLogId }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setError(data?.error || 'Rolle konnte nicht zurückgesetzt werden.')
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/10 disabled:opacity-60"
      >
        {isPending ? 'Setzt zurück...' : `Zurück auf ${previousRole}`}
      </button>

      {error ? <div className="text-xs text-red-300">{error}</div> : null}
    </div>
  )
}