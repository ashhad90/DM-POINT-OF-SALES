import React, { useEffect, useState } from 'react'
import { Wallet, Search, CheckCircle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { fmtMoney, fmtDate } from '../lib/format'
import EmptyState from '../components/ui/EmptyState'

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

  const loadData = async () => {
    setLoading(true)
    
    // Load customers who have a balance
    const { data: custData, error: custErr } = await supabase
      .from('customers')
      .select('*')
      .gt('balance', 0)
      .order('name')
      
    if (custErr) {
      push(custErr.message, 'error')
    } else {
      setCustomers(custData || [])
    }

    // Load recent recovery payments
    const { data: payData, error: payErr } = await supabase
      .from('customer_ledger')
      .select('*, customer:customers(name)')
      .eq('type', 'payment')
      .order('created_at', { ascending: false })
      .limit(50)

    if (payErr) {
      push(payErr.message, 'error')
    } else {
      setPayments(payData || [])
    }
    
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

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
    loadData()
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
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Customer</label>
                <select
                  required
                  className="input"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} - Outstanding: {fmtMoney(c.balance)}
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
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-5 py-3 font-semibold">Customer</th>
                      <th className="px-5 py-3 font-semibold">Description</th>
                      <th className="px-5 py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                        <td className="px-5 py-3 font-semibold text-slate-800">
                          {p.customer?.name || 'Unknown'}
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-slate-700">{p.description}</p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="font-bold text-emerald-600">
                            +{fmtMoney(p.credit)}
                          </span>
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
    </div>
  )
}
