import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAdminApi, type PlatformRole } from '@/lib/platform-admin'

type Body = {
  userId?: string
  platformRole?: PlatformRole
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

  const userId = body.userId?.trim()
  const platformRole = body.platformRole

  if (!userId) {
    return NextResponse.json({ error: 'userId fehlt.' }, { status: 400 })
  }

  if (!platformRole || !ALLOWED_ROLES.includes(platformRole)) {
    return NextResponse.json({ error: 'Ungültige Rolle.' }, { status: 400 })
  }

  const { data: adminRows, error: adminReadError } = await supabaseAdmin
    .from('profiles')
    .select('id, platform_role, is_platform_admin')
    .returns<AdminProfileRow[]>()

  if (adminReadError) {
    return NextResponse.json({ error: adminReadError.message }, { status: 500 })
  }

  const profiles = adminRows ?? []
  const currentAdmins = profiles.filter((row) => normalizeRole(row) === 'platform_admin')
  const targetProfile = profiles.find((row) => row.id === userId) ?? null

  if (!targetProfile) {
    return NextResponse.json({ error: 'Profil nicht gefunden.' }, { status: 404 })
  }

  const previousRole = normalizeRole(targetProfile)
  const isTargetCurrentlyAdmin = previousRole === 'platform_admin'
  const isDowngradeFromAdmin = isTargetCurrentlyAdmin && platformRole !== 'platform_admin'

  if (isDowngradeFromAdmin && currentAdmins.length <= 1) {
    return NextResponse.json(
      { error: 'Der letzte platform_admin kann nicht entfernt werden.' },
      { status: 400 }
    )
  }

  if (access.user.id === userId && platformRole !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Du kannst dir selbst die platform_admin-Rolle nicht entziehen.' },
      { status: 400 }
    )
  }

  if (previousRole === platformRole) {
    return NextResponse.json({
      ok: true,
      userId,
      platformRole,
      isPlatformAdmin: platformRole === 'platform_admin',
      skipped: true,
    })
  }

  const isPlatformAdmin = platformRole === 'platform_admin'

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      platform_role: platformRole,
      is_platform_admin: isPlatformAdmin,
    })
    .eq('id', userId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { error: auditError } = await supabaseAdmin
    .from('platform_role_audit_logs')
    .insert({
      actor_user_id: access.user.id,
      target_user_id: userId,
      previous_role: previousRole,
      new_role: platformRole,
    })

  if (auditError) {
    return NextResponse.json(
      { error: `Rolle geändert, aber Audit-Log fehlgeschlagen: ${auditError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    userId,
    previousRole,
    platformRole,
    isPlatformAdmin,
  })
}