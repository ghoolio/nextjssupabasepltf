import { cache } from 'react'
import { createClient } from '@/lib/supabase-server'

export const getAppSettings = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('app_settings')
    .select('platform_enabled, payments_enabled, maintenance_message')
    .eq('id', 1)
    .single()

  return data ?? {
    platform_enabled: true,
    payments_enabled: true,
    maintenance_message: null,
  }
})
