import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/http'
import { useSession } from '../auth/AuthProvider'
import { readAccessClaims, setSession } from '../auth/session'

export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  if (!session) return null

  const claims = readAccessClaims(session.accessToken)
  const role = claims?.roles?.[0] ?? 'Member'

  async function copyTenant() {
    try {
      await navigator.clipboard.writeText(session!.tenantId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  async function signOut() {
    setSigningOut(true)
    try {
      await api<void>('/api/v1/auth/logout', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ refreshToken: session!.refreshToken }),
      })
    } catch {
      // Leave the browser either way. A failed revoke leaves the refresh token until it expires.
    } finally {
      setSession(null)
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <p className="mark">Foundation</p>
        <div className="who">
          <span className="role">{formatRole(role)}</span>
          <span className="email">{session.email}</span>
          <button type="button" className="button secondary" onClick={() => void signOut()} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>
      <div className="tenant-strip">
        <span>Tenant</span>
        <code>{session.tenantId}</code>
        <button type="button" className="text-button" onClick={() => void copyTenant()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <main className="content">{children}</main>
    </div>
  )
}

function formatRole(role: string): string {
  const lower = role.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}
