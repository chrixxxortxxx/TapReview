import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, Building2, CircleCheck, CircleX, Eye, MousePointerClick, Nfc, QrCode, Store } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useAsync, useWorkspace } from '../../lib/workspace'
import { api } from '../../lib/api'
import { groupSum } from '../../lib/derive'
import { num, pct } from '../../lib/format'
import { regionName } from '../../lib/geo'
import { ActivityChart, bucket, CompareBars, fillDays, isoDaysAgo, SplitBar, sumRows } from '../../components/Charts'
import { BarList, Button, Panel, Segmented, Spinner, Stat, Tabs } from '../../components/ui'

const RANGES = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
  { value: '180', label: '6m' },
]

export default function Analytics() {
  const { ws, cards, version } = useWorkspace()
  const { isAdmin, base } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [range, setRange] = useState('30')
  const [by, setBy] = useState('day')
  const [geo, setGeo] = useState('region')
  const branchId = params.get('branch') ?? ''
  const businessId = params.get('business') ?? ''
  const from = isoDaysAgo(Number(range) - 1)

  const [rows] = useAsync(() => api.getActivity({ from, businessId: businessId || undefined, branchId: branchId || undefined }), [from, businessId, branchId, version])
  const [periodTotals] = useAsync(() => api.getCardTotalsSince(from), [from, version])
  const series = useMemo(() => (rows ? bucket(fillDays(rows, from), by) : null), [rows, from, by])
  const sum = useMemo(() => (rows ? sumRows(rows) : null), [rows])

  // Period totals joined to each card's current restaurant/branch/location.
  const scoped = useMemo(() => {
    if (!periodTotals) return null
    const byCard = new Map(periodTotals.map((t) => [t.card_id, t]))
    return cards
      .filter((c) => (!businessId || c.business_id === businessId) && (!branchId || c.branch_id === branchId))
      .map((c) => {
        const t = byCard.get(c.id) ?? { taps: 0, scans: 0, views: 0, clicks: 0 }
        return { ...c, p_taps: t.taps, p_scans: t.scans, p_total: t.taps + t.scans }
      })
  }, [periodTotals, cards, businessId, branchId])

  const setScope = (k, v) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    if (k === 'business') p.delete('branch')
    setParams(p, { replace: true })
  }

  const topCards = scoped && [...scoped].sort((a, b) => b.p_total - a.p_total).slice(0, 8).map((c) => ({ key: c.id, label: `${c.card_code} · ${c.card_name}`, sub: c.branch_name, value: c.p_total }))
  const topBranches = scoped && groupSum(scoped, (c) => c.branch_id, (c) => c.p_total).slice(0, 8).map((x) => {
    const b = ws.branches.find((y) => y.id === x.key)
    return { ...x, label: b?.name, sub: ws.businesses.find((z) => z.id === b?.business_id)?.name }
  })
  const topBiz = scoped && groupSum(scoped, (c) => c.business_id, (c) => c.p_total).slice(0, 8).map((x) => ({ ...x, label: ws.businesses.find((b) => b.id === x.key)?.name }))
  const geoItems = scoped && groupSum(scoped, (c) => (geo === 'region' ? c.region_code : geo === 'province' ? c.province : c.city), (c) => c.p_total).slice(0, 12).map((x) => ({ ...x, label: geo === 'region' ? regionName(x.key) : x.key }))
  const nfcVsQrByRegion = scoped && groupSum(scoped, (c) => c.region_code, (c) => c.p_total).slice(0, 8).map((x) => ({
    label: regionName(x.key).replace('Region ', 'R-'),
    nfc: scoped.filter((c) => c.region_code === x.key).reduce((s, c) => s + c.p_taps, 0),
    qr: scoped.filter((c) => c.region_code === x.key).reduce((s, c) => s + c.p_scans, 0),
  }))

  const scopeCards = cards.filter((c) => (!businessId || c.business_id === businessId) && (!branchId || c.branch_id === branchId))
  const branchName = branchId && ws.branches.find((b) => b.id === branchId)

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p>Anonymous NFC taps, QR scans, landing page views and Google Review button clicks.</p>
        </div>
        <div className="row wrap">
          {ws.businesses.length > 1 && (
            <select className="input" style={{ width: 'auto' }} value={businessId} onChange={(e) => setScope('business', e.target.value)} aria-label="Restaurant">
              <option value="">{isAdmin ? 'All restaurants' : 'All businesses'}</option>
              {ws.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select className="input" style={{ width: 'auto' }} value={branchId} onChange={(e) => setScope('branch', e.target.value)} aria-label="Branch">
            <option value="">All branches</option>
            {ws.branches.filter((b) => !businessId || b.business_id === businessId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Segmented value={range} onChange={setRange} options={RANGES} />
        </div>
      </div>

      {branchName && (
        <p className="alert info">
          Showing <b>{branchName.name}</b> ({branchName.city}). <Button size="sm" variant="ghost" onClick={() => setScope('branch', '')}>Show all</Button>
        </p>
      )}

      <div className="stats-row compact">
        {isAdmin && !businessId && !branchId && (
          <>
            <Stat icon={Store} label="Total restaurants" value={num(ws.businesses.length)} />
            <Stat icon={Building2} label="Total branches" value={num(ws.branches.length)} />
          </>
        )}
        <Stat icon={Nfc} label="Total NFC cards" value={num(scopeCards.length)} />
        <Stat icon={CircleCheck} label="Active cards" value={num(scopeCards.filter((c) => c.status === 'active').length)} />
        <Stat icon={CircleX} label="Inactive cards" value={num(scopeCards.filter((c) => c.status !== 'active').length)} />
        <Stat icon={Activity} label="NFC taps" value={sum ? num(sum.nfc) : '…'} sub={`Last ${RANGES.find((r) => r.value === range).label}`} />
        <Stat icon={QrCode} label="QR scans" value={sum ? num(sum.qr) : '…'} />
        <Stat icon={Eye} label="Landing page visits" value={sum ? num(sum.views) : '…'} />
        <Stat icon={MousePointerClick} label="Review button clicks" value={sum ? num(sum.clicks) : '…'} sub={sum ? `${pct(sum.clicks, sum.views)} click-through` : ''} />
      </div>

      <div className="row between wrap">
        <h2>Usage over time</h2>
        <Segmented value={by} onChange={setBy} options={[{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} />
      </div>
      <div className="grid grid-2">
        <Panel title="NFC usage over time">{series ? <ActivityChart data={series} series={['nfc']} by={by} area /> : <Spinner />}</Panel>
        <Panel title="QR usage over time">{series ? <ActivityChart data={series} series={['qr']} by={by} area /> : <Spinner />}</Panel>
        <Panel title="NFC vs QR" subtitle="Share of all interactions in this period">
          {sum ? (
            <div className="stack">
              <SplitBar a={sum.nfc} b={sum.qr} labelA="NFC taps" labelB="QR scans" />
              <ActivityChart data={series} series={['nfc', 'qr']} by={by} small />
            </div>
          ) : <Spinner />}
        </Panel>
        <Panel title="Landing page → Google Review" subtitle="Visits vs review button clicks">
          {series ? <ActivityChart data={series} series={['views', 'clicks']} by={by} /> : <Spinner />}
        </Panel>
      </div>

      <div className="grid grid-3">
        {isAdmin && !businessId && (
          <Panel title="Top restaurants" subtitle="Taps + scans in period">
            {topBiz ? <BarList items={topBiz} format={num} onClick={(i) => navigate(`/admin/restaurants/${i.key}`)} /> : <Spinner />}
          </Panel>
        )}
        <Panel title="Most-used branches">{topBranches ? <BarList items={topBranches} format={num} onClick={(i) => setScope('branch', i.key)} /> : <Spinner />}</Panel>
        <Panel title="Top NFC cards">{topCards ? <BarList items={topCards} format={num} onClick={(i) => navigate(`${base}/cards/${i.key}`)} /> : <Spinner />}</Panel>
      </div>

      <div className="grid grid-2">
        <Panel title="Geographic usage" subtitle="By registered branch location" actions={<Tabs value={geo} onChange={setGeo} options={[{ value: 'region', label: 'Region' }, { value: 'province', label: 'Province' }, { value: 'city', label: 'City' }]} />}>
          {geoItems ? <BarList items={geoItems} format={num} /> : <Spinner />}
        </Panel>
        <Panel title="NFC vs QR by region">{nfcVsQrByRegion ? <CompareBars data={nfcVsQrByRegion} /> : <Spinner />}</Panel>
      </div>
    </div>
  )
}
