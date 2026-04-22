import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import PageShell from '@/components/page-shell'
import UploadForm from '@/components/upload-form'
import { createClient } from '@/lib/supabase-server'

type AppSettingsRow = {
  id: number
  platform_enabled: boolean
  payments_enabled: boolean
  maintenance_message: string | null
  updated_at: string
}

export default async function UploadPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: settingsRows } = await supabase
    .from('app_settings')
    .select('id, platform_enabled, payments_enabled, maintenance_message, updated_at')
    .eq('id', 1)
    .returns<AppSettingsRow[]>()

  const settings = settingsRows?.[0] ?? null

  if (settings && !settings.platform_enabled) {
    return (
      <>
        <SiteHeader userEmail={user.email} />
        <main className="mx-auto max-w-3xl px-4 py-8 text-white">
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6">
            <h1 className="text-2xl font-semibold">Uploads derzeit deaktiviert</h1>
            <p className="mt-3 text-sm text-white/70">
              {settings.maintenance_message || 'Die Plattform ist aktuell im Wartungsmodus.'}
            </p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <PageShell
        title="Video hochladen"
        description="Lade ein neues Video hoch und veröffentliche es sauber statt es im Dateisystem verrotten zu lassen."
      >
        <UploadForm
          userId={user.id}
          paymentsEnabled={settings?.payments_enabled ?? true}
        />
      </PageShell>
    </>
  )
}