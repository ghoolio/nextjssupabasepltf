import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAdminApi } from '@/lib/platform-admin'

type MembershipStatus = 'active' | 'canceled' | 'expired'
type StatusFilter = MembershipStatus | 'all'

type MembershipRow = {
  creator_id: string
  member_id: string
  tier_id: string
  status: MembershipStatus
  provider: string | null
  provider_subscription_id: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  cancel_at: string | null
  stripe_customer_id: string | null
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
}

type TierRow = {
  id: string
  name: string
  price_cents: number
  currency: 'EUR' | 'USD'
}

type MembershipCsvRow = {
  creator_id: string
  creator_username: string
  creator_display_name: string
  member_id: string
  member_username: string
  member_display_name: string
  tier_id: string
  tier_name: string
  tier_price_cents: number | ''
  tier_currency: 'EUR' | 'USD' | ''
  status: MembershipStatus
  provider: string
  provider_subscription_id: string
  stripe_customer_id: string
  current_period_end: string
  cancel_at_period_end: boolean
  cancel_at: string
}

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

function toCsv(rows: MembershipCsvRow[]) {
  const headers = [
    'creator_id',
    'creator_username',
    'creator_display_name',
    'member_id',
    'member_username',
    'member_display_name',
    'tier_id',
    'tier_name',
    'tier_price_cents',
    'tier_currency',
    'status',
    'provider',
    'provider_subscription_id',
    'stripe_customer_id',
    'current_period_end',
    'cancel_at_period_end',
    'cancel_at',
  ]

  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      [
        row.creator_id,
        row.creator_username,
        row.creator_display_name,
        row.member_id,
        row.member_username,
        row.member_display_name,
        row.tier_id,
        row.tier_name,
        row.tier_price_cents,
        row.tier_currency,
        row.status,
        row.provider,
        row.provider_subscription_id,
        row.stripe_customer_id,
        row.current_period_end,
        row.cancel_at_period_end,
        row.cancel_at,
      ]
        .map(escapeCsvValue)
        .join(',')
    ),
  ]

  return lines.join('\n')
}

export async function GET(req: Request) {
  const adminCheck = await requirePlatformAdminApi()

  if (!adminCheck.ok) {
    return new NextResponse(adminCheck.message, { status: adminCheck.status })
  }

  const { searchParams } = new URL(req.url)

  const statusFilter = (['active', 'canceled', 'expired', 'all'].includes(
    searchParams.get('status') || ''
  )
    ? searchParams.get('status')
    : 'all') as StatusFilter

  const query = (searchParams.get('q') || '').trim().toLowerCase()

  const { data: membershipRows, error: membershipError } = await supabaseAdmin
    .from('creator_memberships')
    .select(
      'creator_id, member_id, tier_id, status, provider, provider_subscription_id, current_period_end, cancel_at_period_end, cancel_at, stripe_customer_id'
    )
    .order('current_period_end', { ascending: false, nullsFirst: false })
    .returns<MembershipRow[]>()

  if (membershipError) {
    return new NextResponse(membershipError.message, { status: 500 })
  }

  const memberships = membershipRows ?? []

  const creatorIds = [...new Set(memberships.map((m) => m.creator_id))]
  const memberIds = [...new Set(memberships.map((m) => m.member_id))]
  const tierIds = [...new Set(memberships.map((m) => m.tier_id))]

  const { data: creatorProfiles, error: creatorProfilesError } = creatorIds.length
    ? await supabaseAdmin
        .from('profiles')
        .select('id, username, display_name')
        .in('id', creatorIds)
        .returns<ProfileRow[]>()
    : { data: [] as ProfileRow[], error: null }

  if (creatorProfilesError) {
    return new NextResponse(creatorProfilesError.message, { status: 500 })
  }

  const { data: memberProfiles, error: memberProfilesError } = memberIds.length
    ? await supabaseAdmin
        .from('profiles')
        .select('id, username, display_name')
        .in('id', memberIds)
        .returns<ProfileRow[]>()
    : { data: [] as ProfileRow[], error: null }

  if (memberProfilesError) {
    return new NextResponse(memberProfilesError.message, { status: 500 })
  }

  const { data: tierRows, error: tierError } = tierIds.length
    ? await supabaseAdmin
        .from('membership_tiers')
        .select('id, name, price_cents, currency')
        .in('id', tierIds)
        .returns<TierRow[]>()
    : { data: [] as TierRow[], error: null }

  if (tierError) {
    return new NextResponse(tierError.message, { status: 500 })
  }

  const creatorMap = new Map((creatorProfiles ?? []).map((p) => [p.id, p]))
  const memberMap = new Map((memberProfiles ?? []).map((p) => [p.id, p]))
  const tierMap = new Map((tierRows ?? []).map((t) => [t.id, t]))

  const filteredMemberships = memberships.filter((membership) => {
    if (statusFilter !== 'all' && membership.status !== statusFilter) {
      return false
    }

    if (!query) return true

    const creator = creatorMap.get(membership.creator_id)
    const member = memberMap.get(membership.member_id)
    const tier = tierMap.get(membership.tier_id)

    const haystack = [
      creator?.display_name || '',
      creator?.username || '',
      member?.display_name || '',
      member?.username || '',
      tier?.name || '',
      membership.provider_subscription_id || '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })

  const rows: MembershipCsvRow[] = filteredMemberships.map((membership) => {
    const creator = creatorMap.get(membership.creator_id)
    const member = memberMap.get(membership.member_id)
    const tier = tierMap.get(membership.tier_id)

    return {
      creator_id: membership.creator_id,
      creator_username: creator?.username || '',
      creator_display_name: creator?.display_name || '',
      member_id: membership.member_id,
      member_username: member?.username || '',
      member_display_name: member?.display_name || '',
      tier_id: membership.tier_id,
      tier_name: tier?.name || '',
      tier_price_cents: tier?.price_cents ?? '',
      tier_currency: tier?.currency ?? '',
      status: membership.status,
      provider: membership.provider || '',
      provider_subscription_id: membership.provider_subscription_id || '',
      stripe_customer_id: membership.stripe_customer_id || '',
      current_period_end: membership.current_period_end || '',
      cancel_at_period_end: Boolean(membership.cancel_at_period_end),
      cancel_at: membership.cancel_at || '',
    }
  })

  const csv = toCsv(rows)
  const filename = `platform-memberships-${statusFilter || 'all'}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}