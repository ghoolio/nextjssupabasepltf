import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import { createClient } from '@/lib/supabase-server'

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  created_at?: string | null
}

function formatDate(value?: string | null) {
  if (!value) return 'Unbekannt'
  return new Date(value).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function SettingsAccountPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, created_at')
    .eq('id', user.id)
    .returns<ProfileRow[]>()

  const profile = profileRows?.[0] ?? null

  const providerLabels =
    user.app_metadata?.providers && Array.isArray(user.app_metadata.providers)
      ? user.app_metadata.providers.join(', ')
      : user.app_metadata?.provider || 'Unbekannt'

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
              <Link
                href="/settings"
                className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
              >
                ← Zurück zu Einstellungen
              </Link>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Konto
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Private Kontoinformationen und spätere Account-Verwaltung.
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white">Kontodaten</h2>
              <p className="mt-1 text-sm text-white/45">
                Diese Daten sind privat und gehören nicht zu deinem öffentlichen Kanal.
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/40">E-Mail</div>
                  <div className="mt-2 text-sm text-white">{user.email || 'Nicht verfügbar'}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/40">Login-Anbieter</div>
                  <div className="mt-2 text-sm text-white">{providerLabels}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/40">User ID</div>
                  <div className="mt-2 break-all text-sm text-white/70">{user.id}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/40">Account erstellt</div>
                  <div className="mt-2 text-sm text-white">
                    {formatDate(user.created_at || profile?.created_at || null)}
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-sm font-medium uppercase tracking-wide text-white/45">
                  Aktueller Stand
                </h2>

                <div className="mt-4 space-y-3 text-sm text-white/55">
                  <div>
                    Display Name:{' '}
                    <span className="text-white">
                      {profile?.display_name || 'Nicht gesetzt'}
                    </span>
                  </div>
                  <div>
                    Username:{' '}
                    <span className="text-white">
                      @{profile?.username || 'creator'}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-sm font-medium uppercase tracking-wide text-white/45">
                  Später sinnvoll
                </h2>

                <div className="mt-4 space-y-3 text-sm text-white/55">
                  <div>Passwort ändern</div>
                  <div>Sessions verwalten</div>
                  <div>2FA</div>
                  <div>Account löschen</div>
                </div>
              </section>
            </aside>
          </div>
        </main>
      </AppFrame>
    </>
  )
}