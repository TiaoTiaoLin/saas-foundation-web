import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api/http'
import { AuthLayout } from '../components/AuthLayout'
import { TextField } from '../components/TextField'
import { emailError } from '../validation'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const problem = emailError(email)
    setFieldError(problem)
    setFormError(null)
    if (problem) return

    setPending(true)
    try {
      await api<void>('/api/v1/auth/password-resets', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email: email.trim() }),
      })
      setSent(true)
    } catch (error) {
      setFormError(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout>
      <form className="panel" onSubmit={(event) => void onSubmit(event)} noValidate>
        <h2>Reset password</h2>
        {sent ? (
          <p className="lede" role="status">
            If an account exists for {email.trim()}, a reset link is on its way. The link expires in 30 minutes.
          </p>
        ) : (
          <>
            <p className="lede">Enter the email for your account. We will send a link if it matches one.</p>
            {formError ? <p className="banner error" role="alert">{formError}</p> : null}
            <TextField
              label="Email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={setEmail}
              error={fieldError}
              maxLength={320}
            />
            <button type="submit" className="button" disabled={pending}>
              {pending ? 'Sending…' : 'Send reset link'}
            </button>
          </>
        )}
        <p className="switch">
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
