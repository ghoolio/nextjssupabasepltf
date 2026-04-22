import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformFinanceAccessApi } from '@/lib/platform-admin'

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  membership_enabled: boolean
  stripe_account_id: string | null
}

type VideoPurchaseAggregateRow = {
  creator_id: string
  amount_cents: number
  platform_fee_amount_cents: number | null
  creator_net_amount_cents: number | null
  payment_status: 'paid' | 'refunded' | 'failed'
}

type MembershipPaymentAggregateRow = {
  creator_id: string
  amount_cents: number
  platform_fee_amount_cents: number
  creator_net_amount_cents: number
  payment_status: 'paid' | 'refunded' | 'failed'
}

type MembershipTierRow = {
  creator_id: string
  archived: boolean
}

type CreatorStats = {
  creator_id: string
  display_name: string
  username: string
  membership_enabled: boolean
  stripe_connected: boolean
  video_gross: number
  video_fees: number
  video_net: number
  membership_gross: number
  membership_fees: number
  membership_net: number
  video_paid_count: number
  membership_paid_count: number
  active_tier_count: number
  total_gross: number
  total_fees: number
  total_net: number
  total_paid_count: number
}

type ConnectFilter = 'all' | 'connected' | 'missing'
type MembershipFilter = 'all' | 'enabled' | 'disabled'
type RevenueFilter = 'all' | 'with' | 'without'

function escapeCsvValue(value: string | number | boolean | null | undefined) {
  const stringValue = String(value ?? '')
  if (
    stringValue.includes('"') ||
    stringValue.includes(',') ||
    stringValue.includes('\n')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function toCsv(rows: CreatorStats[]) {
  const headers = [
    'creator_id',
    'display_name',
    'username',
    'membership_enabled',
    'stripe_connected',
    'active_tier_count',
    'video_gross_cents',
    'video_fee_cents',
    'video_net_cents',
    'membership_gross_cents',
    'membership_fee_cents',
    'membership_net_cents',
    'total_gross_cents',
    'total_fee_cents',
    'total_net_cents',
    'video_paid_count',
    'membership_paid_count',
    'total_paid_count',
  ]

  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      [
        row.creator_id,
        row.display_name,
        row.username,
        row.membership_enabled,
        row.stripe_connected,
        row.active_tier_count,
        row.video_gross,
        row.video_fees,
        row.video_net,
        row.membership_gross,
        row.membership_fees,
        row.membership_net,
        row.total_gross,
        row.total_fees,
        row.total_net,
        row.video_paid_count,
        row.membership_paid_count,
        row.total_paid_count,
      ]
        .map(escapeCsvValue)
        .join(',')
    ),
  ]

  return lines.join('\n')
}

