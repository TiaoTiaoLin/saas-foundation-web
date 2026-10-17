import { useEffect, useState, useSyncExternalStore } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api, errorMessage, putImage, switchOrganization } from '../api/http'
import type { LoginOrganization, MembershipRole, Organization, Profile } from '../api/types'
import { useSession } from '../auth/AuthProvider'
import { bumpImages, canViewMembers, getImageVersion, getSession, isOwner, readAccessClaims, setSession, subscribeImages } from '../auth/session'
import { Avatar, Logo } from './Avatar'

export function AppShell() {
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [copied, setCopied] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [organizations, setOrganizations] = useState<LoginOrganization[] | null>(null)
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [logoPending, setLogoPending] = useState(false)
  const imageVersion = useSyncExternalStore(subscribeImages, getImageVersion)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    api<LoginOrganization[]>('/api/v1/auth/organizations')
      .then((list) => {
        if (!cancelled) setOrganizations(list)
      })
      .catch(() => {
        if (!cancelled) setOrganizations(null)
      })
    return () => {
      cancelled = true
    }
  }, [session?.tenantId])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    api<Organization>('/api/v1/organization')
      .then((organization) => {
        if (!cancelled) setLogoUrl(organization.logoUrl ?? null)
      })
      .catch(() => {
        if (!cancelled) setLogoUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [session?.tenantId, imageVersion])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    api<Profile>('/api/v1/auth/profile')
      .then((profile) => {
        if (cancelled) return
        setAvatarUrl(profile.avatarUrl ?? null)
        const current = getSession()
        if (!current || (current.name ?? '') === profile.name) return
        setSession({ ...current, name: profile.name })
      })
      .catch(() => {
        // The header keeps the email until the name can be loaded.
      })
    return () => {
      cancelled = true
    }
  }, [session?.email, imageVersion])

  if (!session) return null

  const claims = readAccessClaims(session.accessToken)
  const role = claims?.roles?.[0] ?? 'Member'
  const showMembers = canViewMembers(session.accessToken)
  const owner = isOwner(session.accessToken)

  async function copyTenant() {
    try {
      await navigator.clipboard.writeText(session!.tenantId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const choices = organizationChoices(session, organizations)
  const showSwitcher = choices.length > 1

  async function onOrganizationChange(tenantId: string) {
    if (tenantId === session!.tenantId || switchingTo) return
    setSwitchingTo(tenantId)
    setSwitchError(null)
    try {
      const tokens = await switchOrganization(tenantId)
      setSession({
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.expiresAt,
        refreshToken: tokens.refreshToken,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
        tenantId: tokens.tenantId,
        email: session!.email,
        organizationName: tokens.organizationName,
      })
      if (location.pathname === '/members' && !canViewMembers(tokens.accessToken)) {
        navigate('/', { replace: true })
      }
    } catch (error) {
      setSwitchError(errorMessage(error))
    } finally {
      setSwitchingTo(null)
    }
  }

  async function onLogo(file: File | undefined) {
    if (!file) return
    setLogoError(null)
    setLogoPending(true)
    try {
      const organization = await putImage<Organization>('/api/v1/organization/logo', file)
      setLogoUrl(organization.logoUrl ?? null)
      bumpImages()
    } catch (error) {
      setLogoError(errorMessage(error))
    } finally {
      setLogoPending(false)
    }
  }

  async function onClearLogo() {
    setLogoError(null)
    setLogoPending(true)
    try {
      const organization = await api<Organization>('/api/v1/organization/logo', { method: 'DELETE' })
      setLogoUrl(organization.logoUrl ?? null)
      bumpImages()
    } catch (error) {
      setLogoError(errorMessage(error))
    } finally {
      setLogoPending(false)
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
          <Avatar url={avatarUrl} label={session.name || session.email} />
          <span className="role">{formatRole(role)}</span>
          {session.name ? <span className="who-name">{session.name}</span> : null}
          <span className="email">{session.email}</span>
          <button type="button" className="button secondary" onClick={() => void signOut()} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>
      <nav className="nav" aria-label="Sections">
        <NavLink to="/" end>Products</NavLink>
        {showMembers ? <NavLink to="/members">Members</NavLink> : null}
        <NavLink to="/password">Password</NavLink>
        <NavLink to="/account">Account</NavLink>
      </nav>
      <div className="tenant-strip">
        <Logo url={logoUrl} />
        {showSwitcher ? (
          <>
            <label className="sr-only" htmlFor="organization-switch">Organization</label>
            <select
              id="organization-switch"
              value={switchingTo ?? session.tenantId}
              onChange={(event) => void onOrganizationChange(event.target.value)}
              disabled={switchingTo !== null}
              aria-describedby={switchError ? 'organization-switch-error' : undefined}
            >
              {choices.map((organization) => (
                <option key={organization.tenantId} value={organization.tenantId}>
                  {organizationLabel(organization, choices)}
                </option>
              ))}
            </select>
          </>
        ) : (
          <span className="org-name">{session.organizationName ?? 'Tenant'}</span>
        )}
        <code>{session.tenantId}</code>
        <button type="button" className="text-button" onClick={() => void copyTenant()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        {owner ? (
          <label className="text-button file-button">
            {logoPending ? 'Saving…' : logoUrl ? 'Change logo' : 'Add logo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={logoPending}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void onLogo(file)
              }}
            />
          </label>
        ) : null}
        {owner && logoUrl ? (
          <button type="button" className="text-button" onClick={() => void onClearLogo()} disabled={logoPending}>
            Remove logo
          </button>
        ) : null}
        {logoError ? <p className="field-error" role="alert">{logoError}</p> : null}
        {switchError ? (
          <p id="organization-switch-error" className="field-error" role="alert">{switchError}</p>
        ) : null}
      </div>
      <main className="content">
        <div key={session.tenantId}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function organizationChoices(session: { tenantId: string; organizationName?: string; accessToken: string }, organizations: LoginOrganization[] | null): LoginOrganization[] {
  if (!organizations) return []
  if (organizations.some((organization) => organization.tenantId === session.tenantId)) return organizations
  const role = (readAccessClaims(session.accessToken)?.roles?.[0] ?? 'MEMBER') as MembershipRole
  return [
    { tenantId: session.tenantId, name: session.organizationName ?? 'Organization', role },
    ...organizations,
  ]
}

function organizationLabel(organization: LoginOrganization, organizations: LoginOrganization[]): string {
  const duplicated = organizations.some((item) => item !== organization && item.name === organization.name)
  return duplicated ? `${organization.name} · ${formatRole(organization.role)}` : organization.name
}

function formatRole(role: string): string {
  const lower = role.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}
