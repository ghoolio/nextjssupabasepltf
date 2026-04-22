import { cache } from 'react'
import { supabaseAdmin } from './supabase-admin'

type AppSettingsRow = {
  id: number
  platform_enabled: boolean
  maintenance_message: string | null
  payments_enabled: boolean
  updated_at: string
}

export const getPlatformState = cache(async () => {
  const supabase = supabaseAdmin

  const { data: rows, error } = await supabase
    .from('app_settings')
    .select('id, platform_enabled, maintenance_message, payments_enabled, updated_at')
    .eq('id', 1)
    .returns<AppSettingsRow[]>()

  if (error) {
    return {
      id: 1,
      platform_enabled: true,
      maintenance_message: null,
      payments_enabled: true,
      updated_at: new Date().toISOString(),
    }
  }

  return (
    rows?.[0] ?? {
      id: 1,
      platform_enabled: true,
      maintenance_message: null,
      payments_enabled: true,
      updated_at: new Date().toISOString(),
    }
  )
})