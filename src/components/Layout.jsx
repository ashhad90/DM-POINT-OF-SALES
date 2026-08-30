import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Store,
  Receipt,
  FileText,
  BookOpen
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { to: '/checkout', label: 'Checkout', icon: ShoppingCart, adminOnly: false },
  { to: '/transactions', label: 'Billing', icon: FileText, adminOnly: false },
  { to: '/products', label: 'Products', icon: Package, adminOnly: false },
  { to: '/customers', label: 'Customers', icon: Users, adminOnly: true },
  { to: '/ledger', label: 'Udhaar Ledgers', icon: BookOpen, adminOnly: true },
  { to: '/expenses', label: 'Expenses', icon: Receipt, adminOnly: true },
  { to: '/reports', label: 'Reports', icon: BarChart3, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings, adminOnly: true }
]

export default function Layout() {
  const { profile, isAdmin, signOut, isDemoMode } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    if (!isDemoMode) navigate('/login')
  }

  const items = navItems.filter((i) => !i.adminOnly || isAdmin)

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-5">
          <img src="/logo.png" alt="DM Logo" className="h-9 w-9 object-contain shrink-0" />
          <div>
            <p className="text-sm font-bold text-slate-800">DM POS</p>
            <p className="text-[11px] text-slate-400">Retail point of sale</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-50 text-accent-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`
              }
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-bold text-accent-700">
              {(profile?.full_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-700">{profile?.full_name || 'User'}</p>
              <p className="text-xs capitalize text-slate-400">{profile?.role || '…'}</p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="DM Logo" className="h-8 w-8 object-contain shrink-0" />
          <span className="text-sm font-bold text-slate-800">DM POS</span>
        </div>
        <div className="flex items-center gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center rounded-lg px-2.5 py-1 text-[10px] font-medium ${
                  isActive ? 'text-accent-700' : 'text-slate-500'
                }`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
          <button onClick={handleSignOut} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <main className="min-w-0 flex-1 overflow-y-auto pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  )
}
