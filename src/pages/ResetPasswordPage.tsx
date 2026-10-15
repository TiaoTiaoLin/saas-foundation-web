import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiRequestError, errorMessage } from '../api/http'
import { AuthLayout } from '../components/AuthLayout'
import { TextField } from '../components/TextField'
import { signupPasswordError } from '../validation'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const missingToken = token.length === 0
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    const passwordProblem = signupPasswordError(newPassword)
    if (passwordProblem) nextErrors.newPassword = passwordProblem
    if (newPassword && confirmPassword !== newPassword) {
      nextErrors.confirmPassword = 'Enter the same new password again'
    }
    setFieldErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length > 0) return

    setPending(true)
    try {
      await api<void>('/api/v1/auth/password-resets/confirm', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ token, newPassword }),
      })
      navigate('/login', {
        replace: true,
        state: { notice: 'Password updated. Sign in with the new password.' },
      })
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 400 && error.message.includes('reset link')) {
        setFormError(error.message)
      } else if (
        error instanceof ApiRequestError
        && (error.message.startsWith('Password must') || error.message === 'Choose a different password')
      ) {
        setFieldErrors({ newPassword: error.message })
      } else {
        setFormError(errorMessage(error))
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout>
      <form className="panel" onSubmit={(event) => void onSubmit(event)} noValidate>
        <h2>Choose a new password</h2>
        <p className="lede">This replaces the password for your account and signs out other sessions.</p>
        {missingToken ? (
          <p className="banner error" role="alert">This reset link is invalid or has expired</p>
        ) : null}
        {formError ? <p className="banner error" role="alert">{formError}</p> : null}
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
        <button type="submit" className="button" disabled={pending || !token}>
          {pending ? 'Updating…' : 'Update password'}
        </button>
        <p className="switch">
          <Link to="/forgot-password">Request a new link</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
