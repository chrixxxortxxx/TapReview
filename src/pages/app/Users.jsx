import { useMemo, useState } from 'react'
import { Search, Users as UsersIcon } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useAsync, useWorkspace } from '../../lib/workspace'
import { api } from '../../lib/api'
import { date } from '../../lib/format'
import { matches } from '../../lib/derive'
import { Avatar, Button, EmptyState, Pager, Panel, Spinner, useAction, usePaged } from '../../components/ui'

export default function Users() {
  const { user: me } = useAuth()
  const { businessById } = useWorkspace()
  const [users, loading, error, refresh] = useAsync(() => api.listUsers(), [])
  const [run] = useAction()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const rows = useMemo(
    () => (users ?? []).filter((u) => (!role || u.role === role) && matches(q, u.full_name, u.email, u.phone, ...u.memberships.map((m) => businessById.get(m.business_id)?.name))),
    [users, q, role, businessById],
  )
  const paged = usePaged(rows, 25, q + role)
  const update = async (u, patch, msg) => (await run(() => api.updateUser(u.id, patch), msg)) && refresh()

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <p>Administrator and business accounts. Customers never need an account.</p>
        </div>
      </div>
      <Panel flush>
        <div className="toolbar">
          <div className="search">
            <Search />
            <input className="input" placeholder="Search name, email, business…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
            <option value="">All roles</option>
            <option value="admin">Administrators</option>
            <option value="business">Business users</option>
          </select>
        </div>
        {loading ? <div style={{ padding: 20 }}><Spinner /></div> : error ? <p className="alert" style={{ margin: 14 }}>{error}</p> : rows.length === 0 ? <EmptyState icon={UsersIcon} title="No users found." /> : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>User</th><th>Role</th><th>Businesses</th><th>Status</th><th>Joined</th><th className="right">Actions</th></tr></thead>
                <tbody>
                  {paged.slice.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="row">
                          <Avatar name={u.full_name || u.email} />
                          <div><div className="cell-title">{u.full_name ?? '—'}</div><div className="cell-sub">{u.email}</div></div>
                        </div>
                      </td>
                      <td><span className={`badge plain ${u.role === 'admin' ? 'admin' : ''}`}>{u.role === 'admin' ? 'Administrator' : 'Business'}</span></td>
                      <td className="muted">{u.memberships.map((m) => `${businessById.get(m.business_id)?.name ?? '—'} (${m.role})`).join(', ') || '—'}</td>
                      <td><span className={`badge ${u.is_active ? 'active' : 'inactive'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                      <td className="nowrap">{date(u.created_at)}</td>
                      <td className="right nowrap">
                        {u.id !== me.id && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => update(u, { role: u.role === 'admin' ? 'business' : 'admin' }, 'Role updated')}>
                              {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => update(u, { is_active: !u.is_active }, u.is_active ? 'User disabled' : 'User enabled')}>
                              {u.is_active ? 'Disable' : 'Enable'}
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager paged={paged} />
          </>
        )}
      </Panel>
    </div>
  )
}
