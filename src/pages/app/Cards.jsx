import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleCheck, Download, Eye, Nfc, PackageCheck, PackageOpen, Pencil, Plus, Power, QrCode, RefreshCw, Search, TriangleAlert, X } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useWorkspace } from '../../lib/workspace'
import { api } from '../../lib/api'
import { cardUrl } from '../../lib/config'
import { matches, totals, usageLevel, USAGE_LABELS } from '../../lib/derive'
import { CARD_STATUSES, date, downloadCsv, num, statusLabel } from '../../lib/format'
import { REGIONS } from '../../lib/geo'
import { Button, CopyField, EmptyState, Modal, Pager, Panel, Stat, StatusBadge, useAction, usePaged, useSort } from '../../components/ui'
import { CardFormModal, ReplaceCardModal } from '../../components/forms'
import { QRActions, QRImage } from '../../components/QR'

export default function Cards() {
  const { ws, cards, reload } = useWorkspace()
  const { isAdmin, base, isOwnerAnywhere, isOwnerOf } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [modal, setModal] = useState(null) // {type, card}
  const [run] = useAction()
  const f = {
    q: params.get('q') ?? '',
    status: params.get('status') ?? '',
    business: params.get('business') ?? '',
    branch: params.get('branch') ?? '',
    region: params.get('region') ?? '',
    assigned: params.get('assigned') ?? '',
    usage: params.get('usage') ?? '',
  }
  const setFilter = (k, v) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    if (k === 'business') p.delete('branch')
    setParams(p, { replace: true })
  }

  useEffect(() => {
    if (params.get('new') === '1') {
      setModal({ type: 'new' })
      const p = new URLSearchParams(params)
      p.delete('new')
      setParams(p, { replace: true })
    }
  }, [params, setParams])

  const t = useMemo(() => totals(ws), [ws])
  const rows = useMemo(
    () =>
      cards
        .map((c) => ({ ...c, usage: usageLevel(c.interactions, 'card') }))
        .filter(
          (c) =>
            matches(f.q, c.card_code, c.nfc_uid, c.card_name, c.business_name, c.branch_name, c.city, c.public_token) &&
            (!f.status || c.status === f.status) &&
            (!f.business || c.business_id === f.business) &&
            (!f.branch || c.branch_id === f.branch) &&
            (!f.region || c.region_code === f.region) &&
            (!f.assigned || (f.assigned === 'yes' ? !!c.business_id : !c.business_id)) &&
            (!f.usage || c.usage === f.usage),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, params],
  )
  const [sorted, th] = useSort(rows, 'card_code', 'asc')
  const paged = usePaged(sorted, 25, params.toString())
  const branchFilter = f.branch && ws.branches.find((b) => b.id === f.branch)
  const anyFilter = Object.values(f).some(Boolean)

  const toggle = async (c) => {
    const next = c.status === 'active' ? 'inactive' : 'active'
    const ok = await run(() => api.updateCard(c.id, { status: next }), next === 'active' ? 'Card activated' : 'Card deactivated')
    if (ok) reload()
  }

  const exportCsv = () =>
    downloadCsv(`tapreview-nfc-cards-${new Date().toISOString().slice(0, 10)}.csv`, [
      { label: 'Card ID', key: 'card_code' },
      { label: 'NFC UID', key: 'nfc_uid' },
      { label: 'Restaurant', key: 'business_name' },
      { label: 'Branch', key: 'branch_name' },
      { label: 'City', key: 'city' },
      { label: 'Province', key: 'province' },
      { label: 'Region', key: 'region_code' },
      { label: 'Card name', key: 'card_name' },
      { label: 'Card type', key: 'card_type' },
      { label: 'Status', key: 'status' },
      { label: 'NFC URL', value: (c) => cardUrl(c.public_token) },
      { label: 'QR URL', value: (c) => cardUrl(c.public_token, 'qr') },
      { label: 'Total taps', key: 'taps' },
      { label: 'Total QR scans', key: 'scans' },
      { label: 'Created', value: (c) => date(c.created_at) },
      { label: 'Last used', value: (c) => date(c.last_used_at) },
    ], sorted)

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>NFC Cards</h1>
          <p>{isAdmin ? 'Inventory and assignment of every physical NFC card.' : 'Cards linked to your branches.'}</p>
        </div>
        <div className="row">
          <Button icon={Download} onClick={exportCsv}>Export CSV</Button>
          {(isAdmin || isOwnerAnywhere) && <Button variant="primary" icon={Plus} onClick={() => setModal({ type: 'new' })}>Register NFC card</Button>}
        </div>
      </div>

      {isAdmin && (
        <div className="stats-row compact">
          <Stat icon={Nfc} label="Total physical cards" value={num(t.cards)} />
          <button className="panel stat" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setFilter('assigned', 'no')}>
            <div className="stat-label"><PackageOpen /> Unassigned</div>
            <div className="stat-value">{num(t.unassigned)}</div>
          </button>
          <button className="panel stat" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setFilter('assigned', 'yes')}>
            <div className="stat-label"><PackageCheck /> Assigned</div>
            <div className="stat-value">{num(t.assigned)}</div>
          </button>
          {['active', 'inactive', 'lost', 'replaced'].map((s) => (
            <button key={s} className="panel stat" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setFilter('status', s)}>
              <div className="stat-label">{s === 'active' ? <CircleCheck /> : s === 'lost' ? <TriangleAlert /> : null} {statusLabel(s)}</div>
              <div className="stat-value">{num(t.byStatus[s])}</div>
            </button>
          ))}
        </div>
      )}

      <Panel flush>
        <div className="toolbar">
          <div className="search">
            <Search />
            <input className="input" placeholder="Card ID, NFC UID, name, restaurant, city…" value={f.q} onChange={(e) => setFilter('q', e.target.value)} />
          </div>
          <select className="input" value={f.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {CARD_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          {ws.businesses.length > 1 && (
            <select className="input" value={f.business} onChange={(e) => setFilter('business', e.target.value)} aria-label="Restaurant">
              <option value="">All restaurants</option>
              {ws.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select className="input" value={f.branch} onChange={(e) => setFilter('branch', e.target.value)} aria-label="Branch">
            <option value="">All branches</option>
            {ws.branches.filter((b) => !f.business || b.business_id === f.business).map((b) => <option key={b.id} value={b.id}>{b.name} · {b.city}</option>)}
          </select>
          {isAdmin && (
            <>
              <select className="input" value={f.region} onChange={(e) => setFilter('region', e.target.value)} aria-label="Region">
                <option value="">All regions</option>
                {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.short}</option>)}
              </select>
              <select className="input" value={f.assigned} onChange={(e) => setFilter('assigned', e.target.value)} aria-label="Assignment">
                <option value="">Assigned & unassigned</option>
                <option value="yes">Assigned</option>
                <option value="no">Unassigned</option>
              </select>
            </>
          )}
          <select className="input" value={f.usage} onChange={(e) => setFilter('usage', e.target.value)} aria-label="Usage">
            <option value="">All usage</option>
            {Object.entries(USAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {anyFilter && <Button variant="ghost" icon={X} onClick={() => setParams({}, { replace: true })}>Clear</Button>}
        </div>
        {branchFilter && (
          <div className="row" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <span className="muted">Showing cards at</span>
            <b>{ws.businesses.find((b) => b.id === branchFilter.business_id)?.name} — {branchFilter.name}</b>
            <span className="muted">({branchFilter.city})</span>
          </div>
        )}

        {cards.length === 0 ? (
          <EmptyState icon={Nfc} title="No NFC cards registered yet." action={(isAdmin || isOwnerAnywhere) && <Button variant="primary" icon={Plus} onClick={() => setModal({ type: 'new' })}>Register NFC Card</Button>} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Search} title="No cards match these filters." action={<Button onClick={() => setParams({}, { replace: true })}>Clear filters</Button>} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    {th('card_code', 'Card ID')}
                    {th('nfc_uid', 'NFC UID')}
                    {th('business_name', 'Restaurant / branch')}
                    {th('city', 'Location')}
                    {th('card_name', 'Card')}
                    {th('status', 'Status')}
                    <th>NFC URL</th>
                    {th('taps', 'Taps', 'num')}
                    {th('scans', 'QR scans', 'num')}
                    {th('created_at', 'Created')}
                    {th('last_used_at', 'Last used')}
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.slice.map((c) => (
                    <tr key={c.id} className="click" onClick={() => navigate(`${base}/cards/${c.id}`)}>
                      <td className="mono nowrap"><b>{c.card_code}</b></td>
                      <td className="mono faint nowrap">{c.nfc_uid ?? '—'}</td>
                      <td>
                        {c.business_name ? (
                          <>
                            <div className="cell-title">{c.business_name}</div>
                            <div className="cell-sub">{c.branch_name ?? 'No branch'}</div>
                          </>
                        ) : <span className="badge plain">Unassigned</span>}
                      </td>
                      <td className="nowrap">{c.city ? <>{c.city}<div className="cell-sub">{c.province}</div></> : '—'}</td>
                      <td>
                        <div>{c.card_name}</div>
                        <div className="cell-sub">{c.card_type}</div>
                      </td>
                      <td><StatusBadge status={c.status} /></td>
                      <td className="mono nowrap" style={{ fontSize: 12 }}>{cardUrl(c.public_token).replace(/^https?:\/\//, '')}</td>
                      <td className="num">{num(c.taps)}</td>
                      <td className="num">{num(c.scans)}</td>
                      <td className="nowrap">{date(c.created_at)}</td>
                      <td className="nowrap">{date(c.last_used_at)}</td>
                      <td className="right nowrap" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" icon={Eye} title="View" onClick={() => navigate(`${base}/cards/${c.id}`)} />
                        {c.status !== 'replaced' && <Button size="sm" variant="ghost" icon={Pencil} title="Edit" onClick={() => setModal({ type: 'edit', card: c })} />}
                        <Button size="sm" variant="ghost" icon={QrCode} title="QR code" onClick={() => setModal({ type: 'qr', card: c })} />
                        {c.status !== 'replaced' && c.status !== 'suspended' && c.business_id && (
                          <Button size="sm" variant="ghost" icon={Power} title={c.status === 'active' ? 'Deactivate' : 'Activate'} onClick={() => toggle(c)} />
                        )}
                        {c.status !== 'replaced' && (isAdmin || isOwnerOf(c.business_id)) && (
                          <Button size="sm" variant="ghost" icon={RefreshCw} title="Replace" onClick={() => setModal({ type: 'replace', card: c })} />
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

      {modal?.type === 'new' && (
        <CardFormModal
          defaults={{ business_id: f.business || (branchFilter?.business_id ?? undefined), branch_id: f.branch || undefined }}
          onClose={() => setModal(null)}
          onSaved={async (c) => {
            setModal(null)
            await reload()
            navigate(`${base}/cards/${c.id}`)
          }}
        />
      )}
      {modal?.type === 'edit' && <CardFormModal card={modal.card} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload() }} />}
      {modal?.type === 'replace' && (
        <ReplaceCardModal
          card={modal.card}
          onClose={() => setModal(null)}
          onDone={async (id) => {
            setModal(null)
            await reload()
            navigate(`${base}/cards/${id}`)
          }}
        />
      )}
      {modal?.type === 'qr' && <QrModal card={modal.card} onClose={() => setModal(null)} />}
    </div>
  )
}

export function QrModal({ card, onClose }) {
  const { base } = useAuth()
  const url = cardUrl(card.public_token, 'qr')
  return (
    <Modal title={`QR code · ${card.card_code}`} onClose={onClose}>
      <div className="stack" style={{ alignItems: 'center' }}>
        <QRImage text={url} style={{ width: 240 }} />
        <div style={{ width: '100%' }}>
          <CopyField value={url} />
        </div>
        <QRActions text={url} filename={card.card_code} title={card.business_name ?? 'TapReview'} code={card.card_code} />
        <Link className="link" to={`${base}/cards/${card.id}`} onClick={onClose}>Open card details & preview →</Link>
      </div>
    </Modal>
  )
}
