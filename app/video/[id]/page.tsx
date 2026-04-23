import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import VideoGrid from '@/components/video-grid'
import DeleteVideoButton from '@/components/delete-video-button'
import PurchaseVideoButton from '@/components/purchase-video-button'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { attachSignedThumbnailUrls } from '@/lib/thumbnail-helpers'
import { attachSignedAvatarUrls } from '@/lib/avatar-helpers'

type VideoRow = {
  id: string
  user_id: string
  title: string
  description: string | null
  file_path: string
  thumbnail_path: string | null
  is_public: boolean
  payment_type: 'free' | 'paid'
  visibility_type: 'public' | 'paid' | 'members'
  price_cents: number | null
  currency: 'EUR' | 'USD' | null
}

type VideoCardRow = {
  id: string
  title: string
  description: string | null
  thumbnail_path: string | null
  payment_type: 'free' | 'paid'
  visibility_type: 'public' | 'paid' | 'members'
  price_cents: number | null
  currency: 'EUR' | 'USD' | null
  user_id: string
}

type PurchaseRow = {
  id: string
  video_id: string
  buyer_id: string
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

type CreatorMembershipRow = {
  tier_id: string
  status: 'active' | 'canceled' | 'expired'
}

export default async function VideoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ checkout?: string; session_id?: string }>
}) {
  const { id } = await params
  const qs = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: videoRows } = await supabase
    .from('videos')
    .select(
      'id, user_id, title, description, file_path, thumbnail_path, is_public, payment_type, visibility_type, price_cents, currency'
    )
    .eq('id', id)
    .returns<VideoRow[]>()

  const video = videoRows?.[0] ?? null

  if (!video) {
    return (
      <>
        <SiteHeader userEmail={user?.email} />
        <AppFrame>
          <main className="px-4 py-8 text-white">Video nicht gefunden.</main>
        </AppFrame>
      </>
    )
  }

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, membership_enabled')
    .eq('id', video.user_id)
    .returns<ProfileRow[]>()

  const creator = profileRows?.[0] ?? null

  const creatorAvatarPublicUrl = creator?.avatar_url
    ? supabase.storage.from('profile-assets').getPublicUrl(creator.avatar_url).data.publicUrl
    : null

  const isOwner = user?.id === video.user_id
  const isPublicVideo = video.visibility_type === 'public'
  const isPaidVideo = video.visibility_type === 'paid'
  const isMembersVideo = video.visibility_type === 'members'

  let hasPaidAccess = false
  if (user && !isOwner && isPaidVideo) {
    const { data: purchaseRows } = await supabase
      .from('video_purchases')
      .select('id, video_id, buyer_id, payment_status')
      .eq('video_id', video.id)
      .eq('buyer_id', user.id)
      .returns<PurchaseRow[]>()

    const purchase = purchaseRows?.[0] ?? null
    hasPaidAccess = purchase?.payment_status === 'paid'
  }

  let hasMembershipAccess = false
  if (user && !isOwner && isMembersVideo) {
    const { data: membershipRows } = await supabase
      .from('creator_memberships')
      .select('tier_id, status')
      .eq('creator_id', video.user_id)
      .eq('member_id', user.id)
      .eq('status', 'active')
      .returns<CreatorMembershipRow[]>()

    hasMembershipAccess = !!membershipRows?.length
  }

  const canWatch =
    isOwner ||
    isPublicVideo ||
    (isPaidVideo && hasPaidAccess) ||
    (isMembersVideo && hasMembershipAccess)

  const signed = canWatch
    ? await supabaseAdmin.storage.from('videos').createSignedUrl(video.file_path, 60 * 60)
    : { data: null as { signedUrl?: string } | null }

  let relatedQuery = supabase
    .from('videos')
    .select(
      'id, user_id, title, description, thumbnail_path, payment_type, visibility_type, price_cents, currency'
    )
    .neq('id', video.id)
    .order('created_at', { ascending: false })
    .limit(8)

  if (user) {
    if (!isOwner) {
      relatedQuery = relatedQuery.or(
        `visibility_type.eq.public,visibility_type.eq.paid,user_id.eq.${user.id}`
      )
    }
  } else {
    relatedQuery = relatedQuery.eq('visibility_type', 'public')
  }

  const { data: moreVideos } = await relatedQuery.returns<VideoCardRow[]>()

  const creatorIds = [...new Set((moreVideos ?? []).map((item) => item.user_id))]

  const { data: creatorProfiles } = creatorIds.length
    ? await supabase
        .from('public_profiles')
        .select('id, username, display_name, avatar_url, membership_enabled')
        .in('id', creatorIds)
        .returns<ProfileRow[]>()
    : { data: [] as ProfileRow[] }

  const creatorMap = new Map((creatorProfiles ?? []).map((p) => [p.id, p]))

  const enrichedMoreVideos =
    moreVideos?.map((item) => {
      const profile = creatorMap.get(item.user_id)

      return {
        ...item,
        creator_id: item.user_id,
        creator_name: profile?.display_name || profile?.username || 'Creator',
        creator_avatar_url: profile?.avatar_url || null,
      }
    }) ?? []

  const withThumbs = await attachSignedThumbnailUrls(supabase, enrichedMoreVideos)
  const mappedMoreVideos = await attachSignedAvatarUrls(supabase, withThumbs)

  const videoThumbnail = video.thumbnail_path
    ? await supabaseAdmin.storage.from('videos').createSignedUrl(video.thumbnail_path, 60 * 60)
    : null

  return (
    <>
      <SiteHeader userEmail={user?.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          {qs.checkout === 'success' ? (
            <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
              Zahlung erfolgreich. Die Freischaltung sollte jetzt aktiv sein.
            </div>
          ) : null}

          {qs.checkout === 'cancel' ? (
            <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
              Zahlung abgebrochen.
            </div>
          ) : null}

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-white/55">
                <Link
                  href={`/channel/${video.user_id}`}
                  className="rounded-2xl border border-white/10 px-3 py-1.5 transition hover:bg-white/10"
                >
                  ← Zum Kanal
                </Link>

                {isOwner ? (
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/my-videos"
                      className="rounded-2xl border border-white/10 px-3 py-1.5 transition hover:bg-white/10"
                    >
                      Zu meinen Videos
                    </Link>

                    <DeleteVideoButton videoId={video.id} />
                  </div>
                ) : null}
              </div>

              <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                {canWatch ? (
                  <video
                    controls
                    className="aspect-video w-full bg-black"
                    src={signed.data?.signedUrl}
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-black p-8 text-center">
                    <div className="max-w-md">
                      {isPaidVideo ? (
                        <>
                          <div className="mb-4 inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
                            Einzelkauf
                          </div>

                          <h2 className="text-2xl font-semibold">
                            Dieses Video ist kostenpflichtig
                          </h2>

                          <p className="mt-3 text-sm text-white/60">
                            Kaufe das Video, um es freizuschalten.
                          </p>

                          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                            {user ? (
                              <PurchaseVideoButton
                                videoId={video.id}
                                label={`Jetzt kaufen · ${((video.price_cents ?? 0) / 100).toFixed(2)} ${video.currency ?? 'EUR'}`}
                              />
                            ) : (
                              <Link
                                href="/login"
                                className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
                              >
                                Einloggen zum Kaufen
                              </Link>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="mb-4 inline-flex rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs text-fuchsia-200">
                            Mitgliederinhalt
                          </div>

                          <h2 className="text-2xl font-semibold">
                            Dieses Video ist nur für Mitglieder
                          </h2>

                          <p className="mt-3 text-sm text-white/60">
                            Werde Mitglied auf dem Kanal, um dieses exklusive Video anzusehen.
                          </p>

                          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                            {user ? (
                              <Link
                                href={`/channel/${video.user_id}#memberships`}
                                className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
                              >
                                Mitgliedschaften ansehen
                              </Link>
                            ) : (
                              <Link
                                href="/login"
                                className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
                              >
                                Einloggen für Mitgliederzugang
                              </Link>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="p-6">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/45">
                    <span className="rounded-full border border-white/10 px-3 py-1">
                      {video.visibility_type === 'public'
                        ? 'Öffentlich'
                        : video.visibility_type === 'paid'
                          ? `Einzelkauf · ${((video.price_cents ?? 0) / 100).toFixed(2)} ${video.currency ?? 'EUR'}`
                          : 'Nur für Mitglieder'}
                    </span>

                    {isOwner ? (
                      <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sky-200">
                        Dein Video
                      </span>
                    ) : null}

                    {isPaidVideo && hasPaidAccess ? (
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-200">
                        Gekauft
                      </span>
                    ) : null}

                    {isMembersVideo && hasMembershipAccess ? (
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-200">
                        Mitgliedszugang aktiv
                      </span>
                    ) : null}
                  </div>

                  {videoThumbnail?.data?.signedUrl ? (
                    <div className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                      <img
                        src={videoThumbnail.data.signedUrl}
                        alt={video.title}
                        className="h-56 w-full object-cover"
                      />
                    </div>
                  ) : null}

                  <h1 className="text-3xl font-semibold tracking-tight">
                    {video.title}
                  </h1>

                  <Link
                    href={`/channel/${video.user_id}`}
                    className="mt-5 flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/5"
                  >
                    <div className="h-12 w-12 overflow-hidden rounded-full bg-white/10">
                      {creatorAvatarPublicUrl ? (
                        <img
                          src={creatorAvatarPublicUrl}
                          alt={creator?.display_name || creator?.username || 'Creator'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-white/50">
                          {(
                            creator?.display_name?.[0] ||
                            creator?.username?.[0] ||
                            'V'
                          ).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-white">
                        {creator?.display_name || creator?.username || 'Unbekannter Creator'}
                      </div>
                      <div className="text-sm text-white/45">
                        Zum Kanal und weiteren Inhalten
                      </div>
                    </div>
                  </Link>

                  <p className="mt-5 max-w-3xl text-sm text-white/60">
                    {video.description || 'Keine Beschreibung vorhanden.'}
                  </p>
                </div>
              </section>
            </section>

            <aside className="min-w-0">
              <h2 className="mb-4 text-lg font-semibold text-white">
                Weitere Videos
              </h2>
              <VideoGrid videos={mappedMoreVideos} />
            </aside>
          </div>
        </main>
      </AppFrame>
    </>
  )
}