import Link from 'next/link'
import { notFound } from 'next/navigation'
import PlatformShell from '@/components/platform-shell'
import PayoutStatusForm from '@/components/payout-status-form'
import PayoutCancelButton from '@/components/payout-cancel-button'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformFinanceAccess } from '@/lib/platform-admin'

type PayoutStatus = 'pending' | 'paid_out' | 'on_hold' | 'canceled'

type CreatorPayoutRow = {
  id: string
  creator_id: string
  period_start: string
  period_end: string
  gross_cents: number
  platform_fee_cents: number
  net_cents: number
  status: PayoutStatus
  paid_out_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
}

type VideoPurchaseBoundRow = {
  id: string
  buyer_id: string
  amount_cents: number
  platform_fee_amount_cents: number | null
  creator_net_amount_cents: number | null
  payment_status: 'paid' | 'refunded' | 'failed'
  currency: 'EUR' | 'USD'
  created_at: string
  video_id: string
}

type MembershipPaymentBoundRow = {
  id: string
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

type AuditRow = {
  id: string
  actor_user_id: string
  creator_id: string
  previous_status: PayoutStatus
  new_status: PayoutStatus
  previous_notes: string | null
  new_notes: string | null
  created_at: string
}

function formatMoney(cents: number, currency: 'EUR' | 'USD' = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadgeClass(status: PayoutStatus) {
  if (status === 'paid_out') {
    return 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
  }
  if (status === 'on_hold') {
    return 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
  }
  if (status === 'canceled') {
    return 'border border-red-400/20 bg-red-400/10 text-red-200'
  }
  return 'border border-sky-400/20 bg-sky-400/10 text-sky-200'
}

export default async function SettingsPlatformPayoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { user } = await requirePlatformFinanceAccess()
  const { id } = await params

  const { data: payoutRows, error: payoutError } = await supabaseAdmin
    .from('creator_payouts')
    .select(
      'id, creator_id, period_start, period_end, gross_cents, platform_fee_cents, net_cents, status, paid_out_at, notes, created_at, updated_at'
    )
    .eq('id', id)
    .returns<CreatorPayoutRow[]>()

  if (payoutError) {
    throw new Error(payoutError.message)
  }

  const payout = payoutRows?.[0] ?? null

  if (!payout) {
    notFound()
  }

  const { data: profileRows, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, username, display_name')
    .in('id', [payout.creator_id, user.id])
    .returns<ProfileRow[]>()

  if (profileError) {
    throw new Error(profileError.message)
  }

  const profileMap = new Map((profileRows ?? []).map((row) => [row.id, row]))
  const creator = profileMap.get(payout.creator_id)

  const { data: videoRows, error: videoError } = await supabaseAdmin
    .from('video_purchases')
    .select(
      'id, buyer_id, amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status, currency, created_at, video_id'
    )
    .eq('payout_id', payout.id)
    .order('created_at', { ascending: false })
    .returns<VideoPurchaseBoundRow[]>()

  if (videoError) {
    throw new Error(videoError.message)
  }

  const { data: membershipRows, error: membershipError } = await supabaseAdmin
    .from('membership_payments')
    .select(
      'id, member_id, tier_id, amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status, currency, paid_at, provider_invoice_id, provider_subscription_id'
    )
    .eq('payout_id', payout.id)
    .order('paid_at', { ascending: false })
    .returns<MembershipPaymentBoundRow[]>()

  if (membershipError) {
    throw new Error(membershipError.message)
  }

  const { data: auditRows, error: auditError } = await supabaseAdmin
    .from('creator_payout_audit_logs')
    .select(
      'id, actor_user_id, creator_id, previous_status, new_status, previous_notes, new_notes, created_at'
    )
    .eq('payout_id', payout.id)
    .order('created_at', { ascending: false })
    .returns<AuditRow[]>()

  if (auditError) {
    throw new Error(auditError.message)
  }

  const actorIds = [...new Set((auditRows ?? []).map((row) => row.actor_user_id))]
  let actorMap = new Map<string, ProfileRow>()

  if (actorIds.length > 0) {
    const { data: actorRows, error: actorError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name')
      .in('id', actorIds)
      .returns<ProfileRow[]>()

    if (actorError) {
      throw new Error(actorError.message)
    }

    actorMap = new Map((actorRows ?? []).map((row) => [row.id, row]))
  }

  const videoCount = videoRows?.length ?? 0
  const membershipCount = membershipRows?.length ?? 0
  const canCancel = payout.status === 'pending' || payout.status === 'on_hold'

  const actions = (
    <>
      <Link
        href="/settings/platform/payouts"
        className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
      >
        Zurück zu Payouts
      </Link>

      <PayoutStatusForm
        payoutId={payout.id}
        currentStatus={payout.status === 'canceled' ? 'pending' : payout.status}
        currentNotes={payout.notes}
      />

      {canCancel ? <PayoutCancelButton payoutId={payout.id} /> : null}
    </>
  )

  return (
    <PlatformShell
      userEmail={user.email}
      current="payouts"
      title={`Payout ${payout.id.slice(0, 8)}`}
      description={`${creator?.display_name || creator?.username || payout.creator_id} • ${formatDate(
        payout.period_start
      )} bis ${formatDate(payout.period_end)}`}
      actions={actions}
    >
      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Brutto</div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {formatMoney(payout.gross_cents)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Gebühren</div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {formatMoney(payout.platform_fee_cents)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Netto</div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {formatMoney(payout.net_cents)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Status</div>
          <div className="mt-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-sm ${statusBadgeClass(
                payout.status
              )}`}
            >
              {payout.status}
            </span>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Video-Posten</div>
          <div className="mt-2 text-2xl font-semibold text-white">{videoCount}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Membership-Posten</div>
          <div className="mt-2 text-2xl font-semibold text-white">{membershipCount}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Ausgezahlt am</div>
          <div className="mt-2 text-sm font-medium text-white">
            {formatDateTime(payout.paid_out_at)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Notiz</div>
          <div className="mt-2 whitespace-pre-wrap break-words text-sm text-white/70">
            {payout.notes || '—'}
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Gebundene Video-Käufe</h2>
        </div>

        {(videoRows ?? []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-white/40">
                  <th className="px-3 py-2">Zeit</th>
                  <th className="px-3 py-2">Video</th>
                  <th className="px-3 py-2">Buyer</th>
                  <th className="px-3 py-2">Brutto</th>
                  <th className="px-3 py-2">Gebühr</th>
                  <th className="px-3 py-2">Netto</th>
                </tr>
              </thead>
              <tbody>
                {(videoRows ?? []).map((row) => (
                  <tr
                    key={row.id}
                    className="rounded-2xl bg-black/20 text-sm text-white/80"
                  >
                    <td className="rounded-l-2xl px-3 py-3 whitespace-nowrap">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-3 py-3">{row.video_id}</td>
                    <td className="px-3 py-3">{row.buyer_id}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatMoney(row.amount_cents, row.currency)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatMoney(row.platform_fee_amount_cents ?? 0, row.currency)}
                    </td>
                    <td className="rounded-r-2xl px-3 py-3 whitespace-nowrap">
                      {formatMoney(row.creator_net_amount_cents ?? 0, row.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
            Keine Video-Käufe an dieses Payout gebunden.
          </div>
        )}
      </section>

      <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Gebundene Membership-Zahlungen</h2>
        </div>

        {(membershipRows ?? []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-white/40">
                  <th className="px-3 py-2">Zeit</th>
                  <th className="px-3 py-2">Tier</th>
                  <th className="px-3 py-2">Member</th>
                  <th className="px-3 py-2">Brutto</th>
                  <th className="px-3 py-2">Gebühr</th>
                  <th className="px-3 py-2">Netto</th>
                </tr>
              </thead>
              <tbody>
                {(membershipRows ?? []).map((row) => (
                  <tr
                    key={row.id}
                    className="rounded-2xl bg-black/20 text-sm text-white/80"
                  >
                    <td className="rounded-l-2xl px-3 py-3 whitespace-nowrap">
                      {formatDateTime(row.paid_at)}
                    </td>
                    <td className="px-3 py-3">{row.tier_id}</td>
                    <td className="px-3 py-3">{row.member_id}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatMoney(row.amount_cents, row.currency)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatMoney(row.platform_fee_amount_cents, row.currency)}
                    </td>
                    <td className="rounded-r-2xl px-3 py-3 whitespace-nowrap">
                      {formatMoney(row.creator_net_amount_cents, row.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
            Keine Membership-Zahlungen an dieses Payout gebunden.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Payout-Audit</h2>
        </div>

        {(auditRows ?? []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-white/40">
                  <th className="px-3 py-2">Zeit</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Von</th>
                  <th className="px-3 py-2">Zu</th>
                  <th className="px-3 py-2">Notiz alt</th>
                  <th className="px-3 py-2">Notiz neu</th>
                </tr>
              </thead>
              <tbody>
                {(auditRows ?? []).map((row) => {
                  const actor = actorMap.get(row.actor_user_id)

                  return (
                    <tr
                      key={row.id}
                      className="rounded-2xl bg-black/20 text-sm text-white/80"
                    >
                      <td className="rounded-l-2xl px-3 py-3 whitespace-nowrap">
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-white">
                          {actor?.display_name || actor?.username || row.actor_user_id}
                        </div>
                        <div className="text-xs text-white/45">
                          @{actor?.username || 'unknown'}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${statusBadgeClass(
                            row.previous_status
                          )}`}
                        >
                          {row.previous_status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${statusBadgeClass(
                            row.new_status
                          )}`}
                        >
                          {row.new_status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="max-w-[220px] whitespace-pre-wrap break-words text-white/60">
                          {row.previous_notes || '—'}
                        </div>
                      </td>
                      <td className="rounded-r-2xl px-3 py-3">
                        <div className="max-w-[220px] whitespace-pre-wrap break-words text-white/60">
                          {row.new_notes || '—'}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
            Noch keine Audit-Einträge für dieses Payout vorhanden.
          </div>
        )}
      </section>
    </PlatformShell>
  )
}