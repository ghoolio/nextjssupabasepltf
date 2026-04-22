import { cache } from 'react'
import { supabaseAdmin } from './supabase-admin'

export const getPlatformState = cache(async () => {
  const supabase = supabaseAdmin
  const { data } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle()

  return data ?? {
    id: 1,
    platform_enabled: true,
    maintenance_message: null,
    payments_enabled: true,
    updated_at: new Date().toISOString()
  }
})
