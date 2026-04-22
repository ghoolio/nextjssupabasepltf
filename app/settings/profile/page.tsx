import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import EditProfileForm from '@/components/edit-profile-form'
import { createClient } from '@/lib/supabase-server'

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

export default async function SettingsProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileRows } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, bio, avatar_url, banner_url, support_enabled, support_cta, membership_enabled'
    )
    .eq('id', user.id)
    .returns<ProfileRow[]>()

  const profile = profileRows?.[0] ?? null

  const initialProfile = {
    username: profile?.username || '',
    display_name: profile?.display_name || '',
    bio: profile?.bio || '',
    avatar_url: profile?.avatar_url || '',
    banner_url: profile?.banner_url || '',
    support_enabled: profile?.support_enabled ?? false,
    support_cta: profile?.support_cta || '',
    membership_enabled: profile?.membership_enabled ?? false,
  }

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

              <Link
                href={`/channel/${user.id}`}
                className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
              >
                Meinen Kanal ansehen
              </Link>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Profil & Kanal bearbeiten
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Verwalte Avatar, Banner, Name, Bio und Creator-Einstellungen für deinen öffentlichen Kanal.
              </p>
            </div>
          </div>

          <EditProfileForm
            userId={user.id}
            initialProfile={initialProfile}
          />
        </main>
      </AppFrame>
    </>
  )
}