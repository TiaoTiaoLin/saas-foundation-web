import { useState, type FormEvent } from 'react'
import { api, ApiRequestError, errorMessage } from '../api/http'
import type { TokenResponse } from '../api/types'
import { useSession } from '../auth/AuthProvider'
import { setSession } from '../auth/session'
import { TextField } from '../components/TextField'
import { signupPasswordError } from '../validation'

export function PasswordPage() {
  const session = useSession()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!currentPassword) nextErrors.currentPassword = 'Current password is required'
    const newPasswordProblem = signupPasswordError(newPassword)
    if (newPasswordProblem) nextErrors.newPassword = newPasswordProblem
    if (newPassword && confirmPassword !== newPassword) {
      nextErrors.confirmPassword = 'Enter the same new password again'
    }
    if (currentPassword && newPassword && currentPassword === newPassword) {
      nextErrors.newPassword = 'Choose a different password'
    }
    setFieldErrors(nextErrors)
    setFormError(null)
    setNotice(null)
    if (Object.keys(nextErrors).length > 0 || !session) return

    setPending(true)
    try {
      const tokens = await api<TokenResponse>('/api/v1/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setSession({
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.expiresAt,
        refreshToken: tokens.refreshToken,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
        tenantId: tokens.tenantId,
        email: session.email,
        organizationName: tokens.organizationName || session.organizationName,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setNotice('Password changed. Other sessions need to sign in again.')
    } catch (error) {
      if (error instanceof ApiRequestError && error.message === 'Current password is incorrect') {
        setFieldErrors({ currentPassword: error.message })
      } else if (error instanceof ApiRequestError && error.message === 'Choose a different password') {
        setFieldErrors({ newPassword: error.message })
      } else {
        setFormError(errorMessage(error))
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Password</h1>
          <p>This password is for your account, in every organization you belong to.</p>
        </div>
      </header>
      <form className="create-card password-card" onSubmit={(event) => void onSubmit(event)} noValidate>
        {notice ? <p className="banner" role="status">{notice}</p> : null}
        {formError ? <p className="banner error" role="alert">{formError}</p> : null}
        <TextField
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={setCurrentPassword}
          error={fieldErrors.currentPassword || undefined}
        />
        <TextField
          label="New password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
          error={fieldErrors.newPassword || undefined}
          hint="At least 12 characters."
        />
        <TextField
          label="Confirm new password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={fieldErrors.confirmPassword || undefined}
        />
        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Changing…' : 'Change password'}
        </button>
      </form>
    </section>
  )
}
