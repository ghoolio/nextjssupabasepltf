import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import VideoGrid from '@/components/video-grid'
import EmptyState from '@/components/empty-state'
import JoinMembershipButton from '@/components/join-membership-button'
import ManageMembershipButton from '@/components/manage-membership-button'
import FollowCreatorButton from '@/components/follow-creator-button'
import StoryRing from '@/components/story-ring'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { attachSignedThumbnailUrls } from '@/lib/thumbnail-helpers'
import { attachSignedAvatarUrls } from '@/lib/avatar-helpers'

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
  created_at: string
}

type ChannelVideo = {
  id: string
  title: string
  description: string | null
  thumbnail_path: string | null
  payment_type: 'free' | 'paid'
  visibility_type: 'public' | 'paid' | 'members'
  price_cents: number | null
  currency: 'EUR' | 'USD' | null
  user_id: string
  created_at?: string
}

type PurchaseRow = {
  video_id: string
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
}

type MembershipTierRow = {
  id: string
  creator_id: string
  name: string
  description: string | null
  price_cents: number
  currency: 'EUR' | 'USD'
  position: number
}

type CreatorMembershipRow = {
  tier_id: string
  status: 'active' | 'canceled' | 'expired'
}

type FollowRow = {
  creator_id: string
  follower_id: string
}

type StoryRow = {
  id: string
  creator_id: string
  visibility_type: 'public' | 'followers' | 'members'
  expires_at: string
}

type StoryViewRow = {
  story_id: string
  viewer_id: string
}

type HighlightRow = {
  id: string
  creator_id: string
  title: string
  cover_story_id: string | null
  position: number
}

type HighlightItemRow = {
  highlight_id: string
  story_id: string
}

type CoverStoryRow = {
  id: string
  file_path: string
  thumbnail_path: string | null
}

