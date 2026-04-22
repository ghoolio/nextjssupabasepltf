import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'

export type PlatformRole =
  | 'user'
  | 'support_admin'
  | 'finance_admin'
  | 'platform_admin'

type PlatformAdminProfileRow = {
  id: string
  is_platform_admin?: boolean | null
  platform_role?: PlatformRole | null
}

type PlatformRoleCheckResult =
  | {
      ok: true
      user: User
      profile: {
        id: string
        role: PlatformRole
        isPlatformAdmin: boolean
      }
    }
  | {
      ok: false
      status: number
      message: string
    }

function normalizePlatformRole(profile: PlatformAdminProfileRow | null): PlatformRole {
  if (!profile) return 'user'

  if (profile.platform_role) {
    return profile.platform_role
  }

  if (profile.is_platform_admin) {
    return 'platform_admin'
  }

  return 'user'
}

function hasRequiredRole(currentRole: PlatformRole, allowedRoles: PlatformRole[]): boolean {
  return allowedRoles.includes(currentRole)
}

async function getCurrentPlatformRoleInternal() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      supabase,
      user: null,
      profile: null,
      role: 'user' as PlatformRole,
      isPlatformAdmin: false,
    }
  }

  const { data: rows } = await supabase
    .from('profiles')
    .select('id, is_platform_admin, platform_role')
    .eq('id', user.id)
    .returns<PlatformAdminProfileRow[]>()

  const profile = rows?.[0] ?? null
  const role = normalizePlatformRole(profile)
  const isPlatformAdmin = role === 'platform_admin'

  return {
    supabase,
    user,
    profile,
    role,
    isPlatformAdmin,
  }
}

export async function requirePlatformRole(allowedRoles: PlatformRole[]) {
  const result = await getCurrentPlatformRoleInternal()

  if (!result.user) {
    redirect('/login')
  }

  if (!hasRequiredRole(result.role, allowedRoles)) {
    redirect('/settings')
  }

  return {
    user: result.user,
    profile: {
      id: result.profile?.id ?? result.user.id,
      role: result.role,
      isPlatformAdmin: result.isPlatformAdmin,
    },
  }
}

export async function requirePlatformAdmin() {
  return requirePlatformRole(['platform_admin'])
}

export async function requirePlatformFinanceAccess() {
  return requirePlatformRole(['finance_admin', 'platform_admin'])
}

export async function requirePlatformSupportAccess() {
  return requirePlatformRole([
    'support_admin',
    'finance_admin',
    'platform_admin',
  ])
}

export async function requirePlatformRoleApi(
  allowedRoles: PlatformRole[]
): Promise<PlatformRoleCheckResult> {
  const result = await getCurrentPlatformRoleInternal()

  if (!result.user) {
    return {
      ok: false,
      status: 401,
      message: 'Nicht eingeloggt.',
    }
  }

  if (!hasRequiredRole(result.role, allowedRoles)) {
    return {
      ok: false,
      status: 403,
      message: 'Forbidden',
    }
  }

  return {
    ok: true,
    user: result.user,
    profile: {
      id: result.profile?.id ?? result.user.id,
      role: result.role,
      isPlatformAdmin: result.isPlatformAdmin,
    },
  }
}

export async function requirePlatformAdminApi() {
  return requirePlatformRoleApi(['platform_admin'])
}

export async function requirePlatformFinanceAccessApi() {
  return requirePlatformRoleApi(['finance_admin', 'platform_admin'])
}

export async function requirePlatformSupportAccessApi() {
  return requirePlatformRoleApi([
    'support_admin',
    'finance_admin',
    'platform_admin',
  ])
}

export async function getPlatformAdminState() {
  const result = await getCurrentPlatformRoleInternal()

  return {
    user: result.user,
    isPlatformAdmin: result.isPlatformAdmin,
    platformRole: result.role,
  }
}

export async function getPlatformAccessState() {
  const result = await getCurrentPlatformRoleInternal()

  return {
    user: result.user,
    platformRole: result.role,
    isPlatformAdmin: result.isPlatformAdmin,
    canAccessPlatformSupport:
      result.role === 'support_admin' ||
      result.role === 'finance_admin' ||
      result.role === 'platform_admin',
    canAccessPlatformFinance:
      result.role === 'finance_admin' ||
      result.role === 'platform_admin',
    canAccessPlatformAdmin: result.role === 'platform_admin',
  }
}