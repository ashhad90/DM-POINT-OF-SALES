import React, { useEffect, useMemo, useState } from 'react'
import { BookOpen, Search, Printer, CheckSquare, Square, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { fmtMoney } from '../lib/format'
import { printLedgerStatements, useReceiptStore } from '../lib/receipt'
import EmptyState from '../components/ui/EmptyState'

export default function Ledger() {
  const { push } = useToast()
  const store = useReceiptStore()

  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [printing, setPrinting] = useState(false)

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
                        <button
                          onClick={() => handlePrint([c.id])}
                          className="btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                        >
                          <Printer size={13} /> Print Statement
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
