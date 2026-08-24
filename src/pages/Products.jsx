import { useMemo, useState } from 'react'
import { Package, Plus, Search, Upload, Pencil, Trash2, MinusCircle, AlertTriangle } from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useToast } from '../context/ToastContext'
import { fmtMoney } from '../lib/format'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import ProductForm from '../components/products/ProductForm'
import StockAdjust from '../components/products/StockAdjust'
import ImportCSV from '../components/products/ImportCSV'

export default function Products() {
  const { products, loading, categories, suppliers, deleteProduct, lowStock } = useProducts()
  const { push } = useToast()
  const suppliersMap = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s.name])), [suppliers])

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [lowOnly, setLowOnly] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [adjusting, setAdjusting] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (category !== 'all' && p.category_id !== category) return false
      if (lowOnly && !(p.active && p.quantity_on_hand <= p.reorder_threshold)) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
      )
    })
  }, [products, search, category, lowOnly])

  const catName = (id) => categories.find((c) => c.id === id)?.name || '—'
  const supName = (id) => suppliersMap[id] || '—'

  const doDelete = async () => {
    try {
      await deleteProduct(confirmDelete.id)
      push('Product deleted')
    } catch (err) {
      push(err.message || 'Delete failed', 'error')
    }
    setConfirmDelete(null)
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products</h1>
          <p className="text-sm text-slate-500">{products.length} total · {lowStock.length} low stock</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setImportOpen(true)} className="btn-secondary">
            <Upload size={16} /> Import CSV
          </button>
          <button onClick={() => { setEditing(null); setFormOpen(true) }} className="btn-primary">
            <Plus size={16} /> Add product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search name, SKU, or barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          onClick={() => setLowOnly(!lowOnly)}
          className={`btn ${lowOnly ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'btn-secondary'}`}
        >
          <AlertTriangle size={16} /> Low stock
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products found"
            subtitle="Try adjusting your search, or add your first product."
            action={<button onClick={() => { setEditing(null); setFormOpen(true) }} className="btn-primary"><Plus size={16} /> Add product</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 text-right font-semibold">Cost</th>
                  <th className="px-4 py-3 text-right font-semibold">Price</th>
                  <th className="px-4 py-3 text-right font-semibold">Stock</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const low = p.active && p.quantity_on_hand <= p.reorder_threshold
                  return (
                    <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
                            {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <Package size={18} />}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{p.name}</p>
                            {p.barcode && <p className="text-xs text-slate-400">UPC {p.barcode}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                      <td className="px-4 py-3 text-slate-600">{catName(p.category_id)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{fmtMoney(p.cost_price)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmtMoney(p.sale_price)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${low ? 'text-red-600' : 'text-slate-800'}`}>{p.quantity_on_hand}</span>
                        {low && <span className="ml-1 text-xs text-red-500">≤ {p.reorder_threshold}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {!p.active ? <Badge color="slate">Inactive</Badge> : low ? <Badge color="red">Low stock</Badge> : <Badge color="green">In stock</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => { setAdjusting(p) }} title="Adjust stock" className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600">
                            <MinusCircle size={17} />
                          </button>
                          <button onClick={() => { setEditing(p); setFormOpen(true) }} title="Edit" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                            <Pencil size={17} />
                          </button>
                          <button onClick={() => setConfirmDelete(p)} title="Delete" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProductForm open={formOpen} onClose={() => setFormOpen(false)} product={editing} />
      <StockAdjust product={adjusting} open={!!adjusting} onClose={() => setAdjusting(null)} />
      <ImportCSV open={importOpen} onClose={() => setImportOpen(false)} />

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Delete {confirmDelete.name}?</h3>
            <p className="mt-1 text-sm text-slate-500">
              This permanently removes the product. Past transactions keep their records.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary">Cancel</button>
              <button onClick={doDelete} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
