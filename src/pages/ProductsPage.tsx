import { useEffect, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { api, errorMessage, violation } from '../api/http'
import type { Product } from '../api/types'
import { useSession } from '../auth/AuthProvider'
import { canManageProducts } from '../auth/session'
import { TextField } from '../components/TextField'
import { requiredText } from '../validation'

type HomeState = {
  organizationName?: string
  welcomeEmailAccepted?: boolean
  welcomeEmailDetail?: string
}

export function ProductsPage() {
  const location = useLocation()
  const session = useSession()
  const canManage = session ? canManageProducts(session.accessToken) : false
  const arrival = (location.state ?? null) as HomeState | null
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({})
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [notice, setNotice] = useState<string | null>(() => arrivalNotice(arrival))

  async function load() {
    try {
      const list = await api<Product[]>('/api/v1/products')
      setProducts(list)
      setLoadError(null)
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    const nameProblem = requiredText(name, 'Name', 128)
    const skuProblem = requiredText(sku, 'SKU', 64)
    if (nameProblem) nextErrors.name = nameProblem
    if (skuProblem) nextErrors.sku = skuProblem
    setCreateErrors(nextErrors)
    setCreateError(null)
    if (Object.keys(nextErrors).length > 0) return

    setCreating(true)
    try {
      await api<Product>('/api/v1/products', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), sku: sku.trim() }),
      })
      setName('')
      setSku('')
      await load()
    } catch (error) {
      setCreateErrors({
        name: violation(error, 'name') ?? '',
        sku: violation(error, 'sku') ?? '',
      })
      setCreateError(errorMessage(error))
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Products</h1>
          <p>
            {canManage
              ? 'Active products for this tenant. Turning a product off removes it from this list.'
              : 'Active products for this tenant. You can view them.'}
          </p>
        </div>
      </header>

      {notice ? (
        <div className="banner" role="status">
          <p>{notice}</p>
          <button type="button" className="text-button" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      ) : null}

      {canManage ? (
        <form className="create-card" onSubmit={(event) => void onCreate(event)} noValidate>
          <h2>New product</h2>
          {createError ? <p className="banner error" role="alert">{createError}</p> : null}
          <div className="create-grid">
            <TextField
              label="Name"
              name="name"
              value={name}
              onChange={setName}
              error={createErrors.name || undefined}
              maxLength={128}
            />
            <TextField
              label="SKU"
              name="sku"
              value={sku}
              onChange={setSku}
              error={createErrors.sku || undefined}
              maxLength={64}
              spellCheck={false}
            />
            <button type="submit" className="button" disabled={creating}>
              {creating ? 'Adding…' : 'Add product'}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <p className="muted">Loading products…</p> : null}
      {loadError ? <p className="banner error" role="alert">{loadError}</p> : null}

      {!loading && !loadError && products.length === 0 ? (
        <div className="empty">
          <h2>No active products</h2>
          <p>
            {canManage
              ? 'Add one with a name and a SKU that is unique inside this tenant.'
              : 'An owner or admin can add products for this tenant.'}
          </p>
        </div>
      ) : null}

      {products.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">SKU</th>
                <th scope="col">Updated</th>
                {canManage ? <th scope="col"><span className="sr-only">Actions</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <th scope="row">{product.name}</th>
                  <td className="sku">{product.sku}</td>
                  <td>{formatWhen(product.updatedAt)}</td>
                  {canManage ? (
                    <td className="row-action">
                      <button type="button" className="button secondary" onClick={() => setEditing(product)}>
                        Edit
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {canManage && editing ? (
        <EditProductDialog
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
        />
      ) : null}
    </section>
  )
}

function arrivalNotice(state: HomeState | null): string | null {
  if (!state?.organizationName) return null
  if (state.welcomeEmailAccepted === false && state.welcomeEmailDetail) {
    return `${state.organizationName} is ready. The welcome email was not sent: ${state.welcomeEmailDetail}`
  }
  return `${state.organizationName} is ready. You are signed in as the owner.`
}

function formatWhen(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function EditProductDialog({
  product,
  onClose,
  onSaved,
}: {
  product: Product
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(product.name)
  const [active, setActive] = useState(product.active)
  const [nameError, setNameError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pending])

  async function onSave(event: FormEvent) {
    event.preventDefault()
    const problem = requiredText(name, 'Name', 128)
    setNameError(problem)
    setFormError(null)
    if (problem) return

    setPending(true)
    try {
      await api<Product>(`/api/v1/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), active }),
      })
      onSaved()
    } catch (error) {
      setNameError(violation(error, 'name'))
      setFormError(errorMessage(error))
      setPending(false)
    }
  }

  async function onDelete() {
    setPending(true)
    setFormError(null)
    try {
      await api<void>(`/api/v1/products/${product.id}`, { method: 'DELETE' })
      onSaved()
    } catch (error) {
      setFormError(errorMessage(error))
      setPending(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-product-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={(event) => void onSave(event)} noValidate>
          <h2 id="edit-product-title">Edit product</h2>
          <p className="sku-line">SKU <span>{product.sku}</span></p>
          {formError ? <p className="banner error" role="alert">{formError}</p> : null}
          <TextField
            label="Name"
            name="edit-name"
            value={name}
            onChange={setName}
            error={nameError}
            maxLength={128}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            <span>Active. Inactive products are left out of this list.</span>
          </label>
          <div className="modal-actions">
            <button type="submit" className="button" disabled={pending}>
              {pending && !confirmDelete ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="button secondary" onClick={onClose} disabled={pending}>
              Cancel
            </button>
          </div>
        </form>
        {confirmDelete ? (
          <div className="confirm">
            <p>Delete {product.name}? This cannot be undone.</p>
            <div className="modal-actions">
              <button type="button" className="button danger" onClick={() => void onDelete()} disabled={pending}>
                {pending ? 'Deleting…' : 'Delete product'}
              </button>
              <button type="button" className="button secondary" onClick={() => setConfirmDelete(false)} disabled={pending}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="text-button danger-text" onClick={() => setConfirmDelete(true)}>
            Delete product
          </button>
        )}
      </div>
    </div>
  )
}
