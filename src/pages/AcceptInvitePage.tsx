import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api/http'
import type { AcceptMembershipInviteResponse, MembershipInvitePreview } from '../api/types'
import { useSession } from '../auth/AuthProvider'
import { AuthLayout } from '../components/AuthLayout'

export function AcceptInvitePage() {
  const session = useSession()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [preview, setPreview] = useState<MembershipInvitePreview | null>(null)
  const [accepted, setAccepted] = useState<AcceptMembershipInviteResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(token.length > 0)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!token || !session) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api<MembershipInvitePreview>('/api/v1/membership-invites/preview', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then((next) => {
        if (!cancelled) setPreview(next)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, session])

  async function onAccept() {
    setPending(true)
    setError(null)
    try {
      const result = await api<AcceptMembershipInviteResponse>('/api/v1/membership-invites/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      setAccepted(result)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout>
      <section className="panel">
        <h2>Join organization</h2>
        {!token ? (
          <p className="banner error" role="alert">This invitation is invalid or has expired</p>
        ) : null}
        {loading ? <p className="lede">Checking the invitation…</p> : null}
        {error ? <p className="banner error" role="alert">{error}</p> : null}
        {preview && !accepted ? (
          <>
            <p className="lede">
              Join {preview.organizationName} as {formatRole(preview.role)}. You are signed in as {session?.email}.
            </p>
            <button type="button" className="button" disabled={pending} onClick={() => void onAccept()}>
              {pending ? 'Joining…' : 'Accept invitation'}
            </button>
          </>
        ) : null}
        {accepted ? (
          <>
            <p className="lede" role="status">
              You joined {accepted.organizationName} as {formatRole(accepted.role)}. Sign out and sign in again,
              then choose {accepted.organizationName}.
            </p>
          </>
        ) : null}
        <p className="switch">
          <Link to="/">Back to the current organization</Link>
        </p>
      </section>
    </AuthLayout>
  )
}

function formatRole(role: string): string {
  const lower = role.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}
