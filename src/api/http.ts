import { getSession, setSession, type Session } from '../auth/session'
import type { ApiErrorBody, FieldViolation, TokenResponse } from './types'

export class ApiRequestError extends Error {
  readonly status: number
  readonly violations: FieldViolation[]
  readonly retryAfterSeconds?: number

  constructor(status: number, message: string, violations: FieldViolation[] = [], retryAfterSeconds?: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.violations = violations
    this.retryAfterSeconds = retryAfterSeconds
  }
}

type ApiOptions = RequestInit & {
  auth?: boolean
  retried?: boolean
}

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
}

export function violation(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiRequestError)) return undefined
  return error.violations.find((item) => item.field === field)?.message
}

class ApiUnreachableError extends Error {
  constructor() {
    super("We couldn't reach the server. Check your connection and try again.")
    this.name = 'ApiUnreachableError'
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.retryAfterSeconds) {
      return `${error.message} Try again in ${error.retryAfterSeconds} seconds.`
    }
    return error.message
  }
  if (error instanceof ApiUnreachableError) return error.message
  return 'Something went wrong. Try again.'
}

let refreshInFlight: Promise<Session | null> | null = null

export function refreshSession(): Promise<Session | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

async function performRefresh(): Promise<Session | null> {
  const current = getSession()
  if (!current) return null
  try {
    const tokens = await request<TokenResponse>('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    })
    const next: Session = {
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.expiresAt,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      tenantId: tokens.tenantId,
      email: current.email,
    }
    setSession(next)
    return next
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
      setSession(null)
      return null
    }
    throw error
  }
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await send(path, options)
  if (response.status === 401 && options.auth !== false && !options.retried) {
    const next = await refreshSession()
    if (next) return api<T>(path, { ...options, retried: true })
  }
  return parse<T>(response)
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  return parse<T>(await send(path, options))
}

async function send(path: string, options: ApiOptions): Promise<Response> {
  const headers = new Headers(options.headers)
  if (options.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.auth !== false) {
    const session = getSession()
    if (session) {
      headers.set('Authorization', `Bearer ${session.accessToken}`)
      headers.set('X-Tenant-ID', session.tenantId)
    }
  }

  try {
    return await fetch(`${apiBase()}${path}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    if (error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')) {
      throw new ApiUnreachableError()
    }
    throw error
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T

  const text = await response.text()
  const body = text ? parseJson(text) : null

  if (!response.ok) {
    const message = body?.message
      || (response.status === 401
        ? 'Sign in again to continue.'
        : response.status >= 500
          ? 'Something went wrong. Try again in a moment.'
          : 'Request failed')
    const retryAfter = Number(response.headers.get('Retry-After'))
    throw new ApiRequestError(
      response.status,
      message,
      body?.violations ?? [],
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    )
  }

  return (body ?? undefined) as T
}

function parseJson(text: string): ApiErrorBody | null {
  try {
    return JSON.parse(text) as ApiErrorBody
  } catch {
    return null
  }
}
