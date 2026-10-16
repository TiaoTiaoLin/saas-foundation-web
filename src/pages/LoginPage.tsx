import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api, ApiRequestError, errorMessage, violation } from '../api/http'
import type { LoginOrganization, MembershipRole, TokenResponse } from '../api/types'
import { setSession } from '../auth/session'
import { AuthLayout } from '../components/AuthLayout'
import { TextField } from '../components/TextField'
import { emailError, loginPasswordError } from '../validation'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const notice = typeof location.state === 'object' && location.state && 'notice' in location.state
    ? String((location.state as { notice?: unknown }).notice ?? '')
    : ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizations, setOrganizations] = useState<LoginOrganization[] | null>(null)
  const [tenantId, setTenantId] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    const emailProblem = emailError(email)
    const passwordProblem = loginPasswordError(password)
    if (emailProblem) nextErrors.email = emailProblem
    if (passwordProblem) nextErrors.password = passwordProblem
    if (organizations && !tenantId) nextErrors.tenantId = 'Choose an organization'
    setFieldErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length > 0) return

    setPending(true)
    try {
      const body: { email: string; password: string; tenantId?: string } = {
        email: email.trim(),
        password,
      }
      if (organizations && tenantId) body.tenantId = tenantId
      const tokens = await api<TokenResponse>('/api/v1/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify(body),
      })
      setSession({
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.expiresAt,
        refreshToken: tokens.refreshToken,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
        tenantId: tokens.tenantId,
        email: email.trim(),
        organizationName: tokens.organizationName,
      })
      navigate(returnPath(location.state), { replace: true })
    } catch (error) {
      if (error instanceof ApiRequestError && error.organizations.length > 1) {
        setOrganizations(error.organizations)
        setTenantId('')
        setFormError(null)
        return
      }
      setOrganizations(null)
      setTenantId('')
      setFieldErrors({
        email: violation(error, 'email') ?? '',
        password: violation(error, 'password') ?? '',
        tenantId: violation(error, 'tenantId') ?? '',
      })
      setFormError(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout>
      <form className="panel" onSubmit={(event) => void onSubmit(event)} noValidate>
        <h2>Sign in</h2>
        <p className="lede">Use the owner account created for your organization.</p>
        {notice ? <p className="banner" role="status">{notice}</p> : null}
        {formError ? <p className="banner error" role="alert">{formError}</p> : null}
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(value) => {
            setEmail(value)
            setOrganizations(null)
            setTenantId('')
          }}
          error={fieldErrors.email || undefined}
          maxLength={320}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(value) => {
            setPassword(value)
            setOrganizations(null)
            setTenantId('')
          }}
          error={fieldErrors.password || undefined}
        />
        {organizations ? (
          <div className="field">
            <label htmlFor="organization">Organization</label>
            <select
              id="organization"
              name="organization"
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              aria-invalid={fieldErrors.tenantId ? true : undefined}
              aria-describedby={fieldErrors.tenantId ? 'organization-error' : undefined}
            >
              <option value="">Choose an organization</option>
              {organizations.map((organization) => (
                <option key={organization.tenantId} value={organization.tenantId}>
                  {organizationLabel(organization, organizations)}
                </option>
              ))}
            </select>
            {fieldErrors.tenantId ? (
              <p id="organization-error" className="field-error">{fieldErrors.tenantId}</p>
            ) : null}
          </div>
        ) : null}
        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="switch">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <p className="switch">
          New organization? <Link to="/signup">Create one</Link>
        </p>
      </form>
    </AuthLayout>
  )
}

function organizationLabel(organization: LoginOrganization, organizations: LoginOrganization[]): string {
  const name = organization.name
  const duplicated = organizations.some((item) => item !== organization && item.name === name)
  return duplicated ? `${name} · ${formatRole(organization.role)}` : name
}

function formatRole(role: MembershipRole): string {
  const lower = role.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function returnPath(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) return '/'
  const from = (state as { from?: { pathname?: unknown; search?: unknown } }).from
  const pathname = typeof from?.pathname === 'string' ? from.pathname : ''
  const search = typeof from?.search === 'string' ? from.search : ''
  const path = `${pathname}${search}`
  if (path.startsWith('/') && !path.startsWith('//')) return path
  return '/'
}
