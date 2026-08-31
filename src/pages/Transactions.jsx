import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Search, Printer, Calendar, RefreshCw, XCircle, ArrowLeftCircle, User, Banknote, Clock, HelpCircle, Edit, Trash2, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { fmtMoney, fmtDateTime } from '../lib/format'
import { printReceipt, useReceiptStore, printReceipts } from '../lib/receipt'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { CheckSquare, Square } from 'lucide-react'
import Checkout from './Checkout'
import { useCart } from '../context/CartContext'

export default function Transactions() {
  const { push } = useToast()
  const { isAdmin } = useAuth()
  const store = useReceiptStore()
  const cart = useCart()

  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isAddingNew, setIsAddingNew] = useState(false)
  
  // Pre-checkout states
  const [preCheckoutOpen, setPreCheckoutOpen] = useState(false)
  const [customers, setCustomers] = useState([])
  const [preCustomer, setPreCustomer] = useState('')
  const [preDate, setPreDate] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [custSearch, setCustSearch] = useState('')
  
  // New Customer states
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [newCustForm, setNewCustForm] = useState({ name: '', phone: '', email: '' })
  const [custBusy, setCustBusy] = useState(false)
  
  const [selectedTxn, setSelectedTxn] = useState(null)
  const [txnItems, setTxnItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [editingTxn, setEditingTxn] = useState(null)
  const [editForm, setEditForm] = useState({ created_at: '', payment_method: 'cash' })
  const [editBusy, setEditBusy] = useState(false)
  const [deletingTxn, setDeletingTxn] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [filterType, setFilterType] = useState('all') // 'all' | 'completed' | 'voided'
  const [selectedIds, setSelectedIds] = useState([])
  const [printing, setPrinting] = useState(false)

  const loadTransactions = async () => {
    setLoading(true)
    let query = supabase
      .from('transactions')
      .select('*, cashier:profiles!transactions_cashier_id_fkey(full_name), customer:customers(*)')
      .order('created_at', { ascending: false })

    if (filterType === 'completed') {
      query = query.eq('status', 'completed')
    } else if (filterType === 'voided') {
      query = query.eq('status', 'voided')
    }

    const { data, error } = await query

    if (error) {
      push(error.message, 'error')
    } else {
      setTxns(data || [])
    }
    setLoading(false)
  }

  const openPreCheckout = async () => {
    setPreCustomer('')
    setPreDate('')
    setPreCheckoutOpen(true)
    const { data } = await supabase.from('customers').select('*').order('name')
    if (data) setCustomers(data)
  }

  const handlePreCheckoutSubmit = (e) => {
    e.preventDefault()
    if (preCustomer === 'walkin') {
      cart.setCustomer(null)
    } else if (preCustomer) {
      const c = customers.find(x => x.id === preCustomer)
      if (c) cart.setCustomer(c)
    } else {
      push('Please select a customer or Walk-in', 'error')
      return
    }
    
    setPreCheckoutOpen(false)
    setIsAddingNew(true)
  }

  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    if (!newCustForm.name.trim()) return
    setCustBusy(true)
    const { data, error } = await supabase
      .from('customers')
      .insert({ name: newCustForm.name.trim(), phone: newCustForm.phone.trim(), email: newCustForm.email.trim() })
      .select()
      .single()
    
    setCustBusy(false)
    if (error) {
      push(error.message, 'error')
      return
    }
    
    push('Customer added successfully')
    setCreatingCustomer(false)
    setNewCustForm({ name: '', phone: '', email: '' })
    
    // Refresh customers and auto-select new one
    const res = await supabase.from('customers').select('*').order('name')
    if (res.data) setCustomers(res.data)
    setPreCustomer(data.id)
  }

  useEffect(() => {
    loadTransactions()
  }, [filterType])

  useEffect(() => {
    if (editingTxn) {
      setEditForm({
        created_at: editingTxn.created_at ? editingTxn.created_at.slice(0, 16) : '',
        payment_method: editingTxn.payment_method || 'cash'
      })
    }
  }, [editingTxn])

  const filtered = txns.filter(t =>
    t.receipt_number.toLowerCase().includes(search.trim().toLowerCase()) ||
    (t.customer?.name || '').toLowerCase().includes(search.trim().toLowerCase())
  )

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map(t => t.id))
    }
  }

  const handleBulkPrint = async () => {
    if (selectedIds.length === 0) return
    setPrinting(true)
    try {
      const { data: allItems, error } = await supabase
        .from('transaction_items')
        .select('*')
        .in('transaction_id', selectedIds)
        .order('id')
      
      if (error) throw error

      const bulkData = selectedIds.map(id => {
        const txn = txns.find(t => t.id === id)
        const items = (allItems || []).filter(item => item.transaction_id === id)
        return { txn, items }
      })

      printReceipts(bulkData, store)
      push(`Sent ${selectedIds.length} invoice(s) to printer`)
    } catch (err) {
      push(err.message || 'Printing failed', 'error')
    } finally {
      setPrinting(false)
    }
  }

  const viewDetails = async (txn) => {
    setSelectedTxn(txn)
    setItemsLoading(true)
    setVoidReason('')
    const { data, error } = await supabase
      .from('transaction_items')
      .select('*')
      .eq('transaction_id', txn.id)
      .order('id')

    if (error) {
      push(error.message, 'error')
      setTxnItems([])
    } else {
      setTxnItems(data || [])
    }
    setItemsLoading(false)
  }

  const handlePrint = (txn, items) => {
    printReceipt(txn, items, store)
  }

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      push('Please enter a reason for voiding this transaction', 'error')
      return
    }
    setVoiding(true)
    const { error } = await supabase.rpc('void_transaction', {
      p_txn_id: selectedTxn.id,
      p_reason: voidReason.trim()
    })

    setVoiding(false)
    if (error) {
      push(error.message, 'error')
    } else {
      push('Transaction voided successfully')
      // Update local state for view
      setSelectedTxn(prev => ({
        ...prev,
        status: 'voided',
        void_reason: voidReason.trim(),
        voided_at: new Date().toISOString()
      }))
      loadTransactions()
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditBusy(true)
    const { error } = await supabase
      .from('transactions')
      .update({
        created_at: new Date(editForm.created_at).toISOString(),
        payment_method: editForm.payment_method
      })
      .eq('id', editingTxn.id)

    setEditBusy(false)
    if (error) {
      push(error.message, 'error')
    } else {
      push('Transaction updated successfully')
      setEditingTxn(null)
      loadTransactions()
    }
  }

  const handleDeleteConfirm = async () => {
    setDeleteBusy(true)
    const { error } = await supabase.from('transactions').delete().eq('id', deletingTxn.id)
    setDeleteBusy(false)
    if (error) {
      push(error.message, 'error')
    } else {
      push('Transaction deleted permanently')
      setDeletingTxn(null)
      loadTransactions()
    }
  }


  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Invoices & Bills</h1>
          <p className="text-sm text-slate-500">{txns.length} transactions stored</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={openPreCheckout} className="btn-primary text-sm shadow-sm hover:shadow">
            <Plus size={16} /> Add New Bill
          </button>
          <button
            onClick={handleBulkPrint}
            disabled={selectedIds.length === 0 || printing}
            className="btn-primary py-1.5 px-3 text-xs inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={14} /> {printing ? 'Printing...' : `Bulk Print (${selectedIds.length})`}
          </button>
          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setFilterType('all')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                filterType === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('completed')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                filterType === 'completed' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setFilterType('voided')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                filterType === 'voided' ? 'bg-white shadow-sm text-rose-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Voided
            </button>
          </div>
        </div>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Search receipt number or customer..."
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
          <EmptyState icon={FileText} title="No invoices found" subtitle="Complete transactions in Checkout to see them here." />
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
                      {selectedIds.length === filtered.length && filtered.length > 0 ? (
                        <CheckSquare size={18} className="text-accent-600" />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">Receipt No</th>
                  <th className="px-4 py-3 font-semibold">Date & Time</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Amount</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const isSelected = selectedIds.includes(t.id)
                  return (
                    <tr
                      key={t.id}
                      className={`border-t border-slate-100 transition-colors hover:bg-slate-50/60 ${
                        isSelected ? 'bg-accent-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleSelect(t.id)}
                          className="text-slate-500 hover:text-slate-700 focus:outline-none"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-accent-600" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{t.receipt_number}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDateTime(t.created_at)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{t.customer?.name || 'Walk-in Guest'}</td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-slate-600 font-semibold">{t.payment_method}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{fmtMoney(t.total)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={t.status === 'completed' ? 'success' : 'danger'}>
                          {t.status === 'completed' ? 'Completed' : 'Voided'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => viewDetails(t)}
                            className="btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                            title="View Invoice"
                          >
                            <FileText size={13} /> View Invoice
                          </button>
                          <button
                            onClick={() => setEditingTxn(t)}
                            className="btn-secondary px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => setDeletingTxn(t)}
                            className="btn-secondary px-2 py-1.5 text-xs text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 size={14} />
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

      {/* Invoice Detail modal */}
      <Modal open={!!selectedTxn} onClose={() => setSelectedTxn(null)} title={`Invoice ${selectedTxn?.receipt_number}`} size="md">
        {selectedTxn && (
          <div className="space-y-4">
            {/* Header Details */}
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-xs">
              <div>
                <p className="text-slate-400 font-semibold">Cashier</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedTxn.cashier?.full_name || 'Admin'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold">Date</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{fmtDateTime(selectedTxn.created_at)}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold">Customer</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedTxn.customer?.name || 'Walk-in Guest'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold">Payment Method</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5 uppercase">{selectedTxn.payment_method}</p>
              </div>
            </div>

            {/* Items table */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Invoice Items</p>
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-100 bg-white">
                {itemsLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600" />
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2 text-center">Qty</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txnItems.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-700">
                            <div>{item.product_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.sku}</div>
                          </td>
                          <td className="px-3 py-2 text-center text-slate-600">{item.quantity}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{fmtMoney(item.unit_price)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtMoney(item.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Subtotal, discount, grand total */}
            <div className="flex flex-col items-end gap-1.5 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between w-60 text-slate-500">
                <span>Subtotal</span>
                <span>{fmtMoney(selectedTxn.subtotal)}</span>
              </div>
              {selectedTxn.discount > 0 && (
                <div className="flex justify-between w-60 text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span>-{fmtMoney(selectedTxn.discount)}</span>
                </div>
              )}
              {selectedTxn.tax > 0 && (
                <div className="flex justify-between w-60 text-slate-500">
                  <span>Tax</span>
                  <span>{fmtMoney(selectedTxn.tax)}</span>
                </div>
              )}
              <div className="flex justify-between w-60 text-base font-bold text-slate-800 border-t border-slate-200 pt-1.5 mt-1">
                <span>Grand Total</span>
                <span>{fmtMoney(selectedTxn.total)}</span>
              </div>
            </div>

            {/* Print and Actions */}
            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => handlePrint(selectedTxn, txnItems)}
                className="btn-primary py-2.5 inline-flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Print Receipt
              </button>
              <button
                type="button"
                onClick={() => setSelectedTxn(null)}
                className="btn-secondary py-2.5"
              >
                Close
              </button>
            </div>

            {/* Voiding segment for Admins */}
            {isAdmin && selectedTxn.status === 'completed' && (
              <div className="border-t border-red-100 bg-red-50/40 rounded-xl p-4 mt-4">
                <p className="text-xs font-bold text-red-700 flex items-center gap-1">
                  <XCircle size={14} /> Void / Cancel Transaction
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Voiding will restore all product items back into the inventory stock.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    className="input text-xs py-1.5 h-8 bg-white border-red-200"
                    placeholder="Enter reason for voiding..."
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                  />
                  <button
                    onClick={handleVoid}
                    disabled={voiding || !voidReason.trim()}
                    className="btn bg-red-600 text-white hover:bg-red-700 h-8 py-0 px-3 text-xs font-bold shrink-0 disabled:opacity-50"
                  >
                    {voiding ? 'Voiding...' : 'Void Sale'}
                  </button>
                </div>
              </div>
            )}

            {/* Voided Details */}
            {selectedTxn.status === 'voided' && (
              <div className="border-t border-slate-100 bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
                <p className="font-bold text-red-600">VOIDED TRANSACTION</p>
                <p className="mt-1"><strong>Void reason:</strong> "{selectedTxn.void_reason}"</p>
                {selectedTxn.voided_at && <p className="mt-0.5"><strong>Voided at:</strong> {fmtDateTime(selectedTxn.voided_at)}</p>}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editingTxn} onClose={() => setEditingTxn(null)} title="Edit Transaction" size="sm">
        {editingTxn && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="label">Date & Time</label>
              <input
                type="datetime-local"
                className="input"
                value={editForm.created_at}
                onChange={(e) => setEditForm({ ...editForm, created_at: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select
                className="input"
                value={editForm.payment_method}
                onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                required
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit">Credit / Udhaar</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setEditingTxn(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={editBusy} className="btn-primary">
                {editBusy ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deletingTxn} onClose={() => setDeletingTxn(null)} title="Delete Transaction" size="sm">
        {deletingTxn && (
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 p-4 border border-red-100">
              <p className="text-sm text-red-800 font-semibold mb-1 flex items-center gap-2">
                <Trash2 size={16} /> Delete Permanently?
              </p>
              <p className="text-xs text-red-700">
                You are about to permanently delete Receipt <strong>{deletingTxn.receipt_number}</strong>.
                This action cannot be undone. 
                <br /><br />
                <strong>Note:</strong> Deleting will NOT restore inventory items. If you need to restore stock, you should Void the transaction instead of deleting it.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setDeletingTxn(null)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleDeleteConfirm} disabled={deleteBusy} className="btn-danger">
                {deleteBusy ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Pre-Checkout Modal */}
      <Modal open={preCheckoutOpen} onClose={() => setPreCheckoutOpen(false)} title="Start New Bill" size="sm">
        <form onSubmit={handlePreCheckoutSubmit} className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">Select Customer</label>
              <button
                type="button"
                onClick={() => setCreatingCustomer(true)}
                className="text-xs font-semibold text-accent-600 hover:text-accent-700 flex items-center gap-1"
              >
                <Plus size={12} /> New
              </button>
            </div>
            
            <div className="relative">
              <div 
                className="input flex items-center justify-between cursor-pointer"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span className={preCustomer ? 'text-slate-900' : 'text-slate-500'}>
                  {preCustomer === 'walkin' 
                    ? '-- Walk-in (No Customer) --' 
                    : preCustomer 
                      ? customers.find(c => c.id === preCustomer)?.name || 'Select a customer...'
                      : 'Select a customer...'}
                </span>
                <Search size={14} className="text-slate-400" />
              </div>
              
              {dropdownOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
                  <div className="p-2 border-b border-slate-100">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search customers..."
                      className="w-full rounded bg-slate-50 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent-500"
                      value={custSearch}
                      onChange={(e) => setCustSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1">
                    <div 
                      className={`cursor-pointer rounded px-3 py-2 text-sm hover:bg-slate-50 ${preCustomer === 'walkin' ? 'bg-accent-50 text-accent-700 font-medium' : 'text-slate-700'}`}
                      onClick={() => { setPreCustomer('walkin'); setDropdownOpen(false); }}
                    >
                      -- Walk-in (No Customer) --
                    </div>
                    {customers
                      .filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone?.includes(custSearch))
                      .map(c => (
                        <div
                          key={c.id}
                          className={`cursor-pointer rounded px-3 py-2 text-sm hover:bg-slate-50 ${preCustomer === c.id ? 'bg-accent-50 text-accent-700 font-medium' : 'text-slate-700'}`}
                          onClick={() => { setPreCustomer(c.id); setDropdownOpen(false); }}
                        >
                          {c.name} {c.phone ? `(${c.phone})` : ''}
                        </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Custom Date (Optional)</label>
            <input
              type="datetime-local"
              className="input"
              value={preDate}
              onChange={(e) => setPreDate(e.target.value)}
              title="Leave empty for current time"
            />
            <p className="mt-1 text-xs text-slate-500">Purani date ka bill banana ho to select karein.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setPreCheckoutOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Continue to Bill</button>
          </div>
        </form>
      </Modal>

      {/* New Customer Modal */}
      <Modal open={creatingCustomer} onClose={() => setCreatingCustomer(false)} title="New Customer" size="sm">
        <form onSubmit={handleCreateCustomer} className="space-y-4">
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
            <button type="button" onClick={() => setCreatingCustomer(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={custBusy} className="btn-primary">
              {custBusy ? 'Saving...' : 'Add Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Checkout Modal */}
      <Modal open={isAddingNew} onClose={() => { setIsAddingNew(false); loadTransactions(); }} title="Create New Bill" size="full">
        <div className="h-[75vh] -mx-5 -my-4 relative overflow-hidden bg-slate-50">
          <Checkout initialDate={preDate} />
        </div>
      </Modal>
    </div>
  )
}
