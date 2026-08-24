import { useEffect, useState } from 'react'
import { Shield, Store, Users, Save, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Badge from '../components/ui/Badge'

export default function Settings() {
  const { profile } = useAuth()
  const { push } = useToast()

  // Store settings (localStorage, used by receipts)
  const [store, setStore] = useState({ store_name: '', address: '', phone: '', tax_label: 'Sales Tax', tax_rate: 0 })

  // User management
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('cashier')

  useEffect(() => {
    const raw = window.localStorage.getItem('pos_store_settings')
    if (raw) {
      try { setStore({ ...store, ...JSON.parse(raw) }) } catch { /* ignore */ }
    }
    loadUsers()
  }, [])

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setUsers(data || [])
    setLoadingUsers(false)
  }

  const saveStore = () => {
    window.localStorage.setItem('pos_store_settings', JSON.stringify(store))
    push('Store settings saved')
  }

  const changeRole = async (u, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', u.id)
    if (error) push(error.message, 'error')
    else {
      push(`${u.full_name || 'User'} is now ${role}`)
      loadUsers()
    }
  }

  const inviteUser = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    // Production note: use a Supabase Edge Function with the service role
    // key for true invites. This creates a user with a temporary password.
    const password = Math.random().toString(36).slice(2, 10)
    const { data, error } = await supabase.auth.signUp({
      email: inviteEmail.trim(),
      password,
      options: { data: { full_name: inviteName.trim(), role: inviteRole } }
    })
    if (error) {
      push(error.message, 'error')
      return
    }
    if (data?.user) {
      // Ensure profile row exists with the right role
      const { error: pErr } = await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: inviteName.trim() || inviteEmail.trim(),
        role: inviteRole
      })
      if (pErr) push(pErr.message, 'error')
      else {
        push(`Invited ${inviteEmail.trim()} — temp password: ${password}`, 'info')
        setInviteEmail(''); setInviteName(''); setInviteRole('cashier')
        loadUsers()
      }
    } else {
      push('Check the user\'s email to confirm the invite', 'info')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">Store configuration and team management</p>
      </div>

      {/* Store settings */}
      <div className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700"><Store size={16} /> Store details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Store name</label>
            <input className="input" value={store.store_name} onChange={(e) => setStore({ ...store, store_name: e.target.value })} placeholder="Store POS" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={store.phone} onChange={(e) => setStore({ ...store, phone: e.target.value })} placeholder="(555) 123-4567" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <input className="input" value={store.address} onChange={(e) => setStore({ ...store, address: e.target.value })} placeholder="123 Main St, Springfield" />
          </div>
          <div>
            <label className="label">Tax label</label>
            <input className="input" value={store.tax_label} onChange={(e) => setStore({ ...store, tax_label: e.target.value })} />
          </div>
          <div>
            <label className="label">Tax rate (%)</label>
            <input type="number" step="0.01" min="0" className="input" value={store.tax_rate} onChange={(e) => setStore({ ...store, tax_rate: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={saveStore} className="btn-primary"><Save size={16} /> Save store settings</button>
        </div>
      </div>

      {/* Team */}
      <div className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700"><Users size={16} /> Team & roles</h3>

        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">Invite a new user</p>
          <form onSubmit={inviteUser} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input className="input" placeholder="Full name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            <input className="input sm:col-span-1" placeholder="Email *" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
            <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="btn-primary"><KeyRound size={15} /> Invite</button>
          </form>
          <p className="mt-2 text-xs text-slate-400">
            New users get a temporary password shown after invite. Ask them to change it after first login.
          </p>
        </div>

        {loadingUsers ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">User</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold">Joined</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{u.full_name || '—'}</span>
                        {u.id === profile?.id && <Badge color="blue">You</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge color={u.role === 'admin' ? 'violet' : 'slate'}>{u.role}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2.5 text-right">
                      {u.id !== profile?.id && (
                        <button
                          onClick={() => changeRole(u, u.role === 'admin' ? 'cashier' : 'admin')}
                          className="btn-secondary px-3 py-1 text-xs"
                        >
                          Make {u.role === 'admin' ? 'cashier' : 'admin'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role guide */}
      <div className="card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700"><Shield size={16} /> Role permissions</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="mb-2 text-sm font-bold text-slate-700">Admin</p>
            <ul className="space-y-1 text-sm text-slate-500">
              <li>• Manage products, stock & pricing</li>
              <li>• View all reports and dashboard</li>
              <li>• Manage users and roles</li>
              <li>• Void transactions & refunds</li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="mb-2 text-sm font-bold text-slate-700">Cashier</p>
            <ul className="space-y-1 text-sm text-slate-500">
              <li>• Process sales & checkout</li>
              <li>• View product list & stock levels</li>
              <li>• Look up customers</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