function formatJoinedDate(value: string) {
  return new Date(value).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
  })
}

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ membership?: string }>
}) {
  const { id } = await params
  const qs = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profileRows } = await supabase
    .from('public_profiles')
    .select(
      'id, username, display_name, bio, avatar_url, banner_url, support_enabled, support_cta, membership_enabled, created_at'
    )
    .eq('id', id)
    .returns<ProfileRow[]>()

  const profile = profileRows?.[0] ?? null

  if (!profile) {
    return (
      <>
        <SiteHeader userEmail={user?.email} />
        <AppFrame>
          <main className="px-4 py-8 text-white">Kanal nicht gefunden.</main>
        </AppFrame>
      </>
    )
  }

  const isOwnChannel = user?.id === profile.id

  let activeMembership: CreatorMembershipRow | null = null
  let isFollowing = false

  if (user && !isOwnChannel) {
    const { data: membershipRows } = await supabase
      .from('creator_memberships')
      .select('tier_id, status')
      .eq('creator_id', id)
      .eq('member_id', user.id)
      .eq('status', 'active')
      .returns<CreatorMembershipRow[]>()

    activeMembership = membershipRows?.[0] ?? null

    const { data: followRows } = await supabase
      .from('creator_follows')
      .select('creator_id, follower_id')
      .eq('creator_id', id)
      .eq('follower_id', user.id)
      .returns<FollowRow[]>()

    isFollowing = Boolean(followRows?.length)
  }

  const { data: followerRows } = await supabase
    .from('creator_follows')
    .select('creator_id, follower_id')
    .eq('creator_id', id)
    .returns<FollowRow[]>()

  const followerCount = followerRows?.length ?? 0

  const nowIso = new Date().toISOString()
  const { data: storyRows } = await supabase
    .from('creator_stories')
    .select('id, creator_id, visibility_type, expires_at')
    .eq('creator_id', id)
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

  const hasStories = activeStories.length > 0
  const allStoriesSeen =
    hasStories && activeStories.every((story) => seenStoryIds.has(story.id))

  const { data: highlightRows } = await supabase
    .from('creator_highlights')
    .select('id, creator_id, title, cover_story_id, position')
    .eq('creator_id', id)
    .order('position', { ascending: true })
    .returns<HighlightRow[]>()

  const highlights = highlightRows ?? []
  const coverStoryIds = [
    ...new Set(highlights.map((h) => h.cover_story_id).filter(Boolean) as string[]),
  ]

  const { data: coverStories } = coverStoryIds.length
    ? await supabase
        .from('creator_stories')
        .select('id, file_path, thumbnail_path')
        .in('id', coverStoryIds)
        .returns<CoverStoryRow[]>()
    : { data: [] as CoverStoryRow[] }

  const { data: highlightItemRows } = highlights.length
    ? await supabase
        .from('creator_highlight_items')
        .select('highlight_id, story_id')
        .in('highlight_id', highlights.map((h) => h.id))
        .returns<HighlightItemRow[]>()
    : { data: [] as HighlightItemRow[] }

  const coverMap = new Map((coverStories ?? []).map((story) => [story.id, story]))
  const itemCountByHighlight = new Map<string, number>()

  for (const item of highlightItemRows ?? []) {
    itemCountByHighlight.set(
      item.highlight_id,
      (itemCountByHighlight.get(item.highlight_id) ?? 0) + 1
    )
  }

  const mappedHighlights = await Promise.all(
    highlights.map(async (highlight) => {
      const coverStory = highlight.cover_story_id
        ? coverMap.get(highlight.cover_story_id) ?? null
        : null
      const previewPath = coverStory?.thumbnail_path || coverStory?.file_path || null

      const signedCoverUrl = previewPath
        ? (
            await supabaseAdmin.storage
              .from('stories')
              .createSignedUrl(previewPath, 60 * 60)
          ).data?.signedUrl ?? null
        : null

      return {
        ...highlight,
        item_count: itemCountByHighlight.get(highlight.id) ?? 0,
        cover_url: signedCoverUrl,
      }
    })
  )

  let videoQuery = supabase
    .from('videos')
    .select(
      'id, user_id, title, description, thumbnail_path, payment_type, visibility_type, price_cents, currency, created_at'
    )
    .eq('user_id', id)
    .order('created_at', { ascending: false })

  if (!isOwnChannel) {
    if (activeMembership) {
      videoQuery = videoQuery.or(
        'visibility_type.eq.public,visibility_type.eq.paid,visibility_type.eq.members'
      )
    } else {
      videoQuery = videoQuery.or('visibility_type.eq.public,visibility_type.eq.paid')
    }
  }

  const { data: videos } = await videoQuery.returns<ChannelVideo[]>()

  const { data: tierRows } = await supabase
    .from('membership_tiers')
    .select('id, creator_id, name, description, price_cents, currency, position')
    .eq('creator_id', id)
    .order('position', { ascending: true })
    .returns<MembershipTierRow[]>()

  let purchasedIds = new Set<string>()

  if (user) {
    const { data: purchases } = await supabase
      .from('video_purchases')
      .select('video_id, payment_status')
      .eq('buyer_id', user.id)
      .eq('payment_status', 'paid')
      .returns<PurchaseRow[]>()

    purchasedIds = new Set((purchases ?? []).map((p) => p.video_id))
  }

  const enrichedVideos =
    videos?.map((video) => ({
      ...video,
      purchased: purchasedIds.has(video.id),
      creator_id: profile.id,
      creator_name: profile.display_name || profile.username || 'Creator',
      creator_avatar_url: profile.avatar_url || null,
    })) ?? []

  const withThumbs = await attachSignedThumbnailUrls(supabase, enrichedVideos)
  const mappedVideos = await attachSignedAvatarUrls(supabase, withThumbs)

  const publicCount = mappedVideos.filter((v) => v.visibility_type === 'public').length
  const paidCount = mappedVideos.filter((v) => v.visibility_type === 'paid').length
  const membersCount = mappedVideos.filter((v) => v.visibility_type === 'members').length

  const avatarPublicUrl = profile.avatar_url
    ? supabase.storage.from('profile-assets').getPublicUrl(profile.avatar_url).data.publicUrl
    : null

  const bannerPublicUrl = profile.banner_url
    ? supabase.storage.from('profile-assets').getPublicUrl(profile.banner_url).data.publicUrl
    : null

  const hasVideos = mappedVideos.length > 0
  const hasMemberships = (tierRows?.length ?? 0) > 0
  const joinedLabel = formatJoinedDate(profile.created_at)

  return (
    <>
      <SiteHeader userEmail={user?.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          {qs.membership === 'success' ? (
            <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
              Mitgliedschaft erfolgreich aktiviert.
            </div>
          ) : null}

          {qs.membership === 'cancel' ? (
            <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
              Mitgliedschaft abgebrochen.
            </div>
          ) : null}

          <section className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <div className="relative h-40 bg-gradient-to-r from-red-700/40 via-neutral-800 to-neutral-950">
              {bannerPublicUrl ? (
                <img
                  src={bannerPublicUrl}
                  alt={profile.display_name || profile.username || 'Banner'}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>

            <div className="px-6 pb-6 pt-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <div className="shrink-0">
                    {hasStories ? (
                      <StoryRing
                        href={`/stories/${profile.id}`}
                        imageUrl={avatarPublicUrl}
                        label={profile.display_name || profile.username || 'Creator'}
                        size="lg"
                        seen={allStoriesSeen}
                        showLabel={false}
                      />
                    ) : (
                      <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-neutral-950 bg-white/10">
                        {avatarPublicUrl ? (
                          <img
                            src={avatarPublicUrl}
                            alt={profile.display_name || profile.username || 'Creator'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl text-white/50">
                            {(
                              profile.display_name?.[0] ||
                              profile.username?.[0] ||
                              'V'
                            ).toUpperCase()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h1 className="text-3xl font-semibold tracking-tight text-white">
                      {profile.display_name || profile.username || 'Unbekannter Creator'}
                    </h1>

                    <div className="mt-1 text-sm text-white/45">
                      @{profile.username || 'creator'}
                    </div>

                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
                      {profile.bio || 'Noch keine Bio hinterlegt.'}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/45">
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        Seit {joinedLabel} auf VideoHub
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        {mappedVideos.length} Inhalte
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        {followerCount} Follower
                      </span>
                      {hasStories ? (
                        <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-fuchsia-200">
                          {activeStories.length} aktive Stories
                        </span>
                      ) : null}
                      {mappedHighlights.length > 0 ? (
                        <span className="rounded-full border border-white/10 px-3 py-1">
                          {mappedHighlights.length} Highlights
                        </span>
                      ) : null}
                      {membersCount > 0 ? (
                        <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-fuchsia-200">
                          {membersCount} Mitgliederinhalte
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 xl:pt-1">
                  {!isOwnChannel && user ? (
                    <FollowCreatorButton
                      creatorId={profile.id}
                      initialFollowing={isFollowing}
                    />
                  ) : null}

                  {isOwnChannel ? (
                    <>
                      <Link
                        href="/stories/new"
                        className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
                      >
                        Story posten
                      </Link>
                      <Link
                        href="/highlights/new"
                        className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                      >
                        Highlight erstellen
                      </Link>
                    </>
                  ) : null}

                  {profile.support_enabled ? (
                    <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90">
                      {profile.support_cta || 'Creator unterstützen'}
                    </button>
                  ) : null}

                  {profile.membership_enabled ? (
                    activeMembership ? (
                      <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
                        Mitglied aktiv
                      </div>
                    ) : (
                      <div className="rounded-full border border-white/10 px-4 py-2 text-sm text-white">
                        Mitgliedschaft verfügbar
                      </div>
                    )
                  ) : null}

                  {activeMembership && !isOwnChannel ? (
                    <ManageMembershipButton
                      creatorId={profile.id}
                      returnPath={`/channel/${profile.id}`}
                    />
                  ) : null}

                  {isOwnChannel ? (
                    <Link
                      href="settings/profile"
                      className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                    >
                      Profil bearbeiten
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {mappedHighlights.length > 0 ? (
            <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Highlights</h2>
                  <p className="mt-1 text-sm text-white/45">
                    Dauerhafte Story-Sammlungen dieses Creators.
                  </p>
                </div>

                {isOwnChannel ? (
                  <Link
                    href="/highlights/new"
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    Neues Highlight
                  </Link>
                ) : null}
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2">
                {mappedHighlights.map((highlight) => (
                  <div
                    key={highlight.id}
                    className="flex w-[112px] shrink-0 flex-col items-center gap-2"
                  >
                    <Link
                      href={`/highlights/${highlight.id}`}
                      className="group flex w-full flex-col items-center gap-2"
                    >
                      <div className="h-20 w-20 overflow-hidden rounded-full border border-white/10 bg-white/10 transition group-hover:border-white/20">
                        {highlight.cover_url ? (
                          <img
                            src={highlight.cover_url}
                            alt={highlight.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
                            HL
                          </div>
                        )}
                      </div>

                      <div className="w-full text-center">
                        <div className="truncate text-xs text-white/75">{highlight.title}</div>
                        <div className="text-[11px] text-white/35">
                          {highlight.item_count} Story
                          {highlight.item_count === 1 ? '' : 's'}
                        </div>
                      </div>
                    </Link>

                    {isOwnChannel ? (
                      <Link
                        href={`/highlights/${highlight.id}/edit`}
                        className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white"
                      >
                        Bearbeiten
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : isOwnChannel ? (
            <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Highlights</h2>
                  <p className="mt-1 text-sm text-white/45">
                    Du hast noch keine Highlights erstellt.
                  </p>
                </div>

                <Link
                  href="/highlights/new"
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
                >
                  Erstes Highlight erstellen
                </Link>
              </div>
            </section>
          ) : null}

          <section className="mb-6 sticky top-[72px] z-20 rounded-2xl border border-white/10 bg-black/70 p-2 backdrop-blur">
            <div className="flex flex-wrap gap-2">
              <a
                href="#videos"
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                Videos
              </a>

              <a
                href="#memberships"
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                Mitgliedschaften
              </a>

              <a
                href="#about"
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                Über
              </a>
            </div>
          </section>

          <section className="mb-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-white/40">Videos</div>
              <div className="mt-2 text-2xl font-semibold text-white">{mappedVideos.length}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-white/40">Öffentlich</div>
              <div className="mt-2 text-2xl font-semibold text-white">{publicCount}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-white/40">Einzelkauf</div>
              <div className="mt-2 text-2xl font-semibold text-white">{paidCount}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-white/40">Mitgliederinhalte</div>
              <div className="mt-2 text-2xl font-semibold text-white">{membersCount}</div>
            </div>
          </section>

          <section id="videos" className="mb-10 scroll-mt-32">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Videos</h2>
                <p className="mt-1 text-sm text-white/45">
                  Alle für dich sichtbaren Inhalte dieses Kanals.
                </p>
              </div>
            </div>

            {hasVideos ? (
              <VideoGrid videos={mappedVideos} />
            ) : (
              <EmptyState
                title="Noch keine sichtbaren Videos"
                description="Dieser Kanal hat aktuell noch keine für dich sichtbaren Inhalte."
              />
            )}
          </section>

          <section id="memberships" className="mb-10 scroll-mt-32">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-white">Mitgliedschaften</h2>
              <p className="mt-1 text-sm text-white/45">
                Unterstütze den Creator und erhalte Zugriff auf exklusive Inhalte.
              </p>
            </div>

            {hasMemberships ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {tierRows!.map((tier) => (
                  <div
                    key={tier.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="text-lg font-semibold text-white">{tier.name}</div>

                    <div className="mt-2 text-sm text-white/60">
                      {tier.description || 'Exklusive Inhalte und Support-Zugang.'}
                    </div>

                    <div className="mt-4 text-2xl font-semibold text-white">
                      {(tier.price_cents / 100).toFixed(2)} {tier.currency}
                      <span className="ml-1 text-sm font-normal text-white/45">/ Monat</span>
                    </div>

                    {activeMembership?.tier_id === tier.id ? (
                      <div className="mt-4 space-y-3">
                        <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-center text-sm text-emerald-200">
                          Aktives Abo
                        </div>

                        <ManageMembershipButton
                          creatorId={profile.id}
                          returnPath={`/channel/${profile.id}`}
                        />
                      </div>
                    ) : isOwnChannel ? (
                      <div className="mt-4 rounded-full border border-white/10 px-4 py-2 text-center text-sm text-white/50">
                        Dein eigener Tier
                      </div>
                    ) : (
                      <div className="mt-4">
                        <JoinMembershipButton
                          tierId={tier.id}
                          label="Diesen Tier wählen"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/55">
                Für diesen Creator sind aktuell noch keine Mitgliedschafts-Tiers eingerichtet.
              </div>
            )}
          </section>

          <section id="about" className="scroll-mt-32">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-white">Über diesen Kanal</h2>
              <p className="mt-1 text-sm text-white/45">
                Mehr Kontext zum Creator, Content und Kanal.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-sm font-medium uppercase tracking-wide text-white/45">
                  Beschreibung
                </h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/70">
                  {profile.bio ||
                    'Dieser Creator hat bisher noch keine ausführliche Kanalbeschreibung hinterlegt.'}
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-medium uppercase tracking-wide text-white/45">
                    Kanal-Fakten
                  </h3>

                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-white/45">Display Name</dt>
                      <dd className="text-right text-white">
                        {profile.display_name || 'Nicht gesetzt'}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-white/45">Username</dt>
                      <dd className="text-right text-white">
                        @{profile.username || 'creator'}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-white/45">Seit</dt>
                      <dd className="text-right text-white">{joinedLabel}</dd>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-white/45">Follower</dt>
                      <dd className="text-right text-white">{followerCount}</dd>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-white/45">Stories</dt>
                      <dd className="text-right text-white">{activeStories.length}</dd>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-white/45">Highlights</dt>
                      <dd className="text-right text-white">{mappedHighlights.length}</dd>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-white/45">Mitgliedschaften</dt>
                      <dd className="text-right text-white">
                        {profile.membership_enabled ? 'Aktiviert' : 'Nicht aktiviert'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-medium uppercase tracking-wide text-white/45">
                    Inhaltstypen
                  </h3>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 px-3 py-1 text-sm text-white/75">
                      {publicCount} öffentlich
                    </span>
                    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-sm text-amber-200">
                      {paidCount} Einzelkauf
                    </span>
                    <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-sm text-fuchsia-200">
                      {membersCount} Mitglieder
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </AppFrame>
    </>
  )
}