import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformFinanceAccessApi } from '@/lib/platform-admin'

type PayoutStatus = 'pending' | 'paid_out' | 'on_hold'
type StatusFilter = PayoutStatus | 'all'

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

function toCsv(
  rows: Array<{
    payout_id: string
    creator_id: string
    creator_username: string
    creator_display_name: string
    period_start: string
    period_end: string
    gross_cents: number
    platform_fee_cents: number
    net_cents: number
    status: PayoutStatus
    paid_out_at: string
    notes: string
    created_at: string
    updated_at: string
  }>
) {
  const headers = [
    'payout_id',
    'creator_id',
    'creator_username',
    'creator_display_name',
    'period_start',
    'period_end',
    'gross_cents',
    'platform_fee_cents',
    'net_cents',
    'status',
    'paid_out_at',
    'notes',
    'created_at',
    'updated_at',
  ]

  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      [
        row.payout_id,
        row.creator_id,
        row.creator_username,
        row.creator_display_name,
        row.period_start,
        row.period_end,
        row.gross_cents,
        row.platform_fee_cents,
        row.net_cents,
        row.status,
        row.paid_out_at,
        row.notes,
        row.created_at,
        row.updated_at,
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

  const statusFilter = (
    ['all', 'pending', 'paid_out', 'on_hold'].includes(searchParams.get('status') || '')
      ? searchParams.get('status')
      : 'all'
  ) as StatusFilter

  const query = (searchParams.get('q') || '').trim().toLowerCase()

  const { data: payoutRows, error: payoutError } = await supabaseAdmin
    .from('creator_payouts')
    .select(
      'id, creator_id, period_start, period_end, gross_cents, platform_fee_cents, net_cents, status, paid_out_at, notes, created_at, updated_at'
    )
    .order('period_end', { ascending: false })
    .returns<CreatorPayoutRow[]>()

  if (payoutError) {
    return new NextResponse(payoutError.message, { status: 500 })
  }

  const payouts = payoutRows ?? []
  const creatorIds = [...new Set(payouts.map((row) => row.creator_id))]

  const { data: profileRows, error: profileError } = creatorIds.length
    ? await supabaseAdmin
        .from('profiles')
        .select('id, username, display_name')
        .in('id', creatorIds)
        .returns<ProfileRow[]>()
    : { data: [] as ProfileRow[], error: null }

  if (profileError) {
    return new NextResponse(profileError.message, { status: 500 })
  }

  const profileMap = new Map((profileRows ?? []).map((row) => [row.id, row]))

  const filteredPayouts = payouts.filter((row) => {
    if (statusFilter !== 'all' && row.status !== statusFilter) {
      return false
    }

    if (!query) return true

    const creator = profileMap.get(row.creator_id)

    const haystack = [
      creator?.display_name || '',
      creator?.username || '',
      row.creator_id,
      row.notes || '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })

  const rows = filteredPayouts.map((row) => {
    const creator = profileMap.get(row.creator_id)

    return {
      payout_id: row.id,
      creator_id: row.creator_id,
      creator_username: creator?.username || '',
      creator_display_name: creator?.display_name || '',
      period_start: row.period_start,
      period_end: row.period_end,
      gross_cents: row.gross_cents,
      platform_fee_cents: row.platform_fee_cents,
      net_cents: row.net_cents,
      status: row.status,
      paid_out_at: row.paid_out_at || '',
      notes: row.notes || '',
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  })

  const csv = toCsv(rows)
  const filenameParts = ['platform-payouts']

  if (statusFilter !== 'all') {
    filenameParts.push(statusFilter)
  }

  if (query) {
    filenameParts.push('filtered')
  }

  const filename = `${filenameParts.join('-')}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}