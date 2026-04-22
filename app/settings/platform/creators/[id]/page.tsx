import Link from 'next/link'
import { notFound } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAdmin } from '@/lib/platform-admin'

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  membership_enabled: boolean
  stripe_account_id: string | null
  stripe_onboarding_completed?: boolean | null
  stripe_charges_enabled?: boolean | null
  stripe_payouts_enabled?: boolean | null
  stripe_details_submitted?: boolean | null
}

type VideoPurchaseRow = {
  video_id: string
  buyer_id: string
  amount_cents: number
  platform_fee_amount_cents: number | null
  creator_net_amount_cents: number | null
  payment_status: 'paid' | 'refunded' | 'failed'
  currency: 'EUR' | 'USD'
  created_at: string
}

type MembershipPaymentRow = {
  creator_id: string
  member_id: string
  tier_id: string
  amount_cents: number
  platform_fee_amount_cents: number
  creator_net_amount_cents: number
  payment_status: 'paid' | 'refunded' | 'failed'
  currency: 'EUR' | 'USD'
  paid_at: string
  provider_invoice_id: string | null
  provider_subscription_id: string | null
}

type TierRow = {
  id: string
  name: string
  price_cents: number
  currency: 'EUR' | 'USD'
  archived: boolean
  stripe_product_id: string | null
  stripe_price_id: string | null
}

type CreatorMembershipRow = {
  status: 'active' | 'canceled' | 'expired'
}

type ActivityItem = {
  id: string
  kind: 'video_purchase' | 'membership_payment'
  status: 'paid' | 'refunded' | 'failed'
  gross_cents: number
  fee_cents: number
  net_cents: number
  currency: 'EUR' | 'USD'
  occurred_at: string
  reference: string
}

