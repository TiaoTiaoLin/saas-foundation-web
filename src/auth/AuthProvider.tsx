import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { refreshSession } from '../api/http'
import { getSession, subscribe, type Session } from './session'

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession, () => null)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const current = getSession()
    if (!current) return
    const expiresAt = Date.parse(current.accessTokenExpiresAt)
    if (!Number.isFinite(expiresAt) || expiresAt - Date.now() < 30_000) {
      void refreshSession().catch(() => {
        // The next request surfaces the failure.
      })
    }
  }, [])

  return children
}
