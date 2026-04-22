import type { ReactNode } from 'react'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import PlatformNav from '@/components/platform-nav'

type PlatformShellProps = {
  userEmail?: string | null
  current: 'overview' | 'transactions' | 'memberships' | 'creators' | 'creator-detail'
  title: string
  description?: string
  creatorId?: string
  range?: 'today' | '7d' | '30d' | 'all'
  actions?: ReactNode
  children: ReactNode
}

export default function PlatformShell({
  userEmail,
  current,
  title,
  description,
  creatorId,
  range = '30d',
  actions,
  children,
}: PlatformShellProps) {
  return (
    <>
      <SiteHeader userEmail={userEmail ?? undefined} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <div className="mb-6 flex flex-col gap-4">
            <PlatformNav current={current} creatorId={creatorId} range={range} />

            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  {title}
                </h1>
                {description ? (
                  <p className="mt-1 text-sm text-white/50">{description}</p>
                ) : null}
              </div>

              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
          </div>

          {children}
        </main>
      </AppFrame>
    </>
  )
}