function formatMoney(cents: number, currency: 'EUR' | 'USD' = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadgeClass(status: string) {
  if (status === 'paid' || status === 'active') {
    return 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
  }
  if (status === 'refunded' || status === 'expired') {
    return 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
  }
  return 'border border-red-400/20 bg-red-400/10 text-red-200'
}

export default async function SettingsPlatformCreatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user } = await requirePlatformAdmin()
  const supabase = await createClient()

  const { data: profileRows, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select(
      'id, username, display_name, bio, avatar_url, membership_enabled, stripe_account_id, stripe_onboarding_completed, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted'
    )
    .eq('id', id)
    .returns<ProfileRow[]>()

  if (profileError) {
    throw new Error(profileError.message)
  }

  const profile = profileRows?.[0] ?? null

  if (!profile) {
    notFound()
  }

  const avatarUrl = profile.avatar_url
    ? supabase.storage.from('profile-assets').getPublicUrl(profile.avatar_url).data.publicUrl
    : null

  const { data: videoRowsRaw, error: videoError } = await supabaseAdmin
    .from('video_purchases')
    .select(
      `
      video_id,
      buyer_id,
      amount_cents,
      platform_fee_amount_cents,
      creator_net_amount_cents,
      payment_status,
      currency,
      created_at,
      videos!inner(user_id)
    `
    )
    .eq('videos.user_id', id)

  if (videoError) {
    throw new Error(videoError.message)
  }

  const videoRows: VideoPurchaseRow[] = (videoRowsRaw ?? []).map((row: any) => ({
    video_id: row.video_id,
    buyer_id: row.buyer_id,
    amount_cents: row.amount_cents,
    platform_fee_amount_cents: row.platform_fee_amount_cents,
    creator_net_amount_cents: row.creator_net_amount_cents,
    payment_status: row.payment_status,
    currency: row.currency,
    created_at: row.created_at,
  }))

  const { data: membershipRows, error: membershipError } = await supabaseAdmin
    .from('membership_payments')
    .select(
      'creator_id, member_id, tier_id, amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status, currency, paid_at, provider_invoice_id, provider_subscription_id'
    )
    .eq('creator_id', id)
    .returns<MembershipPaymentRow[]>()

  if (membershipError) {
    throw new Error(membershipError.message)
  }

  const { data: tierRows, error: tierError } = await supabaseAdmin
    .from('membership_tiers')
    .select(
      'id, name, price_cents, currency, archived, stripe_product_id, stripe_price_id'
    )
    .eq('creator_id', id)
    .order('position', { ascending: true })
    .returns<TierRow[]>()

  if (tierError) {
    throw new Error(tierError.message)
  }

  const { data: activeMembershipRows, error: activeMembershipError } = await supabaseAdmin
    .from('creator_memberships')
    .select('status')
    .eq('creator_id', id)
    .eq('status', 'active')
    .returns<CreatorMembershipRow[]>()

  if (activeMembershipError) {
    throw new Error(activeMembershipError.message)
  }

  const paidVideoRows = videoRows.filter((row) => row.payment_status === 'paid')
  const refundedVideoRows = videoRows.filter((row) => row.payment_status === 'refunded')

  const paidMembershipRows = (membershipRows ?? []).filter((row) => row.payment_status === 'paid')
  const refundedMembershipRows = (membershipRows ?? []).filter(
    (row) => row.payment_status === 'refunded'
  )

  const videoGross = paidVideoRows.reduce((sum, row) => sum + row.amount_cents, 0)
  const videoFees = paidVideoRows.reduce(
    (sum, row) => sum + (row.platform_fee_amount_cents ?? 0),
    0
  )
  const videoNet = paidVideoRows.reduce(
    (sum, row) => sum + (row.creator_net_amount_cents ?? 0),
    0
  )

  const membershipGross = paidMembershipRows.reduce((sum, row) => sum + row.amount_cents, 0)
  const membershipFees = paidMembershipRows.reduce(
    (sum, row) => sum + row.platform_fee_amount_cents,
    0
  )
  const membershipNet = paidMembershipRows.reduce(
    (sum, row) => sum + row.creator_net_amount_cents,
    0
  )

  const totalGross = videoGross + membershipGross
  const totalFees = videoFees + membershipFees
  const totalNet = videoNet + membershipNet

  const activeTiers = (tierRows ?? []).filter((tier) => !tier.archived)
  const archivedTiers = (tierRows ?? []).filter((tier) => tier.archived)
  const activeMembershipCount = activeMembershipRows?.length ?? 0

  const activity: ActivityItem[] = [
    ...videoRows.map((row) => ({
      id: `video_${row.video_id}_${row.buyer_id}_${row.created_at}`,
      kind: 'video_purchase' as const,
      status: row.payment_status,
      gross_cents: row.amount_cents,
      fee_cents: row.platform_fee_amount_cents ?? 0,
      net_cents: row.creator_net_amount_cents ?? 0,
      currency: row.currency,
      occurred_at: row.created_at,
      reference: row.video_id,
    })),
    ...(membershipRows ?? []).map((row) => ({
      id: `membership_${row.provider_invoice_id || row.tier_id}_${row.paid_at}`,
      kind: 'membership_payment' as const,
      status: row.payment_status,
      gross_cents: row.amount_cents,
      fee_cents: row.platform_fee_amount_cents,
      net_cents: row.creator_net_amount_cents,
      currency: row.currency,
      occurred_at: row.paid_at,
      reference: row.tier_id,
    })),
  ]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 12)

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
              <Link
                href="/settings/platform/creators"
                className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
              >
                ← Zurück zu Creator-Übersicht
              </Link>

              <Link
                href={`/channel/${profile.id}`}
                className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
              >
                Kanal öffnen
              </Link>

              <a
                href={`/api/platform/creators/${profile.id}/export`}
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
              >
                CSV exportieren
              </a>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 overflow-hidden rounded-full bg-white/10">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile.display_name || profile.username || 'Creator'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg text-white/50">
                      {(profile.display_name?.[0] || profile.username?.[0] || 'C').toUpperCase()}
                    </div>
                  )}
                </div>

                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white">
                    {profile.display_name || profile.username || 'Unbekannter Creator'}
                  </h1>
                  <p className="mt-1 text-sm text-white/45">@{profile.username || 'creator'}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs ${
                    profile.stripe_account_id
                      ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                      : 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
                  }`}
                >
                  {profile.stripe_account_id ? 'Stripe verbunden' : 'Stripe fehlt'}
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs ${
                    profile.membership_enabled
                      ? 'border border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200'
                      : 'border border-white/10 bg-white/5 text-white/60'
                  }`}
                >
                  {profile.membership_enabled ? 'Membership aktiv' : 'Membership aus'}
                </span>
              </div>
            </div>
          </div>

          <section className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/40">Brutto</div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {formatMoney(totalGross)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/40">Plattformgebühren</div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {formatMoney(totalFees)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/40">Netto Creator</div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {formatMoney(totalNet)}
              </div>
            </div>
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">Monetarisierung</h2>
              <div className="mt-4 space-y-3 text-sm text-white/70">
                <div className="flex items-center justify-between gap-4">
                  <span>Einzelkäufe bezahlt</span>
                  <span className="text-white">{paidVideoRows.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Einzelkäufe refunded</span>
                  <span className="text-white">{refundedVideoRows.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Membership-Zahlungen bezahlt</span>
                  <span className="text-white">{paidMembershipRows.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Membership-Zahlungen refunded</span>
                  <span className="text-white">{refundedMembershipRows.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Aktive Memberships</span>
                  <span className="text-white">{activeMembershipCount}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">Stripe & Tiers</h2>
              <div className="mt-4 space-y-3 text-sm text-white/70">
                <div className="flex items-center justify-between gap-4">
                  <span>Details eingereicht</span>
                  <span className="text-white">
                    {profile.stripe_details_submitted ? 'Ja' : 'Nein'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Zahlungen möglich</span>
                  <span className="text-white">
                    {profile.stripe_charges_enabled ? 'Ja' : 'Nein'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Auszahlungen möglich</span>
                  <span className="text-white">
                    {profile.stripe_payouts_enabled ? 'Ja' : 'Nein'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Aktive Tiers</span>
                  <span className="text-white">{activeTiers.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Archivierte Tiers</span>
                  <span className="text-white">{archivedTiers.length}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold text-white">Aktive Tiers</h2>

            {activeTiers.length > 0 ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {activeTiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="text-sm font-medium text-white">{tier.name}</div>
                    <div className="mt-2 text-sm text-white/60">
                      {formatMoney(tier.price_cents, tier.currency)}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span
                        className={`rounded-full px-2 py-1 ${
                          tier.stripe_product_id
                            ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                            : 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
                        }`}
                      >
                        {tier.stripe_product_id ? 'Produkt ok' : 'Produkt fehlt'}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 ${
                          tier.stripe_price_id
                            ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                            : 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
                        }`}
                      >
                        {tier.stripe_price_id ? 'Preis ok' : 'Preis fehlt'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
                Keine aktiven Tiers vorhanden.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold text-white">Letzte Aktivitäten</h2>

            {activity.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-white/40">
                      <th className="px-3 py-2">Datum</th>
                      <th className="px-3 py-2">Typ</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Brutto</th>
                      <th className="px-3 py-2">Gebühr</th>
                      <th className="px-3 py-2">Netto</th>
                      <th className="px-3 py-2">Referenz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((item) => (
                      <tr
                        key={item.id}
                        className="rounded-2xl bg-black/20 text-sm text-white/80"
                      >
                        <td className="rounded-l-2xl px-3 py-3 whitespace-nowrap">
                          {formatDate(item.occurred_at)}
                        </td>
                        <td className="px-3 py-3">
                          {item.kind === 'video_purchase' ? 'Einzelkauf' : 'Membership'}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs ${statusBadgeClass(
                              item.status
                            )}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatMoney(item.gross_cents, item.currency)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatMoney(item.fee_cents, item.currency)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatMoney(item.net_cents, item.currency)}
                        </td>
                        <td className="rounded-r-2xl px-3 py-3">
                          <div className="max-w-[220px] truncate text-white/60">
                            {item.reference}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
                Noch keine Aktivitäten vorhanden.
              </div>
            )}
          </section>
        </main>
      </AppFrame>
    </>
  )
}