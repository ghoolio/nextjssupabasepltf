import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import StripeTierRepairButton from '@/components/stripe-tier-repair-button'
import StripeConnectActions from '@/components/stripe-connect-actions'
import { createClient } from '@/lib/supabase-server'

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  support_enabled: boolean
  support_cta: string | null
  membership_enabled: boolean
  stripe_account_id: string | null
  stripe_onboarding_completed: boolean
  stripe_charges_enabled: boolean
  stripe_payouts_enabled: boolean
  stripe_details_submitted: boolean
}

type MembershipTierRow = {
  id: string
  creator_id: string
  name: string
  price_cents: number
  currency: 'EUR' | 'USD'
  position: number
  archived: boolean
  stripe_product_id: string | null
  stripe_price_id: string | null
}

type StoryRow = { id: string }
type HighlightRow = { id: string }
type VideoRow = {
  id: string
  visibility_type: 'public' | 'paid' | 'members'
}

export default async function SettingsCreatorPage() {
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
      'id, username, display_name, support_enabled, support_cta, membership_enabled, stripe_account_id, stripe_onboarding_completed, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted'
    )
    .eq('id', user.id)
    .returns<ProfileRow[]>()

  const profile = profileRows?.[0] ?? null

  const { data: tierRows } = await supabase
    .from('membership_tiers')
    .select(
      'id, creator_id, name, price_cents, currency, position, archived, stripe_product_id, stripe_price_id'
    )
    .eq('creator_id', user.id)
    .order('archived', { ascending: true })
    .order('position', { ascending: true })
    .returns<MembershipTierRow[]>()

  const { data: storyRows } = await supabase
    .from('creator_stories')
    .select('id')
    .eq('creator_id', user.id)
    .returns<StoryRow[]>()

  const { data: highlightRows } = await supabase
    .from('creator_highlights')
    .select('id')
    .eq('creator_id', user.id)
    .returns<HighlightRow[]>()

  const { data: videoRows } = await supabase
    .from('videos')
    .select('id, visibility_type')
    .eq('user_id', user.id)
    .returns<VideoRow[]>()

  const tiers = tierRows ?? []
  const activeTiers = tiers.filter((tier) => !tier.archived)
  const archivedTiers = tiers.filter((tier) => tier.archived)

  const storiesCount = storyRows?.length ?? 0
  const highlightsCount = highlightRows?.length ?? 0
  const videos = videoRows ?? []

  const publicVideos = videos.filter((v) => v.visibility_type === 'public').length
  const paidVideos = videos.filter((v) => v.visibility_type === 'paid').length
  const memberVideos = videos.filter((v) => v.visibility_type === 'members').length

  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY)
  const stripeProductCount = activeTiers.filter((tier) => Boolean(tier.stripe_product_id)).length
  const stripePriceCount = activeTiers.filter((tier) => Boolean(tier.stripe_price_id)).length
  const archivedStripeProductCount = archivedTiers.filter((tier) => Boolean(tier.stripe_product_id)).length

  const hasStripeAccount = Boolean(profile?.stripe_account_id)

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
                Creator
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Verwalte creator-spezifische Funktionen deines Kanals und deiner Inhalte.
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <section className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold text-white">Creator-Funktionen</h2>
                <p className="mt-1 text-sm text-white/45">
                  Die wichtigsten Schalter und Wege für dein Creator-Setup.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Link
                    href="/settings/creator/memberships"
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/10"
                  >
                    <div className="text-sm font-medium text-white">Mitgliedschafts-Tiers</div>
                    <div className="mt-1 text-sm text-white/45">
                      Preise, Tiers und exklusive Mitgliedschaften verwalten
                    </div>
                  </Link>

                  <Link
                    href="/stories/new"
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/10"
                  >
                    <div className="text-sm font-medium text-white">Story posten</div>
                    <div className="mt-1 text-sm text-white/45">
                      Neue Story veröffentlichen
                    </div>
                  </Link>

                  <Link
                    href="/highlights/new"
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/10"
                  >
                    <div className="text-sm font-medium text-white">Highlight erstellen</div>
                    <div className="mt-1 text-sm text-white/45">
                      Stories dauerhaft als Highlight bündeln
                    </div>
                  </Link>

                  <Link
                    href="/my-videos"
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/10"
                  >
                    <div className="text-sm font-medium text-white">Meine Videos</div>
                    <div className="mt-1 text-sm text-white/45">
                      Eigene Uploads und Sichtbarkeit verwalten
                    </div>
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold text-white">Aktueller Creator-Status</h2>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Mitgliedschaften
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {profile?.membership_enabled ? 'Aktiviert' : 'Deaktiviert'}
                    </div>
                    <div className="mt-1 text-sm text-white/45">
                      {activeTiers.length} aktiv, {archivedTiers.length} archiviert
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Support-CTA
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {profile?.support_enabled ? 'Aktiviert' : 'Deaktiviert'}
                    </div>
                    <div className="mt-1 truncate text-sm text-white/45">
                      {profile?.support_cta || 'Kein CTA gesetzt'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Stories
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {storiesCount}
                    </div>
                    <div className="mt-1 text-sm text-white/45">
                      Insgesamt erstellt
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Highlights
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {highlightsCount}
                    </div>
                    <div className="mt-1 text-sm text-white/45">
                      Dauerhafte Sammlungen
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Öffentliche Videos
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {publicVideos}
                    </div>
                    <div className="mt-1 text-sm text-white/45">
                      Frei sichtbar
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Monetisierte Videos
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {paidVideos + memberVideos}
                    </div>
                    <div className="mt-1 text-sm text-white/45">
                      Kauf + Mitglieder
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Stripe Connect</h2>
                    <p className="mt-1 text-sm text-white/45">
                      Status deines Creator-Auszahlungs- und Onboarding-Setups.
                    </p>
                  </div>

                  <div
                    className={`rounded-full px-3 py-1 text-xs ${
                      stripeConfigured
                        ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                        : 'border border-red-400/20 bg-red-400/10 text-red-200'
                    }`}
                  >
                    {stripeConfigured ? 'Stripe aktiv' : 'Stripe fehlt'}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Connect-Konto
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {hasStripeAccount ? 'Vorhanden' : 'Fehlt'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Details eingereicht
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {profile?.stripe_details_submitted ? 'Ja' : 'Nein'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Zahlungen möglich
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {profile?.stripe_charges_enabled ? 'Ja' : 'Nein'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Auszahlungen möglich
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {profile?.stripe_payouts_enabled ? 'Ja' : 'Nein'}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <StripeConnectActions
                    hasStripeAccount={hasStripeAccount}
                    onboardingCompleted={profile?.stripe_onboarding_completed ?? false}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Stripe-Status</h2>
                    <p className="mt-1 text-sm text-white/45">
                      Überblick über die aktuelle Stripe-Kopplung deiner Membership-Tiers.
                    </p>
                  </div>

                  <div
                    className={`rounded-full px-3 py-1 text-xs ${
                      stripeConfigured
                        ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                        : 'border border-red-400/20 bg-red-400/10 text-red-200'
                    }`}
                  >
                    {stripeConfigured ? 'Stripe aktiv' : 'Stripe fehlt'}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Aktive Tiers
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {activeTiers.length}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Produkte verbunden
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {stripeProductCount}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Preise verbunden
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {stripePriceCount}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Archivierte Produkte
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {archivedStripeProductCount}
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {activeTiers.length > 0 ? (
                    activeTiers.map((tier) => {
                      const needsRepair = !tier.stripe_product_id || !tier.stripe_price_id

                      return (
                        <div
                          key={tier.id}
                          className="rounded-2xl border border-white/10 bg-black/20 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="text-sm font-medium text-white">{tier.name}</div>
                              <div className="mt-1 text-xs text-white/45">
                                {(tier.price_cents / 100).toFixed(2)} {tier.currency}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <div className="flex flex-wrap justify-end gap-2 text-[11px]">
                                <span
                                  className={`rounded-full px-2 py-1 ${
                                    tier.stripe_product_id
                                      ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                                      : 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
                                  }`}
                                >
                                  {tier.stripe_product_id ? 'Produkt verbunden' : 'Kein Produkt'}
                                </span>

                                <span
                                  className={`rounded-full px-2 py-1 ${
                                    tier.stripe_price_id
                                      ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                                      : 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
                                  }`}
                                >
                                  {tier.stripe_price_id ? 'Preis verbunden' : 'Kein Preis'}
                                </span>
                              </div>

                              {needsRepair ? <StripeTierRepairButton tierId={tier.id} /> : null}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
                      Noch keine aktiven Membership-Tiers vorhanden.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-sm font-medium uppercase tracking-wide text-white/45">
                  Creator-Profil
                </h2>

                <div className="mt-4 space-y-3 text-sm text-white/55">
                  <div>
                    Name:{' '}
                    <span className="text-white">
                      {profile?.display_name || profile?.username || 'Nicht gesetzt'}
                    </span>
                  </div>
                  <div>
                    Username:{' '}
                    <span className="text-white">
                      @{profile?.username || 'creator'}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-sm font-medium uppercase tracking-wide text-white/45">
                  Später sinnvoll
                </h2>

                <div className="mt-4 space-y-3 text-sm text-white/55">
                  <div>Stripe / Auszahlungen</div>
                  <div>Creator-Analytics</div>
                  <div>Moderation</div>
                  <div>Verifizierungsstatus</div>
                </div>
              </section>
            </aside>
          </div>
        </main>
      </AppFrame>
    </>
  )
}