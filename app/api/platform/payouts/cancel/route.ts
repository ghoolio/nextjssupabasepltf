import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformFinanceAccessApi } from '@/lib/platform-admin'

type PayoutStatus = 'pending' | 'paid_out' | 'on_hold' | 'canceled'

type Body = {
  payoutId?: string
  reason?: string | null
}

type ExistingPayoutRow = {
  id: string
  creator_id: string
  status: PayoutStatus
  notes: string | null
}

export async function POST(req: Request) {
  const access = await requirePlatformFinanceAccessApi()

  if (!access.ok) {
    return new NextResponse(access.message, { status: access.status })
  }

  let body: Body

  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 })
  }

  const payoutId = body.payoutId?.trim()
  const reason = typeof body.reason === 'string' ? body.reason.trim() : body.reason ?? null

  if (!payoutId) {
    return NextResponse.json({ error: 'payoutId fehlt.' }, { status: 400 })
  }

  const { data: payoutRows, error: payoutError } = await supabaseAdmin
    .from('creator_payouts')
    .select('id, creator_id, status, notes')
    .eq('id', payoutId)
    .returns<ExistingPayoutRow[]>()

  if (payoutError) {
    return NextResponse.json({ error: payoutError.message }, { status: 500 })
  }

  const payout = payoutRows?.[0] ?? null

  if (!payout) {
    return NextResponse.json({ error: 'Payout nicht gefunden.' }, { status: 404 })
  }

  if (payout.status === 'paid_out') {
    return NextResponse.json(
      { error: 'Ein bereits ausgezahltes Payout kann nicht storniert werden.' },
      { status: 400 }
    )
  }

  if (payout.status === 'canceled') {
    return NextResponse.json(
      { error: 'Dieses Payout ist bereits storniert.' },
      { status: 400 }
    )
  }

  const nextNotes = reason
    ? `${payout.notes?.trim() ? `${payout.notes.trim()}\n\n` : ''}[Canceled] ${reason}`
    : payout.notes?.trim() || '[Canceled]'

  const { error: unbindVideoError } = await supabaseAdmin
    .from('video_purchases')
    .update({ payout_id: null })
    .eq('payout_id', payout.id)

  if (unbindVideoError) {
    return NextResponse.json(
      { error: `Video-Posten konnten nicht gelöst werden: ${unbindVideoError.message}` },
      { status: 500 }
    )
  }

  const { error: unbindMembershipError } = await supabaseAdmin
    .from('membership_payments')
    .update({ payout_id: null })
    .eq('payout_id', payout.id)

  if (unbindMembershipError) {
    return NextResponse.json(
      { error: `Membership-Posten konnten nicht gelöst werden: ${unbindMembershipError.message}` },
      { status: 500 }
    )
  }

  const { error: updateError } = await supabaseAdmin
    .from('creator_payouts')
    .update({
      status: 'canceled',
      notes: nextNotes,
      paid_out_at: null,
    })
    .eq('id', payout.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { error: auditError } = await supabaseAdmin
    .from('creator_payout_audit_logs')
    .insert({
      payout_id: payout.id,
      actor_user_id: access.user.id,
      creator_id: payout.creator_id,
      previous_status: payout.status,
      new_status: 'canceled',
      previous_notes: payout.notes,
      new_notes: nextNotes,
    })

  if (auditError) {
    return NextResponse.json(
      { error: `Payout storniert, aber Audit-Log fehlgeschlagen: ${auditError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    payoutId: payout.id,
    status: 'canceled',
  })
}