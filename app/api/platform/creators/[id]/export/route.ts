import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAdminApi } from '@/lib/platform-admin'

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  bio: string | null
  membership_enabled: boolean
  stripe_account_id: string | null
  stripe_onboarding_completed: boolean | null
  stripe_charges_enabled: boolean | null
  stripe_payouts_enabled: boolean | null
  stripe_details_submitted: boolean | null
}

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

type TierRow = {
  id: string
  name: string
  price_cents: number
  currency: 'EUR' | 'USD'
  archived: boolean
  stripe_product_id: string | null
  stripe_price_id: string | null
}

type CreatorMembershipRow = {
  status: 'active' | 'canceled' | 'expired'
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

function makeCsvSection(
  title: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
) {
  const lines = [
    title,
    headers.join(','),
    ...rows.map((row) => row.map(escapeCsvValue).join(',')),
    '',
  ]
  return lines.join('\n')
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requirePlatformAdminApi()

  if (!adminCheck.ok) {
    return new NextResponse(adminCheck.message, { status: adminCheck.status })
  }

  const { id } = await params

  const { data: profileRows, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select(
      'id, username, display_name, bio, membership_enabled, stripe_account_id, stripe_onboarding_completed, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted'
    )
    .eq('id', id)
    .returns<ProfileRow[]>()

  if (profileError) {
    return new NextResponse(profileError.message, { status: 500 })
  }

  const profile = profileRows?.[0] ?? null

  if (!profile) {
    return new NextResponse('Creator nicht gefunden.', { status: 404 })
  }

  const { data: videoRowsRaw, error: videoError } = await supabaseAdmin
    .from('video_purchases')
    .select(
      `
      video_id,
      buyer_id,
      amount_cents,
      platform_fee_amount_cents,
      creator_net_amount_cents,
      payment_status,
      currency,
      created_at,
      videos!inner(user_id)
    `
    )
    .eq('videos.user_id', id)

  if (videoError) {
    return new NextResponse(videoError.message, { status: 500 })
  }

  const videoRows: VideoPurchaseRow[] = (videoRowsRaw ?? []).map((row: any) => ({
    video_id: row.video_id,
    buyer_id: row.buyer_id,
    amount_cents: row.amount_cents,
    platform_fee_amount_cents: row.platform_fee_amount_cents,
    creator_net_amount_cents: row.creator_net_amount_cents,
    payment_status: row.payment_status,
    currency: row.currency,
    created_at: row.created_at,
  }))

  const { data: membershipRows, error: membershipError } = await supabaseAdmin
    .from('membership_payments')
    .select(
      'creator_id, member_id, tier_id, amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status, currency, paid_at, provider_invoice_id, provider_subscription_id'
    )
    .eq('creator_id', id)
    .returns<MembershipPaymentRow[]>()

  if (membershipError) {
    return new NextResponse(membershipError.message, { status: 500 })
  }

  const { data: tierRows, error: tierError } = await supabaseAdmin
    .from('membership_tiers')
    .select(
      'id, name, price_cents, currency, archived, stripe_product_id, stripe_price_id'
    )
    .eq('creator_id', id)
    .order('position', { ascending: true })
    .returns<TierRow[]>()

  if (tierError) {
    return new NextResponse(tierError.message, { status: 500 })
  }

  const { data: activeMembershipRows, error: activeMembershipError } = await supabaseAdmin
    .from('creator_memberships')
    .select('status')
    .eq('creator_id', id)
    .eq('status', 'active')
    .returns<CreatorMembershipRow[]>()

  if (activeMembershipError) {
    return new NextResponse(activeMembershipError.message, { status: 500 })
  }

  const paidVideoRows = videoRows.filter((row) => row.payment_status === 'paid')
  const paidMembershipRows = (membershipRows ?? []).filter((row) => row.payment_status === 'paid')

  const videoGross = paidVideoRows.reduce((sum, row) => sum + row.amount_cents, 0)
  const videoFees = paidVideoRows.reduce((sum, row) => sum + (row.platform_fee_amount_cents ?? 0), 0)
  const videoNet = paidVideoRows.reduce((sum, row) => sum + (row.creator_net_amount_cents ?? 0), 0)

  const membershipGross = paidMembershipRows.reduce((sum, row) => sum + row.amount_cents, 0)
  const membershipFees = paidMembershipRows.reduce((sum, row) => sum + row.platform_fee_amount_cents, 0)
  const membershipNet = paidMembershipRows.reduce((sum, row) => sum + row.creator_net_amount_cents, 0)

  const totalGross = videoGross + membershipGross
  const totalFees = videoFees + membershipFees
  const totalNet = videoNet + membershipNet
  const activeMembershipCount = activeMembershipRows?.length ?? 0

  const sections = [
    makeCsvSection(
      'creator_profile',
      [
        'creator_id',
        'username',
        'display_name',
        'bio',
        'membership_enabled',
        'stripe_account_id',
        'stripe_onboarding_completed',
        'stripe_charges_enabled',
        'stripe_payouts_enabled',
        'stripe_details_submitted',
        'active_membership_count',
      ],
      [[
        profile.id,
        profile.username,
        profile.display_name,
        profile.bio,
        profile.membership_enabled,
        profile.stripe_account_id,
        profile.stripe_onboarding_completed,
        profile.stripe_charges_enabled,
        profile.stripe_payouts_enabled,
        profile.stripe_details_submitted,
        activeMembershipCount,
      ]]
    ),
    makeCsvSection(
      'summary',
      [
        'video_gross_cents',
        'video_fee_cents',
        'video_net_cents',
        'membership_gross_cents',
        'membership_fee_cents',
        'membership_net_cents',
        'total_gross_cents',
        'total_fee_cents',
        'total_net_cents',
      ],
      [[
        videoGross,
        videoFees,
        videoNet,
        membershipGross,
        membershipFees,
        membershipNet,
        totalGross,
        totalFees,
        totalNet,
      ]]
    ),
    makeCsvSection(
      'tiers',
      [
        'tier_id',
        'name',
        'price_cents',
        'currency',
        'archived',
        'stripe_product_id',
        'stripe_price_id',
      ],
      (tierRows ?? []).map((tier) => [
        tier.id,
        tier.name,
        tier.price_cents,
        tier.currency,
        tier.archived,
        tier.stripe_product_id,
        tier.stripe_price_id,
      ])
    ),
    makeCsvSection(
      'video_purchases',
      [
        'video_id',
        'buyer_id',
        'amount_cents',
        'platform_fee_amount_cents',
        'creator_net_amount_cents',
        'payment_status',
        'currency',
        'created_at',
      ],
      videoRows.map((row) => [
        row.video_id,
        row.buyer_id,
        row.amount_cents,
        row.platform_fee_amount_cents ?? 0,
        row.creator_net_amount_cents ?? 0,
        row.payment_status,
        row.currency,
        row.created_at,
      ])
    ),
    makeCsvSection(
      'membership_payments',
      [
        'member_id',
        'tier_id',
        'amount_cents',
        'platform_fee_amount_cents',
        'creator_net_amount_cents',
        'payment_status',
        'currency',
        'paid_at',
        'provider_invoice_id',
        'provider_subscription_id',
      ],
      (membershipRows ?? []).map((row) => [
        row.member_id,
        row.tier_id,
        row.amount_cents,
        row.platform_fee_amount_cents,
        row.creator_net_amount_cents,
        row.payment_status,
        row.currency,
        row.paid_at,
        row.provider_invoice_id,
        row.provider_subscription_id,
      ])
    ),
  ]

  const csv = sections.join('\n')
  const safeName = (profile.username || profile.display_name || id).replace(/[^a-zA-Z0-9_-]+/g, '-')
  const filename = `creator-detail-${safeName}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}