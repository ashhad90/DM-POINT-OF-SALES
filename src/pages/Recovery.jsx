import React, { useEffect, useState } from 'react'
import { Wallet, Search, CheckCircle, Clock, Plus, Edit, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { fmtMoney, fmtDate } from '../lib/format'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'

export default function Recovery() {
  const { push } = useToast()
  
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState([])
  
  // Payment form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [customDate, setCustomDate] = useState('')

  const [creating, setCreating] = useState(false)
  const [newCustForm, setNewCustForm] = useState({ name: '', phone: '', email: '' })
  
  // Edit/Delete payment state
  const [editingPayment, setEditingPayment] = useState(null)
  const [editPaymentForm, setEditPaymentForm] = useState({ amount: '', date: '', note: '' })
  const [deletingPayment, setDeletingPayment] = useState(null)

  const loadCustomers = async () => {
    const { data, error } = await supabase.from('customers').select('*').order('name')
    if (error) push(error.message, 'error')
    else setCustomers(data || [])
  }

  const loadHistory = async (customerId) => {
    setLoading(true)
    let query = supabase.from('customer_ledger').select('*, customer:customers(name)')
    
    if (customerId) {
      query = query.eq('customer_id', customerId)
      // fetch all ledger for the customer
    } else {
      query = query.eq('type', 'payment') // default view just shows recent payments
    }
    
    const { data, error } = await query.order('created_at', { ascending: false }).limit(50)
    
    if (error) push(error.message, 'error')
    else setPayments(data || [])
    
    setLoading(false)
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    loadHistory(selectedCustomerId)
  }, [selectedCustomerId])

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    if (!selectedCustomerId) {
      push('Please select a customer', 'error')
      return
    }
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      push('Invalid amount', 'error')
      return
    }

    setBusy(true)
    
    const { data, error } = await supabase.rpc('record_payment', {
      p_customer_id: selectedCustomerId,
      p_amount: amt,
      p_payment_method: method,
      p_note: note.trim(),
      p_created_at: customDate ? new Date(customDate).toISOString() : null
    })

    setBusy(false)

    if (error) {
      push(error.message, 'error')
      return
    }

    push('Recovery payment recorded successfully')
    
    // Reset form
    setSelectedCustomerId('')
    setAmount('')
    setMethod('cash')
    setNote('')
    setCustomDate('')
    
    // Refresh data
    loadCustomers()
    loadHistory(selectedCustomerId)
  }

  const createCustomer = async (e) => {
    e.preventDefault()
    if (!newCustForm.name.trim()) return
    setBusy(true)
    const { data, error } = await supabase
      .from('customers')
      .insert({ name: newCustForm.name.trim(), phone: newCustForm.phone.trim(), email: newCustForm.email.trim() })
      .select()
      .single()
    
    setBusy(false)
    if (error) {
      push(error.message, 'error')
      return
    }
    
    push('Customer added successfully')
    setCreating(false)
    setNewCustForm({ name: '', phone: '', email: '' })
    
    // Refresh customers and auto-select new one
    await loadCustomers()
    setSelectedCustomerId(data.id)
  }

  const handleEditPaymentSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.rpc('edit_payment', {
      p_ledger_id: editingPayment.id,
      p_amount: parseFloat(editPaymentForm.amount) || undefined,
      p_note: editPaymentForm.note,
      p_created_at: editPaymentForm.date || undefined
    })
    setBusy(false)
    if (error) {
      push(error.message, 'error')
    } else {
      push('Payment updated successfully')
      setEditingPayment(null)
      loadCustomers()
      loadHistory(selectedCustomerId)
    }
  }

  const handleDeletePaymentConfirm = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('delete_payment', {
      p_ledger_id: deletingPayment.id
    })
    setBusy(false)
    if (error) {
      push(error.message, 'error')
    } else {
      push('Payment deleted successfully')
      setDeletingPayment(null)
      loadCustomers()
      loadHistory(selectedCustomerId)
    }
  }

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Udhaar Recovery</h1>
        <p className="text-sm text-slate-500">Record payments received from customers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: New Recovery Form */}
        <div className="lg:col-span-1">
          <div className="card p-5 sticky top-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Wallet size={18} className="text-accent-600" /> New Recovery
            </h2>
            
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-slate-700">Customer</label>
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="text-xs font-semibold text-accent-600 hover:text-accent-700 flex items-center gap-1"
                  >
                    <Plus size={12} /> New
                  </button>
                </div>
                <select
                  required
                  className="input"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.balance > 0 ? `- Outstanding: ${fmtMoney(c.balance)}` : ''}
                    </option>
                  ))}
                </select>
                {selectedCustomer && (
                  <p className="mt-1 text-xs font-medium text-red-500">
                    Current Balance: {fmtMoney(selectedCustomer.balance)}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Amount Received (PKR)</label>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="input text-lg font-bold"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Payment Method</label>
                <select
                  className="input"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card / POS</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="mobile_wallet">Mobile Wallet</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Custom Date (Optional)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  title="Leave empty to use current date and time"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Notes (Optional)</label>
                <input
                  className="input"
                  placeholder="e.g. Received via JazzCash"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={busy || loading}
                className="btn-primary w-full py-3 text-sm"
              >
                {busy ? 'Recording...' : 'Record Payment'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Recent Recoveries */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Recent Recoveries</h2>
            </div>
            
            {loading ? (
              <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600" /></div>
            ) : payments.length === 0 ? (
              <EmptyState icon={Clock} title="No recent recoveries" subtitle="Payments received from customers will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm relative">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 sticky top-0 shadow-sm">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Date</th>
                      {!selectedCustomerId && <th className="px-5 py-3 font-semibold">Customer</th>}
                      <th className="px-5 py-3 font-semibold">Description</th>
                      <th className="px-5 py-3 text-right font-semibold">Debit (+)</th>
                      <th className="px-5 py-3 text-right font-semibold">Credit (-)</th>
                      {selectedCustomerId && <th className="px-5 py-3 text-right font-semibold">Running Bal</th>}
                      <th className="px-5 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                        {!selectedCustomerId && (
                          <td className="px-5 py-3 font-semibold text-slate-800">
                            {p.customer?.name || 'Unknown'}
                          </td>
                        )}
                        <td className="px-5 py-3">
                          <p className="text-slate-700">{p.description}</p>
                        </td>
                        <td className="px-5 py-3 text-right text-red-500 font-medium">
                          {p.debit > 0 ? `+${fmtMoney(p.debit)}` : '—'}
                        </td>
                        <td className="px-5 py-3 text-right text-emerald-600 font-medium">
                          {p.credit > 0 ? `-${fmtMoney(p.credit)}` : '—'}
                        </td>
                        {selectedCustomerId && (
                          <td className="px-5 py-3 text-right font-bold text-slate-800">
                            {fmtMoney(p.balance)}
                          </td>
                        )}
                        <td className="px-5 py-3 text-right">
                          {p.type === 'payment' && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingPayment(p)
                                  setEditPaymentForm({ amount: p.credit, date: p.created_at.slice(0, 16), note: p.description })
                                }}
                                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-accent-600"
                                title="Edit Payment"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => setDeletingPayment(p)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-500"
                                title="Delete Payment"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Customer Modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title="New Customer" size="sm">
        <form onSubmit={createCustomer} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Full Name *</label>
            <input
              required
              className="input"
              placeholder="e.g. John Doe"
              value={newCustForm.name}
              onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Phone</label>
            <input
              type="tel"
              className="input"
              placeholder="e.g. 0300-1234567"
              value={newCustForm.phone}
              onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email</label>
            <input
              type="email"
              className="input"
              value={newCustForm.email}
              onChange={(e) => setNewCustForm({ ...newCustForm, email: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCreating(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Saving...' : 'Add Customer'}
            </button>
          </div>
        </form>
      </Modal>
      {/* Edit Payment Modal */}
      <Modal open={!!editingPayment} onClose={() => setEditingPayment(null)} title="Edit Payment" size="sm">
        <form onSubmit={handleEditPaymentSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Amount (PKR)</label>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              className="input"
              value={editPaymentForm.amount}
              onChange={(e) => setEditPaymentForm({ ...editPaymentForm, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date & Time</label>
            <input
              type="datetime-local"
              className="input"
              value={editPaymentForm.date}
              onChange={(e) => setEditPaymentForm({ ...editPaymentForm, date: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Notes</label>
            <input
              className="input"
              value={editPaymentForm.note}
              onChange={(e) => setEditPaymentForm({ ...editPaymentForm, note: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditingPayment(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Payment Modal */}
      <Modal open={!!deletingPayment} onClose={() => setDeletingPayment(null)} title="Delete Payment" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete this payment of <strong>{fmtMoney(deletingPayment?.credit || 0)}</strong>? 
            This will add the amount back to the customer's outstanding balance.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setDeletingPayment(null)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleDeletePaymentConfirm} disabled={busy} className="btn-danger">
              {busy ? 'Deleting...' : 'Delete Payment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
