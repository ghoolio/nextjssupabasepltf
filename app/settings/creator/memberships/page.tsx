import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import MembershipTiersManager from '@/components/membership-tiers-manager'
import { createClient } from '@/lib/supabase-server'

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  membership_enabled: boolean
}

type MembershipTierRow = {
  id: string
  creator_id: string
  name: string
  description: string | null
  price_cents: number
  currency: 'EUR' | 'USD'
  position: number
  archived: boolean
  stripe_product_id: string | null
  stripe_price_id: string | null
}

export default async function SettingsCreatorMembershipsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, membership_enabled')
    .eq('id', user.id)
    .returns<ProfileRow[]>()

  const profile = profileRows?.[0] ?? null

  const { data: tierRows } = await supabase
    .from('membership_tiers')
    .select(
      'id, creator_id, name, description, price_cents, currency, position, archived, stripe_product_id, stripe_price_id'
    )
    .eq('creator_id', user.id)
    .order('archived', { ascending: true })
    .order('position', { ascending: true })
    .returns<MembershipTierRow[]>()

  const activeTiers = (tierRows ?? []).filter((tier) => !tier.archived)
  const archivedTiers = (tierRows ?? []).filter((tier) => tier.archived)

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
              <Link
                href="/settings/creator"
                className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
              >
                ← Zurück zu Creator
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
                Mitgliedschaften
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Verwalte deine Tiers, Preise und exklusive Mitgliedschaftsinhalte.
              </p>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-white/40">
                Creator
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                {profile?.display_name || profile?.username || 'Creator'}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-white/40">
                Mitgliedschaften
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                {profile?.membership_enabled ? 'Aktiviert' : 'Deaktiviert'}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-white/40">
                Aktive Tiers
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                {activeTiers.length}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-white/40">
                Archiviert
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                {archivedTiers.length}
              </div>
            </div>
          </div>

          <MembershipTiersManager
            creatorId={user.id}
            membershipEnabled={profile?.membership_enabled ?? false}
            initialTiers={tierRows ?? []}
          />
        </main>
      </AppFrame>
    </>
  )
}