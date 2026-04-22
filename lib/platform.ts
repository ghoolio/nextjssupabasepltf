import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabase-admin'

type AppConfigRow = {
  key: string
  value_json: {
    disabled?: boolean
    reason?: string
  } | null
}

export const getPlatformDisabledState = cache(async () => {
  const { data: rows, error } = await supabaseAdmin
    .from('app_config')
    .select('key, value_json')
    .eq('key', 'platform_disabled')
    .returns<AppConfigRow[]>()

  if (error) {
    return {
      disabled: false,
      reason: null as string | null,
    }
  }

  const row = rows?.[0] ?? null
  const value = row?.value_json ?? null

  return {
    disabled: Boolean(value?.disabled),
    reason: value?.reason ?? null,
  }
})