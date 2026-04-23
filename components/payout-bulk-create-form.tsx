'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type PreviewSummary = {
  creatorCountWithRevenue: number
  creatableCount: number
  skippedExistingCount: number
  skippedEmptyCount: number
  grossCents: number
  feeCents: number
  netCents: number
}

type PreviewCreator = {
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

export default function PayoutBulkCreateForm() {
  const router = useRouter()
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState<PreviewSummary | null>(null)
  const [topCreators, setTopCreators] = useState<PreviewCreator[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    async function loadPreview() {
      setError(null)
      setSuccess(null)

      if (!periodStart || !periodEnd) {
        setPreview(null)
        setTopCreators([])
        return
      }

      const startIso = toIsoStartOfDay(periodStart)
      const endIsoExclusive = toIsoNextStartOfDay(periodEnd)

      if (new Date(startIso).getTime() >= new Date(endIsoExclusive).getTime()) {
        setPreview(null)
        setTopCreators([])
        return
      }

      setLoadingPreview(true)

      try {
        const params = new URLSearchParams({
          periodStart: startIso,
          periodEnd: endIsoExclusive,
        })

        const res = await fetch(`/api/platform/payouts/preview-bulk?${params.toString()}`)
        const data = await res.json().catch(() => null)

        if (!res.ok) {
          setError(data?.error || 'Bulk-Vorschau konnte nicht geladen werden.')
          setPreview(null)
          setTopCreators([])
          return
        }

        setPreview((data?.summary ?? null) as PreviewSummary | null)
        setTopCreators((data?.topCreators ?? []) as PreviewCreator[])
      } finally {
        setLoadingPreview(false)
      }
    }

    void loadPreview()
  }, [periodStart, periodEnd])

  async function onSubmit() {
    setError(null)
    setSuccess(null)

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

    const res = await fetch('/api/platform/payouts/create-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodStart: startIso,
        periodEnd: endIsoExclusive,
        notes,
      }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setError(data?.error || 'Bulk-Payouts konnten nicht erstellt werden.')
      return
    }

    setSuccess(
      `Erstellt: ${data?.createdCount ?? 0}, übersprungen vorhanden: ${
        data?.skippedExistingCount ?? 0
      }, übersprungen leer: ${data?.skippedEmptyCount ?? 0}.`
    )
    setNotes('')

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 text-sm font-medium text-white">
        Payouts für alle Creator erzeugen
      </div>

      <div className="grid gap-3 md:grid-cols-3">
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

        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optionale Notiz"
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
        />
      </div>

      {loadingPreview ? (
        <div className="mt-3 text-sm text-white/50">Vorschau wird geladen...</div>
      ) : preview ? (
        <>
          <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs uppercase tracking-wide text-white/40">Mit Umsatz</div>
              <div className="mt-1 text-sm font-medium text-white">
                {preview.creatorCountWithRevenue}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs uppercase tracking-wide text-white/40">Erstellbar</div>
              <div className="mt-1 text-sm font-medium text-white">
                {preview.creatableCount}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs uppercase tracking-wide text-white/40">Vorhanden</div>
              <div className="mt-1 text-sm font-medium text-white">
                {preview.skippedExistingCount}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs uppercase tracking-wide text-white/40">Brutto</div>
              <div className="mt-1 text-sm font-medium text-white">
                {formatMoney(preview.grossCents)}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs uppercase tracking-wide text-white/40">Gebühr</div>
              <div className="mt-1 text-sm font-medium text-white">
                {formatMoney(preview.feeCents)}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs uppercase tracking-wide text-white/40">Netto</div>
              <div className="mt-1 text-sm font-medium text-white">
                {formatMoney(preview.netCents)}
              </div>
            </div>
          </div>

          {topCreators.length > 0 ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-xs uppercase tracking-wide text-white/40">
                Größte Creator in diesem Lauf
              </div>
              <div className="space-y-2">
                {topCreators.map((creator) => (
                  <div
                    key={creator.creatorId}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-white">
                        {creator.displayName || creator.username || creator.creatorId}
                      </div>
                      <div className="truncate text-xs text-white/45">
                        @{creator.username || 'creator'}
                      </div>
                    </div>

                    <div className="whitespace-nowrap text-white">
                      {formatMoney(creator.netCents)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending || loadingPreview || !preview || preview.creatableCount === 0}
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? 'Erstellt...' : 'Bulk-Payouts erzeugen'}
        </button>

        {error ? <div className="text-sm text-red-300">{error}</div> : null}
        {success ? <div className="text-sm text-emerald-300">{success}</div> : null}
      </div>
    </div>
  )
}