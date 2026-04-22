import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import { createClient } from '@/lib/supabase-server'
import { getPlatformAdminState } from '@/lib/platform-admin'

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  support_enabled: boolean
  support_cta: string | null
  membership_enabled: boolean
}

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { isPlatformAdmin } = await getPlatformAdminState()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, bio, avatar_url, banner_url, support_enabled, support_cta, membership_enabled'
    )
    .eq('id', user.id)
    .returns<ProfileRow[]>()

  const profile = profileRows?.[0] ?? null

  const avatarUrl = profile?.avatar_url
    ? supabase.storage.from('profile-assets').getPublicUrl(profile.avatar_url).data.publicUrl
    : null

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Einstellungen
            </h1>
            <p className="mt-1 text-sm text-white/50">
              Verwalte dein öffentliches Creator-Profil und deine private Kontoansicht.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white">Bereiche</h2>
              <p className="mt-1 text-sm text-white/45">
                Öffentliche Kanalverwaltung und private Kontoeinstellungen sauber getrennt.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Link
                  href="/settings/profile"
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/10"
                >
                  <div className="text-sm font-medium text-white">Profil bearbeiten</div>
                  <div className="mt-1 text-sm text-white/45">
                    Avatar, Banner, Name, Bio und Creator-Einstellungen ändern
                  </div>
                </Link>

                <Link
                  href="/settings/account"
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/10"
                >
                  <div className="text-sm font-medium text-white">Konto</div>
                  <div className="mt-1 text-sm text-white/45">
                    Private Kontodaten, Login-Infos und spätere Sicherheitsoptionen
                  </div>
                </Link>

                <Link
                  href="/settings/creator"
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/10"
                >
                  <div className="text-sm font-medium text-white">Creator</div>
                  <div className="mt-1 text-sm text-white/45">
                    Mitgliedschaften, Stories, Highlights und creator-spezifische Verwaltung
                  </div>
                </Link>

                {isPlatformAdmin ? (
                  <Link
                    href="/settings/platform"
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/10"
                  >
                    <div className="text-sm font-medium text-white">Plattform</div>
                    <div className="mt-1 text-sm text-white/45">
                      Interne Umsatz-, Gebühren- und Creator-Auszahlungsübersicht
                    </div>
                  </Link>
                ) : null}

                <Link
                  href={`/channel/${user.id}`}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/10"
                >
                  <div className="text-sm font-medium text-white">Meinen Kanal ansehen</div>
                  <div className="mt-1 text-sm text-white/45">
                    Öffentliche Ansicht deines Kanals öffnen
                  </div>
                </Link>

                <Link
                  href="/stories/new"
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/10"
                >
                  <div className="text-sm font-medium text-white">Story posten</div>
                  <div className="mt-1 text-sm text-white/45">
                    Neue Story für Follower, Mitglieder oder alle veröffentlichen
                  </div>
                </Link>

                <Link
                  href="/highlights/new"
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/10"
                >
                  <div className="text-sm font-medium text-white">Highlight erstellen</div>
                  <div className="mt-1 text-sm text-white/45">
                    Stories dauerhaft als Highlight-Sammlung speichern
                  </div>
                </Link>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-full bg-white/10">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={profile?.display_name || profile?.username || 'Profil'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg text-white/50">
                        {(
                          profile?.display_name?.[0] ||
                          profile?.username?.[0] ||
                          'U'
                        ).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-lg font-semibold text-white">
                      {profile?.display_name || profile?.username || 'Unbekannter User'}
                    </div>
                    <div className="mt-1 text-sm text-white/45">
                      @{profile?.username || 'creator'}
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-2 text-sm text-white/55">
                  <div>
                    Mitgliedschaften:{' '}
                    <span className="text-white">
                      {profile?.membership_enabled ? 'Aktiviert' : 'Nicht aktiviert'}
                    </span>
                  </div>
                  <div>
                    Support-CTA:{' '}
                    <span className="text-white">
                      {profile?.support_enabled ? 'Aktiviert' : 'Nicht aktiviert'}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-sm font-medium uppercase tracking-wide text-white/45">
                  Nächste sinnvolle Bereiche
                </h2>
                <div className="mt-4 space-y-3 text-sm text-white/55">
                  <div>Benachrichtigungen</div>
                  <div>Privatsphäre</div>
                  <div>Billing / Creator-Auszahlung</div>
                  <div>Moderation</div>
                </div>
              </section>
            </aside>
          </div>
        </main>
      </AppFrame>
    </>
  )
}