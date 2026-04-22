import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAdminApi } from '@/lib/platform-admin'

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

type PlatformTransactionCsvRow = {
  date: string
  type: 'video_purchase' | 'membership_payment'
  status: 'paid' | 'refunded' | 'failed'
  gross_cents: number
  platform_fee_cents: number
  creator_net_cents: number
  currency: 'EUR' | 'USD'
  reference: string
  actor_id: string
  counterparty_id: string
}

type RangeKey = 'today' | '7d' | '30d' | 'all'

function getRangeStart(range: RangeKey) {
  const now = new Date()

  if (range === 'all') return null

  if (range === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start.toISOString()
  }

  if (range === '7d') {
    const start = new Date(now)
    start.setDate(start.getDate() - 7)
    return start.toISOString()
  }

  const start = new Date(now)
  start.setDate(start.getDate() - 30)
  return start.toISOString()
}

function escapeCsvValue(value: string | number | null | undefined) {
  const stringValue = String(value ?? '')
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function toCsv(rows: PlatformTransactionCsvRow[]) {
  const headers = [
    'date',
    'type',
    'status',
    'gross_cents',
    'platform_fee_cents',
    'creator_net_cents',
    'currency',
    'reference',
    'actor_id',
    'counterparty_id',
  ]

  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      [
        row.date,
        row.type,
        row.status,
        row.gross_cents,
        row.platform_fee_cents,
        row.creator_net_cents,
        row.currency,
        row.reference,
        row.actor_id,
        row.counterparty_id,
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
  const range = (['today', '7d', '30d', 'all'].includes(searchParams.get('range') || '')
    ? searchParams.get('range')
    : '30d') as RangeKey

  const startDate = getRangeStart(range)

  let videoQuery = supabaseAdmin
    .from('video_purchases')
    .select(
      'video_id, buyer_id, amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status, currency, created_at'
    )
    .order('created_at', { ascending: false })

  if (startDate) {
    videoQuery = videoQuery.gte('created_at', startDate)
  }

  const { data: videoRows, error: videoError } = await videoQuery.returns<VideoPurchaseRow[]>()

  if (videoError) {
    return new NextResponse(videoError.message, { status: 500 })
  }

  let membershipQuery = supabaseAdmin
    .from('membership_payments')
    .select(
      'creator_id, member_id, tier_id, amount_cents, platform_fee_amount_cents, creator_net_amount_cents, payment_status, currency, paid_at, provider_invoice_id, provider_subscription_id'
    )
    .order('paid_at', { ascending: false })

  if (startDate) {
    membershipQuery = membershipQuery.gte('paid_at', startDate)
  }

  const { data: membershipRows, error: membershipError } =
    await membershipQuery.returns<MembershipPaymentRow[]>()

  if (membershipError) {
    return new NextResponse(membershipError.message, { status: 500 })
  }

  const videoTransactions: PlatformTransactionCsvRow[] = (videoRows ?? []).map((row) => ({
    date: row.created_at,
    type: 'video_purchase',
    status: row.payment_status,
    gross_cents: row.amount_cents,
    platform_fee_cents: row.platform_fee_amount_cents ?? 0,
    creator_net_cents: row.creator_net_amount_cents ?? 0,
    currency: row.currency,
    reference: row.video_id,
    actor_id: row.buyer_id,
    counterparty_id: '',
  }))

  const membershipTransactions: PlatformTransactionCsvRow[] = (membershipRows ?? []).map(
    (row) => ({
      date: row.paid_at,
      type: 'membership_payment',
      status: row.payment_status,
      gross_cents: row.amount_cents,
      platform_fee_cents: row.platform_fee_amount_cents,
      creator_net_cents: row.creator_net_amount_cents,
      currency: row.currency,
      reference: row.tier_id,
      actor_id: row.member_id,
      counterparty_id: row.creator_id,
    })
  )

  const rows = [...videoTransactions, ...membershipTransactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const csv = toCsv(rows)
  const filename = `platform-transactions-${range}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}