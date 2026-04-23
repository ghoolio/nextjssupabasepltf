import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import EmptyState from '@/components/empty-state'
import ManageMembershipButton from '@/components/manage-membership-button'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type MembershipRow = {
  id: string
  creator_id: string
  member_id: string
  tier_id: string
  status: 'active' | 'canceled' | 'expired'
  provider: string
  created_at: string
  current_period_end: string | null
  cancel_at_period_end: boolean
  cancel_at: string | null
}

type TierRow = {
  id: string
  creator_id: string
  name: string
  description: string | null
  price_cents: number
  currency: 'EUR' | 'USD'
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
}

type MemberVideoRow = {
  id: string
  user_id: string
  title: string
  description: string | null
  thumbnail_path: string | null
  visibility_type: 'public' | 'paid' | 'members'
  payment_type: 'free' | 'paid'
  price_cents: number | null
  currency: 'EUR' | 'USD' | null
  created_at: string
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString('de-DE')
}

export default async function MyMembershipsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: membershipRows } = await supabase
    .from('creator_memberships')
    .select(
      'id, creator_id, member_id, tier_id, status, provider, created_at, current_period_end, cancel_at_period_end, cancel_at'
    )
    .eq('member_id', user.id)
    .order('created_at', { ascending: false })
    .returns<MembershipRow[]>()

  const memberships = membershipRows ?? []

  const creatorIds = [...new Set(memberships.map((m) => m.creator_id))]
  const tierIds = [...new Set(memberships.map((m) => m.tier_id))]
  const activeCreatorIds = [
    ...new Set(memberships.filter((m) => m.status === 'active').map((m) => m.creator_id)),
  ]

  const { data: profileRows } = creatorIds.length
    ? await supabase
        .from('public_profiles')
        .select('id, username, display_name, avatar_url, bio, membership_enabled')
        .in('id', creatorIds)
        .returns<ProfileRow[]>()
    : { data: [] as ProfileRow[] }

  const { data: tierRows } = tierIds.length
    ? await supabase
        .from('membership_tiers')
        .select('id, creator_id, name, description, price_cents, currency')
        .in('id', tierIds)
        .returns<TierRow[]>()
    : { data: [] as TierRow[] }

  const { data: memberVideoRows } = activeCreatorIds.length
    ? await supabase
        .from('videos')
        .select(
          'id, user_id, title, description, thumbnail_path, visibility_type, payment_type, price_cents, currency, created_at'
        )
        .in('user_id', activeCreatorIds)
        .eq('visibility_type', 'members')
        .order('created_at', { ascending: false })
        .returns<MemberVideoRow[]>()
    : { data: [] as MemberVideoRow[] }

  const signedMemberVideos = await Promise.all(
    (memberVideoRows ?? []).map(async (video) => {
      const thumbnailSigned = video.thumbnail_path
        ? await supabaseAdmin.storage.from('videos').createSignedUrl(video.thumbnail_path, 60 * 60)
        : null

      return {
        ...video,
        thumbnail_signed_url: thumbnailSigned?.data?.signedUrl ?? null,
      }
    })
  )

  const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]))
  const tierMap = new Map((tierRows ?? []).map((t) => [t.id, t]))

  const videosByCreator = new Map<
    string,
    (MemberVideoRow & { thumbnail_signed_url: string | null })[]
  >()

  for (const video of signedMemberVideos) {
    const existing = videosByCreator.get(video.user_id) ?? []
    existing.push(video)
    videosByCreator.set(video.user_id, existing)
  }

  const items = memberships.map((membership) => {
    const creator = profileMap.get(membership.creator_id) ?? null
    const tier = tierMap.get(membership.tier_id) ?? null
    const exclusiveVideos = videosByCreator.get(membership.creator_id) ?? []

    const avatarPublicUrl = creator?.avatar_url
      ? supabase.storage.from('profile-assets').getPublicUrl(creator.avatar_url).data.publicUrl
      : null

    return {
      membership,
      creator,
      tier,
      avatarPublicUrl,
      exclusiveVideos,
    }
  })

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Meine Mitgliedschaften
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Alle aktiven und vergangenen Creator-Abos an einem Ort.
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
            <div className="space-y-6">
              {items.map(({ membership, creator, tier, avatarPublicUrl, exclusiveVideos }) => {
                const periodEnd = formatDate(membership.current_period_end)
                const cancelAt = formatDate(membership.cancel_at)
                const isEnding =
                  membership.status === 'active' &&
                  (membership.cancel_at_period_end || Boolean(membership.cancel_at))

                return (
                  <article
                    key={membership.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
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
                          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-white/50">
                            <span
                              className={`rounded-full px-3 py-1 ${
                                membership.status === 'active'
                                  ? isEnding
                                    ? 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
                                    : 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                                  : membership.status === 'canceled'
                                    ? 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
                                    : 'border border-white/10 text-white/50'
                              }`}
                            >
                              {membership.status === 'active'
                                ? isEnding
                                  ? 'Aktiv, Kündigung vorgemerkt'
                                  : 'Aktiv'
                                : membership.status === 'canceled'
                                  ? 'Gekündigt'
                                  : 'Abgelaufen'}
                            </span>

                            <span className="rounded-full border border-white/10 px-3 py-1">
                              {tier
                                ? `${(tier.price_cents / 100).toFixed(2)} ${tier.currency} / Monat`
                                : 'Tier unbekannt'}
                            </span>

                            {membership.status === 'active' ? (
                              <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-fuchsia-200">
                                {exclusiveVideos.length} exklusive Inhalte
                              </span>
                            ) : null}
                          </div>

                          <h2 className="truncate text-xl font-semibold text-white">
                            {creator?.display_name || creator?.username || 'Unbekannter Creator'}
                          </h2>

                          <div className="mt-1 text-sm text-white/45">
                            @{creator?.username || 'creator'}
                          </div>

                          <div className="mt-3 text-sm text-white/75">
                            <span className="font-medium text-white">
                              {tier?.name || 'Mitgliedschaft'}
                            </span>
                            {tier?.description ? (
                              <span className="text-white/50"> · {tier.description}</span>
                            ) : null}
                          </div>

                          <p className="mt-3 max-w-2xl text-sm text-white/55">
                            {creator?.bio || 'Keine Creator-Bio vorhanden.'}
                          </p>

                          <div className="mt-3 space-y-1 text-xs text-white/35">
                            <div>
                              Gestartet am {new Date(membership.created_at).toLocaleDateString('de-DE')}
                            </div>

                            {membership.status === 'active' && isEnding && (cancelAt || periodEnd) ? (
                              <div>Endet am {cancelAt || periodEnd}</div>
                            ) : null}

                            {membership.status === 'active' && !isEnding && periodEnd ? (
                              <div>Nächste Verlängerung am {periodEnd}</div>
                            ) : null}

                            {membership.status !== 'active' && periodEnd ? (
                              <div>Letzte bekannte Laufzeit bis {periodEnd}</div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[260px]">
                        <Link
                          href={`/channel/${membership.creator_id}`}
                          className="rounded-full bg-white px-4 py-2 text-center text-sm font-medium text-black transition hover:opacity-90"
                        >
                          Zum Kanal
                        </Link>

                        {membership.status === 'active' ? (
                          <ManageMembershipButton
                            creatorId={membership.creator_id}
                            returnPath="/my-memberships"
                          />
                        ) : (
                          <div className="rounded-full border border-white/10 px-4 py-2 text-center text-sm text-white/45">
                            Nicht mehr aktiv
                          </div>
                        )}
                      </div>
                    </div>

                    {membership.status === 'active' ? (
                      <div className="mt-6 border-t border-white/10 pt-5">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-sm font-medium uppercase tracking-wide text-white/50">
                            Exklusive Inhalte
                          </h3>

                          <Link
                            href={`/channel/${membership.creator_id}#videos`}
                            className="text-sm text-white/60 transition hover:text-white"
                          >
                            Alle Inhalte ansehen
                          </Link>
                        </div>

                        {exclusiveVideos.length > 0 ? (
                          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {exclusiveVideos.slice(0, 6).map((video) => (
                              <Link
                                key={video.id}
                                href={`/video/${video.id}`}
                                className="group overflow-hidden rounded-2xl border border-white/10 bg-black/20 transition hover:bg-white/5"
                              >
                                <div className="relative aspect-video overflow-hidden bg-white/5">
                                  {video.thumbnail_signed_url ? (
                                    <img
                                      src={video.thumbnail_signed_url}
                                      alt={video.title}
                                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-sm text-white/35">
                                      Kein Thumbnail
                                    </div>
                                  )}

                                  <div className="absolute bottom-3 right-3 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/90 px-3 py-1 text-xs font-medium text-black">
                                    Mitglieder
                                  </div>
                                </div>

                                <div className="p-4">
                                  <div className="line-clamp-2 text-sm font-medium text-white">
                                    {video.title}
                                  </div>

                                  <div className="mt-2 line-clamp-2 text-xs text-white/50">
                                    {video.description || 'Exklusiver Mitgliederinhalt'}
                                  </div>

                                  <div className="mt-3 text-xs text-white/35">
                                    {new Date(video.created_at).toLocaleDateString('de-DE')}
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
                            Dieser Creator hat aktuell noch keine exklusiven Mitglieder-Videos veröffentlicht.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          ) : (
            <EmptyState
              title="Noch keine Mitgliedschaften"
              description="Sobald du einen Creator abonnierst, erscheint er hier mit direktem Link zum Kanal, zur Abo-Verwaltung und zu exklusiven Inhalten."
            />
          )}
        </main>
      </AppFrame>
    </>
  )
}