import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import { useProducts } from '../../context/ProductContext'
import { useToast } from '../../context/ToastContext'

const emptyForm = {
  id: null,
  name: '',
  sku: '',
  barcode: '',
  category_id: '',
  cost_price: '',
  sale_price: '',
  quantity_on_hand: 0,
  reorder_threshold: 0,
  supplier_id: '',
  image_url: '',
  active: true
}

export default function ProductForm({ open, onClose, product }) {
  const { categories, suppliers, saveProduct, upsertCategory, upsertSupplier } = useProducts()
  const { push } = useToast()
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newSupplier, setNewSupplier] = useState('')

  useEffect(() => {
    if (open) {
      setForm(
        product
          ? { ...emptyForm, ...product, category_id: product.category_id || '', supplier_id: product.supplier_id || '' }
          : emptyForm
      )
      setNewCategory('')
      setNewSupplier('')
    }
  }, [open, product])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      let categoryId = form.category_id
      if (newCategory.trim()) categoryId = (await upsertCategory(newCategory))?.id
      let supplierId = form.supplier_id
      if (newSupplier.trim()) supplierId = (await upsertSupplier(newSupplier))?.id

      await saveProduct({
        ...form,
        category_id: categoryId || null,
        supplier_id: supplierId || null,
        cost_price: parseFloat(form.cost_price) || 0,
        sale_price: parseFloat(form.sale_price) || 0,
        quantity_on_hand: parseInt(form.quantity_on_hand, 10) || 0,
        reorder_threshold: parseInt(form.reorder_threshold, 10) || 0
      })
      push(product ? 'Product updated' : 'Product created')
      onClose()
    } catch (err) {
      push(err.message || 'Failed to save product', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={product ? 'Edit Product' : 'Add Product'} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Product name *</label>
            <input className="input" value={form.name} onChange={set('name')} required placeholder="e.g. Organic Milk 1L" />
          </div>
          <div>
            <label className="label">SKU *</label>
            <input className="input" value={form.sku} onChange={set('sku')} required placeholder="SKU-0001" />
          </div>
          <div>
            <label className="label">Barcode</label>
            <input className="input" value={form.barcode} onChange={set('barcode')} placeholder="Scan or type" />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category_id} onChange={set('category_id')}>
              <option value="">— Select —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              className="input mt-2"
              placeholder="…or new category name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Supplier</label>
            <select className="input" value={form.supplier_id} onChange={set('supplier_id')}>
              <option value="">— Select —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              className="input mt-2"
              placeholder="…or new supplier name"
              value={newSupplier}
              onChange={(e) => setNewSupplier(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Cost price ($)</label>
            <input type="number" step="0.01" min="0" className="input" value={form.cost_price} onChange={set('cost_price')} />
          </div>
          <div>
            <label className="label">Sale price ($) *</label>
            <input type="number" step="0.01" min="0" className="input" value={form.sale_price} onChange={set('sale_price')} required />
          </div>
          <div>
            <label className="label">Quantity on hand</label>
            <input type="number" className="input" value={form.quantity_on_hand} onChange={set('quantity_on_hand')} />
          </div>
          <div>
            <label className="label">Reorder threshold</label>
            <input type="number" className="input" value={form.reorder_threshold} onChange={set('reorder_threshold')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Image URL</label>
            <input className="input" value={form.image_url} onChange={set('image_url')} placeholder="https://…" />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600 sm:col-span-2">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            Active (visible at checkout)
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : product ? 'Save changes' : 'Add product'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
