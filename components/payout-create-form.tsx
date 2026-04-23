'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Candidate = {
  creatorId: string
  username: string | null
  displayName: string | null
  grossCents: number
  feeCents: number
  netCents: number
}

function toIsoStartOfDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString()
}

function toIsoNextStartOfDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString()
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

export default function PayoutCreateForm() {
  const router = useRouter()

  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [creatorId, setCreatorId] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.creatorId === creatorId) ?? null,
    [candidates, creatorId]
  )

  useEffect(() => {
    async function loadCandidates() {
      setError(null)
      setSuccess(null)

      if (!periodStart || !periodEnd) {
        setCandidates([])
        setCreatorId('')
        return
      }

      const startIso = toIsoStartOfDay(periodStart)
      const endIsoExclusive = toIsoNextStartOfDay(periodEnd)

      if (new Date(startIso).getTime() >= new Date(endIsoExclusive).getTime()) {
        setCandidates([])
        setCreatorId('')
        return
      }

      setLoadingCandidates(true)

      try {
        const params = new URLSearchParams({
          periodStart: startIso,
          periodEnd: endIsoExclusive,
        })

        const res = await fetch(`/api/platform/payouts/candidates?${params.toString()}`)
        const data = await res.json().catch(() => null)

        if (!res.ok) {
          setError(data?.error || 'Kandidaten konnten nicht geladen werden.')
          setCandidates([])
          setCreatorId('')
          return
        }

        const nextCandidates = (data?.candidates ?? []) as Candidate[]
        setCandidates(nextCandidates)
        setCreatorId((current) =>
          nextCandidates.some((candidate) => candidate.creatorId === current)
            ? current
            : nextCandidates[0]?.creatorId ?? ''
        )
      } finally {
        setLoadingCandidates(false)
      }
    }

    void loadCandidates()
  }, [periodStart, periodEnd])

  async function onSubmit() {
    setError(null)
    setSuccess(null)

    if (!creatorId) {
      setError('Bitte einen Creator mit Umsatz auswählen.')
      return
    }

    if (!periodStart || !periodEnd) {
      setError('Bitte Start- und Enddatum setzen.')
      return
    }

    const startIso = toIsoStartOfDay(periodStart)
    const endIsoExclusive = toIsoNextStartOfDay(periodEnd)

    if (new Date(startIso).getTime() >= new Date(endIsoExclusive).getTime()) {
      setError('Der Zeitraum ist ungültig.')
      return
    }

    const res = await fetch('/api/platform/payouts/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creatorId,
        periodStart: startIso,
        periodEnd: endIsoExclusive,
        notes,
      }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setError(data?.error || 'Payout konnte nicht erstellt werden.')
      return
    }

    setSuccess('Payout wurde erstellt.')
    setNotes('')

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 text-sm font-medium text-white">Payout erstellen</div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input
          type="date"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
        />

        <input
          type="date"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
        />

        <select
          value={creatorId}
          onChange={(e) => setCreatorId(e.target.value)}
          disabled={loadingCandidates || candidates.length === 0}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none disabled:opacity-60"
        >
          {loadingCandidates ? (
            <option value="">Creator werden geladen...</option>
          ) : candidates.length > 0 ? (
            candidates.map((candidate) => (
              <option key={candidate.creatorId} value={candidate.creatorId}>
                {candidate.displayName || candidate.username || candidate.creatorId}
                {candidate.username ? ` (@${candidate.username})` : ''}
              </option>
            ))
          ) : (
            <option value="">Keine Creator mit Umsatz</option>
          )}
        </select>

        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optionale Notiz"
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
        />
      </div>

      {selectedCandidate ? (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs uppercase tracking-wide text-white/40">Brutto</div>
            <div className="mt-1 text-sm font-medium text-white">
              {formatMoney(selectedCandidate.grossCents)}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs uppercase tracking-wide text-white/40">Gebühr</div>
            <div className="mt-1 text-sm font-medium text-white">
              {formatMoney(selectedCandidate.feeCents)}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs uppercase tracking-wide text-white/40">Netto</div>
            <div className="mt-1 text-sm font-medium text-white">
              {formatMoney(selectedCandidate.netCents)}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending || loadingCandidates || !creatorId}
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? 'Erstellt...' : 'Payout erzeugen'}
        </button>

        {error ? <div className="text-sm text-red-300">{error}</div> : null}
        {success ? <div className="text-sm text-emerald-300">{success}</div> : null}
      </div>
    </div>
  )
}