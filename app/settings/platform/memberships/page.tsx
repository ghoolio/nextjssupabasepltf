import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type MembershipStatus = 'active' | 'canceled' | 'expired'
type StatusFilter = MembershipStatus | 'all'

type MembershipRow = {
  creator_id: string
  member_id: string
  tier_id: string
  status: MembershipStatus
  provider: string | null
  provider_subscription_id: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  cancel_at: string | null
  stripe_customer_id: string | null
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
}

type TierRow = {
  id: string
  name: string
  price_cents: number
  currency: 'EUR' | 'USD'
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMoney(cents: number, currency: 'EUR' | 'USD' = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

function statusBadgeClass(status: MembershipStatus) {
  if (status === 'active') {
    return 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
  }
  if (status === 'expired') {
    return 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
  }
  return 'border border-red-400/20 bg-red-400/10 text-red-200'
}

export default async function SettingsPlatformMembershipsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const supabase = await createClient()
  const qs = await searchParams

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const statusFilter = (['active', 'canceled', 'expired', 'all'].includes(qs.status || '')
    ? qs.status
    : 'all') as StatusFilter

  const query = (qs.q || '').trim().toLowerCase()

  const { data: membershipRows, error: membershipError } = await supabaseAdmin
    .from('creator_memberships')
    .select(
      'creator_id, member_id, tier_id, status, provider, provider_subscription_id, current_period_end, cancel_at_period_end, cancel_at, stripe_customer_id'
    )
    .order('current_period_end', { ascending: false, nullsFirst: false })
    .returns<MembershipRow[]>()

  if (membershipError) {
    throw new Error(membershipError.message)
  }

  const memberships = membershipRows ?? []

  const creatorIds = [...new Set(memberships.map((m) => m.creator_id))]
  const memberIds = [...new Set(memberships.map((m) => m.member_id))]
  const tierIds = [...new Set(memberships.map((m) => m.tier_id))]

  const { data: creatorProfiles, error: creatorProfilesError } = creatorIds.length
    ? await supabaseAdmin
        .from('profiles')
        .select('id, username, display_name')
        .in('id', creatorIds)
        .returns<ProfileRow[]>()
    : { data: [] as ProfileRow[], error: null }

  if (creatorProfilesError) {
    throw new Error(creatorProfilesError.message)
  }

  const { data: memberProfiles, error: memberProfilesError } = memberIds.length
    ? await supabaseAdmin
        .from('profiles')
        .select('id, username, display_name')
        .in('id', memberIds)
        .returns<ProfileRow[]>()
    : { data: [] as ProfileRow[], error: null }

  if (memberProfilesError) {
    throw new Error(memberProfilesError.message)
  }

  const { data: tierRows, error: tierError } = tierIds.length
    ? await supabaseAdmin
        .from('membership_tiers')
        .select('id, name, price_cents, currency')
        .in('id', tierIds)
        .returns<TierRow[]>()
    : { data: [] as TierRow[], error: null }

  if (tierError) {
    throw new Error(tierError.message)
  }

  const creatorMap = new Map((creatorProfiles ?? []).map((p) => [p.id, p]))
  const memberMap = new Map((memberProfiles ?? []).map((p) => [p.id, p]))
  const tierMap = new Map((tierRows ?? []).map((t) => [t.id, t]))

  const filteredMemberships = memberships.filter((membership) => {
    if (statusFilter !== 'all' && membership.status !== statusFilter) {
      return false
    }

    if (!query) return true

    const creator = creatorMap.get(membership.creator_id)
    const member = memberMap.get(membership.member_id)
    const tier = tierMap.get(membership.tier_id)

    const haystack = [
      creator?.display_name || '',
      creator?.username || '',
      member?.display_name || '',
      member?.username || '',
      tier?.name || '',
      membership.provider_subscription_id || '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })

  const activeCount = memberships.filter((m) => m.status === 'active').length
  const canceledCount = memberships.filter((m) => m.status === 'canceled').length
  const expiredCount = memberships.filter((m) => m.status === 'expired').length
  const scheduledCancelCount = memberships.filter(
    (m) => m.status === 'active' && Boolean(m.cancel_at_period_end)
  ).length

  const statusLinks: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Alle' },
    { key: 'active', label: 'Aktiv' },
    { key: 'canceled', label: 'Gekündigt' },
    { key: 'expired', label: 'Abgelaufen' },
  ]

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
                  Memberships
                </h1>
                <p className="mt-1 text-sm text-white/50">
                  Plattformweite Übersicht über aktive, gekündigte und abgelaufene Mitgliedschaften.
                </p>
              </div>

              <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="text"
                  name="q"
                  defaultValue={qs.q || ''}
                  placeholder="Creator, Member oder Tier suchen"
                  className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white outline-none placeholder:text-white/35 sm:w-80"
                />
                <input type="hidden" name="status" value={statusFilter} />
                <button
                  type="submit"
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
                >
                  Suchen
                </button>
              </form>
            </div>

            <div className="flex flex-wrap gap-2">
              {statusLinks.map((item) => {
                const active = item.key === statusFilter
                const href = `/settings/platform/memberships?status=${item.key}${
                  qs.q ? `&q=${encodeURIComponent(qs.q)}` : ''
                }`

                return (
                  <Link
                    key={item.key}
                    href={href}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      active
                        ? 'border-white bg-white text-black'
                        : 'border-white/10 text-white hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>

          <section className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/40">Aktiv</div>
              <div className="mt-2 text-2xl font-semibold text-white">{activeCount}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/40">
                Kündigt zum Periodenende
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{scheduledCancelCount}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/40">Gekündigt</div>
              <div className="mt-2 text-2xl font-semibold text-white">{canceledCount}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/40">Abgelaufen</div>
              <div className="mt-2 text-2xl font-semibold text-white">{expiredCount}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
            {filteredMemberships.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-white/40">
                      <th className="px-3 py-2">Creator</th>
                      <th className="px-3 py-2">Member</th>
                      <th className="px-3 py-2">Tier</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Periodenende</th>
                      <th className="px-3 py-2">Kündigung</th>
                      <th className="px-3 py-2">Provider</th>
                      <th className="px-3 py-2">Kanal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMemberships.map((membership, index) => {
                      const creator = creatorMap.get(membership.creator_id)
                      const member = memberMap.get(membership.member_id)
                      const tier = tierMap.get(membership.tier_id)

                      return (
                        <tr
                          key={`${membership.creator_id}_${membership.member_id}_${membership.tier_id}_${index}`}
                          className="rounded-2xl bg-black/20 text-sm text-white/80"
                        >
                          <td className="rounded-l-2xl px-3 py-3">
                            <div className="font-medium text-white">
                              {creator?.display_name || creator?.username || membership.creator_id}
                            </div>
                            <div className="text-xs text-white/45">
                              @{creator?.username || 'creator'}
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <div className="font-medium text-white">
                              {member?.display_name || member?.username || membership.member_id}
                            </div>
                            <div className="text-xs text-white/45">
                              @{member?.username || 'member'}
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <div className="font-medium text-white">
                              {tier?.name || membership.tier_id}
                            </div>
                            <div className="text-xs text-white/45">
                              {tier ? formatMoney(tier.price_cents, tier.currency) : '—'}
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs ${statusBadgeClass(
                                membership.status
                              )}`}
                            >
                              {membership.status}
                            </span>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {formatDate(membership.current_period_end)}
                          </td>

                          <td className="px-3 py-3">
                            {membership.cancel_at_period_end ? (
                              <div>
                                <div className="text-amber-200">Zum Periodenende</div>
                                <div className="text-xs text-white/45">
                                  {formatDate(membership.cancel_at)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-white/45">Keine</span>
                            )}
                          </td>

                          <td className="px-3 py-3">
                            <div className="text-white">{membership.provider || '—'}</div>
                            <div className="max-w-[180px] truncate text-xs text-white/45">
                              {membership.provider_subscription_id || '—'}
                            </div>
                          </td>

                          <td className="rounded-r-2xl px-3 py-3">
                            <Link
                              href={`/channel/${membership.creator_id}`}
                              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/10"
                            >
                              Kanal
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/50">
                Keine Memberships für die aktuelle Suche oder den gewählten Status gefunden.
              </div>
            )}
          </section>
        </main>
      </AppFrame>
    </>
  )
}