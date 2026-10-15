import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiRequestError, errorMessage } from '../api/http'
import { useSession } from '../auth/AuthProvider'
import { setSession } from '../auth/session'
import { TextField } from '../components/TextField'

export function AccountPage() {
  const session = useSession()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!session) return
    const nextErrors: Record<string, string> = {}
    if (!currentPassword) nextErrors.currentPassword = 'Current password is required'
    if (confirmation.trim().toLowerCase() !== session.email.trim().toLowerCase()) {
      nextErrors.confirmation = 'Enter the email address for this account'
    }
    setFieldErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length > 0) return

    setPending(true)
    try {
      await api<void>('/api/v1/auth/account', {
        method: 'DELETE',
        body: JSON.stringify({ currentPassword }),
      })
      setSession(null)
      navigate('/login', {
        replace: true,
        state: { notice: 'Account deleted.' },
      })
    } catch (error) {
      if (error instanceof ApiRequestError && error.message === 'Current password is incorrect') {
        setFieldErrors({ currentPassword: error.message })
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
          <h1>Account</h1>
          <p>
            This deletes your login and every membership. An organization where you are the only
            member is deleted with its products. If other people are in an organization you solely
            own, transfer ownership first.
          </p>
        </div>
      </header>
      <form className="create-card password-card" onSubmit={(event) => void onSubmit(event)} noValidate>
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
          label="Email"
          name="confirmation"
          type="email"
          autoComplete="off"
          value={confirmation}
          onChange={setConfirmation}
          error={fieldErrors.confirmation || undefined}
          hint={session ? `Type ${session.email} to confirm.` : undefined}
        />
        <button type="submit" className="button danger" disabled={pending}>
          {pending ? 'Deleting…' : 'Delete account'}
        </button>
      </form>
    </section>
  )
}
