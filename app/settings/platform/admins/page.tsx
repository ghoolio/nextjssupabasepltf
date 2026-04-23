import Link from 'next/link'
import PlatformShell from '@/components/platform-shell'
import PlatformRoleForm from '@/components/platform-role-form'
import PlatformRoleRevertButton from '@/components/platform-role-revert-button'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAdmin, type PlatformRole } from '@/lib/platform-admin'

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  platform_role: PlatformRole | null
  is_platform_admin: boolean | null
}

type RoleFilter = PlatformRole | 'all'

type AuditLogRow = {
  id: string
  actor_user_id: string
  target_user_id: string
  previous_role: PlatformRole
  new_role: PlatformRole
  created_at: string
}

const AUDIT_PAGE_SIZE = 20

function normalizeRole(profile: ProfileRow): PlatformRole {
  if (profile.platform_role) return profile.platform_role
  if (profile.is_platform_admin) return 'platform_admin'
  return 'user'
}

function roleBadgeClass(role: PlatformRole) {
  if (role === 'platform_admin') {
    return 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
  }
  if (role === 'finance_admin') {
    return 'border border-sky-400/20 bg-sky-400/10 text-sky-200'
  }
  if (role === 'support_admin') {
    return 'border border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200'
  }
  return 'border border-white/10 bg-white/5 text-white/60'
}

function rolePriority(role: PlatformRole) {
  switch (role) {
    case 'platform_admin':
      return 0
    case 'finance_admin':
      return 1
    case 'support_admin':
      return 2
    case 'user':
      return 3
  }
}

