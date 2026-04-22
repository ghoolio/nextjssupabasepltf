import { NextResponse } from 'next/server'
import { getPlatformState } from '@/lib/license'

export async function GET() {
  const state = await getPlatformState()
  return NextResponse.json({
    platform_enabled: state.platform_enabled,
    payments_enabled: state.payments_enabled,
    maintenance_message: state.maintenance_message
  })
}
