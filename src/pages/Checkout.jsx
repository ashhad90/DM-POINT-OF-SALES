import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, ScanBarcode, ShoppingCart, Minus, Plus, Trash2, X, Percent, Undo2 } from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { fmtMoney } from '../lib/format'
import PaymentModal from '../components/checkout/PaymentModal'
import ReceiptModal from '../components/checkout/ReceiptModal'
import CustomerSelect from '../components/checkout/CustomerSelect'
import { printReceipt } from '../lib/receipt'

export default function Checkout() {
  const { products } = useProducts()
  const cart = useCart()
  const { push } = useToast()

  const [search, setSearch] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [lastTxn, setLastTxn] = useState(null)
  const [lastItems, setLastItems] = useState([])
  const [showReceipt, setShowReceipt] = useState(false)
  const [voiding, setVoiding] = useState(null) // txn to void
  const [voidReason, setVoidReason] = useState('')
  const [voidBusy, setVoidBusy] = useState(false)
  const [recentSales, setRecentSales] = useState([])
  const [recentOpen, setRecentOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [customDate, setCustomDate] = useState('')
  const searchRef = useRef(null)

  // Customer pre-checkout selection state
  const [custSearch, setCustSearch] = useState('')
  const [customers, setCustomers] = useState([])
  const [custLoading, setCustLoading] = useState(false)
  const [newCustOpen, setNewCustOpen] = useState(false)
  const [newCustForm, setNewCustForm] = useState({ name: '', phone: '', email: '', notes: '' })

  // Load all customers initially to show a quick select list
  useEffect(() => {
    if (!cart.customer) {
      setCustLoading(true)
      supabase.from('customers').select('*').order('name')
        .then(({ data }) => {
          setCustomers(data || [])
          setCustLoading(false)
        })
    }
  }, [cart.customer])

  const filteredCustomers = useMemo(() => {
    const q = custSearch.trim().toLowerCase()
    if (!q) return customers.slice(0, 10) // Show top 10 initially
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    )
  }, [customers, custSearch])

  const stockMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.quantity_on_hand])),
    [products]
  )

  const gridProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = products.filter(
      (p) =>
        p.active &&
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q))
    )
    return filtered.slice(0, 24)
  }, [products, search])

  const addToCart = (p) => {
    const inCart = cart.items.find((i) => i.product.id === p.id)?.quantity || 0
    if (inCart >= p.quantity_on_hand) {
      push('Not enough stock on hand', 'error')
      return
    }
    cart.add(p)
  }

  const loadRecent = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*, customer:customers(name)')
      .order('created_at', { ascending: false })
      .limit(10)
    setRecentSales(data || [])
    setRecentOpen(true)
  }

  const completeSale = async ({ payment_method, amount_tendered, card_amount }) => {
    const items = cart.items.map((i) => ({
      product_id: i.product.id,
      quantity: i.quantity,
      unit_price: i.price ?? i.product.sale_price,
      discount: i.discount || 0
    }))

    const { data, error } = await supabase.rpc('record_sale', {
      p_customer_id: cart.customer?.id || null,
      p_payment_method: payment_method,
      p_amount_tendered: amount_tendered,
      p_card_amount: card_amount,
      p_tax_rate: cart.taxRate,
      p_items: items,
      p_created_at: customDate ? new Date(customDate).toISOString() : null
    })

    if (error) {
      if (error.message.includes('INSUFFICIENT_STOCK')) {
        push('A product in the cart no longer has enough stock', 'error')
      } else {
        push(error.message || 'Sale failed', 'error')
      }
      throw error
    }

    const { data: txn } = await supabase
      .from('transactions')
      .select('*, cashier:profiles!transactions_cashier_id_fkey(full_name), customer:customers(*)')
      .eq('id', data.id)
      .single()

    const { data: txnItems } = await supabase
      .from('transaction_items')
      .select('*')
      .eq('transaction_id', data.id)
      .order('id')
    cart.clear()
    setCustomDate('')
    setLastTxn(txn)
    setLastItems(txnItems || [])
    setShowReceipt(true)
    setRecentOpen(false)
    setBusy(false)

    // Automatically trigger printing of the receipt
    try {
      const store = typeof window !== 'undefined' ? JSON.parse(window.localStorage.getItem('pos_store_settings') || '{}') : {}
      printReceipt(txn, txnItems || [], store)
    } catch (e) {
      console.error('Auto-print failed:', e)
    }
  }

  const doVoid = async () => {
    if (!voiding) return
    setVoidBusy(true)
    try {
      await supabase.rpc('void_transaction', { p_txn_id: voiding.id, p_reason: voidReason })
      push(`Transaction ${voiding.receipt_number} voided — stock restored`)
      setVoiding(null)
      setVoidReason('')
    } catch (err) {
      push(err.message || 'Void failed', 'error')
    } finally {
      setVoidBusy(false)
    }
  }

  const openPayment = () => {
    if (cart.items.length === 0) {
      push('Cart is empty', 'error')
      return
    }
    setPayOpen(true)
  }

  if (!cart.customer) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 p-4 md:p-8">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl md:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <ShoppingCart size={28} />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-800">Start a Checkout Session</h1>
            <p className="text-sm text-slate-500">Please select an existing customer or register a new one to begin adding products to the cart.</p>
          </div>

          <div className="space-y-4">
            {/* Search and Add Row */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-10"
                  placeholder="Search customer by name, phone or email..."
                  value={custSearch}
                  onChange={(e) => setCustSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                onClick={() => {
                  setNewCustForm({ name: '', phone: '', email: '', notes: '' })
                  setNewCustOpen(true)
                }}
                className="btn-primary shrink-0"
              >
                <Plus size={16} /> New Customer
              </button>
            </div>

            {/* Customers list */}
            <div className="max-h-[300px] overflow-y-auto rounded-xl border border-slate-100">
              {custLoading ? (
                <div className="flex justify-center py-10">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600" />
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  No customers found matching "{custSearch}"
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {filteredCustomers.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3.5 hover:bg-slate-50/60">
                      <div>
                        <p className="font-semibold text-slate-800">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.phone || 'No phone'} · {c.email || 'No email'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-semibold text-slate-400 uppercase">Outstanding Balance</p>
                          <p className={`text-sm font-bold ${c.balance > 0 ? 'text-red-500' : 'text-slate-500'}`}>
                            {fmtMoney(c.balance || 0)}
                          </p>
                        </div>
                        <button
                          onClick={() => cart.setCustomer(c)}
                          className="btn-secondary px-3 py-1.5 text-xs font-semibold hover:bg-accent-600 hover:text-white"
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* New Customer Modal */}
        {newCustOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setNewCustOpen(false)} />
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!newCustForm.name.trim()) return
                setBusy(true)
                const { data, error } = await supabase
                  .from('customers')
                  .insert({
                    name: newCustForm.name.trim(),
                    phone: newCustForm.phone.trim(),
                    email: newCustForm.email.trim(),
                    notes: newCustForm.notes.trim()
                  })
                  .select()
                  .single()
                setBusy(false)
                if (error) {
                  push(error.message, 'error')
                  return
                }
                cart.setCustomer(data)
                setNewCustOpen(false)
                push('Customer registered and attached')
              }}
              className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            >
              <h3 className="text-lg font-semibold text-slate-800">Add New Customer</h3>
              <div className="mt-3 space-y-3">
                <input
                  className="input"
                  placeholder="Full name *"
                  value={newCustForm.name}
                  onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })}
                  required
                  autoFocus
                />
                <input
                  className="input"
                  placeholder="Phone"
                  value={newCustForm.phone}
                  onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Email"
                  type="email"
                  value={newCustForm.email}
                  onChange={(e) => setNewCustForm({ ...newCustForm, email: e.target.value })}
                />
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Notes"
                  value={newCustForm.notes}
                  onChange={(e) => setNewCustForm({ ...newCustForm, notes: e.target.value })}
                />
              </div>
              <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setNewCustOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={busy} className="btn-primary">
                  {busy ? 'Registering...' : 'Register & Select'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[60vh] flex-col lg:flex-row">
      {/* Product browser */}
      <div className="flex min-h-0 flex-1 flex-col p-4 lg:p-5">
        <div className="relative mb-3">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            className="input h-12 pl-11 text-base"
            placeholder="Search or scan barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <ScanBarcode size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
        </div>

        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2.5 overflow-y-auto pb-2 sm:grid-cols-3 xl:grid-cols-4">
          {gridProducts.map((p) => {
            const stock = stockMap[p.id]
            const out = stock <= 0
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={out}
                className={`group flex flex-col rounded-xl border bg-white p-3 text-left shadow-sm transition-all ${
                  out
                    ? 'cursor-not-allowed border-slate-200 opacity-50'
                    : 'border-slate-200 hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-md active:scale-95'
                }`}
              >
                <div className="mb-2 flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-300">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <ShoppingCart size={22} />}
                </div>
                <p className="line-clamp-2 text-sm font-semibold leading-tight text-slate-800">{p.name}</p>
                <div className="mt-auto flex items-end justify-between pt-2">
                  <span className="text-base font-bold text-slate-900">{fmtMoney(p.sale_price)}</span>
                  <span className={`text-xs ${stock <= 5 ? 'font-semibold text-red-500' : 'text-slate-400'}`}>{stock} left</span>
                </div>
              </button>
            )
          })}
          {gridProducts.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-slate-400">
              No products match "{search}"
            </p>
          )}
        </div>

        {/* Recent sales */}
        {recentOpen && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <p className="text-sm font-semibold text-slate-700">Recent sales</p>
              <button onClick={() => setRecentOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {recentSales.map((t) => (
                <div key={t.id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-2.5 text-sm last:border-0">
                  <span className="font-mono text-xs text-slate-400">{t.receipt_number}</span>
                  <span className="font-medium text-slate-700">{fmtMoney(t.total)}</span>
                  <span className="text-xs text-slate-400">{t.customer?.name || '—'}</span>
                  <span className={`ml-auto text-xs font-semibold ${t.status === 'completed' ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {t.status}
                  </span>
                  {t.status === 'completed' && (
                    <button onClick={() => { setVoiding(t); setVoidReason('') }} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Undo2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="flex w-full flex-col border-t border-slate-200 bg-white lg:w-[400px] lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Current sale <span className="ml-1 rounded-full bg-accent-100 px-2 py-0.5 text-accent-700">{cart.itemCount}</span>
          </h2>
          <div className="flex gap-1">
            <button onClick={loadRecent} className="btn-ghost px-2 py-1.5 text-xs">Recent sales</button>
            {cart.items.length > 0 && (
              <button onClick={cart.clear} className="btn-ghost px-2 py-1.5 text-xs text-red-500">Clear</button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {cart.items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-slate-400">
              <ShoppingCart size={40} strokeWidth={1.5} />
              <p className="text-sm font-medium">Tap products to add them</p>
              <p className="text-xs">or scan a barcode</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {cart.items.map((i) => (
                <div key={i.product.id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{i.product.name}</p>
                    <div className="flex items-center gap-1 mt-0.5 mb-1.5">
                      <span className="text-[10px] text-slate-400">PKR</span>
                      <input 
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-700 outline-none focus:border-accent-400 bg-slate-50"
                        value={i.price ?? i.product.sale_price}
                        onChange={(e) => cart.setItemPrice(i.product.id, parseFloat(e.target.value) || 0)}
                      />
                      <span className="text-[10px] text-slate-400">each</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => cart.setQty(i.product.id, i.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"><Minus size={14} /></button>
                      <span className="w-8 text-center text-sm font-bold">{i.quantity}</span>
                      <button
                        onClick={() => cart.setQty(i.product.id, i.quantity + 1)}
                        disabled={i.quantity >= i.product.quantity_on_hand}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-bold text-slate-800">{fmtMoney((i.price ?? i.product.sale_price) * i.quantity)}</span>
                    {i.discount > 0 && <span className="text-xs font-semibold text-emerald-600">−{fmtMoney(i.discount)}</span>}
                    <button onClick={() => cart.remove(i.product.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}

              {/* Order discount */}
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 p-2.5">
                <Percent size={16} className="text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                  placeholder="Order discount (PKR)"
                  value={cart.orderDiscount || ''}
                  onChange={(e) => cart.setOrderDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-slate-100 px-4 py-4">
          <CustomerSelect />

          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-semibold text-slate-500 uppercase flex-shrink-0">Custom Date</span>
            <input 
              type="datetime-local" 
              className="input text-xs py-1.5 h-8 border-slate-200" 
              value={customDate} 
              onChange={(e) => setCustomDate(e.target.value)} 
              title="Leave empty for current time"
            />
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{fmtMoney(cart.subtotal)}</span></div>
            {cart.discount > 0 && (
              <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−{fmtMoney(cart.discount)}</span></div>
            )}
            <div className="flex justify-between text-slate-500"><span>Tax ({(cart.taxRate * 100).toFixed(0)}%)</span><span>{fmtMoney(cart.tax)}</span></div>
            <div className="flex items-baseline justify-between border-t border-slate-100 pt-2">
              <span className="text-sm font-bold text-slate-800">Total</span>
              <span className="text-2xl font-bold text-slate-900">{fmtMoney(cart.total)}</span>
            </div>
          </div>

          <button onClick={openPayment} disabled={cart.items.length === 0 || busy} className="btn-primary h-14 w-full text-lg">
            {busy ? 'Processing…' : `Charge ${fmtMoney(cart.total)}`}
          </button>
        </div>
      </div>

      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} onComplete={completeSale} />
      <ReceiptModal txn={lastTxn} items={lastItems} open={showReceipt} onClose={() => setShowReceipt(false)} />

      {/* Void confirm */}
      {voiding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setVoiding(null)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Void {voiding.receipt_number}?</h3>
            <p className="mt-1 text-sm text-slate-500">
              Sale of <span className="font-semibold">{fmtMoney(voiding.total)}</span> will be voided and all stock restored.
            </p>
            <input
              className="input mt-3"
              placeholder="Reason (optional)"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setVoiding(null)} className="btn-secondary">Cancel</button>
              <button onClick={doVoid} disabled={voidBusy} className="btn-danger">
                {voidBusy ? 'Voiding…' : 'Void transaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
