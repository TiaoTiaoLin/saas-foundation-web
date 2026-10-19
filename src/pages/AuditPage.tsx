import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api/http'
import type { AuditEvent, AuditPage, Billing } from '../api/types'
import { useSession } from '../auth/AuthProvider'
import { isOwner } from '../auth/session'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

const ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN: 'Signed in',
  AUTH_LOGOUT: 'Signed out',
  AUTH_PASSWORD_CHANGED: 'Changed password',
  AUTH_PASSWORD_RESET_REQUESTED: 'Requested a password reset',
  AUTH_PASSWORD_RESET_CONFIRMED: 'Reset password',
  AUTH_ACCOUNT_DELETED: 'Deleted account',
  MEMBERSHIP_INVITED: 'Invited a member',
  MEMBERSHIP_ACCEPTED: 'Accepted an invitation',
  MEMBERSHIP_ROLE_CHANGED: 'Changed a role',
  MEMBERSHIP_REMOVED: 'Removed a member',
  ORGANIZATION_LOGO_UPDATED: 'Updated the logo',
  ORGANIZATION_LOGO_REMOVED: 'Removed the logo',
  BILLING_SUBSCRIPTION_CHANGED: 'Subscription changed',
}

export function AuditPage() {
  const session = useSession()
  const owner = session ? isOwner(session.accessToken) : false
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [page, setPage] = useState<AuditPage | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pageDraft, setPageDraft] = useState('1')
  const [sizeDraft, setSizeDraft] = useState(String(DEFAULT_PAGE_SIZE))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!owner) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    api<Billing>('/api/v1/billing')
      .then((billing) => {
        if (cancelled) return
        setAllowed(billing.auditAccess)
        if (!billing.auditAccess) {
          setPage(null)
          setLoading(false)
          return
        }
        const params = new URLSearchParams({ page: String(pageIndex), size: String(pageSize) })
        return api<AuditPage>(`/api/v1/audit?${params}`)
      })
      .then((next) => {
        if (!cancelled && next) {
          setPage(next)
          setPageIndex(next.page)
          setPageSize(next.size)
          setPageDraft(String(next.page + 1))
          setSizeDraft(String(next.size))
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorMessage(error))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [owner, pageIndex, pageSize, session?.tenantId])

  const pageCount = page && page.size > 0 ? Math.ceil(page.total / page.size) : 0
  const lastPageNumber = Math.max(pageCount, 1)
  const total = page?.total ?? 0
  const rangeStart = total === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = Math.min(total, pageIndex * pageSize + (page?.items.length ?? 0))

  function goToPage(event: FormEvent) {
    event.preventDefault()
    const requested = Number(pageDraft)
    if (!Number.isInteger(requested)) return
    const clamped = Math.min(Math.max(requested, 1), lastPageNumber)
    setPageDraft(String(clamped))
    setPageIndex(clamped - 1)
  }

  function applyPageSize() {
    const next = clampPageSize(Number(sizeDraft))
    setSizeDraft(String(next))
    if (next === pageSize) return
    setPageIndex(0)
    setPageSize(next)
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Audit log</h1>
          <p>Security, membership, logo, and subscription changes for this organization.</p>
        </div>
      </header>
      {!owner ? <p className="hint">An owner can view the audit log.</p> : null}
      {owner && allowed === false ? (
        <div className="empty">
          <h2>Pro includes the audit log</h2>
          <p>
            Free includes the rest of this organization. Upgrade to Pro to open the audit log.{' '}
            <Link to="/billing">Open billing</Link>
          </p>
        </div>
      ) : null}
      {owner && loading ? <p className="muted">Loading audit log…</p> : null}
      {loadError ? <p className="banner error" role="alert">{loadError}</p> : null}
      {owner && allowed && page && page.items.length === 0 ? (
        <div className="empty">
          <h2>No activity yet</h2>
          <p>Sign-in, membership, logo, and subscription changes will appear here.</p>
        </div>
      ) : null}
      {page && page.items.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Action</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                  <td>{ACTION_LABELS[event.action] ?? event.action}</td>
                  <td>{detail(event)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {allowed && page && !loadError && total > 0 ? (
        <nav className="pager" aria-label="Audit log">
          {pageCount > 1 ? (
            <button
              type="button"
              className="button secondary"
              disabled={pageIndex === 0 || loading}
              onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
            >
              Previous
            </button>
          ) : null}
          {pageCount > 1 ? (
            <form onSubmit={goToPage}>
              <label htmlFor="audit-page">Page</label>
              <input
                id="audit-page"
                name="page"
                type="number"
                inputMode="numeric"
                min={1}
                max={lastPageNumber}
                value={pageDraft}
                disabled={loading}
                onChange={(event) => setPageDraft(event.target.value)}
              />
              <span>of {lastPageNumber}</span>
              <button type="submit" className="button secondary" disabled={loading}>
                Go
              </button>
            </form>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              applyPageSize()
            }}
          >
            <label htmlFor="audit-page-size">Rows</label>
            <input
              id="audit-page-size"
              name="size"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_PAGE_SIZE}
              value={sizeDraft}
              disabled={loading}
              onChange={(event) => setSizeDraft(event.target.value)}
              onBlur={applyPageSize}
            />
          </form>
          <p>
            {rangeStart}–{rangeEnd} of {total}
          </p>
          {pageCount > 1 ? (
            <button
              type="button"
              className="button secondary"
              disabled={pageIndex + 1 >= pageCount || loading}
              onClick={() => setPageIndex((current) => current + 1)}
            >
              Next
            </button>
          ) : null}
        </nav>
      ) : null}
    </section>
  )
}

function detail(event: AuditEvent): string {
  const metadata = event.metadata ?? {}
  if (metadata.planFrom && metadata.planTo && metadata.planFrom !== metadata.planTo) {
    const status = metadata.from && metadata.to && metadata.from !== metadata.to
      ? ` (${label(metadata.from)} to ${label(metadata.to)})`
      : ''
    return `${label(metadata.planFrom)} to ${label(metadata.planTo)}${status}`
  }
  if (metadata.from && metadata.to) {
    const who = metadata.email ? `${metadata.email}: ` : ''
    return `${who}${label(metadata.from)} to ${label(metadata.to)}`
  }
  if (metadata.email && metadata.role) return `${metadata.email} · ${label(metadata.role)}`
  return metadata.email ?? (metadata.role ? label(metadata.role) : '')
}

function clampPageSize(size: number): number {
  if (!Number.isInteger(size) || size < 1) return DEFAULT_PAGE_SIZE
  return Math.min(size, MAX_PAGE_SIZE)
}

function label(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}
