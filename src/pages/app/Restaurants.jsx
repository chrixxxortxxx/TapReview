import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, Plus, Search, Store } from 'lucide-react'
import { useWorkspace } from '../../lib/workspace'
import { businessStats, matches } from '../../lib/derive'
import { date, downloadCsv, num } from '../../lib/format'
import { Avatar, Button, EmptyState, Modal, Pager, Panel, usePaged, useSort } from '../../components/ui'
import { BusinessForm } from '../../components/forms'

export default function Restaurants() {
  const { ws, reload } = useWorkspace()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (params.get('new') === '1') {
      setAdding(true)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const stats = useMemo(() => businessStats(ws), [ws])
  const firstCity = useMemo(() => {
    const m = new Map()
    for (const b of ws.branches) if (!m.has(b.business_id)) m.set(b.business_id, `${b.city}, ${b.province}`)
    return m
  }, [ws])
  const rows = useMemo(
    () =>
      ws.businesses
        .map((b) => ({ ...b, ...stats.get(b.id), location: firstCity.get(b.id) ?? '—', interactions: stats.get(b.id).taps + stats.get(b.id).scans }))
        .filter((b) => matches(q, b.name, b.owner_name, b.owner_email, b.email, b.phone, b.location) && (!status || b.status === status) && (!category || b.category === category)),
    [ws, stats, firstCity, q, status, category],
  )
  const [sorted, th] = useSort(rows, 'interactions')
  const paged = usePaged(sorted, 25, q + status + category)
  const categories = [...new Set(ws.businesses.map((b) => b.category).filter(Boolean))].sort()

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Restaurants</h1>
          <p>All registered businesses, their owners, branches and NFC usage.</p>
        </div>
        <div className="row">
          <Button
            icon={Download}
            onClick={() =>
              downloadCsv('tapreview-restaurants.csv', [
                { label: 'Business', key: 'name' }, { label: 'Owner', key: 'owner_name' }, { label: 'Owner email', key: 'owner_email' }, { label: 'Phone', key: 'phone' },
                { label: 'Category', key: 'category' }, { label: 'Location', key: 'location' }, { label: 'Registered', value: (b) => date(b.created_at) }, { label: 'Status', key: 'status' },
                { label: 'Branches', key: 'branches' }, { label: 'NFC cards', key: 'cards' }, { label: 'Total taps', key: 'taps' }, { label: 'QR scans', key: 'scans' },
              ], sorted)
            }
          >
            Export CSV
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add restaurant</Button>
        </div>
      </div>

      <Panel flush>
        <div className="toolbar">
          <div className="search">
            <Search />
            <input className="input" placeholder="Search name, owner, email, phone, city…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending approval</option>
            <option value="suspended">Suspended</option>
          </select>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Store} title={ws.businesses.length ? 'No restaurants match.' : 'No restaurants registered yet.'} action={<Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add restaurant</Button>} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    {th('name', 'Business')}
                    {th('owner_name', 'Owner')}
                    {th('category', 'Category')}
                    {th('location', 'Location')}
                    {th('created_at', 'Registered')}
                    {th('status', 'Status')}
                    {th('branches', 'Branches', 'num')}
                    {th('cards', 'NFC cards', 'num')}
                    {th('taps', 'Total taps', 'num')}
                    {th('scans', 'QR scans', 'num')}
                  </tr>
                </thead>
                <tbody>
                  {paged.slice.map((b) => (
                    <tr key={b.id} className="click" onClick={() => navigate(`/admin/restaurants/${b.id}`)}>
                      <td>
                        <div className="row">
                          <Avatar name={b.name} src={b.logo_url} square />
                          <div>
                            <div className="cell-title">{b.name}</div>
                            <div className="cell-sub">{b.email ?? b.phone ?? ''}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>{b.owner_name ?? '—'}</div>
                        <div className="cell-sub">{b.owner_email ?? ''}</div>
                      </td>
                      <td>{b.category ?? '—'}</td>
                      <td className="nowrap">{b.location}</td>
                      <td className="nowrap">{date(b.created_at)}</td>
                      <td><span className={`badge ${b.status}`}>{b.status === 'pending' ? 'Pending' : b.status[0].toUpperCase() + b.status.slice(1)}</span></td>
                      <td className="num">{b.branches}</td>
                      <td className="num">{b.cards}</td>
                      <td className="num">{num(b.taps)}</td>
                      <td className="num">{num(b.scans)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager paged={paged} />
          </>
        )}
      </Panel>

      {adding && (
        <Modal title="Add restaurant" onClose={() => setAdding(false)} wide>
          <p className="muted" style={{ marginBottom: 14 }}>Creates the business and its first branch. Add an owner afterwards from the restaurant’s Team tab.</p>
          <BusinessForm
            submitLabel="Create restaurant"
            onDone={async (id) => {
              setAdding(false)
              await reload()
              navigate(`/admin/restaurants/${id}`)
            }}
          />
        </Modal>
      )}
    </div>
  )
}
