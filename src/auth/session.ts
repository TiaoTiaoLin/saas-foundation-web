export type Session = {
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
  refreshTokenExpiresAt: string
  tenantId: string
  email: string
}

const STORAGE_KEY = 'saas-foundation.session'

let session: Session | null = readStored()
const listeners = new Set<() => void>()

function readStored(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Session>
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.tenantId || !parsed.email) {
      return null
    }
    return parsed as Session
  } catch {
    return null
  }
}

export function getSession(): Session | null {
  return session
}

export function setSession(next: Session | null): void {
  session = next
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // The in-memory session still works for this tab.
  }
  listeners.forEach((listener) => listener())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export type AccessClaims = {
  sub?: string
  roles?: string[]
}

export function readAccessClaims(token: string): AccessClaims | null {
  const segment = token.split('.')[1]
  if (!segment) return null
  try {
    const pad = segment.length % 4 === 0 ? '' : '='.repeat(4 - (segment.length % 4))
    const json = atob(segment.replace(/-/g, '+').replace(/_/g, '/') + pad)
    return JSON.parse(json) as AccessClaims
  } catch {
    return null
  }
}

const PRODUCT_MANAGER_ROLES = new Set(['OWNER', 'ADMIN'])

/** Matches POST, PUT, and DELETE on /api/v1/products, which require OWNER or ADMIN. */
export function canManageProducts(accessToken: string): boolean {
  const roles = readAccessClaims(accessToken)?.roles ?? []
  return roles.some((role) => PRODUCT_MANAGER_ROLES.has(role))
}
