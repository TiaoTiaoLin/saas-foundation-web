import type { ReactNode } from 'react'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-panel">
        <p className="mark">Foundation</p>
        <h1>One organization. One tenant.</h1>
        <ol>
          <li>Register the organization and its first owner.</li>
          <li>Sign in. The access token is scoped to that tenant.</li>
          <li>Manage the products that belong to it.</li>
        </ol>
      </aside>
      <main className="auth-main">{children}</main>
    </div>
  )
}
