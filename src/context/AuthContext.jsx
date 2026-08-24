import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Demo fallback used when no Supabase backend is configured, so the
// whole app remains usable without a login screen.
const demoUser = {
  id: 'demo-admin',
  email: 'dabeer337@gmail.com',
  role: 'admin',
  full_name: 'Store Admin'
}

// True when Supabase env vars are missing/placeholder (no backend).
const isDemoMode = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || ''
  return !url || url.includes('placeholder')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Demo mode: skip Supabase auth entirely and use the demo admin.
  useEffect(() => {
    if (isDemoMode()) {
      setUser({ id: demoUser.id, email: demoUser.email })
      setProfile({ id: demoUser.id, email: demoUser.email, full_name: demoUser.full_name, role: demoUser.role })
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setProfile(null)
    })

    return () => subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user || isDemoMode()) return
    let mounted = true
    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      if (mounted) {
        if (data) {
          setProfile(data)
        } else {
          // Self-healing profile creation: if the user exists but has no profile row, create it
          const fullName = user.user_metadata?.full_name || 'Store User'
          const role = user.user_metadata?.role || 'cashier'
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({ id: user.id, full_name: fullName, role: role })
            .select()
            .maybeSingle()
          if (newProfile) setProfile(newProfile)
        }
      }
    }
    loadProfile()

    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => mounted && setProfile(payload.new)
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [user])

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    if (isDemoMode()) {
      // No backend — nothing to sign out of; app stays accessible.
      return
    }
    await supabase.auth.signOut()
  }

  const value = {
    user,
    profile,
    isAdmin: profile?.role === 'admin' || isDemoMode(),
    loading,
    signIn,
    signOut,
    isDemoMode: isDemoMode()
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
