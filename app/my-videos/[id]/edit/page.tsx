import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import EditVideoForm from '@/components/edit-video-form'
import { createClient } from '@/lib/supabase-server'

type EditVideoRow = {
  id: string
  user_id: string
  title: string
  description: string | null
  thumbnail_path: string | null
  visibility_type: 'public' | 'paid' | 'members'
  payment_type: 'free' | 'paid'
  price_cents: number | null
  currency: 'EUR' | 'USD' | null
}

type AppSettingsRow = {
  platform_enabled: boolean
  payments_enabled: boolean
  maintenance_message: string | null
}

export default async function EditMyVideoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: videoRows } = await supabase
    .from('videos')
    .select(
      'id, user_id, title, description, thumbnail_path, visibility_type, payment_type, price_cents, currency'
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .returns<EditVideoRow[]>()

  const video = videoRows?.[0] ?? null

  if (!video) {
    return (
      <>
        <SiteHeader userEmail={user.email} />
        <AppFrame>
          <main className="px-4 py-8 text-white">
            Video nicht gefunden oder kein Zugriff.
          </main>
        </AppFrame>
      </>
    )
  }

  const thumbnailPreviewUrl = video.thumbnail_path
    ? (
        await supabase.storage
          .from('videos')
          .createSignedUrl(video.thumbnail_path, 60 * 60)
      ).data?.signedUrl ?? null
    : null

  const { data: settingsRows } = await supabase
    .from('app_settings')
    .select('platform_enabled, payments_enabled, maintenance_message')
    .returns<AppSettingsRow[]>()

  const settings = settingsRows?.[0] ?? null

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
              <Link
                href="/my-videos"
                className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
              >
                ← Zurück zu meinen Videos
              </Link>

              <Link
                href={`/video/${video.id}`}
                className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
              >
                Video ansehen
              </Link>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Video bearbeiten
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Passe Titel, Beschreibung, Zugriffstyp und Thumbnail deines Videos an.
              </p>
            </div>
          </div>

          <EditVideoForm
            videoId={video.id}
            userId={user.id}
            paymentsEnabled={settings?.payments_enabled ?? true}
            initialValues={{
              title: video.title,
              description: video.description || '',
              visibility_type: video.visibility_type,
              price_cents: video.price_cents,
              thumbnail_path: video.thumbnail_path,
              thumbnail_preview_url: thumbnailPreviewUrl,
            }}
          />
        </main>
      </AppFrame>
    </>
  )
}