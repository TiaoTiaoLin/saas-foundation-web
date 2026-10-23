import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  canManageProducts,
  canViewMembers,
  currentUserId,
  getSession,
  isOwner,
  readAccessClaims,
  setSession,
  subscribe,
  type Session,
} from './session'

function token(claims: object): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'HS256' })}.${encode(claims)}.signature`
}

function sessionWith(accessToken: string): Session {
  return {
    accessToken,
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    refreshToken: 'refresh-1',
    refreshTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    tenantId: '9180a8b1-3fe8-4424-a578-b958c709c709',
    email: 'owner@acme.test',
  }
}

beforeEach(() => {
  setSession(null)
  localStorage.clear()
})

describe('readAccessClaims', () => {
  it('decodes the payload of a JWT', () => {
    expect(readAccessClaims(token({ sub: 'user-1', roles: ['OWNER'] }))).toEqual({
      sub: 'user-1',
      roles: ['OWNER'],
    })
  })

  it('returns null for tokens it cannot read', () => {
    expect(readAccessClaims('not-a-jwt')).toBeNull()
    expect(readAccessClaims('a.%%%.c')).toBeNull()
  })
})

describe('role helpers', () => {
  it('lets owners and admins manage products and view members', () => {
    for (const role of ['OWNER', 'ADMIN']) {
      const jwt = token({ roles: [role] })
      expect(canManageProducts(jwt)).toBe(true)
      expect(canViewMembers(jwt)).toBe(true)
    }
  })

  it('keeps plain members read-only', () => {
    const jwt = token({ roles: ['MEMBER'] })
    expect(canManageProducts(jwt)).toBe(false)
    expect(canViewMembers(jwt)).toBe(false)
    expect(isOwner(jwt)).toBe(false)
  })

  it('treats a missing roles claim and an unreadable token as no access', () => {
    expect(canManageProducts(token({ sub: 'user-1' }))).toBe(false)
    expect(isOwner('garbage')).toBe(false)
  })

  it('identifies only owners as owners', () => {
    expect(isOwner(token({ roles: ['OWNER'] }))).toBe(true)
    expect(isOwner(token({ roles: ['ADMIN'] }))).toBe(false)
  })

  it('reads the user id from the token subject', () => {
    expect(currentUserId(token({ sub: 'user-1' }))).toBe('user-1')
    expect(currentUserId(token({}))).toBeNull()
  })
})

describe('session storage', () => {
  it('keeps the session in memory and in localStorage', () => {
    const session = sessionWith(token({ roles: ['OWNER'] }))

    setSession(session)

    expect(getSession()).toEqual(session)
    expect(JSON.parse(localStorage.getItem('saas-foundation.session') ?? '{}')).toEqual(session)
  })

  it('clears both when the session is set to null', () => {
    setSession(sessionWith(token({})))

    setSession(null)

    expect(getSession()).toBeNull()
    expect(localStorage.getItem('saas-foundation.session')).toBeNull()
  })

  it('notifies subscribers until they unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)

    setSession(sessionWith(token({})))
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    setSession(null)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
