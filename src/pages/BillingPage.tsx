import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api/http'
import type { Billing, BillingLink, Plan, SubscriptionStatus } from '../api/types'

export function BillingPage() {
  const [params] = useSearchParams()
  const [billing, setBilling] = useState<Billing | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, setPending] = useState<'checkout' | 'portal' | null>(null)
  const checkout = params.get('checkout')

  useEffect(() => {
    let cancelled = false
    api<Billing>('/api/v1/billing')
      .then((next) => {
        if (!cancelled) setBilling(next)
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorMessage(error))
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function open(path: '/api/v1/billing/checkout' | '/api/v1/billing/portal', kind: 'checkout' | 'portal') {
    setActionError(null)
    setPending(kind)
    try {
      const link = await api<BillingLink>(path, { method: 'POST' })
      window.location.assign(link.url)
    } catch (error) {
      setActionError(errorMessage(error))
      setPending(null)
    }
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Billing</h1>
          <p>Every organization starts on Free. Pro adds the audit log. Card details stay with Stripe.</p>
        </div>
      </header>
      {checkout === 'success' ? (
        <p className="banner" role="status">Stripe is confirming the subscription. Refresh if the status has not changed.</p>
      ) : null}
      {checkout === 'cancel' ? (
        <p className="banner" role="status">Checkout was canceled. The organization was not charged.</p>
      ) : null}
      {loadError ? <p className="banner error" role="alert">{loadError}</p> : null}
      {actionError ? <p className="banner error" role="alert">{actionError}</p> : null}
      {!billing && !loadError ? <p className="muted">Loading billing…</p> : null}
      {billing ? (
        <div className="create-card plan-card">
          <div className="plan-top">
            <div>
              <p className="eyebrow">Current plan</p>
              <h2>{planLabel(billing.plan)}</h2>
            </div>
            <span className={billing.subscriptionStatus === 'ACTIVE' || billing.plan === 'FREE' ? 'badge ok' : 'badge'}>
              {subscriptionLabel(billing.subscriptionStatus)}
            </span>
          </div>
          <ul className="plan-points">
            <li>Products, members, and organization settings</li>
            <li>{billing.plan === 'PRO' ? 'Audit log included' : 'Audit log unlocks on Pro'}</li>
          </ul>
          {!billing.configured ? <p className="hint">Billing is not configured on this server.</p> : null}
          {!billing.auditAccess && billing.plan === 'PRO' ? (
            <p>The audit log stays closed until the Pro subscription is active.</p>
          ) : null}
          <div className="photo-actions">
            {billing.canSubscribe ? (
              <button type="button" className="button" disabled={pending !== null} onClick={() => void open('/api/v1/billing/checkout', 'checkout')}>
                {pending === 'checkout' ? 'Opening Stripe…' : 'Upgrade to Pro'}
              </button>
            ) : null}
            {billing.canManage ? (
              <button type="button" className="button secondary" disabled={pending !== null} onClick={() => void open('/api/v1/billing/portal', 'portal')}>
                {pending === 'portal' ? 'Opening Stripe…' : 'Manage billing'}
              </button>
            ) : null}
          </div>
          {!billing.canSubscribe && !billing.canManage ? (
            <p className="hint">An owner can change the subscription.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function planLabel(plan: Plan): string {
  return plan === 'PRO' ? 'Pro' : 'Free'
}

function subscriptionLabel(status: SubscriptionStatus): string {
  switch (status) {
    case 'NONE':
      return 'No subscription'
    case 'ACTIVE':
      return 'Active'
    case 'PAST_DUE':
      return 'Payment past due'
    case 'CANCELED':
      return 'Canceled'
    case 'INCOMPLETE':
      return 'Incomplete'
  }
}
