import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import VideoGrid from '@/components/video-grid'
import EmptyState from '@/components/empty-state'
import StoryRing from '@/components/story-ring'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { attachSignedThumbnailUrls } from '@/lib/thumbnail-helpers'
import { attachSignedAvatarUrls } from '@/lib/avatar-helpers'

type HomeVideoRow = {
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

type PurchaseRow = {
  video_id: string
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
}

type MembershipRow = {
  creator_id: string
  member_id: string
  status: 'active' | 'canceled' | 'expired'
}

type FollowRow = {
  creator_id: string
  follower_id: string
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
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

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: latestPublicRows } = await supabase
    .from('videos')
    .select(
      'id, user_id, title, description, thumbnail_path, payment_type, visibility_type, price_cents, currency, created_at'
    )
    .eq('visibility_type', 'public')
    .order('created_at', { ascending: false })
    .limit(12)
    .returns<HomeVideoRow[]>()

  let purchasedVideos: HomeVideoRow[] = []
  let memberVideos: HomeVideoRow[] = []
  let followedCreatorIds: string[] = []
  let membershipCreatorIds: string[] = []

  if (user) {
    const { data: purchaseRows } = await supabase
      .from('video_purchases')
      .select('video_id, payment_status')
      .eq('buyer_id', user.id)
      .eq('payment_status', 'paid')
      .returns<PurchaseRow[]>()

    const purchasedIds = [...new Set((purchaseRows ?? []).map((row) => row.video_id))]

    if (purchasedIds.length > 0) {
      const { data } = await supabase
        .from('videos')
        .select(
          'id, user_id, title, description, thumbnail_path, payment_type, visibility_type, price_cents, currency, created_at'
        )
        .in('id', purchasedIds)
        .order('created_at', { ascending: false })
        .returns<HomeVideoRow[]>()

      purchasedVideos = data ?? []
    }

    const { data: membershipRows } = await supabase
      .from('creator_memberships')
      .select('creator_id, member_id, status')
      .eq('member_id', user.id)
      .eq('status', 'active')
      .returns<MembershipRow[]>()

    membershipCreatorIds = [...new Set((membershipRows ?? []).map((row) => row.creator_id))]

    if (membershipCreatorIds.length > 0) {
      const { data } = await supabase
        .from('videos')
        .select(
          'id, user_id, title, description, thumbnail_path, payment_type, visibility_type, price_cents, currency, created_at'
        )
        .in('user_id', membershipCreatorIds)
        .eq('visibility_type', 'members')
        .order('created_at', { ascending: false })
        .returns<HomeVideoRow[]>()

      memberVideos = data ?? []
    }

    const { data: followRows } = await supabase
      .from('creator_follows')
      .select('creator_id, follower_id')
      .eq('follower_id', user.id)
      .returns<FollowRow[]>()

    followedCreatorIds = [...new Set((followRows ?? []).map((row) => row.creator_id))]
  }

  const discoverRows = uniqById([
    ...(latestPublicRows ?? []),
    ...purchasedVideos,
    ...memberVideos,
  ])

  const creatorIds = [
    ...new Set([
      ...discoverRows.map((video) => video.user_id),
      ...followedCreatorIds,
      ...membershipCreatorIds,
    ]),
  ]

  const { data: profileRows } = creatorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', creatorIds)
        .returns<ProfileRow[]>()
    : { data: [] as ProfileRow[] }

  const profileMap = new Map((profileRows ?? []).map((profile) => [profile.id, profile]))

  const nowIso = new Date().toISOString()
  const { data: storyRows } = await supabase
    .from('creator_stories')
    .select('id, creator_id, expires_at, visibility_type')
    .gt('expires_at', nowIso)
    .returns<StoryRow[]>()

  const activeStories = storyRows ?? []
  const visibleStoryCreatorIds = [...new Set(activeStories.map((story) => story.creator_id))]

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

  const storiesByCreator = new Map<string, StoryRow[]>()

  for (const story of activeStories) {
    const existing = storiesByCreator.get(story.creator_id) ?? []
    existing.push(story)
    storiesByCreator.set(story.creator_id, existing)
  }

  const homeStoryCreators = visibleStoryCreatorIds
    .filter((creatorId) => {
      if (!user) return true
      return (
        followedCreatorIds.includes(creatorId) ||
        membershipCreatorIds.includes(creatorId) ||
        true
      )
    })
    .slice(0, 16)
    .map((creatorId) => {
      const creator = profileMap.get(creatorId)
      const creatorStories = storiesByCreator.get(creatorId) ?? []
      const seen = creatorStories.length > 0 && creatorStories.every((story) => seenStoryIds.has(story.id))
      const avatarUrl = creator?.avatar_url
        ? supabase.storage.from('profile-assets').getPublicUrl(creator.avatar_url).data.publicUrl
        : null

      return {
        id: creatorId,
        label: creator?.display_name || creator?.username || 'Creator',
        avatarUrl,
        seen,
        count: creatorStories.length,
      }
    })

  async function enrichPublic(rows: HomeVideoRow[]) {
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

  async function enrichProtected(rows: HomeVideoRow[]) {
    const withCreators = rows.map(async (video) => {
      const creator = profileMap.get(video.user_id)

      const thumbnailSigned = video.thumbnail_path
        ? await supabaseAdmin.storage
            .from('videos')
            .createSignedUrl(video.thumbnail_path, 60 * 60)
        : null

      return {
        ...video,
        thumbnail_url: thumbnailSigned?.data?.signedUrl ?? null,
        creator_id: video.user_id,
        creator_name: creator?.display_name || creator?.username || 'Creator',
        creator_avatar_url: creator?.avatar_url || null,
      }
    })

    const resolved = await Promise.all(withCreators)
    return attachSignedAvatarUrls(supabase, resolved)
  }

  const latestPublicVideos = await enrichPublic(latestPublicRows ?? [])
  const purchasedVideoCards = await enrichProtected(purchasedVideos)
  const membershipVideoCards = await enrichProtected(memberVideos)

  return (
    <>
      <SiteHeader userEmail={user?.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs text-white/50">
                Home
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-white">
                {user ? 'Willkommen zurück' : 'Entdecke Creator und exklusive Inhalte'}
              </h1>

              <p className="mt-3 text-sm leading-6 text-white/60">
                {user
                  ? 'Hier findest du neue Uploads, Inhalte aus deinen Mitgliedschaften, Storys und bereits freigeschaltete Videos.'
                  : 'Starte mit kostenlosen Videos und entdecke Creator, Einzelkäufe, Mitgliedschaften und Stories.'}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/explore"
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
                >
                  Explore öffnen
                </Link>

                {user ? (
                  <>
                    <Link
                      href="/my-memberships"
                      className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                    >
                      Meine Mitgliedschaften
                    </Link>
                    <Link
                      href="/my-following"
                      className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                    >
                      Gefolgte Creator
                    </Link>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    Einloggen
                  </Link>
                )}
              </div>
            </div>
          </section>

          {homeStoryCreators.length > 0 ? (
            <section className="mb-10">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-white">Aktive Stories</h2>
                <p className="mt-1 text-sm text-white/45">
                  Kurzlebige Inhalte von Creatorn auf der Plattform.
                </p>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2">
                {homeStoryCreators.map((creator) => (
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

          {user ? (
            <section className="mb-10">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Aus meinen Mitgliedschaften</h2>
                  <p className="mt-1 text-sm text-white/45">
                    Exklusive Inhalte aus deinen aktiven Creator-Abos.
                  </p>
                </div>

                <Link
                  href="/my-memberships"
                  className="text-sm text-white/60 transition hover:text-white"
                >
                  Alle Abos ansehen
                </Link>
              </div>

              {membershipVideoCards.length > 0 ? (
                <VideoGrid videos={membershipVideoCards.slice(0, 8)} />
              ) : (
                <EmptyState
                  title="Noch keine exklusiven Inhalte"
                  description="Sobald Creator aus deinen Mitgliedschaften exklusive Videos veröffentlichen, erscheinen sie hier."
                />
              )}
            </section>
          ) : null}

          {user ? (
            <section className="mb-10">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Bereits freigeschaltet</h2>
                  <p className="mt-1 text-sm text-white/45">
                    Deine gekauften Einzelvideos an einem Ort.
                  </p>
                </div>

                <Link
                  href="/purchases"
                  className="text-sm text-white/60 transition hover:text-white"
                >
                  Alle Käufe ansehen
                </Link>
              </div>

              {purchasedVideoCards.length > 0 ? (
                <VideoGrid videos={purchasedVideoCards.slice(0, 8)} />
              ) : (
                <EmptyState
                  title="Noch keine Käufe"
                  description="Einzelkäufe erscheinen hier, sobald du kostenpflichtige Videos freischaltest."
                />
              )}
            </section>
          ) : null}

          <section>
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-white">Neueste kostenlose Videos</h2>
              <p className="mt-1 text-sm text-white/45">
                Der schnellste Einstieg in neue Creator und Inhalte.
              </p>
            </div>

            {latestPublicVideos.length > 0 ? (
              <VideoGrid videos={latestPublicVideos} />
            ) : (
              <EmptyState
                title="Noch keine Videos"
                description="Sobald Creator öffentliche Inhalte hochladen, erscheinen sie hier."
              />
            )}
          </section>
        </main>
      </AppFrame>
    </>
  )
}