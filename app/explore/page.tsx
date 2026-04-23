import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import VideoGrid from '@/components/video-grid'
import EmptyState from '@/components/empty-state'
import StoryRing from '@/components/story-ring'
import { createClient } from '@/lib/supabase-server'
import { attachSignedThumbnailUrls } from '@/lib/thumbnail-helpers'
import { attachSignedAvatarUrls } from '@/lib/avatar-helpers'

type ExploreVideoRow = {
  id: string
  user_id: string
  title: string
  description: string | null
  thumbnail_path: string | null
  payment_type: 'free' | 'paid'
  visibility_type: 'public' | 'paid' | 'members'
  price_cents: number | null
  currency: 'EUR' | 'USD' | null
  created_at: string
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

type CreatorMembershipRow = {
  creator_id: string
  member_id: string
  status: 'active' | 'canceled' | 'expired'
}

type FollowRow = {
  creator_id: string
  follower_id: string
}

type StoryRow = {
  id: string
  creator_id: string
  expires_at: string
  visibility_type: 'public' | 'followers' | 'members'
}

type StoryViewRow = {
  story_id: string
  viewer_id: string
}

function uniqById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

export default async function ExplorePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: latestRows } = await supabase
    .from('videos')
    .select(
      'id, user_id, title, description, thumbnail_path, payment_type, visibility_type, price_cents, currency, created_at'
    )
    .in('visibility_type', ['public', 'paid'])
    .order('created_at', { ascending: false })
    .limit(18)
    .returns<ExploreVideoRow[]>()

  const { data: freeRows } = await supabase
    .from('videos')
    .select(
      'id, user_id, title, description, thumbnail_path, payment_type, visibility_type, price_cents, currency, created_at'
    )
    .eq('visibility_type', 'public')
    .order('created_at', { ascending: false })
    .limit(12)
    .returns<ExploreVideoRow[]>()

  const { data: paidRows } = await supabase
    .from('videos')
    .select(
      'id, user_id, title, description, thumbnail_path, payment_type, visibility_type, price_cents, currency, created_at'
    )
    .eq('visibility_type', 'paid')
    .order('created_at', { ascending: false })
    .limit(12)
    .returns<ExploreVideoRow[]>()

  let membershipVideos: ExploreVideoRow[] = []
  let followedCreatorIds: string[] = []
  let membershipCreatorIds: string[] = []

  if (user) {
    const { data: membershipRows } = await supabase
      .from('creator_memberships')
      .select('creator_id, member_id, status')
      .eq('member_id', user.id)
      .eq('status', 'active')
      .returns<CreatorMembershipRow[]>()

    membershipCreatorIds = [...new Set((membershipRows ?? []).map((m) => m.creator_id))]

    if (membershipCreatorIds.length > 0) {
      const { data } = await supabase
        .from('videos')
        .select(
          'id, user_id, title, description, thumbnail_path, payment_type, visibility_type, price_cents, currency, created_at'
        )
        .in('user_id', membershipCreatorIds)
        .eq('visibility_type', 'members')
        .order('created_at', { ascending: false })
        .limit(12)
        .returns<ExploreVideoRow[]>()

      membershipVideos = data ?? []
    }

    const { data: followRows } = await supabase
      .from('creator_follows')
      .select('creator_id, follower_id')
      .eq('follower_id', user.id)
      .returns<FollowRow[]>()

    followedCreatorIds = [...new Set((followRows ?? []).map((row) => row.creator_id))]
  }

  const allVideos = uniqById([
    ...(latestRows ?? []),
    ...(freeRows ?? []),
    ...(paidRows ?? []),
    ...membershipVideos,
  ])

  const nowIso = new Date().toISOString()
  const { data: storyRows } = await supabase
    .from('creator_stories')
    .select('id, creator_id, expires_at, visibility_type')
    .gt('expires_at', nowIso)
    .returns<StoryRow[]>()

  const activeStories = storyRows ?? []

  let seenStoryIds = new Set<string>()

  if (user && activeStories.length > 0) {
    const storyIds = activeStories.map((story) => story.id)

    const { data: storyViewRows } = await supabase
      .from('creator_story_views')
      .select('story_id, viewer_id')
      .eq('viewer_id', user.id)
      .in('story_id', storyIds)
      .returns<StoryViewRow[]>()

    seenStoryIds = new Set((storyViewRows ?? []).map((row) => row.story_id))
  }

  const creatorIds = [
    ...new Set([
      ...allVideos.map((video) => video.user_id),
      ...activeStories.map((story) => story.creator_id),
      ...followedCreatorIds,
      ...membershipCreatorIds,
    ]),
  ]

  const { data: profileRows } = creatorIds.length
    ? await supabase
        .from('public_profiles')
        .select('id, username, display_name, bio, avatar_url, membership_enabled')
        .in('id', creatorIds)
        .returns<ProfileRow[]>()
    : { data: [] as ProfileRow[] }

  const profileMap = new Map((profileRows ?? []).map((profile) => [profile.id, profile]))

  const storiesByCreator = new Map<string, StoryRow[]>()
  for (const story of activeStories) {
    const existing = storiesByCreator.get(story.creator_id) ?? []
    existing.push(story)
    storiesByCreator.set(story.creator_id, existing)
  }

  const prioritizedStoryCreatorIds = [
    ...new Set([
      ...followedCreatorIds,
      ...membershipCreatorIds,
      ...activeStories.map((story) => story.creator_id),
    ]),
  ]

  const exploreStoryCreators = prioritizedStoryCreatorIds
    .filter((creatorId) => storiesByCreator.has(creatorId))
    .slice(0, 20)
    .map((creatorId) => {
      const creator = profileMap.get(creatorId)
      const creatorStories = storiesByCreator.get(creatorId) ?? []
      const seen =
        creatorStories.length > 0 &&
        creatorStories.every((story) => seenStoryIds.has(story.id))

      const avatarUrl = creator?.avatar_url
        ? supabase.storage.from('profile-assets').getPublicUrl(creator.avatar_url).data.publicUrl
        : null

      return {
        id: creatorId,
        label: creator?.display_name || creator?.username || 'Creator',
        avatarUrl,
        seen,
      }
    })

  async function enrich(rows: ExploreVideoRow[]) {
    const withCreators = rows.map((video) => {
      const creator = profileMap.get(video.user_id)

      return {
        ...video,
        creator_id: video.user_id,
        creator_name: creator?.display_name || creator?.username || 'Creator',
        creator_avatar_url: creator?.avatar_url || null,
      }
    })

    const withThumbs = await attachSignedThumbnailUrls(supabase, withCreators)
    return attachSignedAvatarUrls(supabase, withThumbs)
  }

  const latestVideos = await enrich(latestRows ?? [])
  const freeVideos = await enrich(freeRows ?? [])
  const paidVideos = await enrich(paidRows ?? [])
  const memberOnlyVideos = await enrich(membershipVideos)

  return (
    <>
      <SiteHeader userEmail={user?.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs text-white/50">
                Explore
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Entdecke Creator, neue Uploads und exklusive Inhalte
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Finde kostenlose Videos, Einzelkäufe, Stories und Inhalte aus deinen aktiven
                Mitgliedschaften an einem Ort.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                {exploreStoryCreators.length > 0 ? (
                  <a
                    href="#stories"
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
                  >
                    Aktive Stories
                  </a>
                ) : null}
                <a
                  href="#latest"
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  Neueste Uploads
                </a>
                <a
                  href="#free"
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  Kostenlos
                </a>
                <a
                  href="#paid"
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  Einzelkauf
                </a>
                {user && memberOnlyVideos.length > 0 ? (
                  <a
                    href="#members"
                    className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-4 py-2 text-sm text-fuchsia-200 transition hover:bg-fuchsia-400/20"
                  >
                    Meine Exklusiv-Inhalte
                  </a>
                ) : null}
              </div>
            </div>
          </section>

          {exploreStoryCreators.length > 0 ? (
            <section id="stories" className="mb-10 scroll-mt-32">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-white">Aktive Stories</h2>
                <p className="mt-1 text-sm text-white/45">
                  Kurzlebige Inhalte von Creatorn, denen du folgst oder die gerade aktiv sind.
                </p>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2">
                {exploreStoryCreators.map((creator) => (
                  <StoryRing
                    key={creator.id}
                    href={`/stories/${creator.id}`}
                    imageUrl={creator.avatarUrl}
                    label={creator.label}
                    size="md"
                    seen={creator.seen}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section id="latest" className="mb-10 scroll-mt-32">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-white">Neueste Uploads</h2>
              <p className="mt-1 text-sm text-white/45">
                Die aktuellsten frei sichtbaren oder kaufbaren Inhalte auf der Plattform.
              </p>
            </div>

            {latestVideos.length > 0 ? (
              <VideoGrid videos={latestVideos} />
            ) : (
              <EmptyState
                title="Noch keine Inhalte"
                description="Sobald Creator neue Videos veröffentlichen, erscheinen sie hier."
              />
            )}
          </section>

          <section id="free" className="mb-10 scroll-mt-32">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-white">Kostenlose Videos</h2>
              <p className="mt-1 text-sm text-white/45">
                Öffentlich verfügbare Inhalte zum direkten Anschauen.
              </p>
            </div>

            {freeVideos.length > 0 ? (
              <VideoGrid videos={freeVideos} />
            ) : (
              <EmptyState
                title="Keine kostenlosen Videos"
                description="Aktuell sind keine kostenlosen Videos verfügbar."
              />
            )}
          </section>

          <section id="paid" className="mb-10 scroll-mt-32">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-white">Einzelkauf</h2>
              <p className="mt-1 text-sm text-white/45">
                Inhalte, die sich einzeln freischalten lassen.
              </p>
            </div>

            {paidVideos.length > 0 ? (
              <VideoGrid videos={paidVideos} />
            ) : (
              <EmptyState
                title="Keine Einzelkauf-Videos"
                description="Aktuell sind keine kaufbaren Einzelvideos verfügbar."
              />
            )}
          </section>

          {user ? (
            <section id="members" className="scroll-mt-32">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Aus meinen Mitgliedschaften</h2>
                  <p className="mt-1 text-sm text-white/45">
                    Die neuesten Inhalte aus deinen aktiven Creator-Abos.
                  </p>
                </div>

                <Link
                  href="/my-memberships"
                  className="text-sm text-white/60 transition hover:text-white"
                >
                  Zu meinen Mitgliedschaften
                </Link>
              </div>

              {memberOnlyVideos.length > 0 ? (
                <VideoGrid videos={memberOnlyVideos} />
              ) : (
                <EmptyState
                  title="Noch keine exklusiven Inhalte"
                  description="Sobald Creator aus deinen Mitgliedschaften exklusive Videos veröffentlichen, erscheinen sie hier."
                />
              )}
            </section>
          ) : null}
        </main>
      </AppFrame>
    </>
  )
}