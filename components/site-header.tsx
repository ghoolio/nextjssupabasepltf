'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { logout } from '@/lib/actions'

type Props = {
  userEmail?: string
}

export default function SiteHeader({ userEmail }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const normalized = query.trim()

    if (!normalized) {
      router.push('/explore')
      return
    }

    router.push(`/explore?q=${encodeURIComponent(normalized)}`)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-neutral-950/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 text-sm font-bold text-white">
              ▶
            </div>
            <span className="text-base font-semibold tracking-tight text-white">
              VideoHub
            </span>
          </Link>
        </div>

        <div className="hidden flex-1 justify-center md:flex">
          <form
            onSubmit={handleSearch}
            className="flex w-full max-w-xl items-center overflow-hidden rounded-full border border-white/10 bg-neutral-900"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Videos suchen"
              className="w-full bg-transparent px-4 py-2 text-sm text-white outline-none placeholder:text-white/35"
            />
            <button
              type="submit"
              className="border-l border-white/10 px-4 py-2 text-sm text-white/55 transition hover:bg-white/5"
            >
              ⌕
            </button>
          </form>
        </div>

        <div className="flex items-center gap-3">
          {userEmail ? (
            <>
              <Link
                href="/upload"
                className="hidden rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10 sm:inline-flex"
              >
                + Erstellen
              </Link>

              <div className="hidden rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/65 lg:block">
                {userEmail}
              </div>

              <form action={logout}>
                <button className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10">
                  Logout
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
              >
                Registrieren
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}