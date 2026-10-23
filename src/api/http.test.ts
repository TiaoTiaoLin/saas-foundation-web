import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSession, setSession, type Session } from '../auth/session'
import {
  ApiRequestError,
  MAX_IMAGE_BYTES,
  api,
  errorMessage,
  mediaSrc,
  putImage,
  refreshSession,
  violation,
} from './http'

const TENANT_ID = '9180a8b1-3fe8-4424-a578-b958c709c709'

function session(overrides: Partial<Session> = {}): Session {
  return {
    accessToken: 'access-1',
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    refreshToken: 'refresh-1',
    refreshTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    tenantId: TENANT_ID,
    email: 'owner@acme.test',
    organizationName: 'Acme',
    ...overrides,
  }
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

const tokens = {
  accessToken: 'access-2',
  tokenType: 'Bearer',
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  refreshToken: 'refresh-2',
  refreshTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  tenantId: TENANT_ID,
  organizationName: 'Acme',
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
  setSession(session())
})

afterEach(() => {
  vi.unstubAllGlobals()
  setSession(null)
})

function lastHeaders(callIndex = 0): Headers {
  return new Headers((fetchMock.mock.calls[callIndex][1] as RequestInit).headers)
}

describe('api', () => {
  it('sends the bearer token and tenant header', async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true }))

    await expect(api('/api/v1/products')).resolves.toEqual({ ok: true })

    expect(lastHeaders().get('Authorization')).toBe('Bearer access-1')
    expect(lastHeaders().get('X-Tenant-ID')).toBe(TENANT_ID)
  })

  it('skips credentials when auth is false', async () => {
    fetchMock.mockResolvedValueOnce(json({}))

    await api('/api/v1/auth/login', { method: 'POST', body: '{}', auth: false })

    expect(lastHeaders().has('Authorization')).toBe(false)
    expect(lastHeaders().get('Content-Type')).toBe('application/json')
  })

  it('returns undefined for 204 responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(api('/api/v1/products/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('refreshes the session on 401 and retries the request once', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ message: 'expired' }, 401))
      .mockResolvedValueOnce(json(tokens))
      .mockResolvedValueOnce(json({ ok: true }))

    await expect(api('/api/v1/products')).resolves.toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/v1/auth/refresh')
    expect(lastHeaders(2).get('Authorization')).toBe('Bearer access-2')
    expect(getSession()?.refreshToken).toBe('refresh-2')
    expect(getSession()?.email).toBe('owner@acme.test')
  })

  it('does not retry forever when the retried request is still unauthorized', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ message: 'expired' }, 401))
      .mockResolvedValueOnce(json(tokens))
      .mockResolvedValueOnce(json({ message: 'still no' }, 401))

    await expect(api('/api/v1/products')).rejects.toMatchObject({ status: 401 })

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('signs the user out when the refresh token is rejected', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ message: 'expired' }, 401))
      .mockResolvedValueOnce(json({ message: 'refresh token revoked' }, 401))

    await expect(api('/api/v1/products')).rejects.toBeInstanceOf(ApiRequestError)

    expect(getSession()).toBeNull()
  })

  it('keeps the session when the refresh fails for a reason other than rejection', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ message: 'expired' }, 401))
      .mockResolvedValueOnce(json({}, 503))

    await expect(api('/api/v1/products')).rejects.toMatchObject({ status: 503 })

    expect(getSession()).not.toBeNull()
  })

  it('shares one refresh between concurrent callers', async () => {
    fetchMock.mockResolvedValue(json(tokens))

    const [first, second] = await Promise.all([refreshSession(), refreshSession()])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)
  })
})

describe('errors', () => {
  it('maps field violations and Retry-After from the response', async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        { message: 'Validation failed', violations: [{ field: 'name', message: 'Name is required' }] },
        400,
        { 'Retry-After': '30' },
      ),
    )

    const error = await api('/api/v1/products', { method: 'POST', body: '{}' }).catch((e) => e)

    expect(error).toBeInstanceOf(ApiRequestError)
    expect(violation(error, 'name')).toBe('Name is required')
    expect(violation(error, 'price')).toBeUndefined()
    expect(errorMessage(error)).toBe('Validation failed Try again in 30 seconds.')
  })

  it('exposes the organizations an account can choose from', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ message: 'Choose an organization', organizations: [{ tenantId: TENANT_ID, name: 'Acme' }] }, 409),
    )

    const error = await api('/api/v1/auth/login', { method: 'POST', body: '{}', auth: false }).catch((e) => e)

    expect(error).toBeInstanceOf(ApiRequestError)
    expect((error as ApiRequestError).organizations).toHaveLength(1)
  })

  it('hides server details on 5xx responses without a message', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>boom</html>', { status: 502 }))

    const error = await api('/api/v1/products').catch((e) => e)

    expect(errorMessage(error)).toBe('Something went wrong. Try again in a moment.')
  })

  it('reports an unreachable server when the network fails', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const error = await api('/api/v1/products').catch((e) => e)

    expect(errorMessage(error)).toBe("We couldn't reach the server. Check your connection and try again.")
  })

  it('uses a generic message for unknown errors', () => {
    expect(errorMessage(new Error('internal detail'))).toBe('Something went wrong. Try again.')
  })
})

describe('putImage', () => {
  it('rejects files over the size limit without calling the server', async () => {
    const file = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'big.png', { type: 'image/png' })

    await expect(putImage('/api/v1/auth/avatar', file)).rejects.toMatchObject({
      status: 400,
      message: 'Image must be at most 2 MB',
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uploads as multipart without forcing a JSON content type', async () => {
    fetchMock.mockResolvedValueOnce(json({ avatarUrl: 'x' }))
    const file = new File(['abc'], 'a.png', { type: 'image/png' })

    await putImage('/api/v1/auth/avatar', file)

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('PUT')
    expect(init.body).toBeInstanceOf(FormData)
    expect(lastHeaders().get('Content-Type')).not.toBe('application/json')
  })
})

describe('mediaSrc', () => {
  it('passes absolute URLs through and prefixes relative ones', () => {
    expect(mediaSrc('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
    expect(mediaSrc('/api/v1/media?key=a')).toBe('/api/v1/media?key=a')
    expect(mediaSrc('api/v1/media?key=a')).toBe('/api/v1/media?key=a')
  })

  it('returns undefined when there is no image', () => {
    expect(mediaSrc(null)).toBeUndefined()
    expect(mediaSrc('')).toBeUndefined()
  })
})
