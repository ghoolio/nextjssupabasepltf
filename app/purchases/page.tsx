import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import VideoGrid from '@/components/video-grid'
import EmptyState from '@/components/empty-state'
import { createClient } from '@/lib/supabase-server'
import { attachSignedThumbnailUrls } from '@/lib/thumbnail-helpers'

type PurchaseRow = {
  video_id: string
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
  videos: {
    id: string
    user_id: string
    title: string
    description: string | null
    thumbnail_path: string | null
    payment_type: 'free' | 'paid'
    price_cents: number | null
    currency: 'EUR' | 'USD' | null
  } | null
}

type ProfileRow = {
  id: string
  username: string | null
  avatar_url: string | null
}

export default async function PurchasesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: purchases, error } = await supabase
    .from('video_purchases')
    .select(`
      video_id,
      payment_status,
      videos (
        id,
        user_id,
        title,
        description,
        thumbnail_path,
        payment_type,
        price_cents,
        currency
      )
    `)
    .eq('buyer_id', user.id)
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: false })
    .returns<PurchaseRow[]>()

  const creatorIds = [
    ...new Set(
      (purchases ?? [])
        .map((entry) => entry.videos?.user_id)
        .filter(Boolean) as string[]
    ),
  ]

  const { data: profiles } = creatorIds.length
  ? await supabase
      .from('public_profiles')
      .select('id, username, avatar_url')
      .in('id', creatorIds)
      .returns<ProfileRow[]>()
  : { data: [] as ProfileRow[] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  const enrichedVideos =
    purchases
      ?.filter((entry) => entry.videos)
      .map((entry) => {
        const video = entry.videos!
        const profile = profileMap.get(video.user_id)

        return {
          ...video,
          purchased: true,
          creator_name: profile?.username || 'Creator',
          creator_avatar_url: profile?.avatar_url || null,
        }
      }) ?? []

  const videos = await attachSignedThumbnailUrls(supabase, enrichedVideos)

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <AppFrame>
        <main className="px-4 py-6 md:px-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Meine Käufe
            </h1>
            <p className="mt-1 text-sm text-white/50">
              Alle freigeschalteten Videos an einem Ort.
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-300">
              Fehler beim Laden deiner Käufe: {error.message}
            </div>
          ) : videos.length > 0 ? (
            <VideoGrid videos={videos} />
          ) : (
            <EmptyState
              title="Noch keine freigeschalteten Videos"
              description="Sobald du ein bezahltes Video kaufst, erscheint es hier."
              actionLabel="Zu Explore"
              actionHref="/explore"
            />
          )}
        </main>
      </AppFrame>
    </>
  )
}