import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAdminApi, type PlatformRole } from '@/lib/platform-admin'

type AuditLogRow = {
  id: string
  actor_user_id: string
  target_user_id: string
  previous_role: PlatformRole
  new_role: PlatformRole
  created_at: string
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
}

type RoleFilter = PlatformRole | 'all'

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
    actor_user_id: string
    actor_username: string
    actor_display_name: string
    target_user_id: string
    target_username: string
    target_display_name: string
    previous_role: string
    new_role: string
    audit_log_id: string
  }>
) {
  const headers = [
    'created_at',
    'actor_user_id',
    'actor_username',
    'actor_display_name',
    'target_user_id',
    'target_username',
    'target_display_name',
    'previous_role',
    'new_role',
    'audit_log_id',
  ]

  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      [
        row.created_at,
        row.actor_user_id,
        row.actor_username,
        row.actor_display_name,
        row.target_user_id,
        row.target_username,
        row.target_display_name,
        row.previous_role,
        row.new_role,
        row.audit_log_id,
      ]
        .map(escapeCsvValue)
        .join(',')
    ),
  ]

  return lines.join('\n')
}

export async function GET(req: Request) {
  const access = await requirePlatformAdminApi()

  if (!access.ok) {
    return new NextResponse(access.message, { status: access.status })
  }

  const { searchParams } = new URL(req.url)

  const auditRoleFilter = (
    ['all', 'user', 'support_admin', 'finance_admin', 'platform_admin'].includes(
      searchParams.get('audit_role') || ''
    )
      ? searchParams.get('audit_role')
      : 'all'
  ) as RoleFilter

  const auditQuery = (searchParams.get('audit_q') || '').trim().toLowerCase()

  const { data: auditRows, error: auditError } = await supabaseAdmin
    .from('platform_role_audit_logs')
    .select('id, actor_user_id, target_user_id, previous_role, new_role, created_at')
    .order('created_at', { ascending: false })
    .returns<AuditLogRow[]>()

  if (auditError) {
    return new NextResponse(auditError.message, { status: 500 })
  }

  const userIds = [
    ...new Set(
      (auditRows ?? []).flatMap((row) => [row.actor_user_id, row.target_user_id])
    ),
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
    if (auditRoleFilter !== 'all' && row.new_role !== auditRoleFilter) {
      return false
    }

    if (!auditQuery) return true

    const actor = profileMap.get(row.actor_user_id)
    const target = profileMap.get(row.target_user_id)

    const haystack = [
      actor?.display_name || '',
      actor?.username || '',
      row.actor_user_id,
      target?.display_name || '',
      target?.username || '',
      row.target_user_id,
      row.previous_role,
      row.new_role,
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(auditQuery)
  })

  const rows = filteredAuditRows.map((row) => {
    const actor = profileMap.get(row.actor_user_id)
    const target = profileMap.get(row.target_user_id)

    return {
      created_at: row.created_at,
      actor_user_id: row.actor_user_id,
      actor_username: actor?.username || '',
      actor_display_name: actor?.display_name || '',
      target_user_id: row.target_user_id,
      target_username: target?.username || '',
      target_display_name: target?.display_name || '',
      previous_role: row.previous_role,
      new_role: row.new_role,
      audit_log_id: row.id,
    }
  })

  const csv = toCsv(rows)
  const filenameParts = ['platform-role-audit']

  if (auditRoleFilter !== 'all') {
    filenameParts.push(auditRoleFilter)
  }

  if (auditQuery) {
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