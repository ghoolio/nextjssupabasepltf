'use client'

import { useMemo, useState } from 'react'
import VideoGrid from '@/components/video-grid'

type ExploreVideo = {
  id: string
  title: string
  description: string | null
  payment_type?: 'free' | 'paid'
  price_cents?: number | null
  currency?: 'EUR' | 'USD' | null
  purchased?: boolean
}

type FilterMode = 'all' | 'free' | 'paid'

export default function ExploreFilters({
  videos,
}: {
  videos: ExploreVideo[]
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')

  const filteredVideos = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return videos.filter((video) => {
      const matchesQuery =
        !normalized ||
        video.title.toLowerCase().includes(normalized) ||
        (video.description || '').toLowerCase().includes(normalized)

      const matchesFilter =
        filter === 'all' ||
        (filter === 'free' && (video.payment_type ?? 'free') === 'free') ||
        (filter === 'paid' && video.payment_type === 'paid')

      return matchesQuery && matchesFilter
    })
  }, [videos, query, filter])

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 text-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Videos durchsuchen..."
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35 md:max-w-md"
          />

          <div className="flex flex-wrap gap-2">
            <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
              Alle
            </FilterButton>
            <FilterButton active={filter === 'free'} onClick={() => setFilter('free')}>
              Kostenlos
            </FilterButton>
            <FilterButton active={filter === 'paid'} onClick={() => setFilter('paid')}>
              Bezahlt
            </FilterButton>
          </div>
        </div>
      </section>

      <VideoGrid videos={filteredVideos} />
    </div>
  )
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-sm transition ${
        active
          ? 'bg-white text-black'
          : 'border border-white/10 bg-black/20 text-white/70 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}