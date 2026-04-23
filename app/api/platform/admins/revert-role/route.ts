import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAdminApi, type PlatformRole } from '@/lib/platform-admin'

type Body = {
  auditLogId?: string
}

type AuditLogRow = {
  id: string
  actor_user_id: string
  target_user_id: string
  previous_role: PlatformRole
  new_role: PlatformRole
  created_at: string
}

type AdminProfileRow = {
  id: string
  platform_role: PlatformRole | null
  is_platform_admin: boolean | null
}

const ALLOWED_ROLES: PlatformRole[] = [
  'user',
  'support_admin',
  'finance_admin',
  'platform_admin',
]

function normalizeRole(row: AdminProfileRow): PlatformRole {
  if (row.platform_role) return row.platform_role
  if (row.is_platform_admin) return 'platform_admin'
  return 'user'
}

export async function POST(req: Request) {
  const access = await requirePlatformAdminApi()

  if (!access.ok) {
    return new NextResponse(access.message, { status: access.status })
  }

  let body: Body

  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 })
  }

  const auditLogId = body.auditLogId?.trim()

  if (!auditLogId) {
    return NextResponse.json({ error: 'auditLogId fehlt.' }, { status: 400 })
  }

  const { data: auditRows, error: auditError } = await supabaseAdmin
    .from('platform_role_audit_logs')
    .select('id, actor_user_id, target_user_id, previous_role, new_role, created_at')
    .eq('id', auditLogId)
    .returns<AuditLogRow[]>()

  if (auditError) {
    return NextResponse.json({ error: auditError.message }, { status: 500 })
  }

  const auditLog = auditRows?.[0] ?? null

  if (!auditLog) {
    return NextResponse.json({ error: 'Audit-Eintrag nicht gefunden.' }, { status: 404 })
  }

  if (!ALLOWED_ROLES.includes(auditLog.previous_role)) {
    return NextResponse.json({ error: 'Ungültige vorherige Rolle im Audit-Log.' }, { status: 400 })
  }

  const targetUserId = auditLog.target_user_id
  const revertRole = auditLog.previous_role

  const { data: profileRows, error: profileReadError } = await supabaseAdmin
    .from('profiles')
    .select('id, platform_role, is_platform_admin')
    .returns<AdminProfileRow[]>()

  if (profileReadError) {
    return NextResponse.json({ error: profileReadError.message }, { status: 500 })
  }

  const profiles = profileRows ?? []
  const currentAdmins = profiles.filter((row) => normalizeRole(row) === 'platform_admin')
  const targetProfile = profiles.find((row) => row.id === targetUserId) ?? null

  if (!targetProfile) {
    return NextResponse.json({ error: 'Zielprofil nicht gefunden.' }, { status: 404 })
  }

  const targetCurrentRole = normalizeRole(targetProfile)
  const isTargetCurrentlyAdmin = targetCurrentRole === 'platform_admin'
  const isDowngradeFromAdmin = isTargetCurrentlyAdmin && revertRole !== 'platform_admin'

  if (isDowngradeFromAdmin && currentAdmins.length <= 1) {
    return NextResponse.json(
      { error: 'Der letzte platform_admin kann nicht entfernt werden.' },
      { status: 400 }
    )
  }

  if (access.user.id === targetUserId && revertRole !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Du kannst dir selbst die platform_admin-Rolle nicht entziehen.' },
      { status: 400 }
    )
  }

  if (targetCurrentRole === revertRole) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      userId: targetUserId,
      platformRole: revertRole,
    })
  }

  const isPlatformAdmin = revertRole === 'platform_admin'

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      platform_role: revertRole,
      is_platform_admin: isPlatformAdmin,
    })
    .eq('id', targetUserId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { error: insertAuditError } = await supabaseAdmin
    .from('platform_role_audit_logs')
    .insert({
      actor_user_id: access.user.id,
      target_user_id: targetUserId,
      previous_role: targetCurrentRole,
      new_role: revertRole,
    })

  if (insertAuditError) {
    return NextResponse.json(
      { error: `Rolle zurückgesetzt, aber Audit-Log fehlgeschlagen: ${insertAuditError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    targetUserId,
    previousRole: targetCurrentRole,
    newRole: revertRole,
  })
}