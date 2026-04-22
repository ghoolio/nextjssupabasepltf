'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function MembershipTierForm({ userId }: { userId: string }) {
  const router = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priceEuros, setPriceEuros] = useState('4.99')
  const [position, setPosition] = useState('0')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const priceCents = Math.round(Number(priceEuros.replace(',', '.')) * 100)

      if (!name.trim()) throw new Error('Name fehlt.')
      if (!Number.isFinite(priceCents) || priceCents < 99) {
        throw new Error('Preis muss mindestens 0,99 sein.')
      }

      const tiersTable = supabase.from('membership_tiers') as any

      const { error } = await tiersTable.insert({
        creator_id: userId,
        name: name.trim(),
        description: description.trim() || null,
        price_cents: priceCents,
        currency: 'EUR',
        position: Number(position) || 0,
      })

      if (error) throw new Error(error.message)

      router.push('/profile/memberships')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tier konnte nicht erstellt werden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6 text-white"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tier-Name"
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Was bekommen Mitglieder in diesem Tier?"
        className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <input
          value={priceEuros}
          onChange={(e) => setPriceEuros(e.target.value)}
          placeholder="Preis in EUR"
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
        />

        <input
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Sortierung"
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
        />
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-2xl bg-white px-5 py-3 font-medium text-black disabled:opacity-60"
      >
        {loading ? 'Speichert...' : 'Tier erstellen'}
      </button>
    </form>
  )
}