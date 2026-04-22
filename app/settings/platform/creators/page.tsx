import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAdmin } from '@/lib/platform-admin'

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  membership_enabled: boolean
  stripe_account_id: string | null
}

type VideoPurchaseAggregateRow = {
  creator_id: string
  amount_cents: number
  platform_fee_amount_cents: number | null
  creator_net_amount_cents: number | null
  payment_status: 'paid' | 'refunded' | 'failed'
}

type MembershipPaymentAggregateRow = {
  creator_id: string
  amount_cents: number
  platform_fee_amount_cents: number
  creator_net_amount_cents: number
  payment_status: 'paid' | 'refunded' | 'failed'
}

type MembershipTierRow = {
  creator_id: string
  archived: boolean
}

type CreatorStats = {
  creator_id: string
  display_name: string
  username: string
  membership_enabled: boolean
  stripe_connected: boolean
  video_gross: number
  video_fees: number
  video_net: number
  membership_gross: number
  membership_fees: number
  membership_net: number
  video_paid_count: number
  membership_paid_count: number
  active_tier_count: number
  total_gross: number
  total_fees: number
  total_net: number
  total_paid_count: number
}

type ConnectFilter = 'all' | 'connected' | 'missing'
type MembershipFilter = 'all' | 'enabled' | 'disabled'
type RevenueFilter = 'all' | 'with' | 'without'

