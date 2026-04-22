import { cache } from 'react'
import { createClient } from '@/lib/supabase-server'

type AppSettingsRow = {
  platform_enabled: boolean
  payments_enabled: boolean
  maintenance_message: string | null
}

export const getAppSettings = cache(async () => {
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('app_settings')
    .select('platform_enabled, payments_enabled, maintenance_message')
    .eq('id', 1)
    .returns<AppSettingsRow[]>()

  if (error) {
    return {
      platform_enabled: true,
      payments_enabled: true,
      maintenance_message: null,
    }
  }

  return (
    rows?.[0] ?? {
      platform_enabled: true,
      payments_enabled: true,
      maintenance_message: null,
    }
  )
})