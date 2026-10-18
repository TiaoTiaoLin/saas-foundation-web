import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useSession } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { AccountPage } from './pages/AccountPage'
import { BillingPage } from './pages/BillingPage'
import { AcceptInvitePage } from './pages/AcceptInvitePage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { MembersPage } from './pages/MembersPage'
import { PasswordPage } from './pages/PasswordPage'
import { ProductsPage } from './pages/ProductsPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SignupPage } from './pages/SignupPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession()
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
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
        <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/invites/accept" element={<RequireAuth><AcceptInvitePage /></RequireAuth>} />
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
          <Route path="/billing" element={<BillingPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
