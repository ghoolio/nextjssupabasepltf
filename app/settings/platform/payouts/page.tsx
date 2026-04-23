import Link from 'next/link'
import PlatformShell from '@/components/platform-shell'
import PayoutStatusForm from '@/components/payout-status-form'
import PayoutCreateForm from '@/components/payout-create-form'
import PayoutBulkCreateForm from '@/components/payout-bulk-create-form'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformFinanceAccess } from '@/lib/platform-admin'

type PayoutStatus = 'pending' | 'paid_out' | 'on_hold' | 'canceled'
type StatusFilter = PayoutStatus | 'all'
type SortKey =
  | 'period_end_desc'
  | 'period_end_asc'
  | 'net_desc'
  | 'net_asc'
  | 'creator_asc'
  | 'status_asc'

type CreatorPayoutRow = {
  id: string
  creator_id: string
  period_start: string
  period_end: string
  gross_cents: number
  platform_fee_cents: number
  net_cents: number
  status: PayoutStatus
  paid_out_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
}

type PayoutAuditRow = {
  id: string
  payout_id: string
  actor_user_id: string
  creator_id: string
  previous_status: PayoutStatus
  new_status: PayoutStatus
  previous_notes: string | null
  new_notes: string | null
  created_at: string
}

const PAGE_SIZE = 20
const AUDIT_PAGE_SIZE = 20

