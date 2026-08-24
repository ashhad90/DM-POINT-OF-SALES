import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import { useCart } from '../../context/CartContext'
import { fmtMoney } from '../../lib/format'

export default function PaymentModal({ open, onClose, onComplete }) {
  const { total, paymentMethod, setPaymentMethod, tendered, setTendered, cardAmount, setCardAmount, customer } = useCart()
  const [busy, setBusy] = useState(false)

  const change = useMemo(
    () => Math.max(0, Math.round((tendered - total) * 100) / 100),
    [tendered, total]
  )

  useEffect(() => {
    if (open) setBusy(false)
  }, [open])

  // Quick-cash buttons: round up to nearest $5
  const quickCash = [5, 10, 20, 50, 100]
    .map((n) => Math.ceil(total / n) * n)
    .filter((n, i, a) => n >= total && a.indexOf(n) === i)
    .slice(0, 4)

  const canComplete =
    (paymentMethod === 'cash' && tendered >= total) ||
    (paymentMethod === 'card' && total > 0) ||
    (paymentMethod === 'split' && cardAmount > 0 && cardAmount < total && tendered >= total - cardAmount) ||
    (paymentMethod === 'credit' && customer && total > 0)

  const complete = async () => {
    if (!canComplete || busy) return
    setBusy(true)
    try {
      await onComplete({
        payment_method: paymentMethod,
        amount_tendered: paymentMethod === 'card' ? total : (paymentMethod === 'credit' ? 0 : tendered),
        card_amount: paymentMethod === 'split' ? cardAmount : 0
      })
      onClose()
    } catch {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Take payment">
      <div className="space-y-5">
        <div className="flex items-baseline justify-between rounded-xl bg-slate-900 px-5 py-4 text-white">
          <span className="text-sm font-medium text-slate-300">Total due</span>
          <span className="text-3xl font-bold">{fmtMoney(total)}</span>
        </div>

        {/* Method */}
        <div className="grid grid-cols-4 gap-2">
          {(['cash', 'card', 'split', 'credit']).map((m) => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className={`rounded-xl border-2 py-3 text-xs font-bold capitalize transition-colors ${
                paymentMethod === m
                  ? 'border-accent-600 bg-accent-50 text-accent-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {m === 'credit' ? 'Credit (Udhaar)' : m}
            </button>
          ))}
        </div>

        {paymentMethod === 'cash' && (
          <div>
            <label className="label">Amount tendered</label>
            <div className="grid grid-cols-4 gap-2">
              {quickCash.map((n) => (
                <button
                  key={n}
                  onClick={() => setTendered(n)}
                  className={`rounded-lg border py-2 text-sm font-bold ${
                    tendered === n ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  ${n}
                </button>
              ))}
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input mt-2 text-lg font-bold"
              placeholder="0.00"
              value={tendered || ''}
              onChange={(e) => setTendered(parseFloat(e.target.value) || 0)}
              autoFocus
            />
            <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3">
              <span className="text-sm font-semibold text-emerald-800">Change due</span>
              <span className="text-xl font-bold text-emerald-700">{fmtMoney(change)}</span>
            </div>
          </div>
        )}

        {paymentMethod === 'card' && (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Charge the card reader for <span className="font-semibold text-slate-800">{fmtMoney(total)}</span>.
            In production this integrates with your card terminal.
          </p>
        )}

        {paymentMethod === 'split' && (
          <div className="space-y-3">
            <div>
              <label className="label">Card amount</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={total}
                className="input text-lg font-bold"
                placeholder="0.00"
                value={cardAmount || ''}
                onChange={(e) => setCardAmount(Math.min(total, parseFloat(e.target.value) || 0))}
              />
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Remaining (cash)</span>
                <span className="font-bold text-slate-800">{fmtMoney(Math.max(0, total - cardAmount))}</span>
              </div>
            </div>
            <div>
              <label className="label">Cash tendered</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input text-lg font-bold"
                placeholder="0.00"
                value={tendered || ''}
                onChange={(e) => setTendered(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3">
              <span className="text-sm font-semibold text-emerald-800">Change due</span>
              <span className="text-xl font-bold text-emerald-700">{fmtMoney(Math.max(0, tendered - (total - cardAmount)))}</span>
            </div>
          </div>
        )}

        {paymentMethod === 'credit' && (
          <div className="rounded-lg bg-red-50 p-4 border border-red-100">
            <h4 className="text-sm font-semibold text-red-800">Credit Sale (Udhaar)</h4>
            <div className="mt-2 space-y-1.5 text-sm text-red-700">
              <div className="flex justify-between"><span>Customer:</span><span className="font-semibold">{customer?.name}</span></div>
              <div className="flex justify-between"><span>Current Balance:</span><span className="font-semibold">{fmtMoney(customer?.balance || 0)}</span></div>
              <div className="flex justify-between border-t border-red-200/50 pt-1.5 font-bold">
                <span>New Outstanding Debt:</span>
                <span>{fmtMoney((customer?.balance || 0) + total)}</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-red-600/80">
              This sale will be charged to the customer's credit line.
            </p>
          </div>
        )}

        <button
          onClick={complete}
          disabled={!canComplete || busy}
          className="btn-primary w-full py-4 text-lg"
        >
          {busy ? 'Processing…' : `Complete sale · ${fmtMoney(total)}`}
        </button>
      </div>
    </Modal>
  )
}
