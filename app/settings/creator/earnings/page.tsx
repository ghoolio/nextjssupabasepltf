import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import { createClient } from '@/lib/supabase-server'

type VideoPurchaseRow = {
  amount_cents: number
  platform_fee_amount_cents: number | null
  creator_net_amount_cents: number | null
  payment_status: 'paid' | 'refunded' | 'failed'
  currency: 'EUR' | 'USD'
  created_at?: string
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

export default async function SettingsCreatorEarningsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: videoRows } = await supabase
    .from('video_purchases')
    .select(
      'amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status, currency, created_at, videos!inner(user_id)'
    )
    .eq('videos.user_id', user.id)

  const { data: membershipRows } = await supabase
    .from('membership_payments')
    .select(
      'amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status, currency, paid_at'
    )
    .eq('creator_id', user.id)
    .returns<MembershipPaymentRow[]>()

  const paidVideoRows = (videoRows ?? []).filter((row: any) => row.payment_status === 'paid') as VideoPurchaseRow[]
  const paidMembershipRows = (membershipRows ?? []).filter((row) => row.payment_status === 'paid')

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

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
                <Link
                    href="/settings/creator/earnings"
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/10"
                >
                    <div className="text-sm font-medium text-white">Einnahmen</div>
                    <div className="mt-1 text-sm text-white/45">
                        Umsatz, Gebühren und Netto-Einnahmen ansehen
                    </div>
                </Link>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Einnahmen
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Überblick über Brutto, Plattformgebühren und Netto-Einnahmen.
              </p>
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

          <section className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-medium text-white">Einzelkäufe</div>
              <div className="mt-4 space-y-2 text-sm text-white/70">
                <div>Brutto: {formatMoney(videoGross)}</div>
                <div>Gebühren: {formatMoney(videoFees)}</div>
                <div>Netto: {formatMoney(videoNet)}</div>
                <div>Anzahl: {paidVideoRows.length}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-medium text-white">Mitgliedschaften</div>
              <div className="mt-4 space-y-2 text-sm text-white/70">
                <div>Brutto: {formatMoney(membershipGross)}</div>
                <div>Gebühren: {formatMoney(membershipFees)}</div>
                <div>Netto: {formatMoney(membershipNet)}</div>
                <div>Anzahl Zahlungen: {paidMembershipRows.length}</div>
              </div>
            </div>
          </section>
        </main>
      </AppFrame>
    </>
  )
}