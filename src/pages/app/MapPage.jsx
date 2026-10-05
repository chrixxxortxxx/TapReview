import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Building2, CircleCheck, CircleX, Flame, Layers, MapPin, Nfc, QrCode, Search, Store } from 'lucide-react'
import { useWorkspace } from '../../lib/workspace'
import { mapPoints, matches, totals, USAGE_LABELS } from '../../lib/derive'
import { CARD_STATUSES, longDate, num, statusLabel } from '../../lib/format'
import { PROVINCES, REGIONS, regionName } from '../../lib/geo'
import { Avatar, Button, EmptyState, Panel, Segmented, Stat } from '../../components/ui'
import PHMap from '../../components/PHMap'

const MODES = [
  { value: 'locations', label: 'Card locations', icon: MapPin },
  { value: 'nfc', label: 'NFC activity', icon: Nfc },
  { value: 'qr', label: 'QR activity', icon: QrCode },
  { value: 'combined', label: 'Combined', icon: Flame },
]

export default function MapPage() {
  const { ws, cards } = useWorkspace()
  const navigate = useNavigate()
  const [f, setF] = useState({ q: '', region: '', province: '', city: '', status: '', usage: '' })
  const [mode, setMode] = useState('locations')
  const [selected, setSelected] = useState(null)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value, ...(k === 'region' ? { province: '', city: '' } : k === 'province' ? { city: '' } : {}) }))

  const t = useMemo(() => totals(ws), [ws])

  const cityOptions = useMemo(
    () => [...new Set(ws.branches.filter((b) => (!f.region || b.region_code === f.region) && (!f.province || b.province === f.province)).map((b) => b.city))].sort(),
    [ws, f.region, f.province],
  )
  const provinceOptions = f.region ? PROVINCES[f.region] : [...new Set(ws.branches.map((b) => b.province))].sort()

  // Filter cards first (status/search), then build per-branch points and filter by place/usage.
  const points = useMemo(() => {
    const bizById = new Map(ws.businesses.map((b) => [b.id, b]))
    const branchHit = new Set(
      ws.branches.filter((b) => matches(f.q, b.name, bizById.get(b.business_id)?.name, b.city, b.province, b.barangay)).map((b) => b.id),
    )
    const filteredCards = cards.filter(
      (c) => c.branch_id && (!f.status || c.status === f.status) && (!f.q || branchHit.has(c.branch_id) || matches(f.q, c.card_code, c.nfc_uid, c.card_name)),
    )
    return mapPoints({ ...ws, cards: filteredCards }).filter(
      (p) =>
        (!f.region || p.region_code === f.region) &&
        (!f.province || p.province === f.province) &&
        (!f.city || p.city === f.city) &&
        (!f.usage || p.usage === f.usage),
    )
  }, [ws, cards, f])

  const fitKey = JSON.stringify(f)
  const sel = selected && points.find((p) => p.id === selected)
  const go = (a, p) => navigate(a === 'cards' ? `/admin/cards?branch=${p.id}` : a === 'analytics' ? `/admin/analytics?branch=${p.id}` : a === 'branch' ? `/admin/branches?focus=${p.id}` : `/admin/restaurants/${p.business_id}`)
  const filtered = Object.values(f).some(Boolean)
  const list = [...points].sort((a, b) => b.taps + b.scans - (a.taps + a.scans))

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>NFC Card Location Map</h1>
          <p>Where registered NFC cards are being used. Locations are the registered branch addresses — never customer locations.</p>
        </div>
        <Segmented value={mode} onChange={setMode} options={MODES} />
      </div>

      <div className="stats-row compact">
        <Stat icon={Nfc} label="Total NFC cards" value={num(t.cards)} />
        <Stat icon={CircleCheck} label="Active cards" value={num(t.byStatus.active)} />
        <Stat icon={CircleX} label="Inactive cards" value={num(t.inactive)} />
        <Stat icon={Store} label="Registered businesses" value={num(t.businesses)} />
        <Stat icon={Building2} label="Registered locations" value={num(t.locations)} />
        <Stat icon={Activity} label="Total NFC taps" value={num(t.taps)} />
        <Stat icon={QrCode} label="Total QR scans" value={num(t.scans)} />
      </div>

      <Panel flush>
        <div className="toolbar">
          <div className="search">
            <Search />
            <input className="input" placeholder="Search restaurant, branch, card ID…" value={f.q} onChange={set('q')} />
          </div>
          <select className="input" value={f.region} onChange={set('region')} aria-label="Region">
            <option value="">All regions</option>
            {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.short}</option>)}
          </select>
          <select className="input" value={f.province} onChange={set('province')} aria-label="Province">
            <option value="">All provinces</option>
            {provinceOptions.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select className="input" value={f.city} onChange={set('city')} aria-label="City or municipality">
            <option value="">All cities / municipalities</option>
            {cityOptions.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="input" value={f.status} onChange={set('status')} aria-label="Card status">
            <option value="">All statuses</option>
            {CARD_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <select className="input" value={f.usage} onChange={set('usage')} aria-label="Usage">
            <option value="">All usage</option>
            {Object.entries(USAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {filtered && <Button variant="ghost" onClick={() => setF({ q: '', region: '', province: '', city: '', status: '', usage: '' })}>Clear</Button>}
          <span className="muted" style={{ marginLeft: 'auto' }}>{points.length} location{points.length === 1 ? '' : 's'}</span>
        </div>
        <div style={{ padding: 14, position: 'relative' }}>
          <PHMap points={points} mode={mode} selectedId={selected} onSelect={(p) => setSelected(p.id)} onAction={go} fitKey={fitKey} />
          {points.length === 0 && (
            <div className="map-overlay map-empty" style={{ inset: 14, borderRadius: 12 }}>
              <EmptyState
                icon={MapPin}
                title={filtered ? 'No locations match these filters.' : 'No NFC cards have been assigned to a location yet.'}
                action={filtered ? <Button onClick={() => setF({ q: '', region: '', province: '', city: '', status: '', usage: '' })}>Clear filters</Button> : <Button variant="primary" onClick={() => navigate('/admin/restaurants?new=1')}>Add Restaurant</Button>}
              />
            </div>
          )}
        </div>
      </Panel>

      <div className="grid grid-3">
        <Panel title="Selected location" className="span-2">
          {sel ? (
            <div className="stack">
              <div className="selected-loc">
                <Avatar name={sel.business} src={sel.logo_url} size="lg" />
                <div className="grow">
                  <h2 style={{ fontSize: 18 }}>{sel.business}</h2>
                  <div>{sel.branch}</div>
                  <div className="muted">{sel.address}</div>
                  <div className="muted">{sel.city}, {sel.province} · {regionName(sel.region_code)}</div>
                </div>
                <span className={`badge ${sel.usage}`}>{USAGE_LABELS[sel.usage]}</span>
              </div>
              <div className="kv-inline">
                <div><span>NFC cards</span><b>{sel.cards}</b></div>
                <div><span>Active</span><b>{sel.active}</b></div>
                <div><span>Inactive</span><b>{sel.inactive}</b></div>
                <div><span>Total NFC taps</span><b>{num(sel.taps)}</b></div>
                <div><span>QR scans</span><b>{num(sel.scans)}</b></div>
                <div><span>Last activity</span><b>{sel.last ? longDate(sel.last) : 'None'}</b></div>
              </div>
              <div className="row wrap">
                <Button onClick={() => go('restaurant', sel)}>View restaurant</Button>
                <Button variant="primary" onClick={() => go('cards', sel)}>View NFC cards</Button>
                <Button onClick={() => go('analytics', sel)}>View analytics</Button>
              </div>
            </div>
          ) : (
            <p className="muted">Click a marker on the map or a location in the list to see its details.</p>
          )}
        </Panel>
        <Panel title="Locations" subtitle="Sorted by total interactions" flush>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {list.map((p) => (
              <div key={p.id} className={`search-item ${p.id === selected ? 'on' : ''}`} style={{ borderRadius: 0, padding: '10px 18px' }} onClick={() => setSelected(p.id)}>
                <Layers />
                <div className="grow">
                  <div className="truncate" style={{ fontWeight: 600 }}>{p.business}</div>
                  <div className="truncate muted" style={{ fontSize: 12 }}>{p.branch} · {p.city}</div>
                </div>
                <div className="right">
                  <div style={{ fontWeight: 600 }}>{num(p.taps + p.scans)}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{p.cards} cards</div>
                </div>
              </div>
            ))}
            {list.length === 0 && <p className="muted" style={{ padding: 18 }}>No locations.</p>}
          </div>
        </Panel>
      </div>
    </div>
  )
}

