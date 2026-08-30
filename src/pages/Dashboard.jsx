import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, TrendingUp, Package, AlertTriangle, ShoppingCart, ArrowRight } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useProducts } from '../context/ProductContext'
import { fmtMoney } from '../lib/format'

function kpi(label, value, Icon, sub) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-xl font-bold text-slate-800 tracking-tight break-words">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { products, lowStock } = useProducts()
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', since.toISOString())
        .order('created_at')
      if (mounted) {
        setTxns(data || [])
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const stats = useMemo(() => {
    const today = new Date().toDateString()
    const completed = txns.filter((t) => t.status === 'completed')

    const totalRevenue = completed.reduce((s, t) => s + Number(t.total), 0)
    const todayRevenue = completed
      .filter((t) => new Date(t.created_at).toDateString() === today)
      .reduce((s, t) => s + Number(t.total), 0)
    const txnCount = completed.length
    const avgSale = txnCount ? totalRevenue / txnCount : 0

    // Daily buckets for the last 14 days
    const days = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toDateString()
      const dayTotal = completed.filter((t) => new Date(t.created_at).toDateString() === key).reduce((s, t) => s + Number(t.total), 0)
      days.push({ label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), sales: Math.round(dayTotal * 100) / 100 })
    }

    const inventoryValue = products.reduce((s, p) => s + p.quantity_on_hand * Number(p.cost_price), 0)

    // Best sellers by units
    return { totalRevenue, todayRevenue, txnCount, avgSale, days, inventoryValue }
  }, [txns, products])

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">Store overview — last 30 days</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600" /></div>
      ) : (
        <>
          {/* Low Stock/Out of Stock Warning Banner */}
          {(products.filter(p => p.quantity_on_hand <= 0).length > 0 || lowStock.length > 0) && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              <AlertTriangle className="shrink-0 text-red-500" size={20} />
              <div className="flex-1 text-sm font-semibold">
                Warning: You have {products.filter(p => p.quantity_on_hand <= 0).length > 0 && <span>{products.filter(p => p.quantity_on_hand <= 0).length} items out of stock</span>}
                {products.filter(p => p.quantity_on_hand <= 0).length > 0 && (lowStock.length - products.filter(p => p.quantity_on_hand <= 0).length) > 0 && ' and '}
                {(lowStock.length - products.filter(p => p.quantity_on_hand <= 0).length) > 0 && <span>{(lowStock.length - products.filter(p => p.quantity_on_hand <= 0).length)} items running low on stock</span>}. Please restock soon.
              </div>
              <Link to="/products" className="text-xs font-bold uppercase tracking-wider text-red-700 hover:underline shrink-0">
                Manage Stock
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpi('Revenue (30d)', fmtMoney(stats.totalRevenue), Banknote, `${stats.txnCount} transactions`)}
            {kpi('Today', fmtMoney(stats.todayRevenue), TrendingUp, 'so far')}
            {kpi('Avg sale', fmtMoney(stats.avgSale), ShoppingCart, 'per transaction')}
            {kpi('Inventory value', fmtMoney(stats.inventoryValue), Package, `${products.length} products`)}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* Sales chart */}
            <div className="card p-5 xl:col-span-2">
              <h3 className="mb-4 text-sm font-bold text-slate-700">Sales — last 14 days</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.days}>
                    <defs>
                      <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `PKR ${v}`} width={90} />
                    <Tooltip formatter={(v) => fmtMoney(v)} labelStyle={{ fontWeight: 600 }} />
                    <Area type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={2} fill="url(#sales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Low stock widget */}
            <div className="card flex flex-col p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">Low stock</h3>
                <Link to="/products" className="inline-flex items-center gap-1 text-xs font-semibold text-accent-600 hover:text-accent-700">
                  View all <ArrowRight size={13} />
                </Link>
              </div>
              {lowStock.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Package size={20} /></div>
                  <p className="text-sm font-medium text-slate-600">All stock levels healthy</p>
                </div>
              ) : (
                <div className="max-h-72 flex-1 space-y-2 overflow-y-auto pr-1">
                  {lowStock.slice(0, 8).map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2">
                      <AlertTriangle size={16} className="shrink-0 text-amber-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-700">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.sku}</p>
                      </div>
                      <span className={`shrink-0 text-sm font-bold ${p.quantity_on_hand <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {p.quantity_on_hand} left
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
