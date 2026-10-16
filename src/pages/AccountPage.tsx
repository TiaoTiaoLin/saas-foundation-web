import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiRequestError, errorMessage, violation } from '../api/http'
import type { Profile } from '../api/types'
import { useSession } from '../auth/AuthProvider'
import { setSession } from '../auth/session'
import { TextField } from '../components/TextField'
import { requiredText } from '../validation'

export function AccountPage() {
  const session = useSession()
  const navigate = useNavigate()
  const [name, setName] = useState(session?.name ?? '')
  const [nameError, setNameError] = useState<string | undefined>()
  const [nameNotice, setNameNotice] = useState<string | null>(null)
  const [nameFormError, setNameFormError] = useState<string | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<Profile>('/api/v1/auth/profile')
      .then((profile) => {
        if (!cancelled) setName(profile.name)
      })
      .catch((error: unknown) => {
        if (!cancelled) setNameFormError(errorMessage(error))
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onSaveName(event: FormEvent) {
    event.preventDefault()
    const problem = requiredText(name, 'Name', 80)
    setNameError(problem)
    setNameNotice(null)
    setNameFormError(null)
    if (problem || !session) return

    setSavingName(true)
    try {
      const profile = await api<Profile>('/api/v1/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim() }),
      })
      setName(profile.name)
      setSession({ ...session, name: profile.name })
      setNameNotice('Name saved.')
    } catch (error) {
      const field = violation(error, 'name')
      setNameError(field)
      if (!field) setNameFormError(errorMessage(error))
    } finally {
      setSavingName(false)
    }
  }

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
          <p>Your name is shown in the header and to other people in your organizations.</p>
        </div>
      </header>
      <form className="create-card password-card" onSubmit={(event) => void onSaveName(event)} noValidate>
        {nameNotice ? <p className="banner" role="status">{nameNotice}</p> : null}
        {nameFormError ? <p className="banner error" role="alert">{nameFormError}</p> : null}
        <TextField
          label="Name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={setName}
          error={nameError}
          maxLength={80}
        />
        <button type="submit" className="button" disabled={savingName}>
          {savingName ? 'Saving…' : 'Save name'}
        </button>
      </form>
      <form className="create-card password-card" onSubmit={(event) => void onSubmit(event)} noValidate>
        <h2>Delete account</h2>
        <p className="lede">
          This deletes your login and every membership. An organization where you are the only
          member is deleted with its products. If other people are in an organization you solely
          own, transfer ownership first.
        </p>
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
