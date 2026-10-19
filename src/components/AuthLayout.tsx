import type { ReactNode } from 'react'
import { LogoMark } from './LogoMark'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-panel">
        <div className="auth-brand">
          <LogoMark />
          <p className="mark">Foundation</p>
        </div>
        <h1>One workspace for the whole organization.</h1>
        <ol>
          <li>Create the organization and sign in as its owner.</li>
          <li>Keep products, members, and roles inside that tenant.</li>
          <li>Upgrade billing when you need the audit log.</li>
        </ol>
      </aside>
      <main className="auth-main">{children}</main>
    </div>
  )
}
