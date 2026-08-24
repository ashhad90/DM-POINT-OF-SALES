import { useEffect, useMemo, useState } from 'react'
import {
  DollarSign, ShoppingBag, TrendingUp, Package, AlertTriangle, BarChart3, Calendar
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useProducts } from '../context/ProductContext'
import { fmtMoney, fmtDate } from '../lib/format'

const PIE_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b']

const periods = {
  week: { label: 'Last 7 days', days: 7 },
  month: { label: 'Last 30 days', days: 30 },
  quarter: { label: 'Last 90 days', days: 90 }
}

export default function Reports() {
  const { products, lowStock, categories } = useProducts()
  const [period, setPeriod] = useState('month')
  const [txns, setTxns] = useState([])
  const [items, setItems] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const since = new Date()
      since.setDate(since.getDate() - periods[period].days)
      const { data: txnData } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', since.toISOString())
        .order('created_at')

      const { data: expData } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', since.toISOString().split('T')[0])
        .order('date')

      if (mounted) {
        setTxns(txnData || [])
        setExpenses(expData || [])
        const { data: ti } = await supabase.from('transaction_items').select('*')
        setItems(ti || [])
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [period])

  const stats = useMemo(() => {
    const completed = txns.filter((t) => t.status === 'completed')
    const revenue = completed.reduce((s, t) => s + Number(t.total), 0)
    const avg = completed.length ? revenue / completed.length : 0

    // COGS calculation
    const productCostMap = new Map(products.map(p => [p.id, Number(p.cost_price)]))
    const txnIds = new Set(completed.map(t => t.id))
    let cogs = 0
    for (const it of items) {
      if (txnIds.has(it.transaction_id)) {
        const cost = productCostMap.get(it.product_id) || 0
        cogs += cost * it.quantity
      }
    }

    const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const netProfit = revenue - cogs - expensesTotal

    // Daily breakdown
    const dailyBreakdown = []
    const daysToTrack = periods[period].days
    for (let i = daysToTrack - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dayStr = d.toDateString()
      const dateKey = d.toISOString().split('T')[0]

      const dayTxns = completed.filter((t) => new Date(t.created_at).toDateString() === dayStr)
      const dayRevenue = dayTxns.reduce((s, t) => s + Number(t.total), 0)

      const dayTxnIds = new Set(dayTxns.map((t) => t.id))
      let dayCOGS = 0
      for (const it of items) {
        if (dayTxnIds.has(it.transaction_id)) {
          const cost = productCostMap.get(it.product_id) || 0
          dayCOGS += cost * it.quantity
        }
      }

      const dayExpenses = expenses
        .filter((e) => e.date === dateKey)
        .reduce((s, e) => s + Number(e.amount), 0)

      const dayProfit = dayRevenue - dayCOGS - dayExpenses
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      dailyBreakdown.push({
        label,
        revenue: Math.round(dayRevenue * 100) / 100,
        expenses: Math.round(dayExpenses * 100) / 100,
        profit: Math.round(dayProfit * 100) / 100
      })
    }

    return { revenue, avg, count: completed.length, cogs, expensesTotal, netProfit, dailyBreakdown }
  }, [txns, items, expenses, products, period])

  const bestSellers = useMemo(() => {
    const txnIds = new Set(txns.filter((t) => t.status === 'completed').map((t) => t.id))
    const map = new Map()
    for (const it of items) {
      if (!txnIds.has(it.transaction_id) || it.quantity <= 0) continue
      const cur = map.get(it.product_name) || { name: it.product_name, units: 0, revenue: 0 }
      cur.units += it.quantity
      cur.revenue += Number(it.line_total)
      map.set(it.product_name, cur)
    }
    return [...map.values()].sort((a, b) => b.units - a.units).slice(0, 8)
  }, [txns, items])

  const byCategory = useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.id, c.name]))
    const prodCat = new Map(products.map((p) => [p.id, catMap.get(p.category_id) || 'Uncategorized']))
    const txnIds = new Set(txns.filter((t) => t.status === 'completed').map((t) => t.id))
    const map = new Map()
    for (const it of items) {
      if (!txnIds.has(it.transaction_id) || it.quantity <= 0) continue
      const name = prodCat.get(it.product_id) || 'Uncategorized'
      map.set(name, (map.get(name) || 0) + Number(it.line_total))
    }
    return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value)
  }, [txns, items, products, categories])

  const inventoryValue = products.reduce((s, p) => s + p.quantity_on_hand * Number(p.cost_price), 0)

  const periodLabel = periods[period].label

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
          <p className="text-sm text-slate-500">{periodLabel}</p>
        </div>
        <div className="flex gap-2">
          {Object.entries(periods).map(([key, p]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                period === key ? 'bg-accent-600 text-white' : 'bg-white text-slate-600 shadow-sm hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600" /></div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="card flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600"><DollarSign size={22} /></div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Revenue</p>
                <p className="text-2xl font-bold text-slate-800">{fmtMoney(stats.revenue)}</p>
              </div>
            </div>
            <div className="card flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><TrendingUp size={22} /></div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Cost of Goods (COGS)</p>
                <p className="text-2xl font-bold text-slate-800">{fmtMoney(stats.cogs)}</p>
              </div>
            </div>
            <div className="card flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><ShoppingBag size={22} /></div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Total Expenses</p>
                <p className="text-2xl font-bold text-amber-600">{fmtMoney(stats.expensesTotal)}</p>
              </div>
            </div>
            <div className="card flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><DollarSign size={22} /></div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Net Profit</p>
                <p className={`text-2xl font-bold ${stats.netProfit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {fmtMoney(stats.netProfit)}
                </p>
              </div>
            </div>
          </div>

          {/* Profit & Loss Breakdown Trend */}
          <div className="card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
              <BarChart3 size={16} /> Profit & Loss Breakdown
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.dailyBreakdown} margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `PKR ${v}`} width={75} />
                  <Tooltip formatter={(v) => fmtMoney(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" fill="#4f46e5" name="Revenue" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#f59e0b" name="Expenses" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" fill="#10b981" name="Net Profit" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* Best sellers */}
            <div className="card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700"><BarChart3 size={16} /> Best-selling products</h3>
              {bestSellers.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No sales in this period</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bestSellers} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v) => `${v} units`} />
                      <Bar dataKey="units" fill="#4f46e5" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Sales by category */}
            <div className="card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700"><PieChart size={16} /> Sales by category</h3>
              {byCategory.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No sales in this period</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                        {byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmtMoney(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Low stock report */}
          <div className="card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
              <AlertTriangle size={16} className="text-amber-500" /> Low-stock report
              <span className="ml-auto text-xs font-semibold text-slate-400">Generated {fmtDate(new Date())}</span>
            </h3>
            {lowStock.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No products below their reorder threshold 🎉</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Product</th>
                      <th className="px-4 py-2.5 font-semibold">SKU</th>
                      <th className="px-4 py-2.5 font-semibold">Category</th>
                      <th className="px-4 py-2.5 text-right font-semibold">On hand</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Threshold</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Value at cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{p.name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{p.sku}</td>
                        <td className="px-4 py-2.5 text-slate-600">{categories.find((c) => c.id === p.category_id)?.name || '—'}</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${p.quantity_on_hand <= 0 ? 'text-red-600' : 'text-amber-600'}`}>{p.quantity_on_hand}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{p.reorder_threshold}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{fmtMoney(p.quantity_on_hand * Number(p.cost_price))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
