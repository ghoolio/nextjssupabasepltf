import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformFinanceAccessApi } from '@/lib/platform-admin'

type Body = {
  periodStart?: string
  periodEnd?: string
  notes?: string | null
}

type ProfileRow = {
  id: string
}

type ExistingPayoutRow = {
  id: string
}

type MembershipPaymentAggregateRow = {
  amount_cents: number
  platform_fee_amount_cents: number
  creator_net_amount_cents: number
}

function isValidIsoDateTime(value: string) {
  const date = new Date(value)
  return !Number.isNaN(date.getTime())
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

  const periodStart = body.periodStart?.trim()
  const periodEnd = body.periodEnd?.trim()
  const notes = typeof body.notes === 'string' ? body.notes.trim() : body.notes ?? null

  if (!periodStart || !isValidIsoDateTime(periodStart)) {
    return NextResponse.json({ error: 'periodStart ist ungültig.' }, { status: 400 })
  }

  if (!periodEnd || !isValidIsoDateTime(periodEnd)) {
    return NextResponse.json({ error: 'periodEnd ist ungültig.' }, { status: 400 })
  }

  if (new Date(periodStart).getTime() >= new Date(periodEnd).getTime()) {
    return NextResponse.json(
      { error: 'periodStart muss vor periodEnd liegen.' },
      { status: 400 }
    )
  }

  const { data: creatorRows, error: creatorError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .returns<ProfileRow[]>()

  if (creatorError) {
    return NextResponse.json({ error: creatorError.message }, { status: 500 })
  }

  const creators = creatorRows ?? []

  let createdCount = 0
  let skippedExistingCount = 0
  let skippedEmptyCount = 0
  const createdCreatorIds: string[] = []

  for (const creator of creators) {
    const { data: existingPayoutRows, error: existingPayoutError } = await supabaseAdmin
      .from('creator_payouts')
      .select('id')
      .eq('creator_id', creator.id)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .returns<ExistingPayoutRow[]>()

    if (existingPayoutError) {
      return NextResponse.json({ error: existingPayoutError.message }, { status: 500 })
    }

    if ((existingPayoutRows ?? []).length > 0) {
      skippedExistingCount += 1
      continue
    }

    const { data: videoRowsRaw, error: videoError } = await supabaseAdmin
      .from('video_purchases')
      .select(
        `
        amount_cents,
        platform_fee_amount_cents,
        creator_net_amount_cents,
        videos!inner(user_id),
        payment_status,
        created_at
      `
      )
      .eq('videos.user_id', creator.id)
      .eq('payment_status', 'paid')
      .gte('created_at', periodStart)
      .lt('created_at', periodEnd)

    if (videoError) {
      return NextResponse.json({ error: videoError.message }, { status: 500 })
    }

    const { data: membershipRows, error: membershipError } = await supabaseAdmin
      .from('membership_payments')
      .select('amount_cents, platform_fee_amount_cents, creator_net_amount_cents')
      .eq('creator_id', creator.id)
      .eq('payment_status', 'paid')
      .gte('paid_at', periodStart)
      .lt('paid_at', periodEnd)
      .returns<MembershipPaymentAggregateRow[]>()

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 })
    }

    const videoGross = (videoRowsRaw ?? []).reduce(
      (sum: number, row: any) => sum + row.amount_cents,
      0
    )
    const videoFees = (videoRowsRaw ?? []).reduce(
      (sum: number, row: any) => sum + (row.platform_fee_amount_cents ?? 0),
      0
    )
    const videoNet = (videoRowsRaw ?? []).reduce(
      (sum: number, row: any) => sum + (row.creator_net_amount_cents ?? 0),
      0
    )

    const membershipGross = (membershipRows ?? []).reduce(
      (sum, row) => sum + row.amount_cents,
      0
    )
    const membershipFees = (membershipRows ?? []).reduce(
      (sum, row) => sum + row.platform_fee_amount_cents,
      0
    )
    const membershipNet = (membershipRows ?? []).reduce(
      (sum, row) => sum + row.creator_net_amount_cents,
      0
    )

    const grossCents = videoGross + membershipGross
    const platformFeeCents = videoFees + membershipFees
    const netCents = videoNet + membershipNet

    if (grossCents <= 0 && netCents <= 0) {
      skippedEmptyCount += 1
      continue
    }

    const { error: insertError } = await supabaseAdmin
      .from('creator_payouts')
      .insert({
        creator_id: creator.id,
        period_start: periodStart,
        period_end: periodEnd,
        gross_cents: grossCents,
        platform_fee_cents: platformFeeCents,
        net_cents: netCents,
        status: 'pending',
        notes: notes || null,
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    createdCount += 1
    createdCreatorIds.push(creator.id)
  }

  return NextResponse.json({
    ok: true,
    createdCount,
    skippedExistingCount,
    skippedEmptyCount,
    createdCreatorIds,
  })
}