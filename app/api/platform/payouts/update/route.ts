import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformFinanceAccessApi } from '@/lib/platform-admin'

type PayoutStatus = 'pending' | 'paid_out' | 'on_hold'

type Body = {
  payoutId?: string
  status?: PayoutStatus
  notes?: string | null
}

const ALLOWED_STATUSES: PayoutStatus[] = ['pending', 'paid_out', 'on_hold']

type ExistingPayoutRow = {
  id: string
  creator_id: string
  status: PayoutStatus
  notes: string | null
  paid_out_at: string | null
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
  const status = body.status
  const notes = typeof body.notes === 'string' ? body.notes.trim() : body.notes ?? null

  if (!payoutId) {
    return NextResponse.json({ error: 'payoutId fehlt.' }, { status: 400 })
  }

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Ungültiger Status.' }, { status: 400 })
  }

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from('creator_payouts')
    .select('id, creator_id, status, notes, paid_out_at')
    .eq('id', payoutId)
    .returns<ExistingPayoutRow[]>()

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  const existing = existingRows?.[0] ?? null

  if (!existing) {
    return NextResponse.json({ error: 'Payout nicht gefunden.' }, { status: 404 })
  }

  const normalizedExistingNotes = existing.notes?.trim() || null
  const normalizedNextNotes = notes || null
  const nothingChanged =
    existing.status === status && normalizedExistingNotes === normalizedNextNotes

  if (nothingChanged) {
    return NextResponse.json({
      ok: true,
      payoutId,
      status,
      paidOutAt: existing.paid_out_at,
      skipped: true,
    })
  }

  const nextPaidOutAt =
    status === 'paid_out'
      ? existing.paid_out_at ?? new Date().toISOString()
      : null

  const { error: updateError } = await supabaseAdmin
    .from('creator_payouts')
    .update({
      status,
      notes: normalizedNextNotes,
      paid_out_at: nextPaidOutAt,
    })
    .eq('id', payoutId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { error: auditError } = await supabaseAdmin
    .from('creator_payout_audit_logs')
    .insert({
      payout_id: existing.id,
      actor_user_id: access.user.id,
      creator_id: existing.creator_id,
      previous_status: existing.status,
      new_status: status,
      previous_notes: normalizedExistingNotes,
      new_notes: normalizedNextNotes,
    })

  if (auditError) {
    return NextResponse.json(
      { error: `Payout aktualisiert, aber Audit-Log fehlgeschlagen: ${auditError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    payoutId,
    status,
    paidOutAt: nextPaidOutAt,
  })
}