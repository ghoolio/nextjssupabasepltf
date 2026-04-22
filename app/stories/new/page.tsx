import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import StoryUploadForm from '@/components/story-upload-form'
import { createClient } from '@/lib/supabase-server'

export default async function NewStoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
              <Link
                href="/profile"
                className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
              >
                ← Zurück zum Profil
              </Link>

              <Link
                href={`/channel/${user.id}`}
                className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
              >
                Zum Kanal
              </Link>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Neue Story
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Veröffentliche eine kurze Story für alle, nur für Follower oder nur für Mitglieder.
              </p>
            </div>
          </div>

          <StoryUploadForm userId={user.id} />
        </main>
      </AppFrame>
    </>
  )
}