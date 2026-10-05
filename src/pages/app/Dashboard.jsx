import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Building2, CircleCheck, Map as MapIcon, MousePointerClick, Nfc, PackageOpen, Plus, QrCode, Star, Store, TriangleAlert } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useAsync, useWorkspace } from '../../lib/workspace'
import { api } from '../../lib/api'
import { businessStats, mapPoints, totals } from '../../lib/derive'
import { ago, num, pct } from '../../lib/format'
import { ActivityChart, fillDays, isoDaysAgo, SplitBar, sumRows } from '../../components/Charts'
import { BarList, EmptyState, Panel, Spinner, Stat } from '../../components/ui'
import PHMap from '../../components/PHMap'
import { ActionLabel } from './ActivityLogs'

export default function Dashboard() {
  const { isAdmin } = useAuth()
  return isAdmin ? <AdminDashboard /> : <BusinessDashboard />
}

function useLast30() {
  const { version } = useWorkspace()
  const from = isoDaysAgo(29)
  const [rows] = useAsync(() => api.getActivity({ from }), [version])
  return useMemo(() => (rows ? fillDays(rows, from) : null), [rows, from])
}

function AdminDashboard() {
  const { ws } = useWorkspace()
  const navigate = useNavigate()
  const t = useMemo(() => totals(ws), [ws])
  const points = useMemo(() => mapPoints(ws), [ws])
  const bstats = useMemo(() => businessStats(ws), [ws])
  const series = useLast30()
  const [logs] = useAsync(() => api.getAuditLogs({ limit: 8 }), [ws])
  const top = ws.businesses
    .map((b) => ({ key: b.id, label: b.name, value: bstats.get(b.id).taps + bstats.get(b.id).scans, sub: `${bstats.get(b.id).cards} cards` }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
  const sum30 = series ? sumRows(series) : null

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Every NFC card, restaurant and location across the Philippines.</p>
        </div>
        <div className="row">
          <Link className="btn" to="/admin/map"><MapIcon size={16} /> Open map</Link>
          <Link className="btn primary" to="/admin/cards?new=1"><Plus size={16} /> Register NFC card</Link>
        </div>
      </div>

      <div className="stats-row">
        <Stat icon={Nfc} label="Total NFC cards" value={num(t.cards)} sub={`${num(t.active)} active · ${num(t.inactive)} inactive`} />
        <Stat icon={Store} label="Restaurants" value={num(t.businesses)} sub={`${num(t.branches)} branches`} delay={40} />
        <Stat icon={MapIcon} label="Locations" value={num(t.locations)} sub="Branches with cards" delay={80} />
        <Stat icon={Activity} label="Total NFC taps" value={num(t.taps)} sub={sum30 ? `${num(sum30.nfc)} in last 30 days` : ' '} delay={120} />
        <Stat icon={QrCode} label="Total QR scans" value={num(t.scans)} sub={sum30 ? `${num(sum30.qr)} in last 30 days` : ' '} delay={160} />
        <Stat icon={MousePointerClick} label="Review clicks" value={num(t.clicks)} sub={`${pct(t.clicks, t.views)} of ${num(t.views)} page views`} delay={200} />
      </div>

      <div className="grid grid-3">
        <Panel className="span-2" title="NFC & QR activity" subtitle="Last 30 days" actions={<Link className="link" to="/admin/analytics">Analytics →</Link>}>
          {series ? <ActivityChart data={series} /> : <Spinner />}
        </Panel>
        <Panel title="Card inventory" actions={<Link className="link" to="/admin/cards">Manage →</Link>}>
          <div className="stack-sm">
            {[
              ['Total physical cards', t.cards, Nfc],
              ['Assigned', t.assigned, Store],
              ['Unassigned (in stock)', t.unassigned, PackageOpen],
              ['Active', t.byStatus.active, CircleCheck],
              ['Inactive', t.byStatus.inactive, null],
              ['Suspended', t.byStatus.suspended, null],
              ['Lost', t.byStatus.lost, TriangleAlert],
              ['Replaced', t.byStatus.replaced, null],
            ].map(([label, v]) => (
              <div key={label} className="row between" style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="muted">{label}</span>
                <b>{num(v)}</b>
              </div>
            ))}
            <div style={{ marginTop: 8 }}>
              <SplitBar a={t.taps} b={t.scans} />
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-3">
        <Panel className="span-2" title="NFC card locations" subtitle="Click a marker for details" flush actions={<Link className="link" to="/admin/map">Full map →</Link>}>
          <div style={{ padding: '0 18px 18px' }}>
            <PHMap
              points={points}
              size="md"
              fitKey={points.length}
              onAction={(a, p) => navigate(a === 'cards' ? `/admin/cards?branch=${p.id}` : a === 'analytics' ? `/admin/analytics?branch=${p.id}` : `/admin/restaurants/${p.business_id}`)}
            />
          </div>
        </Panel>
        <Panel title="Top restaurants" subtitle="By total taps + scans">
          <BarList items={top} format={num} onClick={(i) => navigate(`/admin/restaurants/${i.key}`)} />
        </Panel>
      </div>

      <Panel title="Recent activity" actions={<Link className="link" to="/admin/logs">All logs →</Link>}>
        {!logs ? <Spinner /> : logs.length === 0 ? <p className="muted">No activity yet.</p> : (
          <ul className="timeline">
            {logs.map((l) => (
              <li key={l.id}>
                <div><ActionLabel log={l} /></div>
                <div className="when">{ago(l.created_at)} · {l.actor_email ?? 'system'}</div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function BusinessDashboard() {
  const { ws, cards } = useWorkspace()
  const { isOwnerAnywhere } = useAuth()
  const navigate = useNavigate()
  const t = useMemo(() => totals(ws), [ws])
  const series = useLast30()
  const sum30 = series ? sumRows(series) : null
  const missingReview = ws.businesses.filter((b) => !b.review_url)
  const topCards = [...cards].sort((a, b) => b.interactions - a.interactions).slice(0, 6).map((c) => ({ key: c.id, label: c.card_name, sub: c.branch_name, value: c.interactions }))
  const biz = ws.businesses[0]

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{ws.businesses.length === 1 ? biz.name : 'Dashboard'}</h1>
          <p>How customers are reaching your Google Review page.</p>
        </div>
        {isOwnerAnywhere && <Link className="btn primary" to="/app/cards?new=1"><Plus size={16} /> Register NFC card</Link>}
      </div>

      {missingReview.length > 0 && (
        <p className="alert warn">
          {missingReview.map((b) => b.name).join(', ')} {missingReview.length === 1 ? 'has' : 'have'} no Google Review link yet — customers will see a notice instead of the review button.{' '}
          <Link className="link" to="/app/review">Add it now</Link>
        </p>
      )}
      {biz?.status === 'pending' && <p className="alert info">Your business is pending administrator approval. You can already set up branches and cards.</p>}

      <div className="stats-row">
        <Stat icon={Nfc} label="NFC cards" value={num(t.cards)} sub={`${num(t.active)} active`} />
        <Stat icon={Building2} label="Branches" value={num(t.branches)} delay={40} />
        <Stat icon={Activity} label="NFC taps" value={num(t.taps)} sub={sum30 ? `${num(sum30.nfc)} last 30 days` : ' '} delay={80} />
        <Stat icon={QrCode} label="QR scans" value={num(t.scans)} sub={sum30 ? `${num(sum30.qr)} last 30 days` : ' '} delay={120} />
        <Stat icon={Star} label="Review clicks" value={num(t.clicks)} sub={`${pct(t.clicks, t.views)} of page views`} delay={160} />
      </div>

      {t.cards === 0 ? (
        <Panel>
          <EmptyState icon={Nfc} title="No NFC cards registered yet." text="Register your first card to get a unique tap/scan link and QR code." action={isOwnerAnywhere && <Link className="btn primary" to="/app/cards?new=1"><Plus size={16} /> Register NFC Card</Link>} />
        </Panel>
      ) : (
        <div className="grid grid-3">
          <Panel className="span-2" title="Activity" subtitle="Last 30 days" actions={<Link className="link" to="/app/analytics">Analytics →</Link>}>
            {series ? <ActivityChart data={series} series={['nfc', 'qr', 'clicks']} /> : <Spinner />}
          </Panel>
          <Panel title="Most-used cards">
            <BarList items={topCards} format={num} onClick={(i) => navigate(`/app/cards/${i.key}`)} />
          </Panel>
        </div>
      )}

      <Panel title="Branches" actions={<Link className="link" to="/app/branches">Manage →</Link>}>
        {ws.branches.length === 0 ? (
          <p className="muted">No branches yet.</p>
        ) : (
          <div className="grid grid-3">
            {ws.branches.map((b) => {
              const bc = cards.filter((c) => c.branch_id === b.id)
              return (
                <Link key={b.id} to={`/app/cards?branch=${b.id}`} className="panel" style={{ padding: 14 }}>
                  <div className="cell-title">{b.name}</div>
                  <div className="cell-sub">{b.city}, {b.province}</div>
                  <div className="kv-inline" style={{ marginTop: 10 }}>
                    <div><span>Cards</span><b>{bc.length}</b></div>
                    <div><span>Taps</span><b>{num(bc.reduce((s, c) => s + c.taps, 0))}</b></div>
                    <div><span>Scans</span><b>{num(bc.reduce((s, c) => s + c.scans, 0))}</b></div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
