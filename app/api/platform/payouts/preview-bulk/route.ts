import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformFinanceAccessApi } from '@/lib/platform-admin'

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
}

type ExistingPayoutRow = {
  id: string
  creator_id: string
}

type MembershipPaymentAggregateRow = {
  creator_id: string
  amount_cents: number
  platform_fee_amount_cents: number
  creator_net_amount_cents: number
}

function isValidIsoDateTime(value: string) {
  const date = new Date(value)
  return !Number.isNaN(date.getTime())
}

export async function GET(req: Request) {
  const access = await requirePlatformFinanceAccessApi()

  if (!access.ok) {
    return new NextResponse(access.message, { status: access.status })
  }

  const { searchParams } = new URL(req.url)
  const periodStart = (searchParams.get('periodStart') || '').trim()
  const periodEnd = (searchParams.get('periodEnd') || '').trim()

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

  const { data: profileRows, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, username, display_name')
    .returns<ProfileRow[]>()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  const profileMap = new Map((profileRows ?? []).map((row) => [row.id, row]))

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from('creator_payouts')
    .select('id, creator_id')
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .returns<ExistingPayoutRow[]>()

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  const existingCreatorIds = new Set((existingRows ?? []).map((row) => row.creator_id))

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
    .eq('payment_status', 'paid')
    .gte('created_at', periodStart)
    .lt('created_at', periodEnd)

  if (videoError) {
    return NextResponse.json({ error: videoError.message }, { status: 500 })
  }

  const { data: membershipRows, error: membershipError } = await supabaseAdmin
    .from('membership_payments')
    .select('creator_id, amount_cents, platform_fee_amount_cents, creator_net_amount_cents')
    .eq('payment_status', 'paid')
    .gte('paid_at', periodStart)
    .lt('paid_at', periodEnd)
    .returns<MembershipPaymentAggregateRow[]>()

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 })
  }

  const aggregates = new Map<
    string,
    {
      creatorId: string
      grossCents: number
      feeCents: number
      netCents: number
    }
  >()

  for (const row of videoRowsRaw ?? []) {
    const creatorId = row.videos?.[0]?.user_id as string | undefined
    if (!creatorId) continue

    const current = aggregates.get(creatorId) ?? {
      creatorId,
      grossCents: 0,
      feeCents: 0,
      netCents: 0,
    }

    current.grossCents += row.amount_cents
    current.feeCents += row.platform_fee_amount_cents ?? 0
    current.netCents += row.creator_net_amount_cents ?? 0
    aggregates.set(creatorId, current)
  }

  for (const row of membershipRows ?? []) {
    const current = aggregates.get(row.creator_id) ?? {
      creatorId: row.creator_id,
      grossCents: 0,
      feeCents: 0,
      netCents: 0,
    }

    current.grossCents += row.amount_cents
    current.feeCents += row.platform_fee_amount_cents
    current.netCents += row.creator_net_amount_cents
    aggregates.set(row.creator_id, current)
  }

  const withRevenue = [...aggregates.values()].filter(
    (row) => row.grossCents > 0 || row.netCents > 0
  )

  const creatable = withRevenue.filter((row) => !existingCreatorIds.has(row.creatorId))
  const skippedExisting = withRevenue.filter((row) => existingCreatorIds.has(row.creatorId))

  const grossCents = creatable.reduce((sum, row) => sum + row.grossCents, 0)
  const feeCents = creatable.reduce((sum, row) => sum + row.feeCents, 0)
  const netCents = creatable.reduce((sum, row) => sum + row.netCents, 0)

  const topCreators = creatable
    .slice()
    .sort((a, b) => b.netCents - a.netCents)
    .slice(0, 8)
    .map((row) => {
      const profile = profileMap.get(row.creatorId)
      return {
        creatorId: row.creatorId,
        username: profile?.username ?? null,
        displayName: profile?.display_name ?? null,
        grossCents: row.grossCents,
        feeCents: row.feeCents,
        netCents: row.netCents,
      }
    })

  return NextResponse.json({
    ok: true,
    summary: {
      creatorCountWithRevenue: withRevenue.length,
      creatableCount: creatable.length,
      skippedExistingCount: skippedExisting.length,
      skippedEmptyCount: Math.max((profileRows ?? []).length - withRevenue.length, 0),
      grossCents,
      feeCents,
      netCents,
    },
    topCreators,
  })
}