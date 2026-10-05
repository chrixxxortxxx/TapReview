import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Printer, QrCode, Search } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useWorkspace } from '../../lib/workspace'
import { cardUrl } from '../../lib/config'
import { matches } from '../../lib/derive'
import { Button, CopyField, EmptyState, Pager, Panel, Segmented, StatusBadge, usePaged } from '../../components/ui'
import { printQrs, QRActions, QRImage } from '../../components/QR'
import { CardPreview } from '../../components/CardPreview'

export default function QRCodes() {
  const { ws, cards } = useWorkspace()
  const { base } = useAuth()
  const [q, setQ] = useState('')
  const [biz, setBiz] = useState('')
  const [branch, setBranch] = useState('')
  const [onlyActive, setOnlyActive] = useState(true)
  const [previewId, setPreviewId] = useState(null)
  const [light, setLight] = useState(false)

  const rows = useMemo(
    () =>
      cards.filter(
        (c) =>
          c.business_id &&
          (!onlyActive || c.status === 'active') &&
          (!biz || c.business_id === biz) &&
          (!branch || c.branch_id === branch) &&
          matches(q, c.card_code, c.card_name, c.business_name, c.branch_name, c.city),
      ),
    [cards, q, biz, branch, onlyActive],
  )
  const paged = usePaged(rows, 24, q + biz + branch + onlyActive)
  const preview = cards.find((c) => c.id === previewId) ?? rows[0]

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>QR Codes</h1>
          <p>Every NFC card has a matching QR code that opens the same landing page — a fallback for phones without NFC.</p>
        </div>
        <Button
          icon={Printer}
          disabled={!rows.length}
          onClick={() => printQrs(rows.slice(0, 60).map((c) => ({ text: cardUrl(c.public_token, 'qr'), title: c.business_name, code: `${c.card_code} · ${c.branch_name ?? ''}` })))}
        >
          Print {Math.min(rows.length, 60)} QR codes
        </Button>
      </div>

      {preview && (
        <Panel title="Card preview" subtitle="How the printed card could look. Preview before printing." actions={<Segmented value={light ? 'light' : 'dark'} onChange={(v) => setLight(v === 'light')} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />}>
          <div className="row wrap" style={{ gap: 24, alignItems: 'center' }}>
            <CardPreview name={preview.business_name} url={cardUrl(preview.public_token, 'qr')} light={light} />
            <div className="stack-sm grow" style={{ minWidth: 240 }}>
              <div className="row"><b className="mono">{preview.card_code}</b><StatusBadge status={preview.status} /></div>
              <div className="muted">{preview.business_name} · {preview.branch_name} · {preview.card_name}</div>
              <CopyField value={cardUrl(preview.public_token, 'qr')} />
              <QRActions text={cardUrl(preview.public_token, 'qr')} filename={preview.card_code} title={preview.business_name} code={preview.card_code} />
            </div>
          </div>
        </Panel>
      )}

      <Panel flush>
        <div className="toolbar">
          <div className="search">
            <Search />
            <input className="input" placeholder="Search card, restaurant, branch…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {ws.businesses.length > 1 && (
            <select className="input" value={biz} onChange={(e) => { setBiz(e.target.value); setBranch('') }} aria-label="Restaurant">
              <option value="">All restaurants</option>
              {ws.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select className="input" value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch">
            <option value="">All branches</option>
            {ws.branches.filter((b) => !biz || b.business_id === biz).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <label className="check"><input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} /> Active cards only</label>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={QrCode} title="No QR codes to show." text="QR codes are created automatically for every NFC card assigned to a business." action={<Link className="btn primary" to={`${base}/cards?new=1`}>Register NFC Card</Link>} />
        ) : (
          <>
            <div className="qr-grid" style={{ padding: 14 }}>
              {paged.slice.map((c) => (
                <div key={c.id} className="panel qr-tile">
                  <button style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', alignSelf: 'center' }} onClick={() => setPreviewId(c.id)} title="Preview card">
                    <QRImage text={cardUrl(c.public_token, 'qr')} size={300} />
                  </button>
                  <div>
                    <div className="row between"><b className="mono">{c.card_code}</b><StatusBadge status={c.status} /></div>
                    <div className="truncate">{c.business_name}</div>
                    <div className="cell-sub truncate">{c.branch_name} · {c.card_name}</div>
                  </div>
                  <QRActions text={cardUrl(c.public_token, 'qr')} filename={c.card_code} title={c.business_name} code={c.card_code} />
                </div>
              ))}
            </div>
            <Pager paged={paged} />
          </>
        )}
      </Panel>
    </div>
  )
}
