import { useState } from 'react'
import { User, Search, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'

export default function CustomerSelect() {
  const { customer, setCustomer } = useCart()
  const { push } = useToast()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '' })

  const searchCustomers = async (q) => {
    setSearch(q)
    if (!q.trim()) {
      setResults([])
      return
    }
    const { data } = await supabase
      .from('customers')
      .select('*')
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8)
    setResults(data || [])
  }

  const createCustomer = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const { data, error } = await supabase
      .from('customers')
      .insert({ name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() })
      .select()
      .single()
    if (error) {
      push(error.message, 'error')
      return
    }
    setCustomer(data)
    setCreating(false)
    setForm({ name: '', phone: '', email: '' })
    setOpen(false)
    push('Customer added')
  }

  if (customer) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <User size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-700">{customer.name}</p>
          {customer.phone && <p className="truncate text-xs text-slate-400">{customer.phone}</p>}
        </div>
        <button
          onClick={() => setCustomer(null)}
          className="text-xs font-semibold text-slate-400 hover:text-slate-600"
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="btn-secondary w-full justify-start text-slate-500">
        <User size={16} /> Walk-in (no customer)
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-8"
                placeholder="Search name, phone, email…"
                value={search}
                onChange={(e) => searchCustomers(e.target.value)}
                autoFocus
              />
            </div>

            <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCustomer(c); setOpen(false) }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-slate-700">{c.name}</span>
                  <span className="ml-auto text-xs text-slate-400">{c.phone || c.email || ''}</span>
                </button>
              ))}
              {results.length === 0 && search.trim() && (
                <p className="px-2 py-2 text-sm text-slate-400">No customers match "{search}"</p>
              )}
            </div>

            <button
              onClick={() => { setCreating(true); setOpen(false) }}
              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-2 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
            >
              <Plus size={15} /> New customer
            </button>
          </div>
        </>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setCreating(false)} />
          <form onSubmit={createCustomer} className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">New customer</h3>
            <div className="mt-3 space-y-3">
              <input className="input" placeholder="Full name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
              <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="input" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Create & attach</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