function formatMoney(cents: number, currency: 'EUR' | 'USD' = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadgeClass(status: PayoutStatus) {
  if (status === 'paid_out') {
    return 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
  }
  if (status === 'on_hold') {
    return 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
  }
  if (status === 'canceled') {
        return 'border border-red-400/20 bg-red-400/10 text-red-200'
    }
  return 'border border-sky-400/20 bg-sky-400/10 text-sky-200'
}

function statusPriority(status: PayoutStatus) {
  switch (status) {
    case 'pending':
      return 0
    case 'on_hold':
      return 1
    case 'paid_out':
      return 2
    case 'canceled':
        return 3
  }
}

export default async function SettingsPlatformPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    q?: string
    sort?: string
    page?: string
    audit_q?: string
    audit_status?: string
    audit_page?: string
  }>
}) {
  const { user } = await requirePlatformFinanceAccess()
  const qs = await searchParams

  const statusFilter = (
    ['all', 'pending', 'paid_out', 'on_hold', 'canceled'].includes(qs.status || '')
      ? qs.status
      : 'all'
  ) as StatusFilter

  const auditStatusFilter = (
    ['all', 'pending', 'paid_out', 'on_hold', 'canceled'].includes(qs.audit_status || '')
      ? qs.audit_status
      : 'all'
  ) as StatusFilter

  const sort = (
    [
      'period_end_desc',
      'period_end_asc',
      'net_desc',
      'net_asc',
      'creator_asc',
      'status_asc',
    ].includes(qs.sort || '')
      ? qs.sort
      : 'period_end_desc'
  ) as SortKey

  const currentPageRaw = Number(qs.page || '1')
  const currentPage =
    Number.isFinite(currentPageRaw) && currentPageRaw > 0 ? Math.floor(currentPageRaw) : 1

  const auditPageRaw = Number(qs.audit_page || '1')
  const auditPage =
    Number.isFinite(auditPageRaw) && auditPageRaw > 0 ? Math.floor(auditPageRaw) : 1

  const query = (qs.q || '').trim().toLowerCase()
  const auditQuery = (qs.audit_q || '').trim().toLowerCase()

  const { data: payoutRows, error: payoutError } = await supabaseAdmin
    .from('creator_payouts')
    .select(
      'id, creator_id, period_start, period_end, gross_cents, platform_fee_cents, net_cents, status, paid_out_at, notes, created_at, updated_at'
    )
    .returns<CreatorPayoutRow[]>()

  if (payoutError) {
    throw new Error(payoutError.message)
  }

  const payouts = payoutRows ?? []

  const { data: profileRows, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, username, display_name')
    .returns<ProfileRow[]>()

  if (profileError) {
    throw new Error(profileError.message)
  }

  const profileMap = new Map((profileRows ?? []).map((row) => [row.id, row]))

  const filteredPayouts = payouts.filter((row) => {
    if (statusFilter !== 'all' && row.status !== statusFilter) return false
    if (!query) return true

    const creator = profileMap.get(row.creator_id)
    const haystack = [
      creator?.display_name || '',
      creator?.username || '',
      row.creator_id,
      row.notes || '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })

  const sortedPayouts = filteredPayouts.slice().sort((a, b) => {
    if (sort === 'period_end_desc') {
      return new Date(b.period_end).getTime() - new Date(a.period_end).getTime()
    }
    if (sort === 'period_end_asc') {
      return new Date(a.period_end).getTime() - new Date(b.period_end).getTime()
    }
    if (sort === 'net_desc') return b.net_cents - a.net_cents
    if (sort === 'net_asc') return a.net_cents - b.net_cents
    if (sort === 'creator_asc') {
      const aLabel =
        profileMap.get(a.creator_id)?.display_name ||
        profileMap.get(a.creator_id)?.username ||
        a.creator_id
      const bLabel =
        profileMap.get(b.creator_id)?.display_name ||
        profileMap.get(b.creator_id)?.username ||
        b.creator_id
      return aLabel.localeCompare(bLabel, 'de')
    }
    return statusPriority(a.status) - statusPriority(b.status)
  })

  const totalRows = sortedPayouts.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pagedPayouts = sortedPayouts.slice(pageStart, pageStart + PAGE_SIZE)

  const totalGross = filteredPayouts.reduce((sum, row) => sum + row.gross_cents, 0)
  const totalFees = filteredPayouts.reduce((sum, row) => sum + row.platform_fee_cents, 0)
  const totalNet = filteredPayouts.reduce((sum, row) => sum + row.net_cents, 0)

  const pendingCount = payouts.filter((row) => row.status === 'pending').length
  const paidOutCount = payouts.filter((row) => row.status === 'paid_out').length
  const onHoldCount = payouts.filter((row) => row.status === 'on_hold').length

  const pendingNet = payouts
    .filter((row) => row.status === 'pending')
    .reduce((sum, row) => sum + row.net_cents, 0)

  const statusLinks: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Alle' },
    { key: 'pending', label: 'Pending' },
    { key: 'paid_out', label: 'Ausgezahlt' },
    { key: 'on_hold', label: 'On hold' },
    { key: 'canceled', label: 'Storniert' },
  ]

  const sortLinks: { key: SortKey; label: string }[] = [
    { key: 'period_end_desc', label: 'Zeitraum ↓' },
    { key: 'period_end_asc', label: 'Zeitraum ↑' },
    { key: 'net_desc', label: 'Netto ↓' },
    { key: 'net_asc', label: 'Netto ↑' },
    { key: 'creator_asc', label: 'Creator A-Z' },
    { key: 'status_asc', label: 'Status' },
  ]

  const withParams = (
    next: Partial<
      Record<'status' | 'q' | 'sort' | 'page' | 'audit_q' | 'audit_status' | 'audit_page', string>
    >
  ) => {
    const params = new URLSearchParams()

    const status = next.status ?? statusFilter
    const q = next.q ?? (qs.q || '')
    const sortParam = next.sort ?? sort
    const page = next.page ?? String(safePage)
    const auditQ = next.audit_q ?? (qs.audit_q || '')
    const auditStatus = next.audit_status ?? auditStatusFilter
    const auditPageParam = next.audit_page ?? String(auditPage)

    if (status !== 'all') params.set('status', status)
    if (q.trim()) params.set('q', q.trim())
    if (sortParam !== 'period_end_desc') params.set('sort', sortParam)
    if (page !== '1') params.set('page', page)
    if (auditQ.trim()) params.set('audit_q', auditQ.trim())
    if (auditStatus !== 'all') params.set('audit_status', auditStatus)
    if (auditPageParam !== '1') params.set('audit_page', auditPageParam)

    const queryString = params.toString()
    return `/settings/platform/payouts${queryString ? `?${queryString}` : ''}`
  }

  const exportHref = `/api/platform/payouts/export${
    (() => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (qs.q?.trim()) params.set('q', qs.q.trim())
      const queryString = params.toString()
      return queryString ? `?${queryString}` : ''
    })()
  }`

  const auditExportHref = `/api/platform/payouts/audit/export${
    (() => {
      const params = new URLSearchParams()
      if ((qs.audit_q || '').trim()) params.set('audit_q', qs.audit_q!.trim())
      if (auditStatusFilter !== 'all') params.set('audit_status', auditStatusFilter)
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
          placeholder="Creator oder Notiz suchen"
          className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white outline-none placeholder:text-white/35 sm:w-72"
        />
        <input type="hidden" name="status" value={statusFilter} />
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="audit_q" value={qs.audit_q || ''} />
        <input type="hidden" name="audit_status" value={auditStatusFilter} />
        <input type="hidden" name="audit_page" value={String(auditPage)} />
        <button
          type="submit"
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
        >
          Suchen
        </button>
      </form>

      <a
        href={exportHref}
        className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
      >
        Payout CSV exportieren
      </a>

      <a
        href={auditExportHref}
        className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
      >
        Audit CSV exportieren
      </a>
    </>
  )

  const { data: auditRows, error: auditError } = await supabaseAdmin
    .from('creator_payout_audit_logs')
    .select(
      'id, payout_id, actor_user_id, creator_id, previous_status, new_status, previous_notes, new_notes, created_at'
    )
    .order('created_at', { ascending: false })
    .returns<PayoutAuditRow[]>()

  if (auditError) {
    throw new Error(auditError.message)
  }

  const filteredAuditRows = (auditRows ?? []).filter((row) => {
    if (auditStatusFilter !== 'all' && row.new_status !== auditStatusFilter) return false
    if (!auditQuery) return true

    const actor = profileMap.get(row.actor_user_id)
    const creator = profileMap.get(row.creator_id)

    const haystack = [
      actor?.display_name || '',
      actor?.username || '',
      row.actor_user_id,
      creator?.display_name || '',
      creator?.username || '',
      row.creator_id,
      row.previous_status,
      row.new_status,
      row.previous_notes || '',
      row.new_notes || '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(auditQuery)
  })

  const totalAuditRows = filteredAuditRows.length
  const totalAuditPages = Math.max(1, Math.ceil(totalAuditRows / AUDIT_PAGE_SIZE))
  const safeAuditPage = Math.min(auditPage, totalAuditPages)
  const auditStart = (safeAuditPage - 1) * AUDIT_PAGE_SIZE
  const pagedAuditRows = filteredAuditRows.slice(auditStart, auditStart + AUDIT_PAGE_SIZE)

  return (
    <PlatformShell
      userEmail={user.email}
      current="payouts"
      title="Payouts"
      description="Auszahlungsübersicht für Creator, inklusive Status und offenem Saldo."
      actions={actions}
    >
      <section className="mb-6 grid gap-4 xl:grid-cols-2">
        <PayoutCreateForm />
        <PayoutBulkCreateForm />
      </section>

      <div className="mb-6 flex flex-wrap gap-2">
        {statusLinks.map((item) => {
          const active = item.key === statusFilter
          return (
            <Link
              key={item.key}
              href={withParams({ status: item.key, page: '1' })}
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

      <div className="mb-6 flex flex-wrap gap-2">
        {sortLinks.map((item) => {
          const active = item.key === sort
          return (
            <Link
              key={item.key}
              href={withParams({ sort: item.key, page: '1' })}
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
          <div className="text-xs uppercase tracking-wide text-white/40">Brutto</div>
          <div className="mt-2 text-2xl font-semibold text-white">{formatMoney(totalGross)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Plattformgebühren</div>
          <div className="mt-2 text-2xl font-semibold text-white">{formatMoney(totalFees)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Netto</div>
          <div className="mt-2 text-2xl font-semibold text-white">{formatMoney(totalNet)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Offen (pending)</div>
          <div className="mt-2 text-2xl font-semibold text-white">{formatMoney(pendingNet)}</div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Pending</div>
          <div className="mt-2 text-2xl font-semibold text-white">{pendingCount}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">Ausgezahlt</div>
          <div className="mt-2 text-2xl font-semibold text-white">{paidOutCount}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/40">On hold</div>
          <div className="mt-2 text-2xl font-semibold text-white">{onHoldCount}</div>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
        {pagedPayouts.length > 0 ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-4 text-sm text-white/45">
              <div>
                Zeige {pageStart + 1} bis {Math.min(pageStart + PAGE_SIZE, totalRows)} von {totalRows} Payouts
              </div>
              <div>
                Seite {safePage} von {totalPages}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-white/40">
                    <th className="px-3 py-2">Creator</th>
                    <th className="px-3 py-2">Zeitraum</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Brutto</th>
                    <th className="px-3 py-2">Gebühr</th>
                    <th className="px-3 py-2">Netto</th>
                    <th className="px-3 py-2">Ausgezahlt am</th>
                    <th className="px-3 py-2">Notiz</th>
                    <th className="px-3 py-2">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedPayouts.map((row) => {
                    const creator = profileMap.get(row.creator_id)

                    return (
                      <tr
                        key={row.id}
                        className="rounded-2xl bg-black/20 text-sm text-white/80"
                      >
                        <td className="rounded-l-2xl px-3 py-3">
                          <Link
                                href={`/settings/platform/payouts/${row.id}`}
                                className="font-medium text-white underline-offset-4 hover:underline"
                            >
                                {creator?.display_name || creator?.username || row.creator_id}
                            </Link>
                          <div className="text-xs text-white/45">
                            @{creator?.username || 'creator'}
                          </div>
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          <div>{formatDate(row.period_start)}</div>
                          <div className="text-xs text-white/45">
                            bis {formatDate(row.period_end)}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs ${statusBadgeClass(
                              row.status
                            )}`}
                          >
                            {row.status}
                          </span>
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">{formatMoney(row.gross_cents)}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{formatMoney(row.platform_fee_cents)}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{formatMoney(row.net_cents)}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(row.paid_out_at)}</td>

                        <td className="px-3 py-3">
                          <div className="max-w-[240px] whitespace-pre-wrap break-words text-white/60">
                            {row.notes || '—'}
                          </div>
                        </td>

                        <td className="rounded-r-2xl px-3 py-3">
                            {row.status === 'canceled' ? (
                                <span className="text-xs text-white/35">Storniert</span>
                            ) : (
                                <PayoutStatusForm
                                payoutId={row.id}
                                currentStatus={row.status}
                                currentNotes={row.notes}
                                />
                            )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {safePage > 1 ? (
                  <Link
                    href={withParams({ page: String(safePage - 1) })}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    ← Zurück
                  </Link>
                ) : null}

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(Math.max(0, safePage - 3), Math.min(totalPages, safePage + 2))
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

                {safePage < totalPages ? (
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
            Keine Payouts für den aktuellen Filter gefunden.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Letzte Payout-Änderungen</h2>
            <p className="mt-1 text-sm text-white/45">
              Die letzten manuellen Änderungen an Payout-Status und Notizen.
            </p>
          </div>

          <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              name="audit_q"
              defaultValue={qs.audit_q || ''}
              placeholder="Actor oder Creator suchen"
              className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white outline-none placeholder:text-white/35 sm:w-72"
            />
            <input type="hidden" name="q" value={qs.q || ''} />
            <input type="hidden" name="status" value={statusFilter} />
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="page" value={String(safePage)} />
            <button
              type="submit"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
            >
              Audit suchen
            </button>
          </form>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {statusLinks.map((item) => {
            const active = item.key === auditStatusFilter
            return (
              <Link
                key={`audit-${item.key}`}
                href={withParams({ audit_status: item.key, audit_page: '1' })}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  active
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 text-white hover:bg-white/10'
                }`}
              >
                {item.key === 'all' ? 'Alle neuen Status' : `Neu: ${item.label}`}
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
                Seite {safeAuditPage} von {totalAuditPages}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-white/40">
                    <th className="px-3 py-2">Zeit</th>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Creator</th>
                    <th className="px-3 py-2">Von</th>
                    <th className="px-3 py-2">Zu</th>
                    <th className="px-3 py-2">Notiz alt</th>
                    <th className="px-3 py-2">Notiz neu</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAuditRows.map((row) => {
                    const actor = profileMap.get(row.actor_user_id)
                    const creator = profileMap.get(row.creator_id)

                    return (
                      <tr
                        key={row.id}
                        className="rounded-2xl bg-black/20 text-sm text-white/80"
                      >
                        <td className="rounded-l-2xl px-3 py-3 whitespace-nowrap">
                          {formatDateTime(row.created_at)}
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-medium text-white">
                            {actor?.display_name || actor?.username || row.actor_user_id}
                          </div>
                          <div className="text-xs text-white/45">
                            @{actor?.username || 'unknown'}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-medium text-white">
                            {creator?.display_name || creator?.username || row.creator_id}
                          </div>
                          <div className="text-xs text-white/45">
                            @{creator?.username || 'creator'}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${statusBadgeClass(
                              row.previous_status
                            )}`}
                          >
                            {row.previous_status}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${statusBadgeClass(
                              row.new_status
                            )}`}
                          >
                            {row.new_status}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <div className="max-w-[220px] whitespace-pre-wrap break-words text-white/60">
                            {row.previous_notes || '—'}
                          </div>
                        </td>

                        <td className="rounded-r-2xl px-3 py-3">
                          <div className="max-w-[220px] whitespace-pre-wrap break-words text-white/60">
                            {row.new_notes || '—'}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalAuditPages > 1 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {safeAuditPage > 1 ? (
                  <Link
                    href={withParams({ audit_page: String(safeAuditPage - 1) })}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    ← Audit zurück
                  </Link>
                ) : null}

                {Array.from({ length: totalAuditPages }, (_, i) => i + 1)
                  .slice(Math.max(0, safeAuditPage - 3), Math.min(totalAuditPages, safeAuditPage + 2))
                  .map((page) => (
                    <Link
                      key={`audit-page-${page}`}
                      href={withParams({ audit_page: String(page) })}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        page === safeAuditPage
                          ? 'border-white bg-white text-black'
                          : 'border-white/10 text-white hover:bg-white/10'
                      }`}
                    >
                      {page}
                    </Link>
                  ))}

                {safeAuditPage < totalAuditPages ? (
                  <Link
                    href={withParams({ audit_page: String(safeAuditPage + 1) })}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    Audit weiter →
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