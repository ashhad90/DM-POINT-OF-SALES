import React, { useEffect, useMemo, useState } from 'react'
import { BookOpen, Search, Printer, CheckSquare, Square, ChevronRight, Edit, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { fmtMoney, fmtDate } from '../lib/format'
import { printLedgerStatements, useReceiptStore } from '../lib/receipt'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'

export default function Ledger() {
  const { push } = useToast()
  const store = useReceiptStore()

  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [printing, setPrinting] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [ledgerHistory, setLedgerHistory] = useState(null)
  
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', notes: '' })
  const [deletingCustomer, setDeletingCustomer] = useState(null)
  const [busy, setBusy] = useState(false)

  const loadCustomers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name')

    if (error) {
      push(error.message, 'error')
    } else {
      setCustomers(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    )
  }, [customers, search])

  // Select/deselect handlers
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map((c) => c.id))
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editForm.name.trim()) return
    setBusy(true)

    const updates = {
      name: editForm.name.trim(),
      phone: editForm.phone.trim() || null,
      email: editForm.email.trim() || null,
      notes: editForm.notes.trim() || null,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', editingCustomer.id)

    setBusy(false)
    if (error) {
      push(error.message, 'error')
    } else {
      push('Customer updated successfully')
      setEditingCustomer(null)
      loadCustomers()
    }
  }

  const handleDeleteConfirm = async () => {
    setBusy(true)
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', deletingCustomer.id)
    
    setBusy(false)
    if (error) {
      push(error.message, 'error')
    } else {
      push('Customer deleted successfully')
      setDeletingCustomer(null)
      loadCustomers()
    }
  }

  const viewHistory = async (customer) => {
    setSelectedCustomer(customer)
    setLedgerHistory(null)
    const { data, error } = await supabase
      .from('customer_ledger')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (error) {
      push(error.message, 'error')
    } else {
      setLedgerHistory(data || [])
    }
  }

  const handlePrint = async (targetCustomerIds) => {
    if (targetCustomerIds.length === 0) return
    setPrinting(true)

    try {
      // Fetch all ledger transactions for target customers in chronological order
      const { data: ledgerItems, error } = await supabase
        .from('customer_ledger')
        .select('*')
        .in('customer_id', targetCustomerIds)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Map each customer with their respective ledger records
      const printData = targetCustomerIds.map((id) => {
        const customer = customers.find((c) => c.id === id)
        const items = (ledgerItems || []).filter((item) => item.customer_id === id)
        return { customer, ledgerItems: items }
      })

      printLedgerStatements(printData, store)
      push(`Sent ${targetCustomerIds.length} statement(s) to printer`)
    } catch (err) {
      push(err.message || 'Printing failed', 'error')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Udhaar Ledgers</h1>
          <p className="text-sm text-slate-500">Track outstanding balances and print statements</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handlePrint(selectedIds)}
            disabled={selectedIds.length === 0 || printing}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={16} />
            {printing ? 'Preparing...' : `Print Selected (${selectedIds.length})`}
          </button>
          <button
            onClick={() => handlePrint(filtered.filter(c => (c.balance || 0) > 0).map(c => c.id))}
            disabled={filtered.filter(c => (c.balance || 0) > 0).length === 0 || printing}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Printer size={16} />
            Print All Outstanding ({filtered.filter(c => (c.balance || 0) > 0).length})
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="relative mb-4 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Search customer name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={BookOpen} title="No customers found" subtitle="Only customers with accounts are listed here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-center w-12">
                    <button
                      onClick={toggleSelectAll}
                      className="text-slate-500 hover:text-slate-700 focus:outline-none"
                    >
                      {selectedIds.length === filtered.length ? (
                        <CheckSquare size={18} className="text-accent-600" />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 text-right font-semibold">Outstanding Balance</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const isSelected = selectedIds.includes(c.id)
                  const hasBalance = (c.balance || 0) > 0
                  return (
                    <tr
                      key={c.id}
                      className={`border-t border-slate-100 transition-colors hover:bg-slate-50/60 ${
                        isSelected ? 'bg-accent-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleSelect(c.id)}
                          className="text-slate-500 hover:text-slate-700 focus:outline-none"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-accent-600" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{c.name}</td>
                      <td className="px-4 py-3 text-slate-500">{c.phone || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold text-sm ${hasBalance ? 'text-rose-600' : 'text-slate-500'}`}>
                          {fmtMoney(c.balance || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => viewHistory(c)}
                            className="btn-secondary px-2 py-1.5 text-xs inline-flex items-center gap-1.5"
                          >
                            <BookOpen size={13} /> View History
                          </button>
                          <button
                            onClick={() => handlePrint([c.id])}
                            className="btn-secondary px-2 py-1.5 text-xs inline-flex items-center gap-1.5 mr-2"
                          >
                            <Printer size={13} /> Print
                          </button>
                          <button 
                            onClick={() => { 
                              setEditingCustomer(c); 
                              setEditForm({ name: c.name, phone: c.phone || '', email: c.email || '', notes: c.notes || '' });
                            }} 
                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-accent-600"
                            title="Edit Customer"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => setDeletingCustomer(c)} 
                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-500"
                            title="Delete Customer"
                          >
                            <Trash2 size={16} />
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

      <Modal open={!!selectedCustomer} onClose={() => setSelectedCustomer(null)} title={`${selectedCustomer?.name} - Ledger History`} size="lg">
        {selectedCustomer && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {ledgerHistory === null ? (
              <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600" /></div>
            ) : ledgerHistory.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No transactions recorded in ledger</p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-left text-sm relative">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 sticky top-0 shadow-sm">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Date</th>
                      <th className="px-4 py-2 font-semibold">Description</th>
                      <th className="px-4 py-2 text-right font-semibold">Debit (+)</th>
                      <th className="px-4 py-2 text-right font-semibold">Credit (-)</th>
                      <th className="px-4 py-2 text-right font-semibold">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerHistory.map((l) => (
                      <tr key={l.id} className="border-t border-slate-100 text-slate-700 hover:bg-slate-50">
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
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Customer Modal */}
      <Modal open={!!editingCustomer} onClose={() => setEditingCustomer(null)} title="Edit Customer">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Full Name *</label>
            <input
              required
              className="input"
              placeholder="e.g. John Doe"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Phone</label>
            <input
              type="tel"
              className="input"
              placeholder="e.g. 0300-1234567"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email (Optional)</label>
            <input
              type="email"
              className="input"
              placeholder="e.g. john@example.com"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Notes (Optional)</label>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="Any additional details..."
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditingCustomer(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Customer Modal */}
      <Modal open={!!deletingCustomer} onClose={() => setDeletingCustomer(null)} title="Delete Customer" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <strong>{deletingCustomer?.name}</strong>? 
            This will permanently remove the customer record.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setDeletingCustomer(null)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleDeleteConfirm} disabled={busy} className="btn-danger">
              {busy ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
