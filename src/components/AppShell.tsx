import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api, errorMessage, putImage, switchOrganization } from '../api/http'
import type { LoginOrganization, MembershipRole, Organization, Profile } from '../api/types'
import { useSession } from '../auth/AuthProvider'
import { bumpImages, canViewMembers, getImageVersion, getSession, isOwner, readAccessClaims, setSession, subscribeImages } from '../auth/session'
import { Avatar, Logo } from './Avatar'
import { LogoMark } from './LogoMark'

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
  const [menuOpen, setMenuOpen] = useState(false)
  const [orgMenuOpen, setOrgMenuOpen] = useState(false)
  const orgMenuRef = useRef<HTMLDivElement>(null)
  const imageVersion = useSyncExternalStore(subscribeImages, getImageVersion)

  useEffect(() => {
    setMenuOpen(false)
    setOrgMenuOpen(false)
  }, [location.pathname, session?.tenantId])

  useEffect(() => {
    if (!orgMenuOpen) return
    function onPointer(event: MouseEvent) {
      if (!orgMenuRef.current?.contains(event.target as Node)) setOrgMenuOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOrgMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [orgMenuOpen])

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
      {menuOpen ? (
        <button type="button" className="scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
      ) : null}
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <LogoMark />
          <div>
            <p className="mark">Foundation</p>
            <p className="brand-sub">Workspace</p>
          </div>
        </div>

        <div className="workspace">
          <div className="workspace-id">
            {logoUrl ? <Logo url={logoUrl} /> : <span className="logo placeholder" aria-hidden="true">{(session.organizationName ?? 'T').trim().charAt(0).toUpperCase()}</span>}
            <div className="workspace-copy">
              {showSwitcher ? (
                <div className="org-switch" ref={orgMenuRef}>
                  <label className="sr-only" htmlFor="organization-switch">Organization</label>
                  <button
                    type="button"
                    id="organization-switch"
                    className="org-switch-button"
                    aria-haspopup="listbox"
                    aria-expanded={orgMenuOpen}
                    disabled={switchingTo !== null}
                    aria-describedby={switchError ? 'organization-switch-error' : undefined}
                    onClick={() => setOrgMenuOpen((open) => !open)}
                  >
                    <span className="org-switch-label">
                      {organizationLabel(
                        choices.find((organization) => organization.tenantId === (switchingTo ?? session.tenantId)) ?? choices[0],
                        choices,
                      )}
                    </span>
                  </button>
                  {orgMenuOpen ? (
                    <ul className="org-menu" role="listbox" aria-labelledby="organization-switch">
                      {choices.map((organization) => (
                        <li key={organization.tenantId}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={organization.tenantId === session.tenantId}
                            onClick={() => {
                              setOrgMenuOpen(false)
                              void onOrganizationChange(organization.tenantId)
                            }}
                          >
                            {organizationLabel(organization, choices)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <span className="org-name">{session.organizationName ?? 'Organization'}</span>
              )}
              <button type="button" className="tenant-id" onClick={() => void copyTenant()}>
                <code>{session.tenantId}</code>
                <span>{copied ? 'Copied' : 'Copy id'}</span>
              </button>
            </div>
          </div>
          {owner ? (
            <div className="workspace-actions">
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
              {logoUrl ? (
                <button type="button" className="text-button" onClick={() => void onClearLogo()} disabled={logoPending}>
                  Remove
                </button>
              ) : null}
            </div>
          ) : null}
          {logoError ? <p className="field-error" role="alert">{logoError}</p> : null}
          {switchError ? (
            <p id="organization-switch-error" className="field-error" role="alert">{switchError}</p>
          ) : null}
        </div>

        <nav className="nav" aria-label="Sections">
          <p className="nav-label">Workspace</p>
          <NavLink to="/" end><NavIcon name="products" />Products</NavLink>
          {showMembers ? <NavLink to="/members"><NavIcon name="members" />Members</NavLink> : null}
          <NavLink to="/billing"><NavIcon name="billing" />Billing</NavLink>
          {owner ? <NavLink to="/audit"><NavIcon name="audit" />Audit log</NavLink> : null}
          <p className="nav-label">Account</p>
          <NavLink to="/account"><NavIcon name="account" />Profile</NavLink>
          <NavLink to="/password"><NavIcon name="password" />Password</NavLink>
        </nav>

        <div className="sidebar-user">
          <Avatar url={avatarUrl} label={session.name || session.email} />
          <div className="who">
            <span className="who-name">{session.name || session.email}</span>
            {session.name ? <span className="email">{session.email}</span> : null}
            <span className="role">{formatRole(role)}</span>
          </div>
          <button type="button" className="button secondary" onClick={() => void signOut()} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      <div className="frame">
        <header className="topbar">
          <button type="button" className="menu-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              {menuOpen ? <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" /> : <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
            </svg>
          </button>
          <p className="crumb">{sectionTitle(location.pathname)}</p>
        </header>
        <main className="content">
          <div key={session.tenantId}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function sectionTitle(pathname: string): string {
  if (pathname.startsWith('/members')) return 'Members'
  if (pathname.startsWith('/billing')) return 'Billing'
  if (pathname.startsWith('/audit')) return 'Audit log'
  if (pathname.startsWith('/account')) return 'Profile'
  if (pathname.startsWith('/password')) return 'Password'
  return 'Products'
}

function NavIcon({ name }: { name: 'products' | 'members' | 'billing' | 'audit' | 'account' | 'password' }) {
  const common = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true as const }
  if (name === 'products') {
    return (
      <svg {...common}>
        <path d="M2.5 5.5 8 2.5l5.5 3v6L8 14.5l-5.5-3v-6Z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2.7 5.6 8 8.4l5.3-2.8M8 8.4V14" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    )
  }
  if (name === 'members') {
    return (
      <svg {...common}>
        <circle cx="6" cy="5.2" r="1.8" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2.8 12.2c.5-1.8 1.7-2.7 3.2-2.7s2.7.9 3.2 2.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="11" cy="5.6" r="1.4" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10.4 9.6c1.2.2 2.1.9 2.6 2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'billing') {
    return (
      <svg {...common}>
        <rect x="1.8" y="3.5" width="12.4" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
        <path d="M1.8 6.5h12.4" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    )
  }
  if (name === 'audit') {
    return (
      <svg {...common}>
        <path d="M4 2.8h6.2L13 5.6V13.2H4V2.8Z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10 2.8V6h3M6.2 8.2h4.6M6.2 10.6h3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'password') {
    return (
      <svg {...common}>
        <circle cx="6.2" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8.5 8H14M11.6 8v1.6M13.2 8v1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="8" cy="5.4" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.4 13c.7-2.2 2.2-3.3 4.6-3.3s3.9 1.1 4.6 3.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
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
