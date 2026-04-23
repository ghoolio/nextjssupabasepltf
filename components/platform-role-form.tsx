'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type PlatformRole = 'user' | 'support_admin' | 'finance_admin' | 'platform_admin'

type PlatformRoleFormProps = {
  userId: string
  currentRole: PlatformRole
}

const ROLE_LABELS: Record<PlatformRole, string> = {
  user: 'User',
  support_admin: 'Support Admin',
  finance_admin: 'Finance Admin',
  platform_admin: 'Platform Admin',
}

export default function PlatformRoleForm({
  userId,
  currentRole,
}: PlatformRoleFormProps) {
  const router = useRouter()
  const [role, setRole] = useState<PlatformRole>(currentRole)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function onSubmit(formData: FormData) {
    const nextRole = formData.get('platformRole')

    if (
      nextRole !== 'user' &&
      nextRole !== 'support_admin' &&
      nextRole !== 'finance_admin' &&
      nextRole !== 'platform_admin'
    ) {
      setError('Ungültige Rolle.')
      setSuccess(null)
      return
    }

    setError(null)
    setSuccess(null)

    const res = await fetch('/api/platform/admins/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, platformRole: nextRole }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setError(data?.error || 'Rolle konnte nicht aktualisiert werden.')
      setSuccess(null)
      return
    }

    setRole(nextRole)
    setSuccess('Rolle aktualisiert.')

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <form
      action={onSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"
    >
      <div className="text-sm font-medium text-white">Rolle setzen</div>

      <select
        name="platformRole"
        value={role}
        onChange={(e) => setRole(e.target.value as PlatformRole)}
        className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
      >
        {Object.entries(ROLE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? 'Speichert...' : 'Rolle speichern'}
      </button>

      {error ? <div className="text-sm text-red-300">{error}</div> : null}
      {success ? <div className="text-sm text-emerald-300">{success}</div> : null}
    </form>
  )
}