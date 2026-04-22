import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import PlatformNav from '@/components/platform-nav'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  requirePlatformSupportAccess,
  getPlatformAccessState,
} from '@/lib/platform-admin'

type VideoPurchaseRow = {
  amount_cents: number
  platform_fee_amount_cents: number | null
  creator_net_amount_cents: number | null
  payment_status: 'paid' | 'refunded' | 'failed'
  currency: 'EUR' | 'USD'
  created_at?: string | null
}

type MembershipPaymentRow = {
  amount_cents: number
  platform_fee_amount_cents: number
  creator_net_amount_cents: number
  payment_status: 'paid' | 'refunded' | 'failed'
  currency: 'EUR' | 'USD'
  paid_at: string
}

type RangeKey = 'today' | '7d' | '30d' | 'all'

function formatMoney(cents: number, currency: 'EUR' | 'USD' = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

function getRangeStart(range: RangeKey) {
  const now = new Date()

  if (range === 'all') return null

  if (range === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start.toISOString()
  }

  if (range === '7d') {
    const start = new Date(now)
    start.setDate(start.getDate() - 7)
    return start.toISOString()
  }

  const start = new Date(now)
  start.setDate(start.getDate() - 30)
  return start.toISOString()
}

function getRangeLabel(range: RangeKey) {
  switch (range) {
    case 'today':
      return 'Heute'
    case '7d':
      return '7 Tage'
    case '30d':
      return '30 Tage'
    case 'all':
      return 'Gesamt'
  }
}

export default async function SettingsPlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { user } = await requirePlatformSupportAccess()
  const accessState = await getPlatformAccessState()
  const qs = await searchParams

  const canSeeFinance = accessState.canAccessPlatformFinance
  const canSeeSupport = accessState.canAccessPlatformSupport
  const platformRole = accessState.platformRole

  const range = (['today', '7d', '30d', 'all'].includes(qs.range || '')
    ? qs.range
    : '30d') as RangeKey

  const startDate = getRangeStart(range)

  let videoRows: VideoPurchaseRow[] = []
  let membershipRows: MembershipPaymentRow[] = []

  if (canSeeFinance) {
    let videoQuery = supabaseAdmin
      .from('video_purchases')
      .select(
        'amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status, currency, created_at'
      )

    if (startDate) {
      videoQuery = videoQuery.gte('created_at', startDate)
    }

    const { data: fetchedVideoRows, error: videoError } =
      await videoQuery.returns<VideoPurchaseRow[]>()

    if (videoError) {
      throw new Error(videoError.message)
    }

    let membershipQuery = supabaseAdmin
      .from('membership_payments')
      .select(
        'amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status, currency, paid_at'
      )

    if (startDate) {
      membershipQuery = membershipQuery.gte('paid_at', startDate)
    }

    const { data: fetchedMembershipRows, error: membershipError } =
      await membershipQuery.returns<MembershipPaymentRow[]>()

    if (membershipError) {
      throw new Error(membershipError.message)
    }

    videoRows = fetchedVideoRows ?? []
    membershipRows = fetchedMembershipRows ?? []
  }

  const paidVideoRows = videoRows.filter((row) => row.payment_status === 'paid')
  const refundedVideoRows = videoRows.filter((row) => row.payment_status === 'refunded')

  const paidMembershipRows = membershipRows.filter((row) => row.payment_status === 'paid')
  const refundedMembershipRows = membershipRows.filter(
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

  const refundedVideoGross = refundedVideoRows.reduce((sum, row) => sum + row.amount_cents, 0)
  const refundedMembershipGross = refundedMembershipRows.reduce(
    (sum, row) => sum + row.amount_cents,
    0
  )

  const totalGross = videoGross + membershipGross
  const totalFees = videoFees + membershipFees
  const totalNet = videoNet + membershipNet
  const totalRefundedGross = refundedVideoGross + refundedMembershipGross

  const totalPaidTransactions = paidVideoRows.length + paidMembershipRows.length
  const totalRefundedTransactions =
    refundedVideoRows.length + refundedMembershipRows.length

  const rangeLinks: { key: RangeKey; label: string }[] = [
    { key: 'today', label: 'Heute' },
    { key: '7d', label: '7 Tage' },
    { key: '30d', label: '30 Tage' },
    { key: 'all', label: 'Gesamt' },
  ]

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <div className="mb-6 flex flex-col gap-4">
            <PlatformNav current="overview" range={range} />

            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  Plattform
                </h1>
                <p className="mt-1 text-sm text-white/50">
                  Interner Bereich für Support-, Creator- und Finanzansichten.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                  Rolle: {platformRole}
                </span>

                {canSeeFinance
                  ? rangeLinks.map((item) => {
                      const active = item.key === range
                      return (
                        <Link
                          key={item.key}
                          href={`/settings/platform?range=${item.key}`}
                          className={`rounded-full border px-4 py-2 text-sm transition ${
                            active
                              ? 'border-white bg-white text-black'
                              : 'border-white/10 text-white hover:bg-white/10'
                          }`}
                        >
                          {item.label}
                        </Link>
                      )
                    })
                  : null}
              </div>
            </div>
          </div>

          {canSeeFinance ? (
            <>
              <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Einzelposten</h2>
                    <p className="mt-1 text-sm text-white/45">
                      Alle Plattform-Transaktionen als Liste ansehen.
                    </p>
                  </div>

                  <Link
                    href={`/settings/platform/transactions?range=${range}`}
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
                  >
                    Transaktionen öffnen
                  </Link>
                </div>
              </section>

              <section className="mb-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs uppercase tracking-wide text-white/40">
                    Brutto {getRangeLabel(range)}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {formatMoney(totalGross)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs uppercase tracking-wide text-white/40">
                    Plattformgebühren
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {formatMoney(totalFees)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs uppercase tracking-wide text-white/40">
                    Netto an Creator
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {formatMoney(totalNet)}
                  </div>
                </div>
              </section>

              <section className="mb-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs uppercase tracking-wide text-white/40">
                    Bezahlte Transaktionen
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {totalPaidTransactions}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs uppercase tracking-wide text-white/40">
                    Refunds
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {totalRefundedTransactions}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs uppercase tracking-wide text-white/40">
                    Refund-Volumen
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {formatMoney(totalRefundedGross)}
                  </div>
                </div>
              </section>

              <section className="mb-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-lg font-semibold text-white">Einzelkäufe</h2>
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    <div className="flex items-center justify-between gap-4">
                      <span>Brutto</span>
                      <span className="text-white">{formatMoney(videoGross)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Plattformgebühren</span>
                      <span className="text-white">{formatMoney(videoFees)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Netto Creator</span>
                      <span className="text-white">{formatMoney(videoNet)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Refund-Volumen</span>
                      <span className="text-white">{formatMoney(refundedVideoGross)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Anzahl bezahlt</span>
                      <span className="text-white">{paidVideoRows.length}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Anzahl refunded</span>
                      <span className="text-white">{refundedVideoRows.length}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-lg font-semibold text-white">Mitgliedschaften</h2>
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    <div className="flex items-center justify-between gap-4">
                      <span>Brutto</span>
                      <span className="text-white">{formatMoney(membershipGross)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Plattformgebühren</span>
                      <span className="text-white">{formatMoney(membershipFees)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Netto Creator</span>
                      <span className="text-white">{formatMoney(membershipNet)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Refund-Volumen</span>
                      <span className="text-white">{formatMoney(refundedMembershipGross)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Anzahl bezahlt</span>
                      <span className="text-white">{paidMembershipRows.length}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Anzahl refunded</span>
                      <span className="text-white">{refundedMembershipRows.length}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-semibold text-white">Einordnung</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Plattformanteil
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {totalGross > 0 ? ((totalFees / totalGross) * 100).toFixed(1) : '0.0'}%
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Creator-Anteil
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {totalGross > 0 ? ((totalNet / totalGross) * 100).toFixed(1) : '0.0'}%
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Refund-Quote
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {totalPaidTransactions + totalRefundedTransactions > 0
                        ? (
                            (totalRefundedTransactions /
                              (totalPaidTransactions + totalRefundedTransactions)) *
                            100
                          ).toFixed(1)
                        : '0.0'}
                      %
                    </div>
                  </div>
                </div>
              </section>
            </>
          ) : null}

          {canSeeSupport ? (
            <>
              <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Creator drilldown</h2>
                    <p className="mt-1 text-sm text-white/45">
                      Creator-Übersichten, Status und Detailseiten ansehen.
                    </p>
                  </div>

                  <Link
                    href="/settings/platform/creators"
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    Creator öffnen
                  </Link>
                </div>
              </section>

              <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Membership-Drilldown</h2>
                    <p className="mt-1 text-sm text-white/45">
                      Aktive, gekündigte und abgelaufene Memberships ansehen.
                    </p>
                  </div>

                  <Link
                    href="/settings/platform/memberships"
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    Memberships öffnen
                  </Link>
                </div>
              </section>
            </>
          ) : null}

          {!canSeeFinance && canSeeSupport ? (
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">Hinweis</h2>
              <p className="mt-2 text-sm text-white/55">
                Deine Rolle erlaubt Support- und Creator-Einsicht, aber keine globalen Finanzkennzahlen
                oder Transaktionsansichten.
              </p>
            </section>
          ) : null}
        </main>
      </AppFrame>
    </>
  )
}