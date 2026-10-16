import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage, violation } from '../api/http'
import type { InviteMemberResponse, Member, MembershipRole } from '../api/types'
import { useSession } from '../auth/AuthProvider'
import { currentUserId, isOwner, setSession } from '../auth/session'
import { TextField } from '../components/TextField'
import { emailError } from '../validation'

const ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MEMBER']

export function MembersPage() {
  const session = useSession()
  const navigate = useNavigate()
  const owner = session ? isOwner(session.accessToken) : false
  const selfId = session ? currentUserId(session.accessToken) : null
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MembershipRole>('MEMBER')
  const [emailFieldError, setEmailFieldError] = useState<string | undefined>()
  const [inviting, setInviting] = useState(false)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  async function load() {
    try {
      const list = await api<Member[]>('/api/v1/members')
      setMembers(list)
      setLoadError(null)
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onInvite(event: FormEvent) {
    event.preventDefault()
    const problem = emailError(email)
    setEmailFieldError(problem)
    setActionError(null)
    if (problem) return

    setInviting(true)
    try {
      const invited = await api<InviteMemberResponse>('/api/v1/members', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), role }),
      })
      setEmail('')
      setRole('MEMBER')
      setNotice(inviteNotice(invited))
      await load()
    } catch (error) {
      setEmailFieldError(violation(error, 'email'))
      setActionError(errorMessage(error))
    } finally {
      setInviting(false)
    }
  }

  async function onRoleChange(member: Member, next: MembershipRole) {
    if (next === member.role) return
    setPendingUserId(member.userId)
    setActionError(null)
    try {
      const updated = await api<Member>(`/api/v1/members/${member.userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: next }),
      })
      setMembers((current) => current.map((item) => (item.userId === updated.userId ? updated : item)))
      setNotice(member.userId === selfId
        ? `Your role is now ${formatRole(updated.role)}. Sign in again for this session to use it.`
        : `${updated.email} is now ${formatRole(updated.role)}.`)
    } catch (error) {
      setActionError(errorMessage(error))
    } finally {
      setPendingUserId(null)
    }
  }

  async function onRemove(member: Member) {
    setPendingUserId(member.userId)
    setActionError(null)
    try {
      await api<void>(`/api/v1/members/${member.userId}`, { method: 'DELETE' })
      if (member.userId === selfId) {
        setSession(null)
        navigate('/login', { replace: true })
        return
      }
      setConfirmRemoveId(null)
      setNotice(`${member.email} was removed from this tenant.`)
      await load()
    } catch (error) {
      setActionError(errorMessage(error))
    } finally {
      setPendingUserId(null)
    }
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Members</h1>
          <p>
            {owner
              ? 'Invite an account that already exists. They join after they accept the email. This tenant must keep one owner.'
              : 'You can view members. Only an owner can invite, change a role, or remove someone.'}
          </p>
        </div>
      </header>

      {notice ? (
        <div className="banner" role="status">
          <p>{notice}</p>
          <button type="button" className="text-button" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      ) : null}
      {actionError ? <p className="banner error" role="alert">{actionError}</p> : null}

      {owner ? (
        <form className="create-card" onSubmit={(event) => void onInvite(event)} noValidate>
          <h2>Invite member</h2>
          <p className="hint">The person must already have an account. They are not a member until they accept.</p>
          <div className="create-grid">
            <TextField
              label="Email"
              name="member-email"
              type="email"
              value={email}
              onChange={setEmail}
              error={emailFieldError}
              maxLength={320}
            />
            <div className="field">
              <label htmlFor="member-role">Role</label>
              <select
                id="member-role"
                name="role"
                value={role}
                onChange={(event) => setRole(event.target.value as MembershipRole)}
              >
                {ROLES.map((item) => (
                  <option key={item} value={item}>{formatRole(item)}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="button" disabled={inviting}>
              {inviting ? 'Inviting…' : 'Invite'}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <p className="muted">Loading members…</p> : null}
      {loadError ? <p className="banner error" role="alert">{loadError}</p> : null}

      {!loading && !loadError && members.length === 0 ? (
        <div className="empty">
          <h2>No members</h2>
          <p>Invite an existing account to give it a role in this tenant.</p>
        </div>
      ) : null}

      {members.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                {owner ? <th scope="col"><span className="sr-only">Actions</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const pending = pendingUserId === member.userId
                const confirming = confirmRemoveId === member.userId
                return (
                  <tr key={member.userId}>
                    <th scope="row">
                      {member.email}
                      {member.userId === selfId ? <span className="muted"> · You</span> : null}
                    </th>
                    <td>
                      {owner ? (
                        <select
                          className="inline-select"
                          aria-label={`Role for ${member.email}`}
                          value={member.role}
                          disabled={pending}
                          onChange={(event) => void onRoleChange(member, event.target.value as MembershipRole)}
                        >
                          {ROLES.map((item) => (
                            <option key={item} value={item}>{formatRole(item)}</option>
                          ))}
                        </select>
                      ) : formatRole(member.role)}
                    </td>
                    {owner ? (
                      <td className="row-action">
                        {confirming ? (
                          <>
                            <button
                              type="button"
                              className="button danger"
                              disabled={pending}
                              onClick={() => void onRemove(member)}
                            >
                              {pending ? 'Removing…' : 'Remove'}
                            </button>
                            <button
                              type="button"
                              className="button secondary"
                              disabled={pending}
                              onClick={() => setConfirmRemoveId(null)}
                            >
                              Keep
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="button secondary"
                            disabled={pending}
                            onClick={() => {
                              setActionError(null)
                              setConfirmRemoveId(member.userId)
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

function inviteNotice(invited: InviteMemberResponse): string {
  const role = formatRole(invited.role)
  if (invited.emailAccepted) {
    return `Invitation sent to ${invited.email}. They join as ${role} after they accept.`
  }
  const detail = invited.emailDetail ? `: ${invited.emailDetail}` : ''
  return `Invitation for ${invited.email} was saved, but the email was not sent${detail}. They can join as ${role} only after they accept a link.`
}

function formatRole(role: string): string {
  const lower = role.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}