function sortLabel(profile: {
  display_name: string | null
  username: string | null
  id: string
}) {
  return (profile.display_name?.trim() || profile.username?.trim() || profile.id).toLowerCase()
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function displayName(profile: {
  display_name: string | null
  username: string | null
  id: string
}) {
  return profile.display_name || profile.username || profile.id
}

export default async function SettingsPlatformAdminsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    role?: string
    audit_q?: string
    audit_role?: string
    page?: string
  }>
}) {
  const { user } = await requirePlatformAdmin()
  const qs = await searchParams

  const roleFilter = (
    ['all', 'user', 'support_admin', 'finance_admin', 'platform_admin'].includes(qs.role || '')
      ? qs.role
      : 'all'
  ) as RoleFilter

  const auditRoleFilter = (
    ['all', 'user', 'support_admin', 'finance_admin', 'platform_admin'].includes(
      qs.audit_role || ''
    )
      ? qs.audit_role
      : 'all'
  ) as RoleFilter

  const query = (qs.q || '').trim().toLowerCase()
  const auditQuery = (qs.audit_q || '').trim().toLowerCase()

  const currentPageRaw = Number(qs.page || '1')
  const currentPage =
    Number.isFinite(currentPageRaw) && currentPageRaw > 0 ? Math.floor(currentPageRaw) : 1

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, display_name, platform_role, is_platform_admin')
    .returns<ProfileRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const profiles = (data ?? [])
    .map((profile) => ({
      ...profile,
      normalizedRole: normalizeRole(profile),
      isSelf: profile.id === user.id,
    }))
    .sort((a, b) => {
      if (a.isSelf && !b.isSelf) return -1
      if (!a.isSelf && b.isSelf) return 1

      const roleDelta = rolePriority(a.normalizedRole) - rolePriority(b.normalizedRole)
      if (roleDelta !== 0) return roleDelta

      return sortLabel(a).localeCompare(sortLabel(b), 'de')
    })

  const filteredProfiles = profiles.filter((profile) => {
    if (roleFilter !== 'all' && profile.normalizedRole !== roleFilter) {
      return false
    }

    if (!query) return true

    const haystack = [profile.display_name || '', profile.username || '', profile.id]
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })

  const adminCount = profiles.filter((profile) => profile.normalizedRole === 'platform_admin').length
  const financeCount = profiles.filter((profile) => profile.normalizedRole === 'finance_admin').length
  const supportCount = profiles.filter((profile) => profile.normalizedRole === 'support_admin').length
  const userCount = profiles.filter((profile) => profile.normalizedRole === 'user').length

  const withParams = (
    next: Partial<Record<'q' | 'role' | 'audit_q' | 'audit_role' | 'page', string>>
  ) => {
    const params = new URLSearchParams()

    const q = next.q ?? (qs.q || '')
    const role = next.role ?? roleFilter
    const auditQ = next.audit_q ?? (qs.audit_q || '')
    const auditRole = next.audit_role ?? auditRoleFilter
    const page = next.page ?? String(currentPage)

    if (q.trim()) params.set('q', q.trim())
    if (role !== 'all') params.set('role', role)
    if (auditQ.trim()) params.set('audit_q', auditQ.trim())
    if (auditRole !== 'all') params.set('audit_role', auditRole)
    if (page !== '1') params.set('page', page)

    const queryString = params.toString()
    return `/settings/platform/admins${queryString ? `?${queryString}` : ''}`
  }

  const auditExportHref = `/api/platform/admins/audit/export${
    (() => {
      const params = new URLSearchParams()
      if ((qs.audit_q || '').trim()) params.set('audit_q', (qs.audit_q || '').trim())
      if (auditRoleFilter !== 'all') params.set('audit_role', auditRoleFilter)
      const queryString = params.toString()
      return queryString ? `?${queryString}` : ''
    })()
  }`

  const actions = (
    <>
      <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          name="q"
          defaultValue={qs.q || ''}
          placeholder="Name oder Username suchen"
          className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white outline-none placeholder:text-white/35 sm:w-72"
        />
        <input type="hidden" name="role" value={roleFilter} />
        <input type="hidden" name="audit_q" value={qs.audit_q || ''} />
        <input type="hidden" name="audit_role" value={auditRoleFilter} />
        <button
          type="submit"
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
        >
          Suchen
        </button>
      </form>

      <a
        href={auditExportHref}
        className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
      >
        Audit CSV exportieren
      </a>
    </>
  )

  const roleLinks: { key: RoleFilter; label: string }[] = [
    { key: 'all', label: 'Alle' },
    { key: 'platform_admin', label: 'Platform Admin' },
    { key: 'finance_admin', label: 'Finance Admin' },
    { key: 'support_admin', label: 'Support Admin' },
    { key: 'user', label: 'User' },
  ]

  const { data: auditRows, error: auditError } = await supabaseAdmin
    .from('platform_role_audit_logs')
    .select('id, actor_user_id, target_user_id, previous_role, new_role, created_at')
    .order('created_at', { ascending: false })
    .returns<AuditLogRow[]>()

  if (auditError) {
    throw new Error(auditError.message)
  }

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]))

  const filteredAuditRows = (auditRows ?? []).filter((row) => {
    if (auditRoleFilter !== 'all' && row.new_role !== auditRoleFilter) {
      return false
    }

    if (!auditQuery) return true

    const actor = profileMap.get(row.actor_user_id)
    const target = profileMap.get(row.target_user_id)

    const haystack = [
      actor?.display_name || '',
      actor?.username || '',
      row.actor_user_id,
      target?.display_name || '',
      target?.username || '',
      row.target_user_id,
      row.previous_role,
      row.new_role,
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(auditQuery)
  })

  const totalAuditRows = filteredAuditRows.length
  const totalAuditPages = Math.max(1, Math.ceil(totalAuditRows / AUDIT_PAGE_SIZE))
  const safePage = Math.min(currentPage, totalAuditPages)
  const auditStart = (safePage - 1) * AUDIT_PAGE_SIZE
  const pagedAuditRows = filteredAuditRows.slice(auditStart, auditStart + AUDIT_PAGE_SIZE)

  return (
    <PlatformShell
      userEmail={user.email}
      current="admins"
      title="Rollenverwaltung"
      description="Plattformrollen für interne Zugriffe verwalten."
      actions={actions}
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {roleLinks.map((item) => {
          const active = item.key === roleFilter
          return (
            <Link
              key={item.key}
              href={withParams({ role: item.key, page: '1' })}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                active
                  ? 'border-white bg-white text-black'
                  : 'border-white/10 text-white hover:bg-white/10'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Platform Admins</div>
          <div className="mt-2 text-2xl font-semibold text-white">{adminCount}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Finance Admins</div>
          <div className="mt-2 text-2xl font-semibold text-white">{financeCount}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Support Admins</div>
          <div className="mt-2 text-2xl font-semibold text-white">{supportCount}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Normale User</div>
          <div className="mt-2 text-2xl font-semibold text-white">{userCount}</div>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
        {filteredProfiles.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredProfiles.map((profile) => (
              <div
                key={profile.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-white">
                        {displayName(profile)}
                      </div>

                      {profile.isSelf ? (
                        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200">
                          Du
                        </span>
                      ) : null}
                    </div>

                    <div className="text-sm text-white/45">
                      @{profile.username || 'user'}
                    </div>
                    <div className="mt-1 break-all text-xs text-white/35">
                      {profile.id}
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs ${roleBadgeClass(
                      profile.normalizedRole
                    )}`}
                  >
                    {profile.normalizedRole}
                  </span>
                </div>

                {profile.isSelf ? (
                  <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                    Das ist dein eigener Account. Du kannst dich nicht selbst von
                    platform_admin wegstufen.
                  </div>
                ) : null}

                <PlatformRoleForm
                  userId={profile.id}
                  currentRole={profile.normalizedRole}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/50">
            Keine Profile für den aktuellen Filter gefunden.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Letzte Rollenänderungen</h2>
            <p className="mt-1 text-sm text-white/45">
              Audit-Log für Rollenänderungen.
            </p>
          </div>

          <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              name="audit_q"
              defaultValue={qs.audit_q || ''}
              placeholder="Actor oder Target suchen"
              className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white outline-none placeholder:text-white/35 sm:w-72"
            />
            <input type="hidden" name="q" value={qs.q || ''} />
            <input type="hidden" name="role" value={roleFilter} />
            <input type="hidden" name="audit_role" value={auditRoleFilter} />
            <button
              type="submit"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
            >
              Audit suchen
            </button>
          </form>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {roleLinks.map((item) => {
            const active = item.key === auditRoleFilter
            return (
              <Link
                key={`audit-${item.key}`}
                href={withParams({ audit_role: item.key, page: '1' })}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  active
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 text-white hover:bg-white/10'
                }`}
              >
                {item.key === 'all' ? 'Alle neuen Rollen' : `Neu: ${item.label}`}
              </Link>
            )
          })}
        </div>

        {pagedAuditRows.length > 0 ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-4 text-sm text-white/45">
              <div>
                Zeige {auditStart + 1} bis {Math.min(auditStart + AUDIT_PAGE_SIZE, totalAuditRows)} von {totalAuditRows} Audit-Einträgen
              </div>
              <div>
                Seite {safePage} von {totalAuditPages}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-white/40">
                    <th className="px-3 py-2">Zeit</th>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Von</th>
                    <th className="px-3 py-2">Zu</th>
                    <th className="px-3 py-2">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAuditRows.map((row) => {
                    const actor = profileMap.get(row.actor_user_id)
                    const target = profileMap.get(row.target_user_id)
                    const targetCurrentRole = target?.normalizedRole
                    const canRevert = targetCurrentRole
                      ? targetCurrentRole !== row.previous_role
                      : false

                    return (
                      <tr
                        key={row.id}
                        className="rounded-2xl bg-black/20 text-sm text-white/80"
                      >
                        <td className="rounded-l-2xl px-3 py-3 whitespace-nowrap">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-white">
                            {actor ? displayName(actor) : row.actor_user_id}
                          </div>
                          <div className="text-xs text-white/45">
                            @{actor?.username || 'unknown'}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-white">
                            {target ? displayName(target) : row.target_user_id}
                          </div>
                          <div className="text-xs text-white/45">
                            @{target?.username || 'unknown'}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${roleBadgeClass(
                              row.previous_role
                            )}`}
                          >
                            {row.previous_role}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${roleBadgeClass(
                              row.new_role
                            )}`}
                          >
                            {row.new_role}
                          </span>
                        </td>
                        <td className="rounded-r-2xl px-3 py-3">
                          {canRevert ? (
                            <PlatformRoleRevertButton
                              auditLogId={row.id}
                              previousRole={row.previous_role}
                            />
                          ) : (
                            <span className="text-xs text-white/35">Bereits aktuell</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalAuditPages > 1 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {safePage > 1 ? (
                  <Link
                    href={withParams({ page: String(safePage - 1) })}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    ← Zurück
                  </Link>
                ) : null}

                {Array.from({ length: totalAuditPages }, (_, i) => i + 1)
                  .slice(Math.max(0, safePage - 3), Math.min(totalAuditPages, safePage + 2))
                  .map((page) => (
                    <Link
                      key={page}
                      href={withParams({ page: String(page) })}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        page === safePage
                          ? 'border-white bg-white text-black'
                          : 'border-white/10 text-white hover:bg-white/10'
                      }`}
                    >
                      {page}
                    </Link>
                  ))}

                {safePage < totalAuditPages ? (
                  <Link
                    href={withParams({ page: String(safePage + 1) })}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    Weiter →
                  </Link>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/50">
            Keine Audit-Einträge für den aktuellen Filter gefunden.
          </div>
        )}
      </section>
    </PlatformShell>
  )
}