export async function GET(req: Request) {
  const access = await requirePlatformFinanceAccessApi()

  if (!access.ok) {
    return new NextResponse(access.message, { status: access.status })
  }

  const { searchParams } = new URL(req.url)

  const connectFilter = (['all', 'connected', 'missing'].includes(searchParams.get('connect') || '')
    ? searchParams.get('connect')
    : 'all') as ConnectFilter

  const membershipFilter = (['all', 'enabled', 'disabled'].includes(searchParams.get('memberships') || '')
    ? searchParams.get('memberships')
    : 'all') as MembershipFilter

  const revenueFilter = (['all', 'with', 'without'].includes(searchParams.get('revenue') || '')
    ? searchParams.get('revenue')
    : 'all') as RevenueFilter

  const query = (searchParams.get('q') || '').trim().toLowerCase()

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, username, display_name, membership_enabled, stripe_account_id')
    .returns<ProfileRow[]>()

  if (profilesError) {
    return new NextResponse(profilesError.message, { status: 500 })
  }

  const { data: videoRows, error: videoError } = await supabaseAdmin
    .from('video_purchases')
    .select(
      `
      amount_cents,
      platform_fee_amount_cents,
      creator_net_amount_cents,
      payment_status,
      videos!inner(user_id)
    `
    )

  if (videoError) {
    return new NextResponse(videoError.message, { status: 500 })
  }

  const normalizedVideoRows: VideoPurchaseAggregateRow[] = (videoRows ?? []).map((row: any) => ({
    creator_id: row.videos.user_id,
    amount_cents: row.amount_cents,
    platform_fee_amount_cents: row.platform_fee_amount_cents,
    creator_net_amount_cents: row.creator_net_amount_cents,
    payment_status: row.payment_status,
  }))

  const { data: membershipRows, error: membershipError } = await supabaseAdmin
    .from('membership_payments')
    .select(
      'creator_id, amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status'
    )
    .returns<MembershipPaymentAggregateRow[]>()

  if (membershipError) {
    return new NextResponse(membershipError.message, { status: 500 })
  }

  const { data: tierRows, error: tierError } = await supabaseAdmin
    .from('membership_tiers')
    .select('creator_id, archived')
    .returns<MembershipTierRow[]>()

  if (tierError) {
    return new NextResponse(tierError.message, { status: 500 })
  }

  const statsMap = new Map<
    string,
    Omit<CreatorStats, 'total_gross' | 'total_fees' | 'total_net' | 'total_paid_count'>
  >()

  for (const profile of profiles ?? []) {
    statsMap.set(profile.id, {
      creator_id: profile.id,
      display_name: profile.display_name || profile.username || 'Unbekannter Creator',
      username: profile.username || 'creator',
      membership_enabled: profile.membership_enabled,
      stripe_connected: Boolean(profile.stripe_account_id),
      video_gross: 0,
      video_fees: 0,
      video_net: 0,
      membership_gross: 0,
      membership_fees: 0,
      membership_net: 0,
      video_paid_count: 0,
      membership_paid_count: 0,
      active_tier_count: 0,
    })
  }

  for (const row of normalizedVideoRows) {
    const stats = statsMap.get(row.creator_id)
    if (!stats || row.payment_status !== 'paid') continue

    stats.video_gross += row.amount_cents
    stats.video_fees += row.platform_fee_amount_cents ?? 0
    stats.video_net += row.creator_net_amount_cents ?? 0
    stats.video_paid_count += 1
  }

  for (const row of membershipRows ?? []) {
    const stats = statsMap.get(row.creator_id)
    if (!stats || row.payment_status !== 'paid') continue

    stats.membership_gross += row.amount_cents
    stats.membership_fees += row.platform_fee_amount_cents
    stats.membership_net += row.creator_net_amount_cents
    stats.membership_paid_count += 1
  }

  for (const row of tierRows ?? []) {
    const stats = statsMap.get(row.creator_id)
    if (!stats || row.archived) continue
    stats.active_tier_count += 1
  }

  const creators: CreatorStats[] = [...statsMap.values()]
    .map((stats) => ({
      ...stats,
      total_gross: stats.video_gross + stats.membership_gross,
      total_fees: stats.video_fees + stats.membership_fees,
      total_net: stats.video_net + stats.membership_net,
      total_paid_count: stats.video_paid_count + stats.membership_paid_count,
    }))
    .filter((creator) => {
      if (connectFilter === 'connected' && !creator.stripe_connected) return false
      if (connectFilter === 'missing' && creator.stripe_connected) return false

      if (membershipFilter === 'enabled' && !creator.membership_enabled) return false
      if (membershipFilter === 'disabled' && creator.membership_enabled) return false

      if (revenueFilter === 'with' && creator.total_gross <= 0) return false
      if (revenueFilter === 'without' && creator.total_gross > 0) return false

      if (!query) return true

      const haystack = [creator.display_name, creator.username].join(' ').toLowerCase()
      return haystack.includes(query)
    })
    .sort((a, b) => b.total_gross - a.total_gross)

  const csv = toCsv(creators)
  const filename = 'platform-creators.csv'

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}