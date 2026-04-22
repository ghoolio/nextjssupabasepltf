import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

function formatMoney(cents: number, currency: 'EUR' | 'USD' = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

export default async function SettingsPlatformPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: videoRows, error: videoError } = await supabaseAdmin
    .from('video_purchases')
    .select(
      'amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status, currency, created_at'
    )
    .returns<VideoPurchaseRow[]>()

  if (videoError) {
    throw new Error(videoError.message)
  }

  const { data: membershipRows, error: membershipError } = await supabaseAdmin
    .from('membership_payments')
    .select(
      'amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status, currency, paid_at'
    )
    .returns<MembershipPaymentRow[]>()

  if (membershipError) {
    throw new Error(membershipError.message)
  }

  const allVideoRows = videoRows ?? []
  const allMembershipRows = membershipRows ?? []

  const paidVideoRows = allVideoRows.filter((row) => row.payment_status === 'paid')
  const refundedVideoRows = allVideoRows.filter((row) => row.payment_status === 'refunded')

  const paidMembershipRows = allMembershipRows.filter((row) => row.payment_status === 'paid')
  const refundedMembershipRows = allMembershipRows.filter(
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

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
              <Link
                href="/settings"
                className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
              >
                ← Zurück zu Einstellungen
              </Link>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Plattform
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Interner Überblick über Umsatz, Gebühren und Creator-Auszahlungen.
              </p>
            </div>
          </div>

          <section className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/40">Brutto gesamt</div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {formatMoney(totalGross)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/40">
                Plattformgebühren gesamt
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

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
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
        </main>
      </AppFrame>
    </>
  )
}