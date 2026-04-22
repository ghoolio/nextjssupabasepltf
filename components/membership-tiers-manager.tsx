'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

type MembershipTier = {
  id: string
  creator_id: string
  name: string
  description: string | null
  price_cents: number
  currency: 'EUR' | 'USD'
  position: number
  stripe_product_id?: string | null
  stripe_price_id?: string | null
  archived?: boolean
}

type DraftTier = {
  id: string
  name: string
  description: string
  price: string
  currency: 'EUR' | 'USD'
  position: number
  isNew?: boolean
  archived?: boolean
}

function makeDraftId() {
  return `draft_${crypto.randomUUID()}`
}

function sortByPosition<T extends { position: number }>(items: T[]) {
  return [...items].sort((a, b) => a.position - b.position)
}

export default function MembershipTiersManager({
  creatorId,
  membershipEnabled,
  initialTiers,
}: {
  creatorId: string
  membershipEnabled: boolean
  initialTiers: MembershipTier[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [enabled, setEnabled] = useState(membershipEnabled)
  const [tiers, setTiers] = useState<DraftTier[]>(
    initialTiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      description: tier.description || '',
      price: (tier.price_cents / 100).toFixed(2),
      currency: tier.currency,
      position: tier.position,
      isNew: false,
      archived: tier.archived ?? false,
    }))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const activeTiers = useMemo(
    () => sortByPosition(tiers.filter((tier) => !tier.archived)),
    [tiers]
  )

  const archivedTiers = useMemo(
    () => sortByPosition(tiers.filter((tier) => tier.archived)),
    [tiers]
  )

  const hasActiveTiers = activeTiers.length > 0

  function addTier() {
    setTiers((prev) => [
      ...prev,
      {
        id: makeDraftId(),
        name: '',
        description: '',
        price: '',
        currency: 'EUR',
        position: prev.filter((tier) => !tier.archived).length,
        isNew: true,
        archived: false,
      },
    ])
  }

  function updateTier(id: string, patch: Partial<DraftTier>) {
    setTiers((prev) =>
      prev.map((tier) => (tier.id === id ? { ...tier, ...patch } : tier))
    )
  }

  function removeTierLocal(id: string) {
    setTiers((prev) => {
      const next = prev.filter((tier) => tier.id !== id)
      const active = sortByPosition(next.filter((tier) => !tier.archived)).map((tier, index) => ({
        ...tier,
        position: index,
      }))
      const archived = next.filter((tier) => tier.archived)
      return [...active, ...archived]
    })
  }

  async function removeTier(id: string) {
    setError('')
    setSuccess('')

    const tier = tiers.find((t) => t.id === id)
    if (!tier) return

    if (tier.isNew || tier.id.startsWith('draft_')) {
      removeTierLocal(id)
      return
    }

    const confirmed = window.confirm(
      'Diesen Tier wirklich archivieren? Er wird in Stripe deaktiviert und lokal ausgeblendet.'
    )

    if (!confirmed) return

    setLoading(true)

    try {
      const res = await fetch('/api/memberships/delete-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId: id }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Tier konnte nicht archiviert werden.')
      }

      setTiers((prev) =>
        prev.map((tier) =>
          tier.id === id ? { ...tier, archived: true } : tier
        )
      )

      setSuccess('Tier erfolgreich archiviert.')
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Tier konnte nicht archiviert werden.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function restoreTier(id: string) {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const res = await fetch('/api/memberships/restore-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId: id }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Tier konnte nicht wiederhergestellt werden.')
      }

      setTiers((prev) => {
        const next = prev.map((tier) =>
          tier.id === id ? { ...tier, archived: false } : tier
        )
        const active = sortByPosition(next.filter((tier) => !tier.archived)).map((tier, index) => ({
          ...tier,
          position: index,
        }))
        const archived = next.filter((tier) => tier.archived)
        return [...active, ...archived]
      })

      setSuccess('Tier erfolgreich wiederhergestellt.')
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Tier konnte nicht wiederhergestellt werden.'
      )
    } finally {
      setLoading(false)
    }
  }

  function moveTier(id: string, direction: 'up' | 'down') {
    setTiers((prev) => {
      const active = sortByPosition(prev.filter((tier) => !tier.archived))
      const archived = prev.filter((tier) => tier.archived)

      const index = active.findIndex((tier) => tier.id === id)
      if (index === -1) return prev

      const swapIndex = direction === 'up' ? index - 1 : index + 1
      if (swapIndex < 0 || swapIndex >= active.length) return prev

      const next = [...active]
      ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]

      const normalized = next.map((tier, i) => ({
        ...tier,
        position: i,
      }))

      return [...normalized, ...archived]
    })
  }

  async function syncTier(tier: DraftTier) {
    const parsedPrice = Number(tier.price.replace(',', '.'))

    const res = await fetch('/api/memberships/sync-tier', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tierId: tier.isNew || tier.id.startsWith('draft_') ? undefined : tier.id,
        name: tier.name.trim(),
        description: tier.description.trim(),
        price_cents: Math.round(parsedPrice * 100),
        currency: tier.currency,
        position: tier.position,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Tier-Sync fehlgeschlagen.')
    }

    return data.tier as MembershipTier
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const normalized = sortByPosition(activeTiers)

      for (const tier of normalized) {
        if (tier.name.trim().length < 2 || tier.name.trim().length > 40) {
          throw new Error('Jeder Tier-Name muss zwischen 2 und 40 Zeichen lang sein.')
        }

        if (tier.description.trim().length > 300) {
          throw new Error('Eine Tier-Beschreibung darf maximal 300 Zeichen lang sein.')
        }

        const parsedPrice = Number(tier.price.replace(',', '.'))
        if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
          throw new Error('Jeder Tier-Preis muss größer als 0 sein.')
        }
      }

      const { error: profileError } = await (supabase.from('profiles') as any)
        .update({
          membership_enabled: enabled,
        })
        .eq('id', creatorId)

      if (profileError) {
        throw new Error(profileError.message)
      }

      const syncedTiers: DraftTier[] = []

      for (const tier of normalized) {
        const saved = await syncTier(tier)

        syncedTiers.push({
          id: saved.id,
          name: saved.name,
          description: saved.description || '',
          price: (saved.price_cents / 100).toFixed(2),
          currency: saved.currency,
          position: saved.position,
          isNew: false,
          archived: false,
        })
      }

      setTiers([...sortByPosition(syncedTiers), ...archivedTiers])
      setSuccess('Mitgliedschaften erfolgreich gespeichert.')
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Mitgliedschaften konnten nicht gespeichert werden.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-white"
    >
      <section className="rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Mitgliedschaften aktivieren</h2>
            <p className="mt-1 text-sm text-white/45">
              Bestimmt, ob dein Kanal Mitgliedschafts-Tiers anbietet.
            </p>
          </div>

          <label className="flex items-center gap-3 text-sm text-white/75">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Aktiviert
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Aktive Tiers</h2>
            <p className="mt-1 text-sm text-white/45">
              Sichtbare und verwendbare Mitgliedschafts-Stufen.
            </p>
          </div>

          <button
            type="button"
            onClick={addTier}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            Neuer Tier
          </button>
        </div>

        {hasActiveTiers ? (
          <div className="space-y-4">
            {activeTiers.map((tier, index) => (
              <div
                key={tier.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-5"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">Tier {index + 1}</div>
                    <div className="mt-1 text-xs text-white/40">
                      Position {tier.position + 1}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => moveTier(tier.id, 'up')}
                      disabled={index === 0 || loading}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/10 disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTier(tier.id, 'down')}
                      disabled={index === activeTiers.length - 1 || loading}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/10 disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTier(tier.id)}
                      disabled={loading}
                      className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-400/20 disabled:opacity-40"
                    >
                      Archivieren
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-sm text-white/70">Name</label>
                    <input
                      value={tier.name}
                      onChange={(e) => updateTier(tier.id, { name: e.target.value })}
                      maxLength={40}
                      placeholder="z. B. Gold Supporter"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-sm text-white/70">Beschreibung</label>
                    <textarea
                      value={tier.description}
                      onChange={(e) => updateTier(tier.id, { description: e.target.value })}
                      maxLength={300}
                      placeholder="Was bekommen Mitglieder in diesem Tier?"
                      className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm text-white/70">Preis</label>
                    <input
                      value={tier.price}
                      onChange={(e) => updateTier(tier.id, { price: e.target.value })}
                      placeholder="4.99"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm text-white/70">Währung</label>
                    <select
                      value={tier.currency}
                      onChange={(e) =>
                        updateTier(tier.id, {
                          currency: e.target.value as 'EUR' | 'USD',
                        })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/50">
            Noch keine aktiven Tiers vorhanden. Erstelle deinen ersten Mitgliedschafts-Tier.
          </div>
        )}
      </section>

      {archivedTiers.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Archivierte Tiers</h2>
            <p className="mt-1 text-sm text-white/45">
              Deaktivierte Tiers, die nicht mehr öffentlich angeboten werden.
            </p>
          </div>

          <div className="space-y-4">
            {archivedTiers.map((tier) => (
              <div
                key={tier.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-5 opacity-80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">{tier.name}</div>
                    <div className="mt-1 text-xs text-white/40">
                      {(Number(tier.price.replace(',', '.')) || 0).toFixed(2)} {tier.currency}
                    </div>
                    <div className="mt-2 text-sm text-white/50">
                      {tier.description || 'Keine Beschreibung'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => restoreTier(tier.id)}
                    disabled={loading}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs text-white transition hover:bg-white/10 disabled:opacity-40"
                  >
                    Wiederherstellen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Speichert...' : 'Änderungen speichern'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/settings/creator')}
          className="rounded-full border border-white/10 px-5 py-3 text-sm text-white transition hover:bg-white/10"
        >
          Zurück
        </button>
      </div>
    </form>
  )
}