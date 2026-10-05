import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart3, Building2, Download, Nfc, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useWorkspace } from '../../lib/workspace'
import { api } from '../../lib/api'
import { branchStats, mapPoints, matches } from '../../lib/derive'
import { date, downloadCsv, num } from '../../lib/format'
import { REGIONS, regionName } from '../../lib/geo'
import { Button, EmptyState, Modal, Pager, Panel, useAction, usePaged, useSort } from '../../components/ui'
import { BranchFormModal } from '../../components/forms'
import PHMap from '../../components/PHMap'

export default function Branches() {
  const { ws, reload } = useWorkspace()
  const { isAdmin, base, isOwnerOf, isOwnerAnywhere } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const focus = params.get('focus')
  const [q, setQ] = useState('')
  const [region, setRegion] = useState('')
  const [biz, setBiz] = useState('')
  const [modal, setModal] = useState(null)
  const [run] = useAction()
  const focusRow = useRef(null)

  const stats = useMemo(() => branchStats(ws), [ws])
  const bizById = useMemo(() => new Map(ws.businesses.map((b) => [b.id, b])), [ws])
  const rows = useMemo(
    () =>
      ws.branches
        .map((b) => ({ ...b, business_name: bizById.get(b.business_id)?.name, ...stats.get(b.id), interactions: stats.get(b.id).taps + stats.get(b.id).scans }))
        .filter((b) => matches(q, b.name, b.business_name, b.city, b.province, b.address, b.barangay) && (!region || b.region_code === region) && (!biz || b.business_id === biz)),
    [ws, stats, bizById, q, region, biz],
  )
  const points = useMemo(() => mapPoints({ ...ws, branches: rows }), [ws, rows])
  const [sorted, th] = useSort(rows, 'interactions')
  const paged = usePaged(sorted, 25, q + region + biz)

  useEffect(() => {
    focusRow.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focus])

  const remove = async (b) => {
    setModal(null)
    if (await run(() => api.deleteBranch(b.id), 'Branch deleted')) reload()
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{isAdmin ? 'Branches' : 'My Branches'}</h1>
          <p>Each branch has its own address, map location, NFC cards, QR codes and analytics.</p>
        </div>
        <div className="row">
          <Button
            icon={Download}
            onClick={() =>
              downloadCsv('tapreview-branches.csv', [
                { label: 'Restaurant', key: 'business_name' }, { label: 'Branch', key: 'name' }, { label: 'Address', key: 'address' }, { label: 'Barangay', key: 'barangay' },
                { label: 'City', key: 'city' }, { label: 'Province', key: 'province' }, { label: 'Region', key: 'region_code' }, { label: 'Latitude', key: 'lat' }, { label: 'Longitude', key: 'lng' },
                { label: 'NFC cards', key: 'cards' }, { label: 'Active', key: 'active' }, { label: 'Taps', key: 'taps' }, { label: 'QR scans', key: 'scans' },
              ], sorted)
            }
          >
            Export CSV
          </Button>
          {isOwnerAnywhere && <Button variant="primary" icon={Plus} onClick={() => setModal({ type: 'edit' })}>Add branch</Button>}
        </div>
      </div>

      {points.length > 0 && <PHMap points={points} size="md" fitKey={q + region + biz} selectedId={focus} onAction={(a, p) => navigate(a === 'cards' ? `${base}/cards?branch=${p.id}` : a === 'analytics' ? `${base}/analytics?branch=${p.id}` : isAdmin ? `/admin/restaurants/${p.business_id}` : '/app/profile')} />}

      <Panel flush>
        <div className="toolbar">
          <div className="search">
            <Search />
            <input className="input" placeholder="Search branch, restaurant, city…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {ws.businesses.length > 1 && (
            <select className="input" value={biz} onChange={(e) => setBiz(e.target.value)} aria-label="Restaurant">
              <option value="">All restaurants</option>
              {ws.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select className="input" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
            <option value="">All regions</option>
            {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.short}</option>)}
          </select>
        </div>
        {ws.branches.length === 0 ? (
          <EmptyState icon={Building2} title="No branches yet." text="Add a branch with its address and map location to start assigning NFC cards." action={isOwnerAnywhere && <Button variant="primary" icon={Plus} onClick={() => setModal({ type: 'edit' })}>Add branch</Button>} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    {th('name', 'Branch')}
                    {th('city', 'Location')}
                    {th('region_code', 'Region')}
                    {th('cards', 'NFC cards', 'num')}
                    {th('active', 'Active', 'num')}
                    {th('taps', 'Taps', 'num')}
                    {th('scans', 'QR scans', 'num')}
                    {th('last', 'Last activity')}
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.slice.map((b) => (
                    <tr key={b.id} ref={b.id === focus ? focusRow : null} style={b.id === focus ? { background: 'var(--accent-soft)' } : undefined}>
                      <td>
                        <div className="cell-title">{b.name}</div>
                        <div className="cell-sub">{b.business_name}</div>
                      </td>
                      <td>
                        <div>{b.city}, {b.province}</div>
                        <div className="cell-sub truncate" style={{ maxWidth: 260 }}>{[b.address, b.barangay].filter(Boolean).join(', ')}</div>
                      </td>
                      <td className="nowrap">{regionName(b.region_code)}</td>
                      <td className="num">{b.cards}</td>
                      <td className="num">{b.active}</td>
                      <td className="num">{num(b.taps)}</td>
                      <td className="num">{num(b.scans)}</td>
                      <td className="nowrap">{date(b.last)}</td>
                      <td className="right nowrap">
                        <Button size="sm" variant="ghost" icon={Nfc} title="View cards" onClick={() => navigate(`${base}/cards?branch=${b.id}`)} />
                        <Button size="sm" variant="ghost" icon={BarChart3} title="Analytics" onClick={() => navigate(`${base}/analytics?branch=${b.id}`)} />
                        {isOwnerOf(b.business_id) && <Button size="sm" variant="ghost" icon={Pencil} title="Edit" onClick={() => setModal({ type: 'edit', branch: b })} />}
                        {isOwnerOf(b.business_id) && <Button size="sm" variant="ghost" icon={Trash2} title="Delete" onClick={() => setModal({ type: 'delete', branch: b })} />}
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

      {modal?.type === 'edit' && <BranchFormModal branch={modal.branch} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload() }} />}
      {modal?.type === 'delete' && (
        <Modal title="Delete branch?" onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>Cancel</Button><Button variant="danger" onClick={() => remove(modal.branch)}>Delete</Button></>}>
          <p>Delete <b>{modal.branch.name}</b>? Branches with cards can’t be deleted — move or unassign the cards first. Historical analytics are kept.</p>
        </Modal>
      )}
    </div>
  )
}
