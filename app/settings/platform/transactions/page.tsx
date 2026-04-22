import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

type PlatformTransaction = {
  id: string
  kind: 'video_purchase' | 'membership_payment'
  reference: string
  actor_id: string
  counterparty_id: string
  gross_cents: number
  fee_cents: number
  net_cents: number
  status: 'paid' | 'refunded' | 'failed'
  currency: 'EUR' | 'USD'
  occurred_at: string
}

type RangeKey = 'today' | '7d' | '30d' | 'all'

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

function statusBadgeClass(status: PlatformTransaction['status']) {
  if (status === 'paid') {
    return 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
  }
  if (status === 'refunded') {
    return 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
  }
  return 'border border-red-400/20 bg-red-400/10 text-red-200'
}

export default async function SettingsPlatformTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const supabase = await createClient()
  const qs = await searchParams

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const range = (['today', '7d', '30d', 'all'].includes(qs.range || '')
    ? qs.range
    : '30d') as RangeKey

  const startDate = getRangeStart(range)

  let videoQuery = supabaseAdmin
    .from('video_purchases')
    .select(
      'video_id, buyer_id, amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status, currency, created_at'
    )
    .order('created_at', { ascending: false })

  if (startDate) {
    videoQuery = videoQuery.gte('created_at', startDate)
  }

  const { data: videoRows, error: videoError } = await videoQuery.returns<VideoPurchaseRow[]>()

  if (videoError) {
    throw new Error(videoError.message)
  }

  let membershipQuery = supabaseAdmin
    .from('membership_payments')
    .select(
      'creator_id, member_id, tier_id, amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status, currency, paid_at, provider_invoice_id, provider_subscription_id'
    )
    .order('paid_at', { ascending: false })

  if (startDate) {
    membershipQuery = membershipQuery.gte('paid_at', startDate)
  }

  const { data: membershipRows, error: membershipError } = await membershipQuery.returns<MembershipPaymentRow[]>()

  if (membershipError) {
    throw new Error(membershipError.message)
  }

  const videoTransactions: PlatformTransaction[] = (videoRows ?? []).map((row) => ({
    id: `video_${row.video_id}_${row.buyer_id}_${row.created_at}`,
    kind: 'video_purchase',
    reference: row.video_id,
    actor_id: row.buyer_id,
    counterparty_id: '',
    gross_cents: row.amount_cents,
    fee_cents: row.platform_fee_amount_cents ?? 0,
    net_cents: row.creator_net_amount_cents ?? 0,
    status: row.payment_status,
    currency: row.currency,
    occurred_at: row.created_at,
  }))

  const membershipTransactions: PlatformTransaction[] = (membershipRows ?? []).map((row) => ({
    id: `membership_${row.provider_invoice_id || row.tier_id}_${row.paid_at}`,
    kind: 'membership_payment',
    reference: row.tier_id,
    actor_id: row.member_id,
    counterparty_id: row.creator_id,
    gross_cents: row.amount_cents,
    fee_cents: row.platform_fee_amount_cents,
    net_cents: row.creator_net_amount_cents,
    status: row.payment_status,
    currency: row.currency,
    occurred_at: row.paid_at,
  }))

  const transactions = [...videoTransactions, ...membershipTransactions].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  )

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
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
              <Link
                href={`/settings/platform?range=${range}`}
                className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
              >
                ← Zurück zu Plattform
              </Link>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  Transaktionen
                </h1>
                <p className="mt-1 text-sm text-white/50">
                  Einzelposten aus Einzelkäufen und Membership-Zahlungen.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {rangeLinks.map((item) => {
                  const active = item.key === range
                  return (
                    <Link
                      key={item.key}
                      href={`/settings/platform/transactions?range=${item.key}`}
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
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
            {transactions.length > 0 ? (
              <div className="overflow-x-auto">
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
                    {transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="rounded-2xl bg-black/20 text-sm text-white/80"
                      >
                        <td className="rounded-l-2xl px-3 py-3 whitespace-nowrap">
                          {formatDate(tx.occurred_at)}
                        </td>
                        <td className="px-3 py-3">
                          {tx.kind === 'video_purchase' ? 'Einzelkauf' : 'Membership'}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs ${statusBadgeClass(
                              tx.status
                            )}`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatMoney(tx.gross_cents, tx.currency)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatMoney(tx.fee_cents, tx.currency)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatMoney(tx.net_cents, tx.currency)}
                        </td>
                        <td className="rounded-r-2xl px-3 py-3">
                          <div className="max-w-[240px] truncate text-white/60">
                            {tx.reference}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/50">
                Keine Transaktionen im gewählten Zeitraum vorhanden.
              </div>
            )}
          </section>
        </main>
      </AppFrame>
    </>
  )
}