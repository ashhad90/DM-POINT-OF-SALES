import React, { useEffect, useMemo, useState } from 'react'
import { Users, Search, Plus, Phone, Mail, User, BookOpen, History, ChevronDown, ChevronUp, Banknote, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { fmtMoney, fmtDate } from '../lib/format'
import { printReceipt, printReceipts, useReceiptStore } from '../lib/receipt'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'

export default function Customers() {
  const { push } = useToast()
  const store = useReceiptStore()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState(null) // customer detail
  const [history, setHistory] = useState(null)
  const [ledger, setLedger] = useState(null)
  const [activeTab, setActiveTab] = useState('history') // 'history' | 'ledger'
  const [expandedTxn, setExpandedTxn] = useState(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'cash', note: '' })
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', notes: '' })

  const load = async () => {
    const { data } = await supabase.from('customers').select('*').order('name')
    setCustomers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    )
  }, [customers, search])

  const createCustomer = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setBusy(true)
    const { error } = await supabase.from('customers').insert({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      notes: form.notes.trim()
    })
    setBusy(false)
    if (error) {
      push(error.message, 'error')
      return
    }
    push('Customer created')
    setFormOpen(false)
    setForm({ name: '', phone: '', email: '', notes: '' })
    load()
  }

  const openEdit = (c) => {
    setEditingCustomer(c)
    setEditForm({
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      notes: c.notes || ''
    })
    setEditOpen(true)
  }

  const updateCustomer = async (e) => {
    e.preventDefault()
    if (!editForm.name.trim()) return
    setBusy(true)
    const { error } = await supabase
      .from('customers')
      .update({
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        notes: editForm.notes.trim()
      })
      .eq('id', editingCustomer.id)
    
    setBusy(false)
    if (error) {
      push(error.message, 'error')
      return
    }
    push('Customer updated successfully')
    setEditOpen(false)
    setEditingCustomer(null)
    load()
  }

  const deleteCustomer = async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer? This will keep their past sales but clear their account.')) return
    setBusy(true)
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
    
    setBusy(false)
    if (error) {
      push(error.message, 'error')
      return
    }
    push('Customer deleted successfully')
    load()
  }

  const loadDetail = async (c) => {
    setHistory(null)
    setLedger(null)
    
    const p1 = supabase
      .from('transactions')
      .select('*')
      .eq('customer_id', c.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const p2 = supabase
      .from('customer_ledger')
      .select('*')
      .eq('customer_id', c.id)
      .order('created_at', { ascending: false })
      .limit(100)

    const [{ data: txns }, { data: led }] = await Promise.all([p1, p2])

    setLedger(led || [])

    if (txns && txns.length > 0) {
      const txnIds = txns.map(t => t.id)
      const { data: items } = await supabase
        .from('transaction_items')
        .select('*')
        .in('transaction_id', txnIds)
      
      const txnsWithItems = txns.map(t => ({
        ...t,
        items: (items || []).filter(item => item.transaction_id === t.id)
      }))
      setHistory(txnsWithItems)
    } else {
      setHistory([])
    }
  }

  const openDetail = async (c) => {
    setSelected(c)
    setActiveTab('history')
    setExpandedTxn(null)
    loadDetail(c)
  }

  const recordPayment = async (e) => {
    e.preventDefault()
    const amt = parseFloat(paymentForm.amount)
    if (isNaN(amt) || amt <= 0) {
      push('Invalid payment amount', 'error')
      return
    }
    setPaymentBusy(true)
    const { data, error } = await supabase.rpc('record_payment', {
      p_customer_id: selected.id,
      p_amount: amt,
      p_payment_method: paymentForm.method,
      p_note: paymentForm.note.trim()
    })
    setPaymentBusy(false)
    if (error) {
      push(error.message, 'error')
      return
    }
    push('Payment recorded successfully')
    setPaymentOpen(false)
    setPaymentForm({ amount: '', method: 'cash', note: '' })
    
    // Refresh details for the current customer
    const updatedCustomer = { ...selected, balance: data.new_balance }
    setSelected(updatedCustomer)
    loadDetail(updatedCustomer)
    load() // Reload main customers list to update balances
  }

  const totalSpent = (history || []).filter((t) => t.status === 'completed').reduce((s, t) => s + Number(t.total), 0)

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
          <p className="text-sm text-slate-500">{customers.length} registered</p>
        </div>
        <button onClick={() => { setFormOpen(true); setForm({ name: '', phone: '', email: '', notes: '' }) }} className="btn-primary">
          <Plus size={16} /> Add customer
        </button>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" placeholder="Search name, phone, or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" subtitle="Customers are added at checkout or here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Registered</th>
                  <th className="px-4 py-3 text-right font-semibold">Balance (Udhaar)</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                          <User size={17} />
                        </div>
                        <span className="font-semibold text-slate-800">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                        {c.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {c.phone}</span>}
                        {c.email && <span className="inline-flex items-center gap-1"><Mail size={12} /> {c.email}</span>}
                        {!c.phone && !c.email && <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(c.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${c.balance > 0 ? 'text-red-500' : 'text-slate-500'}`}>
                        {fmtMoney(c.balance || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(c)} className="btn-secondary px-3 py-1.5 text-xs">Edit</button>
                        <button onClick={() => openDetail(c)} className="btn-secondary px-3 py-1.5 text-xs">View details</button>
                        <button onClick={() => deleteCustomer(c.id)} className="btn-secondary px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New customer modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add customer">
        <form onSubmit={createCustomer} className="space-y-3">
          <input className="input" placeholder="Full name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <textarea className="input" rows={2} placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Create customer'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit customer modal */}
      <Modal open={editOpen} onClose={() => { setEditOpen(false); setEditingCustomer(null) }} title="Edit customer">
        <form onSubmit={updateCustomer} className="space-y-3">
          <input className="input" placeholder="Full name *" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required autoFocus />
          <input className="input" placeholder="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
          <input className="input" placeholder="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <textarea className="input" rows={2} placeholder="Notes" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={() => { setEditOpen(false); setEditingCustomer(null) }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              {selected.phone && <span className="inline-flex items-center gap-1.5 text-slate-600"><Phone size={14} /> {selected.phone}</span>}
              {selected.email && <span className="inline-flex items-center gap-1.5 text-slate-600"><Mail size={14} /> {selected.email}</span>}
              {selected.notes && <span className="text-slate-500 italic">"{selected.notes}"</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400">Total spent</p>
                <p className="text-xl font-bold text-slate-800">{fmtMoney(totalSpent)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400">Purchases</p>
                <p className="text-xl font-bold text-slate-800">{history?.length || 0}</p>
              </div>
              <div className={`rounded-xl p-4 border ${selected.balance > 0 ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-transparent'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">Outstanding Balance</p>
                    <p className={`text-xl font-bold ${selected.balance > 0 ? 'text-red-500' : 'text-slate-800'}`}>
                      {fmtMoney(selected.balance || 0)}
                    </p>
                  </div>
                  {selected.balance > 0 && (
                    <button
                      onClick={() => {
                        setPaymentForm({ amount: selected.balance.toString(), method: 'cash', note: '' })
                        setPaymentOpen(true)
                      }}
                      className="btn-primary py-1 px-2.5 text-xs font-semibold bg-red-600 hover:bg-red-700"
                    >
                      Receive Payment
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all ${
                  activeTab === 'history'
                    ? 'border-accent-600 text-accent-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <History size={16} /> Purchase History
              </button>
              <button
                onClick={() => setActiveTab('ledger')}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all ${
                  activeTab === 'ledger'
                    ? 'border-accent-600 text-accent-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <BookOpen size={16} /> Ledger (Udhaar Statements)
              </button>
            </div>

            {/* Purchase History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                {history === null ? (
                  <div className="flex justify-center py-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">No purchases yet</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const bulkData = history.map(t => ({
                            txn: { ...t, customer: selected },
                            items: t.items || []
                          }))
                          printReceipts(bulkData, store)
                        }}
                        className="btn-secondary py-1.5 px-3 text-xs inline-flex items-center gap-1.5 bg-white shadow-sm"
                      >
                        <Printer size={14} /> Print All Bills
                      </button>
                    </div>
                    {history.map((t) => {
                      const isExpanded = expandedTxn === t.id
                      return (
                        <div 
                          key={t.id} 
                          className={`rounded-xl border transition-all duration-200 overflow-hidden ${isExpanded ? 'border-accent-300 shadow-md ring-1 ring-accent-100' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}
                        >
                          <div 
                            onClick={() => setExpandedTxn(isExpanded ? null : t.id)}
                            className="flex flex-wrap items-center justify-between p-4 cursor-pointer bg-white hover:bg-slate-50"
                          >
                            <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Receipt No</p>
                                <p className="font-mono text-sm font-bold text-slate-800">{t.receipt_number}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Date</p>
                                <p className="text-sm font-medium text-slate-700">{fmtDate(t.created_at)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Payment & Status</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge variant={t.payment_method === 'credit' ? 'danger' : 'success'}>
                                    {t.payment_method === 'credit' ? 'Credit / Udhaar' : t.payment_method}
                                  </Badge>
                                  <Badge variant={t.status === 'completed' ? 'success' : 'danger'}>
                                    {t.status}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4 mt-2 sm:mt-0">
                              <div className="text-right">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Total Amount</p>
                                <p className="text-base font-extrabold text-slate-900">{fmtMoney(t.total)}</p>
                              </div>
                              <div className={`flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-500 transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-accent-100 text-accent-600' : ''}`}>
                                <ChevronDown size={18} />
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 flex-1">
                                  Purchased Items
                                  <span className="h-px bg-slate-200 flex-1 ml-2"></span>
                                </h4>
                                <button
                                  type="button"
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    printReceipt({ ...t, customer: selected }, t.items || [], store);
                                  }}
                                  className="btn-secondary py-1.5 px-3 text-xs inline-flex items-center gap-1.5 whitespace-nowrap bg-white"
                                >
                                  <Printer size={13} /> Print Bill
                                </button>
                              </div>
                              
                              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                    <tr>
                                      <th className="px-4 py-2.5 font-semibold">Product</th>
                                      <th className="px-4 py-2.5 text-center font-semibold">Qty</th>
                                      <th className="px-4 py-2.5 text-right font-semibold">Price</th>
                                      <th className="px-4 py-2.5 text-right font-semibold">Discount</th>
                                      <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {(t.items || []).map((item) => (
                                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 text-slate-800 font-medium">
                                          {item.product_name}
                                          {item.sku && <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{item.sku}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center text-slate-600 font-medium">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{fmtMoney(item.unit_price)}</td>
                                        <td className="px-4 py-3 text-right font-medium text-emerald-600">
                                          {item.discount > 0 ? `-${fmtMoney(item.discount)}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-800 font-bold">{fmtMoney(item.line_total)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Financial Ledger Tab */}
            {activeTab === 'ledger' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                  <div className="text-sm text-slate-600">
                    Showing debt log and payments for this account.
                  </div>
                  <button
                    onClick={() => {
                      setPaymentForm({ amount: '', method: 'cash', note: '' })
                      setPaymentOpen(true)
                    }}
                    className="btn-primary flex items-center gap-1 py-2 px-4 text-sm font-semibold"
                  >
                    <Banknote size={15} /> Record Payment
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {ledger === null ? (
                    <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600" /></div>
                  ) : ledger.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-400">No transactions recorded in ledger</p>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-2 font-semibold">Date</th>
                          <th className="px-4 py-2 font-semibold">Description</th>
                          <th className="px-4 py-2 text-right font-semibold">Debit (+)</th>
                          <th className="px-4 py-2 text-right font-semibold">Credit (-)</th>
                          <th className="px-4 py-2 text-right font-semibold">Running Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map((l) => (
                          <tr key={l.id} className="border-t border-slate-100 text-slate-700">
                            <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDate(l.created_at)}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-800">{l.description}</td>
                            <td className="px-4 py-2.5 text-right text-red-500 font-medium">
                              {l.debit > 0 ? `+${fmtMoney(l.debit)}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">
                              {l.credit > 0 ? `-${fmtMoney(l.credit)}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-800">
                              {fmtMoney(l.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Record Payment Modal */}
      {paymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setPaymentOpen(false)} />
          <form onSubmit={recordPayment} className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-1">
              <Banknote size={18} className="text-emerald-500" /> Record Udhaar Payment
            </h3>
            <p className="text-xs text-slate-400 mt-1">Receive payment to decrease the customer's outstanding balance.</p>
            
            <div className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Payment Amount *</label>
                <input
                  className="input font-bold text-lg"
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selected?.balance > 0 ? selected.balance : undefined}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Payment Method</label>
                <select
                  className="input"
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Note (Optional)</label>
                <input
                  className="input text-sm"
                  placeholder="e.g. Settle partial balance"
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3.5">
              <button type="button" onClick={() => setPaymentOpen(false)} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" disabled={paymentBusy} className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700">
                {paymentBusy ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
