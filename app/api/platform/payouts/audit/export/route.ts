import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformFinanceAccessApi } from '@/lib/platform-admin'

type PayoutStatus = 'pending' | 'paid_out' | 'on_hold'
type StatusFilter = PayoutStatus | 'all'

type PayoutAuditRow = {
  id: string
  payout_id: string
  actor_user_id: string
  creator_id: string
  previous_status: PayoutStatus
  new_status: PayoutStatus
  previous_notes: string | null
  new_notes: string | null
  created_at: string
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
    created_at: string
    payout_id: string
    actor_user_id: string
    actor_username: string
    actor_display_name: string
    creator_id: string
    creator_username: string
    creator_display_name: string
    previous_status: string
    new_status: string
    previous_notes: string
    new_notes: string
    audit_log_id: string
  }>
) {
  const headers = [
    'created_at',
    'payout_id',
    'actor_user_id',
    'actor_username',
    'actor_display_name',
    'creator_id',
    'creator_username',
    'creator_display_name',
    'previous_status',
    'new_status',
    'previous_notes',
    'new_notes',
    'audit_log_id',
  ]

  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      [
        row.created_at,
        row.payout_id,
        row.actor_user_id,
        row.actor_username,
        row.actor_display_name,
        row.creator_id,
        row.creator_username,
        row.creator_display_name,
        row.previous_status,
        row.new_status,
        row.previous_notes,
        row.new_notes,
        row.audit_log_id,
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
  const auditQuery = (searchParams.get('audit_q') || '').trim().toLowerCase()
  const auditStatusFilter = (
    ['all', 'pending', 'paid_out', 'on_hold'].includes(searchParams.get('audit_status') || '')
      ? searchParams.get('audit_status')
      : 'all'
  ) as StatusFilter

  const { data: auditRows, error: auditError } = await supabaseAdmin
    .from('creator_payout_audit_logs')
    .select(
      'id, payout_id, actor_user_id, creator_id, previous_status, new_status, previous_notes, new_notes, created_at'
    )
    .order('created_at', { ascending: false })
    .returns<PayoutAuditRow[]>()

  if (auditError) {
    return new NextResponse(auditError.message, { status: 500 })
  }

  const userIds = [
    ...new Set((auditRows ?? []).flatMap((row) => [row.actor_user_id, row.creator_id])),
  ]

  const { data: profileRows, error: profileError } = userIds.length
    ? await supabaseAdmin
        .from('profiles')
        .select('id, username, display_name')
        .in('id', userIds)
        .returns<ProfileRow[]>()
    : { data: [] as ProfileRow[], error: null }

  if (profileError) {
    return new NextResponse(profileError.message, { status: 500 })
  }

  const profileMap = new Map((profileRows ?? []).map((row) => [row.id, row]))

  const filteredAuditRows = (auditRows ?? []).filter((row) => {
    if (auditStatusFilter !== 'all' && row.new_status !== auditStatusFilter) {
      return false
    }

    if (!auditQuery) return true

    const actor = profileMap.get(row.actor_user_id)
    const creator = profileMap.get(row.creator_id)

    const haystack = [
      actor?.display_name || '',
      actor?.username || '',
      row.actor_user_id,
      creator?.display_name || '',
      creator?.username || '',
      row.creator_id,
      row.previous_status,
      row.new_status,
      row.previous_notes || '',
      row.new_notes || '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(auditQuery)
  })

  const rows = filteredAuditRows.map((row) => {
    const actor = profileMap.get(row.actor_user_id)
    const creator = profileMap.get(row.creator_id)

    return {
      created_at: row.created_at,
      payout_id: row.payout_id,
      actor_user_id: row.actor_user_id,
      actor_username: actor?.username || '',
      actor_display_name: actor?.display_name || '',
      creator_id: row.creator_id,
      creator_username: creator?.username || '',
      creator_display_name: creator?.display_name || '',
      previous_status: row.previous_status,
      new_status: row.new_status,
      previous_notes: row.previous_notes || '',
      new_notes: row.new_notes || '',
      audit_log_id: row.id,
    }
  })

  const csv = toCsv(rows)

  const filenameParts = ['creator-payout-audit']
  if (auditStatusFilter !== 'all') filenameParts.push(auditStatusFilter)
  if (auditQuery) filenameParts.push('filtered')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filenameParts.join('-')}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}