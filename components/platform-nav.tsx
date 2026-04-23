import Link from 'next/link'
import { getPlatformAccessState } from '@/lib/platform-admin'

type PlatformNavProps = {
  current:
    | 'overview'
    | 'transactions'
    | 'memberships'
    | 'creators'
    | 'creator-detail'
    | 'admins'
    | 'payouts'
  creatorId?: string
  range?: 'today' | '7d' | '30d' | 'all'
}

function itemClass(active: boolean) {
  return active
    ? 'rounded-full border border-white bg-white px-4 py-2 text-sm text-black'
    : 'rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10'
}

export default async function PlatformNav({
  current,
  creatorId,
  range = '30d',
}: PlatformNavProps) {
  const access = await getPlatformAccessState()

  const canSeeFinance = access.canAccessPlatformFinance
  const canSeeSupport = access.canAccessPlatformSupport
  const canSeeAdmin = access.canAccessPlatformAdmin

  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
        <Link
          href="/settings"
          className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
        >
          ← Zurück zu Einstellungen
        </Link>

        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
          Rolle: {access.platformRole}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {canSeeFinance ? (
          <>
            <Link
              href={`/settings/platform?range=${range}`}
              className={itemClass(current === 'overview')}
            >
              Plattform
            </Link>

            <Link
              href={`/settings/platform/transactions?range=${range}`}
              className={itemClass(current === 'transactions')}
            >
              Transaktionen
            </Link>

            <Link
              href="/settings/platform/payouts"
              className={itemClass(current === 'payouts')}
            >
              Payouts
            </Link>
          </>
        ) : null}

        {canSeeSupport ? (
          <>
            <Link
              href="/settings/platform/memberships"
              className={itemClass(current === 'memberships')}
            >
              Memberships
            </Link>

            <Link
              href="/settings/platform/creators"
              className={itemClass(
                current === 'creators' || current === 'creator-detail'
              )}
            >
              Creator
            </Link>
          </>
        ) : null}

        {canSeeAdmin ? (
          <Link
            href="/settings/platform/admins"
            className={itemClass(current === 'admins')}
          >
            Rollen
          </Link>
        ) : null}

        {current === 'creator-detail' && creatorId ? (
          <Link
            href={`/settings/platform/creators/${creatorId}`}
            className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/80"
          >
            Detailansicht
          </Link>
        ) : null}
      </div>
    </div>
  )
}