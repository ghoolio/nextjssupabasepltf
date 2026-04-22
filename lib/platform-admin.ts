import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

type PlatformAdminProfileRow = {
  id: string
  is_platform_admin: boolean
}

export async function requirePlatformAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: rows, error } = await supabase
    .from('profiles')
    .select('id, is_platform_admin')
    .eq('id', user.id)
    .returns<PlatformAdminProfileRow[]>()

  if (error) {
    redirect('/settings')
  }

  const profile = rows?.[0] ?? null

  if (!profile?.is_platform_admin) {
    redirect('/settings')
  }

  return { user, profile }
}

export async function requirePlatformAdminApi() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false as const, status: 401, message: 'Nicht eingeloggt.' }
  }

  const { data: rows, error } = await supabase
    .from('profiles')
    .select('id, is_platform_admin')
    .eq('id', user.id)
    .returns<PlatformAdminProfileRow[]>()

  if (error) {
    return { ok: false as const, status: 500, message: error.message }
  }

  const profile = rows?.[0] ?? null

  if (!profile?.is_platform_admin) {
    return { ok: false as const, status: 403, message: 'Forbidden' }
  }

  return { ok: true as const, user, profile }
}

export async function getPlatformAdminState() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, isPlatformAdmin: false }
  }

  const { data: rows } = await supabase
    .from('profiles')
    .select('id, is_platform_admin')
    .eq('id', user.id)
    .returns<PlatformAdminProfileRow[]>()

  const profile = rows?.[0] ?? null

  return {
    user,
    isPlatformAdmin: Boolean(profile?.is_platform_admin),
  }
}