function formatMoney(cents: number, currency: 'EUR' | 'USD' = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

export default async function SettingsPlatformCreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    connect?: string
    memberships?: string
    revenue?: string
  }>
}) {
  const { user } = await requirePlatformAdmin()
  const qs = await searchParams

  const connectFilter = (['all', 'connected', 'missing'].includes(qs.connect || '')
    ? qs.connect
    : 'all') as ConnectFilter

  const membershipFilter = (['all', 'enabled', 'disabled'].includes(qs.memberships || '')
    ? qs.memberships
    : 'all') as MembershipFilter

  const revenueFilter = (['all', 'with', 'without'].includes(qs.revenue || '')
    ? qs.revenue
    : 'all') as RevenueFilter

  const query = (qs.q || '').trim().toLowerCase()

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, username, display_name, membership_enabled, stripe_account_id')
    .returns<ProfileRow[]>()

  if (profilesError) {
    throw new Error(profilesError.message)
  }

  const { data: videoRows, error: videoError } = await supabaseAdmin
    .from('video_purchases')
    .select(
      `
      amount_cents,
      platform_fee_amount_cents,
      creator_net_amount_cents,
      payment_status,
      videos!inner(user_id)
    `
    )

  if (videoError) {
    throw new Error(videoError.message)
  }

  const normalizedVideoRows: VideoPurchaseAggregateRow[] = (videoRows ?? []).map((row: any) => ({
    creator_id: row.videos.user_id,
    amount_cents: row.amount_cents,
    platform_fee_amount_cents: row.platform_fee_amount_cents,
    creator_net_amount_cents: row.creator_net_amount_cents,
    payment_status: row.payment_status,
  }))

  const { data: membershipRows, error: membershipError } = await supabaseAdmin
    .from('membership_payments')
    .select(
      'creator_id, amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status'
    )
    .returns<MembershipPaymentAggregateRow[]>()

  if (membershipError) {
    throw new Error(membershipError.message)
  }

  const { data: tierRows, error: tierError } = await supabaseAdmin
    .from('membership_tiers')
    .select('creator_id, archived')
    .returns<MembershipTierRow[]>()

  if (tierError) {
    throw new Error(tierError.message)
  }

  const statsMap = new Map<string, Omit<CreatorStats, 'total_gross' | 'total_fees' | 'total_net' | 'total_paid_count'>>()

  for (const profile of profiles ?? []) {
    statsMap.set(profile.id, {
      creator_id: profile.id,
      display_name: profile.display_name || profile.username || 'Unbekannter Creator',
      username: profile.username || 'creator',
      membership_enabled: profile.membership_enabled,
      stripe_connected: Boolean(profile.stripe_account_id),
      video_gross: 0,
      video_fees: 0,
      video_net: 0,
      membership_gross: 0,
      membership_fees: 0,
      membership_net: 0,
      video_paid_count: 0,
      membership_paid_count: 0,
      active_tier_count: 0,
    })
  }

  for (const row of normalizedVideoRows) {
    const stats = statsMap.get(row.creator_id)
    if (!stats || row.payment_status !== 'paid') continue

    stats.video_gross += row.amount_cents
    stats.video_fees += row.platform_fee_amount_cents ?? 0
    stats.video_net += row.creator_net_amount_cents ?? 0
    stats.video_paid_count += 1
  }

  for (const row of membershipRows ?? []) {
    const stats = statsMap.get(row.creator_id)
    if (!stats || row.payment_status !== 'paid') continue

    stats.membership_gross += row.amount_cents
    stats.membership_fees += row.platform_fee_amount_cents
    stats.membership_net += row.creator_net_amount_cents
    stats.membership_paid_count += 1
  }

  for (const row of tierRows ?? []) {
    const stats = statsMap.get(row.creator_id)
    if (!stats || row.archived) continue
    stats.active_tier_count += 1
  }

  const creators: CreatorStats[] = [...statsMap.values()]
    .map((stats) => ({
      ...stats,
      total_gross: stats.video_gross + stats.membership_gross,
      total_fees: stats.video_fees + stats.membership_fees,
      total_net: stats.video_net + stats.membership_net,
      total_paid_count: stats.video_paid_count + stats.membership_paid_count,
    }))
    .filter((creator) => {
      if (connectFilter === 'connected' && !creator.stripe_connected) return false
      if (connectFilter === 'missing' && creator.stripe_connected) return false

      if (membershipFilter === 'enabled' && !creator.membership_enabled) return false
      if (membershipFilter === 'disabled' && creator.membership_enabled) return false

      if (revenueFilter === 'with' && creator.total_gross <= 0) return false
      if (revenueFilter === 'without' && creator.total_gross > 0) return false

      if (!query) return true

      const haystack = [creator.display_name, creator.username].join(' ').toLowerCase()
      return haystack.includes(query)
    })
    .sort((a, b) => b.total_gross - a.total_gross)

  const totalCreators = profiles?.length ?? 0
  const connectedCreators = [...statsMap.values()].filter((c) => c.stripe_connected).length
  const membershipCreators = [...statsMap.values()].filter((c) => c.membership_enabled).length
  const revenueCreators = [...statsMap.values()].filter(
    (c) => c.video_gross + c.membership_gross > 0
  ).length

  const withParams = (next: Partial<Record<'connect' | 'memberships' | 'revenue' | 'q', string>>) => {
    const params = new URLSearchParams()

    const connect = next.connect ?? connectFilter
    const memberships = next.memberships ?? membershipFilter
    const revenue = next.revenue ?? revenueFilter
    const q = next.q ?? (qs.q || '')

    if (connect !== 'all') params.set('connect', connect)
    if (memberships !== 'all') params.set('memberships', memberships)
    if (revenue !== 'all') params.set('revenue', revenue)
    if (q.trim()) params.set('q', q.trim())

    const queryString = params.toString()
    return `/settings/platform/creators${queryString ? `?${queryString}` : ''}`
  }

  const exportHref = `/api/platform/creators/export${
    (() => {
      const params = new URLSearchParams()
      if (connectFilter !== 'all') params.set('connect', connectFilter)
      if (membershipFilter !== 'all') params.set('memberships', membershipFilter)
      if (revenueFilter !== 'all') params.set('revenue', revenueFilter)
      if (qs.q?.trim()) params.set('q', qs.q.trim())
      const queryString = params.toString()
      return queryString ? `?${queryString}` : ''
    })()
  }`

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
              <Link
                href="/settings/platform"
                className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
              >
                ← Zurück zu Plattform
              </Link>
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  Creator-Übersicht
                </h1>
                <p className="mt-1 text-sm text-white/50">
                  Umsatz, Gebühren und Aktivität pro Creator.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    name="q"
                    defaultValue={qs.q || ''}
                    placeholder="Creator suchen"
                    className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white outline-none placeholder:text-white/35 sm:w-72"
                  />
                  <input type="hidden" name="connect" value={connectFilter} />
                  <input type="hidden" name="memberships" value={membershipFilter} />
                  <input type="hidden" name="revenue" value={revenueFilter} />
                  <button
                    type="submit"
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
                  >
                    Suchen
                  </button>
                </form>

                <a
                  href={exportHref}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  CSV exportieren
                </a>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={withParams({ connect: 'all' })}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  connectFilter === 'all'
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 text-white hover:bg-white/10'
                }`}
              >
                Alle Connect
              </Link>
              <Link
                href={withParams({ connect: 'connected' })}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  connectFilter === 'connected'
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 text-white hover:bg-white/10'
                }`}
              >
                Verbunden
              </Link>
              <Link
                href={withParams({ connect: 'missing' })}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  connectFilter === 'missing'
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 text-white hover:bg-white/10'
                }`}
              >
                Fehlt
              </Link>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={withParams({ memberships: 'all' })}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  membershipFilter === 'all'
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 text-white hover:bg-white/10'
                }`}
              >
                Alle Memberships
              </Link>
              <Link
                href={withParams({ memberships: 'enabled' })}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  membershipFilter === 'enabled'
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 text-white hover:bg-white/10'
                }`}
              >
                Membership aktiv
              </Link>
              <Link
                href={withParams({ memberships: 'disabled' })}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  membershipFilter === 'disabled'
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 text-white hover:bg-white/10'
                }`}
              >
                Membership aus
              </Link>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={withParams({ revenue: 'all' })}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  revenueFilter === 'all'
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 text-white hover:bg-white/10'
                }`}
              >
                Alle Umsätze
              </Link>
              <Link
                href={withParams({ revenue: 'with' })}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  revenueFilter === 'with'
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 text-white hover:bg-white/10'
                }`}
              >
                Mit Umsatz
              </Link>
              <Link
                href={withParams({ revenue: 'without' })}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  revenueFilter === 'without'
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 text-white hover:bg-white/10'
                }`}
              >
                Ohne Umsatz
              </Link>
            </div>
          </div>

          <section className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/40">Creator gesamt</div>
              <div className="mt-2 text-2xl font-semibold text-white">{totalCreators}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/40">Stripe verbunden</div>
              <div className="mt-2 text-2xl font-semibold text-white">{connectedCreators}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/40">Membership aktiv</div>
              <div className="mt-2 text-2xl font-semibold text-white">{membershipCreators}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/40">Mit Umsatz</div>
              <div className="mt-2 text-2xl font-semibold text-white">{revenueCreators}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
            {creators.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-white/40">
                      <th className="px-3 py-2">Creator</th>
                      <th className="px-3 py-2">Connect</th>
                      <th className="px-3 py-2">Tiers</th>
                      <th className="px-3 py-2">Brutto</th>
                      <th className="px-3 py-2">Gebühren</th>
                      <th className="px-3 py-2">Netto</th>
                      <th className="px-3 py-2">Zahlungen</th>
                      <th className="px-3 py-2">Details</th>
                      <th className="px-3 py-2">Kanal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creators.map((creator) => (
                      <tr
                        key={creator.creator_id}
                        className="rounded-2xl bg-black/20 text-sm text-white/80"
                      >
                        <td className="rounded-l-2xl px-3 py-3">
                          <div className="font-medium text-white">{creator.display_name}</div>
                          <div className="text-xs text-white/45">@{creator.username}</div>
                        </td>

                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs ${
                              creator.stripe_connected
                                ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                                : 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
                            }`}
                          >
                            {creator.stripe_connected ? 'Verbunden' : 'Fehlt'}
                          </span>
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          {creator.active_tier_count}
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatMoney(creator.total_gross)}
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatMoney(creator.total_fees)}
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatMoney(creator.total_net)}
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          {creator.total_paid_count}
                        </td>

                        <td className="px-3 py-3">
                          <Link
                            href={`/settings/platform/creators/${creator.creator_id}`}
                            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/10"
                          >
                            Details
                          </Link>
                        </td>

                        <td className="rounded-r-2xl px-3 py-3">
                          <Link
                            href={`/channel/${creator.creator_id}`}
                            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/10"
                          >
                            Kanal
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/50">
                Keine Creator für die aktuelle Suche oder Filter gefunden.
              </div>
            )}
          </section>
        </main>
      </AppFrame>
    </>
  )
}