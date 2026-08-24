import { useState } from 'react'
import Modal from '../ui/Modal'
import { useProducts } from '../../context/ProductContext'
import { useToast } from '../../context/ToastContext'

const reasons = [
  { value: 'restock', label: 'Restock' },
  { value: 'damage', label: 'Damage' },
  { value: 'correction', label: 'Correction' }
]

export default function StockAdjust({ product, open, onClose }) {
  const { adjustStock } = useProducts()
  const { push } = useToast()
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('restock')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const qty = parseInt(delta, 10)
    if (!qty) return
    setBusy(true)
    try {
      await adjustStock({ productId: product.id, delta: qty, reason, note })
      push(`Stock adjusted by ${qty > 0 ? '+' : ''}${qty}`)
      onClose()
    } catch (err) {
      push(err.message || 'Adjustment failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const quickAdd = (n) => setDelta(String((parseInt(delta, 10) || 0) + n))

  if (!open || !product) return null

  return (
    <Modal open={open} onClose={onClose} title={`Adjust stock — ${product.name}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">
          Current quantity on hand: <span className="font-semibold text-slate-800">{product.quantity_on_hand}</span>
        </p>

        <div>
          <label className="label">Quantity change</label>
          <div className="grid grid-cols-3 gap-2">
            {[+10, +1, -1, -10, -25, -50].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => quickAdd(n)}
                className={`rounded-lg border py-2.5 text-sm font-bold ${
                  n > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                {n > 0 ? '+' : ''}{n}
              </button>
            ))}
          </div>
          <input
            type="number"
            className="input mt-2 text-lg font-bold"
            placeholder="0"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="label">Reason</label>
          <div className="flex gap-2">
            {reasons.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                  reason === r.value ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Note (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. spilled case, counted stock" />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={busy || !delta} className="btn-primary">Apply adjustment</button>
        </div>
      </form>
    </Modal>
  )
}
