import { createClient } from '@/lib/supabase-server'

export type PlatformState = {
  disabled: boolean
  reason: string | null
}

export async function getPlatformState(): Promise<PlatformState> {
  const envDisabled = process.env.PLATFORM_LICENSE_STATUS === 'disabled'
  if (envDisabled) {
    return { disabled: true, reason: 'Lizenzstatus deaktiviert.' }
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('platform_settings')
    .select('value_json')
    .eq('key', 'platform_mode')
    .maybeSingle()

  const value = data?.value_json as { disabled?: boolean; reason?: string } | undefined
  return {
    disabled: Boolean(value?.disabled),
    reason: value?.reason ?? null,
  }
}

export async function assertPlatformActive() {
  const state = await getPlatformState()
  if (state.disabled) {
    throw new Error(state.reason || 'Plattform ist derzeit deaktiviert.')
  }
}
