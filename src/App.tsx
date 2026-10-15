import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useSession } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { AccountPage } from './pages/AccountPage'
import { LoginPage } from './pages/LoginPage'
import { MembersPage } from './pages/MembersPage'
import { PasswordPage } from './pages/PasswordPage'
import { ProductsPage } from './pages/ProductsPage'
import { SignupPage } from './pages/SignupPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession()
  if (!session) return <Navigate to="/login" replace />
  return children
}

function GuestOnly({ children }: { children: ReactNode }) {
  const session = useSession()
  if (session) return <Navigate to="/" replace />
  return children
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><SignupPage /></GuestOnly>} />
        <Route
          element={(
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          )}
        >
          <Route path="/" element={<ProductsPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/password" element={<PasswordPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
