import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './components/Login'
import Dashboard from './pages/Dashboard'
import Checkout from './pages/Checkout'
import Products from './pages/Products'
import Customers from './pages/Customers'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Transactions from './pages/Transactions'
import Ledger from './pages/Ledger'

function AdminOnly({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return null
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600" />
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/products" element={<Products />} />
        <Route path="/customers" element={<AdminOnly><Customers /></AdminOnly>} />
        <Route path="/ledger" element={<AdminOnly><Ledger /></AdminOnly>} />
        <Route path="/expenses" element={<AdminOnly><Expenses /></AdminOnly>} />
        <Route path="/reports" element={<AdminOnly><Reports /></AdminOnly>} />
        <Route path="/settings" element={<AdminOnly><Settings /></AdminOnly>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
