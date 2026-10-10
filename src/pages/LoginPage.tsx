import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiRequestError, errorMessage, violation } from '../api/http'
import type { TokenResponse } from '../api/types'
import { setSession } from '../auth/session'
import { AuthLayout } from '../components/AuthLayout'
import { TextField } from '../components/TextField'
import { emailError, loginPasswordError, tenantIdError } from '../validation'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [showTenant, setShowTenant] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    const emailProblem = emailError(email)
    const passwordProblem = loginPasswordError(password)
    const tenantProblem = tenantIdError(tenantId)
    if (emailProblem) nextErrors.email = emailProblem
    if (passwordProblem) nextErrors.password = passwordProblem
    if (tenantProblem) nextErrors.tenantId = tenantProblem
    setFieldErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length > 0) return

    setPending(true)
    try {
      const body: { email: string; password: string; tenantId?: string } = {
        email: email.trim(),
        password,
      }
      if (tenantId.trim()) body.tenantId = tenantId.trim()
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
      })
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof ApiRequestError && /tenantId is required/i.test(error.message)) {
        setShowTenant(true)
      }
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
        {formError ? <p className="banner error" role="alert">{formError}</p> : null}
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email || undefined}
          maxLength={320}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password || undefined}
        />
        <button
          type="button"
          className="text-button tenant-toggle"
          onClick={() => setShowTenant((open) => !open)}
          aria-expanded={showTenant}
        >
          {showTenant ? 'Hide organization id' : 'This account belongs to more than one organization'}
        </button>
        {showTenant ? (
          <TextField
            label="Tenant id"
            name="tenantId"
            value={tenantId}
            onChange={setTenantId}
            error={fieldErrors.tenantId || undefined}
            hint="Required only when this email is a member of more than one tenant."
            spellCheck={false}
          />
        ) : null}
        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="switch">
          New organization? <Link to="/signup">Create one</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
