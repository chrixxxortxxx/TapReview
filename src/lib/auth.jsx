import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading, null = signed out

  useEffect(() => {
    let alive = true
    api.getSessionUser().then((u) => alive && setUser(u)).catch(() => alive && setUser(null))
    const off = api.onAuthChange((u) => alive && setUser(u))
    return () => {
      alive = false
      off()
    }
  }, [])

  const refresh = useCallback(async () => setUser(await api.getSessionUser()), [])

  const value = useMemo(() => {
    const isAdmin = user?.role === 'admin'
    const memberships = user?.memberships ?? []
    return {
      user,
      loading: user === undefined,
      isAdmin,
      memberships,
      isOwnerOf: (bizId) => isAdmin || memberships.some((m) => m.business_id === bizId && m.role === 'owner'),
      isOwnerAnywhere: isAdmin || memberships.some((m) => m.role === 'owner'),
      base: isAdmin ? '/admin' : '/app',
      refresh,
      signOut: () => api.signOut(),
    }
  }, [user, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
