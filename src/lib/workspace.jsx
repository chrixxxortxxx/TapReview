import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { enrichCards } from './derive'

const WorkspaceContext = createContext(null)

/** Loads everything the signed-in user can see (RLS-scoped) and shares it across pages. */
export function WorkspaceProvider({ children }) {
  const [ws, setWs] = useState(null)
  const [error, setError] = useState(null)
  const [version, setVersion] = useState(0)

  const reload = useCallback(async () => {
    try {
      const data = await api.getWorkspace()
      setWs(data)
      setError(null)
      setVersion((v) => v + 1)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const value = useMemo(() => {
    if (!ws) return { ws: null, error, reload, version }
    return {
      ws,
      cards: enrichCards(ws),
      businessById: new Map(ws.businesses.map((b) => [b.id, b])),
      branchById: new Map(ws.branches.map((b) => [b.id, b])),
      error,
      reload,
      version,
    }
  }, [ws, error, reload, version])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export const useWorkspace = () => useContext(WorkspaceContext)

/** Small async helper: returns [data, loading, error, reload]. */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const run = useCallback(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    fn().then(
      (data) => alive && setState({ data, loading: false, error: null }),
      (e) => alive && setState({ data: null, loading: false, error: e.message }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(run, [run])
  return [state.data, state.loading, state.error, run]
}
