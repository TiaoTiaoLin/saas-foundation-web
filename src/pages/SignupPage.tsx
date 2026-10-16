import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, errorMessage, violation } from '../api/http'
import type { RegisterTenantResponse, TokenResponse } from '../api/types'
import { setSession } from '../auth/session'
import { AuthLayout } from '../components/AuthLayout'
import { TextField } from '../components/TextField'
import { emailError, requiredText, signupPasswordError } from '../validation'

export function SignupPage() {
  const navigate = useNavigate()
  const [organizationName, setOrganizationName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    const nameProblem = requiredText(organizationName, 'Organization name', 128)
    const adminNameProblem = requiredText(adminName, 'Name', 80)
    const emailProblem = emailError(adminEmail)
    const passwordProblem = signupPasswordError(adminPassword)
    if (nameProblem) nextErrors.organizationName = nameProblem
    if (adminNameProblem) nextErrors.adminName = adminNameProblem
    if (emailProblem) nextErrors.adminEmail = emailProblem
    if (passwordProblem) nextErrors.adminPassword = passwordProblem
    setFieldErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length > 0) return

    setPending(true)
    try {
      const registered = await api<RegisterTenantResponse>('/api/v1/tenants/registrations', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({
          organizationName: organizationName.trim(),
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim(),
          adminPassword,
        }),
      })
      const tokens = await api<TokenResponse>('/api/v1/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({
          email: adminEmail.trim(),
          password: adminPassword,
        }),
      })
      setSession({
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.expiresAt,
        refreshToken: tokens.refreshToken,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
        tenantId: tokens.tenantId,
        email: adminEmail.trim(),
        name: adminName.trim(),
        organizationName: tokens.organizationName || registered.organizationName,
      })
      navigate('/', {
        replace: true,
        state: {
          organizationName: registered.organizationName,
        },
      })
    } catch (error) {
      setFieldErrors({
        organizationName: violation(error, 'organizationName') ?? '',
        adminName: violation(error, 'adminName') ?? '',
        adminEmail: violation(error, 'adminEmail') ?? '',
        adminPassword: violation(error, 'adminPassword') ?? '',
      })
      setFormError(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout>
      <form className="panel" onSubmit={(event) => void onSubmit(event)} noValidate>
        <h2>Create an organization</h2>
        <p className="lede">This creates a tenant and an owner who can sign in immediately.</p>
        {formError ? <p className="banner error" role="alert">{formError}</p> : null}
        <TextField
          label="Organization name"
          name="organizationName"
          autoComplete="organization"
          value={organizationName}
          onChange={setOrganizationName}
          error={fieldErrors.organizationName || undefined}
          maxLength={128}
        />
        <TextField
          label="Your name"
          name="adminName"
          autoComplete="name"
          value={adminName}
          onChange={setAdminName}
          error={fieldErrors.adminName || undefined}
          maxLength={80}
        />
        <TextField
          label="Owner email"
          name="adminEmail"
          type="email"
          autoComplete="email"
          value={adminEmail}
          onChange={setAdminEmail}
          error={fieldErrors.adminEmail || undefined}
          maxLength={320}
        />
        <TextField
          label="Password"
          name="adminPassword"
          type="password"
          autoComplete="new-password"
          value={adminPassword}
          onChange={setAdminPassword}
          error={fieldErrors.adminPassword || undefined}
          hint="12 to 72 characters."
          maxLength={72}
        />
        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Creating…' : 'Create organization'}
        </button>
        <p className="switch">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
