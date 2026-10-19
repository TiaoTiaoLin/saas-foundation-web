import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { api, errorMessage, violation } from '../api/http'
import type { Product, ProductPage } from '../api/types'
import { useSession } from '../auth/AuthProvider'
import { canManageProducts } from '../auth/session'
import { TextField } from '../components/TextField'
import { requiredText } from '../validation'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

type HomeState = {
  organizationName?: string
}

export function ProductsPage() {
  const location = useLocation()
  const session = useSession()
  const canManage = session ? canManageProducts(session.accessToken) : false
  const arrival = (location.state ?? null) as HomeState | null
  const [products, setProducts] = useState<Product[]>([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pageDraft, setPageDraft] = useState('1')
  const [sizeDraft, setSizeDraft] = useState(String(DEFAULT_PAGE_SIZE))
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({})
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [notice, setNotice] = useState<string | null>(() => arrivalNotice(arrival))
  const [query, setQuery] = useState('')
  const loadGeneration = useRef(0)

  async function load(rawQuery: string, pageIndex: number, size = pageSize) {
    const generation = ++loadGeneration.current
    setLoading(true)
    const trimmed = rawQuery.trim()
    const params = new URLSearchParams({
      page: String(Math.max(pageIndex, 0)),
      size: String(clampPageSize(size)),
    })
    if (trimmed) params.set('q', trimmed)
    const path = `${trimmed ? '/api/v1/products/search' : '/api/v1/products'}?${params}`
    try {
      const result = await api<ProductPage>(path)
      if (generation !== loadGeneration.current) return
      const lastPage = result.size > 0 ? Math.max(0, Math.ceil(result.total / result.size) - 1) : 0
      if (result.items.length === 0 && result.page > lastPage) {
        void load(rawQuery, lastPage)
        return
      }
      setProducts(result.items)
      setPage(result.page)
      setPageDraft(String(result.page + 1))
      setPageSize(result.size)
      setSizeDraft(String(result.size))
      setTotal(result.total)
      setLoadError(null)
    } catch (error) {
      if (generation !== loadGeneration.current) return
      setLoadError(errorMessage(error))
    } finally {
      if (generation === loadGeneration.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (!session) return
    setLoading(true)
    const delay = query.trim() ? 300 : 0
    const handle = window.setTimeout(() => {
      void load(query, 0)
    }, delay)
    return () => window.clearTimeout(handle)
  }, [query, session?.tenantId])

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
      await load(query, 0)
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

  const pageCount = pageSize > 0 ? Math.ceil(total / pageSize) : 0
  const lastPageNumber = Math.max(pageCount, 1)
  const rangeStart = total === 0 ? 0 : page * pageSize + 1
  const rangeEnd = Math.min(total, page * pageSize + products.length)

  function goToPage(event: FormEvent) {
    event.preventDefault()
    const requested = Number(pageDraft)
    if (!Number.isInteger(requested)) return
    const clamped = Math.min(Math.max(requested, 1), lastPageNumber)
    setPageDraft(String(clamped))
    void load(query, clamped - 1)
  }

  function applyPageSize() {
    const next = clampPageSize(Number(sizeDraft))
    setSizeDraft(String(next))
    if (next !== pageSize) void load(query, 0, next)
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Products</h1>
          <p>
            {canManage
              ? 'All products for this tenant, including ones that are turned off. Members only see active products.'
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

      <form
        className="search-row"
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          void load(query, 0)
        }}
      >
        <TextField
          label="Search"
          name="product-search"
          value={query}
          onChange={setQuery}
          maxLength={128}
          spellCheck={false}
          hint={canManage
            ? 'Name or SKU. Inactive products are included.'
            : 'Name or SKU.'}
        />
      </form>

      {loading ? <p className="muted">Loading products…</p> : null}
      {loadError ? <p className="banner error" role="alert">{loadError}</p> : null}

      {!loading && !loadError && products.length === 0 ? (
        <div className="empty">
          {query.trim() ? (
            <>
              <h2>No matching products</h2>
              <p>Nothing in this tenant has that name or SKU.</p>
            </>
          ) : (
            <>
              <h2>{canManage ? 'No products' : 'No active products'}</h2>
              <p>
                {canManage
                  ? 'Add one with a name and a SKU that is unique inside this tenant.'
                  : 'An owner or admin can add products for this tenant.'}
              </p>
            </>
          )}
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
                {canManage ? <th scope="col">Status</th> : null}
                {canManage ? <th scope="col"><span className="sr-only">Actions</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <th scope="row">{product.name}</th>
                  <td className="sku">{product.sku}</td>
                  <td>{formatWhen(product.updatedAt)}</td>
                  {canManage ? <td>{product.active ? 'Active' : 'Inactive'}</td> : null}
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

      {!loadError && (!loading || total > 0) ? (
        <nav className="pager" aria-label="Products">
          <button
            type="button"
            className="button secondary"
            disabled={page === 0 || loading || total === 0}
            onClick={() => void load(query, page - 1)}
          >
            Previous
          </button>
          <form onSubmit={goToPage}>
            <label htmlFor="product-page">Page</label>
            <input
              id="product-page"
              name="page"
              type="number"
              inputMode="numeric"
              min={1}
              max={lastPageNumber}
              value={pageDraft}
              disabled={loading || total === 0}
              onChange={(event) => setPageDraft(event.target.value)}
            />
            <span>of {lastPageNumber}</span>
            <button type="submit" className="button secondary" disabled={loading || total === 0}>
              Go
            </button>
          </form>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              applyPageSize()
            }}
          >
            <label htmlFor="product-page-size">Rows</label>
            <input
              id="product-page-size"
              name="size"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_PAGE_SIZE}
              value={sizeDraft}
              disabled={loading}
              onChange={(event) => setSizeDraft(event.target.value)}
              onBlur={applyPageSize}
            />
          </form>
          <p>
            {rangeStart}–{rangeEnd} of {total}
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={page + 1 >= pageCount || loading || total === 0}
            onClick={() => void load(query, page + 1)}
          >
            Next
          </button>
        </nav>
      ) : null}

      {canManage && editing ? (
        <EditProductDialog
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load(query, page)
          }}
          onDeleted={() => {
            setEditing(null)
            const nextPage = products.length === 1 && page > 0 ? page - 1 : page
            void load(query, nextPage)
          }}
        />
      ) : null}
    </section>
  )
}

function clampPageSize(size: number): number {
  if (!Number.isInteger(size) || size < 1) return DEFAULT_PAGE_SIZE
  return Math.min(size, MAX_PAGE_SIZE)
}

function arrivalNotice(state: HomeState | null): string | null {
  if (!state?.organizationName) return null
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
  onDeleted,
}: {
  product: Product
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
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
      onDeleted()
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
            <span>Active. Members only see products that stay checked.</span>
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
