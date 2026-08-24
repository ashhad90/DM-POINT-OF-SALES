import { Printer, Mail, CheckCircle2 } from 'lucide-react'
import Modal from '../ui/Modal'
import { useCart } from '../../context/CartContext'
import { useProducts } from '../../context/ProductContext'
import { printReceipt, emailReceipt, useReceiptStore } from '../../lib/receipt'
import { fmtMoney, fmtDateTime } from '../../lib/format'

export default function ReceiptModal({ txn, items, open, onClose }) {
  const { clear } = useCart()
  const { products } = useProducts()
  const store = useReceiptStore()

  if (!txn) return null

  const close = () => {
    clear()
    onClose()
  }

  const canEmail = txn.customer?.email

  return (
    <Modal open={open} onClose={close} title="Sale complete" size="sm">
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={30} />
          </div>
          <p className="text-xl font-bold text-slate-800">{fmtMoney(txn.total)}</p>
          <p className="text-sm text-slate-500">{txn.receipt_number} · {fmtDateTime(txn.created_at)}</p>
        </div>

        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <div className="flex justify-between py-0.5"><span className="text-slate-500">Items</span><span className="font-semibold">{items?.length}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-slate-500">Payment</span><span className="font-semibold capitalize">{txn.payment_method}{txn.payment_method === 'split' ? ` (${fmtMoney(txn.card_amount)} card)` : ''}</span></div>
          {txn.amount_tendered > 0 && (
            <div className="flex justify-between py-0.5"><span className="text-slate-500">Tendered</span><span className="font-semibold">{fmtMoney(txn.amount_tendered)}</span></div>
          )}
          {txn.change_due > 0 && (
            <div className="flex justify-between py-0.5"><span className="text-slate-500">Change</span><span className="font-semibold text-emerald-700">{fmtMoney(txn.change_due)}</span></div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => printReceipt(txn, items, store)} className="btn-primary py-3">
            <Printer size={17} /> Print receipt
          </button>
          <button
            onClick={() => emailReceipt(txn, items, store)}
            disabled={!canEmail}
            className="btn-secondary py-3"
            title={canEmail ? 'Email receipt' : 'No email on this customer'}
          >
            <Mail size={17} /> Email
          </button>
        </div>
        <button onClick={close} className="btn-secondary w-full">New sale</button>
      </div>
    </Modal>
  )
}
