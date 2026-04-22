import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import EmptyState from '@/components/empty-state'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type FollowRow = {
  id: string
  creator_id: string
  follower_id: string
  created_at: string
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
}

type PublicVideoRow = {
  id: string
  user_id: string
  title: string
  description: string | null
  thumbnail_path: string | null
  visibility_type: 'public' | 'paid' | 'members'
  created_at: string
}

export default async function MyFollowingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: followRows } = await supabase
    .from('creator_follows')
    .select('id, creator_id, follower_id, created_at')
    .eq('follower_id', user.id)
    .order('created_at', { ascending: false })
    .returns<FollowRow[]>()

  const follows = followRows ?? []
  const creatorIds = [...new Set(follows.map((f) => f.creator_id))]

  const { data: profileRows } = creatorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio')
        .in('id', creatorIds)
        .returns<ProfileRow[]>()
    : { data: [] as ProfileRow[] }

  const { data: publicVideoRows } = creatorIds.length
    ? await supabase
        .from('videos')
        .select('id, user_id, title, description, thumbnail_path, visibility_type, created_at')
        .in('user_id', creatorIds)
        .in('visibility_type', ['public', 'paid'])
        .order('created_at', { ascending: false })
        .returns<PublicVideoRow[]>()
    : { data: [] as PublicVideoRow[] }

  const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]))
  const latestByCreator = new Map<string, PublicVideoRow>()

  for (const video of publicVideoRows ?? []) {
    if (!latestByCreator.has(video.user_id)) {
      latestByCreator.set(video.user_id, video)
    }
  }

  const items = await Promise.all(
    follows.map(async (follow) => {
      const creator = profileMap.get(follow.creator_id) ?? null
      const latestVideo = latestByCreator.get(follow.creator_id) ?? null

      const avatarPublicUrl = creator?.avatar_url
        ? supabase.storage.from('profile-assets').getPublicUrl(creator.avatar_url).data.publicUrl
        : null

      const latestThumbnailUrl =
        latestVideo?.thumbnail_path
          ? (
              await supabaseAdmin.storage
                .from('videos')
                .createSignedUrl(latestVideo.thumbnail_path, 60 * 60)
            ).data?.signedUrl ?? null
          : null

      return {
        follow,
        creator,
        avatarPublicUrl,
        latestVideo,
        latestThumbnailUrl,
      }
    })
  )

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Gefolgte Creator
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Creator, denen du folgst. Später wird hier auch dein Following-Feed andocken. Natürlich.
              </p>
            </div>

            <Link
              href="/explore"
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
            >
              Creator entdecken
            </Link>
          </div>

          {items.length > 0 ? (
            <div className="space-y-4">
              {items.map(({ follow, creator, avatarPublicUrl, latestVideo, latestThumbnailUrl }) => (
                <article
                  key={follow.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-white/10">
                        {avatarPublicUrl ? (
                          <img
                            src={avatarPublicUrl}
                            alt={creator?.display_name || creator?.username || 'Creator'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg text-white/50">
                            {(
                              creator?.display_name?.[0] ||
                              creator?.username?.[0] ||
                              'C'
                            ).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h2 className="truncate text-xl font-semibold text-white">
                          {creator?.display_name || creator?.username || 'Unbekannter Creator'}
                        </h2>

                        <div className="mt-1 text-sm text-white/45">
                          @{creator?.username || 'creator'}
                        </div>

                        <p className="mt-3 max-w-2xl text-sm text-white/55">
                          {creator?.bio || 'Noch keine Bio vorhanden.'}
                        </p>

                        <div className="mt-3 text-xs text-white/35">
                          Gefolgt seit {new Date(follow.created_at).toLocaleDateString('de-DE')}
                        </div>
                      </div>
                    </div>

                    <div className="flex w-full shrink-0 flex-col gap-3 xl:w-[280px]">
                      <Link
                        href={`/channel/${follow.creator_id}`}
                        className="rounded-full bg-white px-4 py-2 text-center text-sm font-medium text-black transition hover:opacity-90"
                      >
                        Zum Kanal
                      </Link>
                    </div>
                  </div>

                  {latestVideo ? (
                    <div className="mt-5 border-t border-white/10 pt-5">
                      <div className="mb-3 text-sm font-medium uppercase tracking-wide text-white/45">
                        Neuester frei sichtbarer Inhalt
                      </div>

                      <Link
                        href={`/video/${latestVideo.id}`}
                        className="grid gap-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20 transition hover:bg-white/5 md:grid-cols-[220px_minmax(0,1fr)]"
                      >
                        <div className="aspect-video overflow-hidden bg-white/5">
                          {latestThumbnailUrl ? (
                            <img
                              src={latestThumbnailUrl}
                              alt={latestVideo.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm text-white/35">
                              Kein Thumbnail
                            </div>
                          )}
                        </div>

                        <div className="p-4">
                          <div className="mb-2 flex flex-wrap gap-2 text-xs text-white/45">
                            <span className="rounded-full border border-white/10 px-3 py-1">
                              {latestVideo.visibility_type === 'public'
                                ? 'Öffentlich'
                                : 'Einzelkauf'}
                            </span>
                          </div>

                          <h3 className="line-clamp-2 text-base font-medium text-white">
                            {latestVideo.title}
                          </h3>

                          <p className="mt-2 line-clamp-2 text-sm text-white/50">
                            {latestVideo.description || 'Keine Beschreibung vorhanden.'}
                          </p>

                          <div className="mt-3 text-xs text-white/35">
                            {new Date(latestVideo.created_at).toLocaleDateString('de-DE')}
                          </div>
                        </div>
                      </Link>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Du folgst noch niemandem"
              description="Folge Creatorn, um sie später für Stories, Feed und neue Uploads schneller wiederzufinden."
            />
          )}
        </main>
      </AppFrame>
    </>
  )
}