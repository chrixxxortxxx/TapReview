import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, CircleCheck, Plus, Store } from 'lucide-react'
import { api } from '../../lib/api'
import { useAsync, useWorkspace } from '../../lib/workspace'
import { branchStats, mapPoints } from '../../lib/derive'
import { date, longDate, num, pct } from '../../lib/format'
import { Avatar, BarList, Button, EmptyState, Panel, Spinner, Stat, StatusBadge, Tabs, useAction } from '../../components/ui'
import { ActivityChart, fillDays, isoDaysAgo } from '../../components/Charts'
import { BranchFormModal } from '../../components/forms'
import PHMap from '../../components/PHMap'
import { BusinessProfileForm, TeamPanel } from './Profile'
import { ReviewLinkForm } from './GoogleReview'
import { ActionLabel } from './ActivityLogs'

export default function RestaurantDetail() {
  const { id } = useParams()
  const { ws, cards, reload, version } = useWorkspace()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [addBranch, setAddBranch] = useState(false)
  const [run] = useAction()
  const biz = ws.businesses.find((b) => b.id === id)
  const from = isoDaysAgo(89)
  const [activity] = useAsync(() => api.getActivity({ from, businessId: id }), [id, version])
  const [logs] = useAsync(() => api.getAuditLogs({ businessId: id, limit: 100 }), [id, version])
  const series = useMemo(() => (activity ? fillDays(activity, from) : null), [activity, from])
  const branches = useMemo(() => ws.branches.filter((b) => b.business_id === id), [ws, id])
  const bcards = useMemo(() => cards.filter((c) => c.business_id === id), [cards, id])
  const points = useMemo(() => mapPoints({ ...ws, branches, cards: bcards }), [ws, branches, bcards])
  const bstats = useMemo(() => branchStats({ ...ws, branches, cards: bcards }), [ws, branches, bcards])

  if (!biz) return <EmptyState icon={Store} title="Restaurant not found" action={<Link className="btn" to="/admin/restaurants">Back</Link>} />

  const t = bcards.reduce((s, c) => ({ taps: s.taps + c.taps, scans: s.scans + c.scans, views: s.views + c.views, clicks: s.clicks + c.clicks, active: s.active + (c.status === 'active') }), { taps: 0, scans: 0, views: 0, clicks: 0, active: 0 })
  const setStatus = async (status) => (await run(() => api.updateBusiness(id, { status }), `Business ${status === 'active' ? 'activated' : status}`)) && reload()
  const go = (a, p) => navigate(a === 'cards' ? `/admin/cards?branch=${p.id}` : a === 'analytics' ? `/admin/analytics?branch=${p.id}` : `/admin/branches?focus=${p.id}`)

  return (
    <div className="stack">
      <div><Link className="btn ghost sm" to="/admin/restaurants"><ArrowLeft size={16} /> Restaurants</Link></div>
      <div className="page-head">
        <div className="row" style={{ gap: 14 }}>
          <Avatar name={biz.name} src={biz.logo_url} size="lg" />
          <div>
            <div className="row wrap">
              <h1>{biz.name}</h1>
              <span className={`badge ${biz.status}`}>{biz.status}</span>
            </div>
            <p>{[biz.category, biz.owner_name && `Owner: ${biz.owner_name}`, `Registered ${longDate(biz.created_at)}`].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="row wrap">
          {biz.status !== 'active' && <Button icon={CircleCheck} variant="primary" onClick={() => setStatus('active')}>{biz.status === 'pending' ? 'Approve' : 'Reactivate'}</Button>}
          {biz.status !== 'suspended' && <Button icon={Ban} variant="danger" onClick={() => setStatus('suspended')}>Suspend</Button>}
          <Link className="btn" to={`/admin/cards?business=${id}&new=1`}><Plus size={16} /> Assign NFC card</Link>
        </div>
      </div>
      {biz.status === 'suspended' && <p className="alert">This business is suspended. Its NFC cards show “This NFC card is currently inactive.”</p>}

      <div className="stats-row compact">
        <Stat label="Branches" value={branches.length} />
        <Stat label="NFC cards" value={bcards.length} sub={`${t.active} active`} />
        <Stat label="Total taps" value={num(t.taps)} />
        <Stat label="QR scans" value={num(t.scans)} />
        <Stat label="Review clicks" value={num(t.clicks)} sub={`${pct(t.clicks, t.views)} of visits`} />
      </div>

      <Tabs value={tab} onChange={setTab} options={[{ value: 'overview', label: 'Overview' }, { value: 'branches', label: `Branches (${branches.length})` }, { value: 'cards', label: `NFC cards (${bcards.length})` }, { value: 'profile', label: 'Profile & review link' }, { value: 'team', label: 'Team' }, { value: 'logs', label: 'Activity' }]} />

      {tab === 'overview' && (
        <div className="grid grid-3">
          <Panel className="span-2" title="Activity" subtitle="Last 90 days">{series ? <ActivityChart data={series} series={['nfc', 'qr', 'clicks']} /> : <Spinner />}</Panel>
          <Panel title="Contact">
            <dl className="dl" style={{ gridTemplateColumns: '90px 1fr' }}>
              <dt>Owner</dt><dd>{biz.owner_name ?? '—'}</dd>
              <dt>Email</dt><dd>{biz.owner_email ?? biz.email ?? '—'}</dd>
              <dt>Phone</dt><dd>{biz.phone ?? '—'}</dd>
              <dt>Website</dt><dd>{biz.website ?? '—'}</dd>
              <dt>Review</dt><dd>{biz.review_url ? <a className="link" href={biz.review_url} target="_blank" rel="noopener noreferrer">Google Review link</a> : <span className="badge suspended">Not set</span>}</dd>
            </dl>
          </Panel>
          <Panel className="span-2" title="Locations" flush>
            <div style={{ padding: '0 18px 18px' }}>
              {points.length ? <PHMap points={points} size="sm" fitKey={id} onAction={go} /> : <p className="muted">No branches with cards yet.</p>}
            </div>
          </Panel>
          <Panel title="Most-used branches">
            <BarList items={branches.map((b) => ({ key: b.id, label: b.name, sub: b.city, value: bstats.get(b.id).taps + bstats.get(b.id).scans }))} format={num} onClick={(i) => navigate(`/admin/cards?branch=${i.key}`)} />
          </Panel>
        </div>
      )}

      {tab === 'branches' && (
        <Panel flush actions={<Button size="sm" icon={Plus} onClick={() => setAddBranch(true)}>Add branch</Button>} title="Branches">
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead><tr><th>Branch</th><th>Address</th><th className="num">Cards</th><th className="num">Taps</th><th className="num">QR scans</th><th>Last activity</th></tr></thead>
              <tbody>
                {branches.map((b) => {
                  const s = bstats.get(b.id)
                  return (
                    <tr key={b.id} className="click" onClick={() => navigate(`/admin/cards?branch=${b.id}`)}>
                      <td className="cell-title">{b.name}</td>
                      <td className="muted">{[b.address, b.barangay, b.city, b.province].filter(Boolean).join(', ')}</td>
                      <td className="num">{s.cards}</td><td className="num">{num(s.taps)}</td><td className="num">{num(s.scans)}</td>
                      <td>{date(s.last)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'cards' && (
        <Panel flush title="NFC cards" actions={<Link className="link" to={`/admin/cards?business=${id}`}>Open in NFC Cards →</Link>}>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead><tr><th>Card ID</th><th>Card</th><th>Branch</th><th>Status</th><th className="num">Taps</th><th className="num">QR scans</th><th>Last used</th></tr></thead>
              <tbody>
                {bcards.map((c) => (
                  <tr key={c.id} className="click" onClick={() => navigate(`/admin/cards/${c.id}`)}>
                    <td className="mono"><b>{c.card_code}</b></td><td>{c.card_name}</td><td>{c.branch_name ?? '—'}</td>
                    <td><StatusBadge status={c.status} /></td><td className="num">{num(c.taps)}</td><td className="num">{num(c.scans)}</td><td>{date(c.last_used_at)}</td>
                  </tr>
                ))}
                {bcards.length === 0 && <tr><td colSpan={7} className="muted">No cards assigned.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'profile' && (
        <div className="stack">
          <ReviewLinkForm business={biz} sampleCard={bcards.find((c) => c.status === 'active')} />
          <BusinessProfileForm key={biz.updated_at} business={biz} />
        </div>
      )}
      {tab === 'team' && <TeamPanel businessId={id} />}
      {tab === 'logs' && (
        <Panel title="Activity">
          {!logs ? <Spinner /> : logs.length === 0 ? <p className="muted">No activity.</p> : (
            <ul className="timeline">
              {logs.map((l) => <li key={l.id}><div className="when">{longDate(l.created_at)} · {l.actor_email ?? 'system'}</div><ActionLabel log={l} /></li>)}
            </ul>
          )}
        </Panel>
      )}

      {addBranch && <BranchFormModal businessId={id} onClose={() => setAddBranch(false)} onSaved={() => { setAddBranch(false); reload() }} />}
    </div>
  )
}
