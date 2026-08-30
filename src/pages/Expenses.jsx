import { useEffect, useState, useMemo } from 'react'
import { Plus, Trash2, Calendar, Filter, Receipt, Banknote, Briefcase, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fmtMoney, fmtDate } from '../lib/format'
import Modal from '../components/ui/Modal'

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('month') // 'week', 'month', 'all'

  // Form State
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('other')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [error, setError] = useState('')
  const [totalUdhaar, setTotalUdhaar] = useState(0)

  useEffect(() => {
    supabase.from('customers').select('balance').then(({ data }) => {
      if (data) {
        setTotalUdhaar(data.reduce((sum, c) => sum + (c.balance > 0 ? Number(c.balance) : 0), 0))
      }
    })
  }, [])

  const loadExpenses = async () => {
    setLoading(true)
    let query = supabase.from('expenses').select('*')

    // Apply date filter
    if (dateFilter !== 'all') {
      const since = new Date()
      since.setDate(since.getDate() - (dateFilter === 'week' ? 7 : 30))
      query = query.gte('date', since.toISOString().split('T')[0])
    }

    const { data, error: err } = await query.order('date', { ascending: false })

    if (!err && data) {
      setExpenses(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadExpenses()
  }, [dateFilter])

  const filteredExpenses = useMemo(() => {
    if (categoryFilter === 'all') return expenses
    return expenses.filter(e => e.category === categoryFilter)
  }, [expenses, categoryFilter])

  const stats = useMemo(() => {
    let total = 0
    let rent = 0
    let utilities = 0
    let salaries = 0
    let other = 0

    for (const e of filteredExpenses) {
      const amt = Number(e.amount)
      total += amt
      if (e.category === 'rent') rent += amt
      else if (e.category === 'utilities') utilities += amt
      else if (e.category === 'salaries') salaries += amt
      else other += amt
    }

    return { total, rent, utilities, salaries, other }
  }, [filteredExpenses])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!description.trim() || !amount || Number(amount) < 0) {
      setError('Please fill all fields with valid data.')
      return
    }
    setError('')
    setSubmitting(true)

    const { error: err } = await supabase.from('expenses').insert({
      description: description.trim(),
      amount: Number(amount),
      category,
      date
    })

    setSubmitting(false)
    if (err) {
      setError(err.message)
    } else {
      setIsModalOpen(false)
      setDescription('')
      setAmount('')
      setCategory('other')
      setDate(new Date().toISOString().split('T')[0])
      loadExpenses()
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this expense?')) return
    const { error: err } = await supabase.from('expenses').delete().eq('id', id)
    if (!err) {
      loadExpenses()
    }
  }

  const categoryIcons = {
    rent: <Briefcase className="text-blue-500" size={16} />,
    utilities: <Zap className="text-amber-500" size={16} />,
    salaries: <Banknote className="text-emerald-500" size={16} />,
    other: <Receipt className="text-slate-500" size={16} />
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Expenses Tracker</h1>
          <p className="text-sm text-slate-500">Track and manage store expenditures</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <Plus size={18} /> Add Expense
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="card p-4">
          <p className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400">Total Udhaar</p>
          <p className="text-lg sm:text-xl font-bold text-red-500 tracking-tight break-words">{fmtMoney(totalUdhaar)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400">Total Expenses</p>
          <p className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight break-words">{fmtMoney(stats.total)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400">Rent</p>
          <p className="text-lg sm:text-xl font-bold text-blue-600 tracking-tight break-words">{fmtMoney(stats.rent)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400">Utilities</p>
          <p className="text-lg sm:text-xl font-bold text-amber-600 tracking-tight break-words">{fmtMoney(stats.utilities)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400">Salaries</p>
          <p className="text-lg sm:text-xl font-bold text-emerald-600 tracking-tight break-words">{fmtMoney(stats.salaries)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400">Other</p>
          <p className="text-lg sm:text-xl font-bold text-slate-600 tracking-tight break-words">{fmtMoney(stats.other)}</p>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <h3 className="text-sm font-bold text-slate-700">Expenses Log</h3>
          <div className="flex flex-wrap items-center gap-3">
            {/* Date filter */}
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-slate-400" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="rounded-lg border-slate-200 py-1 pl-2 pr-8 text-xs font-semibold text-slate-600 focus:border-accent-500 focus:ring-accent-500"
              >
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>
            {/* Category filter */}
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-slate-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border-slate-200 py-1 pl-2 pr-8 text-xs font-semibold text-slate-600 focus:border-accent-500 focus:ring-accent-500"
              >
                <option value="all">All Categories</option>
                <option value="rent">Rent</option>
                <option value="utilities">Utilities</option>
                <option value="salaries">Salaries</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">No expenses recorded matching the criteria.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Category</th>
                  <th className="px-4 py-2.5 font-semibold">Description</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th className="w-10 px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-600">{fmtDate(e.date)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-700">
                        {categoryIcons[e.category] || categoryIcons.other}
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{e.description}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{fmtMoney(e.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="text-slate-400 hover:text-red-600"
                        title="Delete expense"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Store Expense"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</div>}

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border-slate-200 shadow-sm focus:border-accent-500 focus:ring-accent-500"
            >
              <option value="rent">Rent</option>
              <option value="utilities">Utilities</option>
              <option value="salaries">Salaries</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Description</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Electricity bill July, Shop Rent, etc."
              className="w-full rounded-lg border-slate-200 shadow-sm focus:border-accent-500 focus:ring-accent-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Amount</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border-slate-200 shadow-sm focus:border-accent-500 focus:ring-accent-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border-slate-200 shadow-sm focus:border-accent-500 focus:ring-accent-500"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary inline-flex items-center gap-1"
            >
              {submitting ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
