import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, ExternalLink, Nfc, Pencil, Power, RefreshCw, TriangleAlert } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useAsync, useWorkspace } from '../../lib/workspace'
import { api } from '../../lib/api'
import { cardUrl } from '../../lib/config'
import { ago, dateTime, EVENT_LABELS, longDate, num, pct } from '../../lib/format'
import { regionName } from '../../lib/geo'
import { mapPoints } from '../../lib/derive'
import { writeTagUrl, webNfcSupported, webNfcUnavailableReason } from '../../lib/nfc'
import { Button, CopyField, EmptyState, Modal, Panel, Segmented, Spinner, StatusBadge, useAction, useToast } from '../../components/ui'
import { CardFormModal, ReplaceCardModal } from '../../components/forms'
import { ActivityChart, fillDays, isoDaysAgo } from '../../components/Charts'
import { QRActions, QRImage } from '../../components/QR'
import { CardPreview } from '../../components/CardPreview'
import PHMap from '../../components/PHMap'
import { ActionLabel } from './ActivityLogs'

export default function CardDetail() {
  const { id } = useParams()
  const { ws, cards, reload, version } = useWorkspace()
  const { isAdmin, base, isOwnerOf } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [run] = useAction()
  const [modal, setModal] = useState(null)
  const card = cards.find((c) => c.id === id)
  const from = isoDaysAgo(89)
  const [activity] = useAsync(() => api.getActivity({ from, cardId: id }), [id, version])
  const [events] = useAsync(() => api.getCardEvents(id, 25), [id, version])
  const [history] = useAsync(() => api.getAuditLogs({ cardId: id, limit: 100 }), [id, version])
  const [light, setLight] = useState(false)
  const series = useMemo(() => (activity ? fillDays(activity, from) : null), [activity, from])
  const point = useMemo(() => (card?.branch_id ? mapPoints({ ...ws, cards: [card] }) : []), [ws, card])

  if (!card) return <EmptyState icon={Nfc} title="Card Not Found" text="This card doesn’t exist or you don’t have access to it." action={<Link className="btn" to={`${base}/cards`}>Back to cards</Link>} />

  const business = ws.businesses.find((b) => b.id === card.business_id)
  const branch = ws.branches.find((b) => b.id === card.branch_id)
  const dest = ws.destinations.find((d) => d.id === card.review_destination_id)?.url ?? business?.review_url
  const nfcUrl = cardUrl(card.public_token)
  const qrUrl = cardUrl(card.public_token, 'qr')
  const replacedBy = card.replaced_by && cards.find((c) => c.id === card.replaced_by)
  const replaces = card.replaces && cards.find((c) => c.id === card.replaces)
  const canReplace = card.status !== 'replaced' && (isAdmin || isOwnerOf(card.business_id))
  const editable = card.status !== 'replaced'

  const setStatus = async (status, msg) => {
    const ok = await run(() => api.updateCard(card.id, { status }), msg)
    if (ok) reload()
  }

  const writeTag = async () => {
    try {
      toast('Hold the NFC card against the back of the phone…')
      await writeTagUrl(nfcUrl)
      toast('URL written to the NFC tag')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div className="stack">
      <div>
        <button className="btn ghost sm" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button>
      </div>
      <div className="page-head">
        <div>
          <div className="row wrap">
            <h1 className="mono" style={{ fontSize: 22 }}>{card.card_code}</h1>
            <StatusBadge status={card.status} />
          </div>
          <p>{card.card_name} · {card.card_type}</p>
        </div>
        <div className="row wrap">
          {editable && <Button icon={Pencil} onClick={() => setModal('edit')}>{isAdmin ? 'Edit / reassign' : 'Edit'}</Button>}
          {editable && card.status !== 'suspended' && card.business_id && (
            card.status === 'active'
              ? <Button icon={Power} onClick={() => setStatus('inactive', 'Card deactivated')}>Deactivate</Button>
              : <Button icon={Power} onClick={() => setStatus('active', 'Card activated')}>Activate</Button>
          )}
          {editable && card.status !== 'lost' && card.status !== 'suspended' && <Button icon={TriangleAlert} variant="danger" onClick={() => setModal('lost')}>Mark lost</Button>}
          {isAdmin && editable && card.status !== 'suspended' && <Button icon={Ban} onClick={() => setStatus('suspended', 'Card suspended')}>Suspend</Button>}
          {isAdmin && card.status === 'suspended' && <Button icon={Power} onClick={() => setStatus('inactive', 'Suspension lifted')}>Lift suspension</Button>}
          {canReplace && <Button icon={RefreshCw} variant="primary" onClick={() => setModal('replace')}>Replace card</Button>}
        </div>
      </div>

      {card.status === 'lost' && <p className="alert">This card is marked lost. Its public link is disabled — anyone tapping it sees “This NFC card has been disabled.”</p>}
      {replacedBy && <p className="alert info">This card was replaced by <Link className="link" to={`${base}/cards/${replacedBy.id}`}>{replacedBy.card_code}</Link>. Historical analytics are kept here.</p>}
      {replaces && <p className="alert info">This card replaces <Link className="link" to={`${base}/cards/${replaces.id}`}>{replaces.card_code}</Link>.</p>}

      <Panel title="Where is this NFC card being used?">
        {business ? (
          <div className="grid grid-2">
            <div className="stack-sm">
              <div className="muted">Currently used by</div>
              <h2 style={{ fontSize: 20 }}>{business.name}</h2>
              <div style={{ fontWeight: 550 }}>{branch ? `${branch.name} Branch` : 'No branch assigned'}</div>
              {branch && <div className="muted">{[branch.address, branch.barangay, branch.city].filter(Boolean).join(', ')}, Philippines</div>}
              <dl className="dl" style={{ marginTop: 8 }}>
                <dt>City</dt><dd>{branch?.city ?? '—'}</dd>
                <dt>Province</dt><dd>{branch?.province ?? '—'}</dd>
                <dt>Region</dt><dd>{regionName(branch?.region_code)}</dd>
                <dt>Coordinates</dt><dd className="mono">{branch ? `${branch.lat}, ${branch.lng}` : '—'}</dd>
                <dt>Status</dt><dd><StatusBadge status={card.status} /></dd>
                <dt>Assigned</dt><dd>{longDate(card.assigned_at)}</dd>
                <dt>Last activity</dt><dd>{card.last_used_at ? `${longDate(card.last_used_at)} (${ago(card.last_used_at)})` : 'Never'}</dd>
              </dl>
            </div>
            {point.length > 0 ? (
              <PHMap points={point} size="sm" fitKey={card.branch_id} onAction={(a, p) => navigate(a === 'cards' ? `${base}/cards?branch=${p.id}` : a === 'analytics' ? `${base}/analytics?branch=${p.id}` : isAdmin ? `/admin/restaurants/${p.business_id}` : '/app/profile')} />
            ) : (
              <EmptyState title="No map location" text="Assign this card to a branch to place it on the map." />
            )}
          </div>
        ) : (
          <EmptyState icon={Nfc} title="Unassigned" text="This card is in inventory and not used by any restaurant." action={isAdmin && <Button variant="primary" onClick={() => setModal('edit')}>Assign to a restaurant</Button>} />
        )}
      </Panel>

      <div className="stats-row compact">
        <div className="panel stat"><div className="stat-label">Total NFC taps</div><div className="stat-value">{num(card.taps)}</div></div>
        <div className="panel stat"><div className="stat-label">Total QR scans</div><div className="stat-value">{num(card.scans)}</div></div>
        <div className="panel stat"><div className="stat-label">Landing page visits</div><div className="stat-value">{num(card.views)}</div></div>
        <div className="panel stat"><div className="stat-label">Google Review clicks</div><div className="stat-value">{num(card.clicks)}</div><div className="stat-sub">{pct(card.clicks, card.views)} of visits</div></div>
      </div>

      <div className="grid grid-3">
        <Panel className="span-2" title="Activity" subtitle="Last 90 days">
          {series ? <ActivityChart data={series} series={['nfc', 'qr', 'clicks']} /> : <Spinner />}
        </Panel>
        <Panel title="Card information">
          <dl className="dl">
            <dt>Card ID</dt><dd className="mono">{card.card_code}</dd>
            <dt>NFC UID</dt><dd className="mono">{card.nfc_uid ?? '—'}</dd>
            <dt>Tag type</dt><dd>{card.tag_type ?? '—'}</dd>
            <dt>Manufacturer</dt><dd>{card.manufacturer ?? '—'}</dd>
            <dt>Material</dt><dd>{card.material ?? '—'}</dd>
            <dt>Batch</dt><dd>{card.purchase_batch ?? '—'}</dd>
            <dt>Purchased</dt><dd>{longDate(card.purchase_date)}</dd>
            <dt>Created</dt><dd>{longDate(card.created_at)}</dd>
            <dt>Activated</dt><dd>{longDate(card.activated_at)}</dd>
            {card.deactivated_at && <><dt>Deactivated</dt><dd>{longDate(card.deactivated_at)}</dd></>}
            {business && <><dt>Owner</dt><dd>{business.owner_name ?? '—'}</dd></>}
            {card.notes && <><dt>Notes</dt><dd>{card.notes}</dd></>}
          </dl>
        </Panel>
      </div>

      <div className="grid grid-2">
        <Panel title="Destination & links">
          <div className="stack">
            <div className="field"><span>Public card URL (write this to the NFC tag)</span><CopyField value={nfcUrl} /></div>
            <div className="field"><span>QR code URL (same page, counted as a scan)</span><CopyField value={qrUrl} /></div>
            <div className="field">
              <span>Google Review destination</span>
              {dest ? <a className="link truncate" href={dest} target="_blank" rel="noopener noreferrer">{dest}</a> : <span className="alert warn">This business has not configured its Google Review page yet.</span>}
            </div>
            <div className="row wrap">
              <a className="btn" href={nfcUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Open landing page</a>
              <Button icon={Nfc} onClick={writeTag} disabled={!webNfcSupported} title={webNfcSupported ? 'Write URL to an NFC tag' : webNfcUnavailableReason()}>Write to NFC tag</Button>
            </div>
            {!webNfcSupported && <p className="muted" style={{ fontSize: 12.5 }}><b>{webNfcUnavailableReason()}</b> To program a tag on this device, use an NFC writer app (e.g. NFC Tools) and write a single <b>URL record</b> with the public card URL. On Android Chrome you can write directly from here.</p>}
          </div>
        </Panel>
        <Panel title="QR code & card preview" actions={<Segmented value={light ? 'light' : 'dark'} onChange={(v) => setLight(v === 'light')} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />}>
          <div className="row wrap" style={{ gap: 20, alignItems: 'flex-start' }}>
            <div className="stack-sm" style={{ alignItems: 'center' }}>
              <QRImage text={qrUrl} style={{ width: 150 }} />
            </div>
            <div className="grow stack-sm" style={{ minWidth: 240 }}>
              <CardPreview name={business?.name ?? 'TapReview'} url={qrUrl} light={light} />
              <QRActions text={qrUrl} filename={card.card_code} title={business?.name ?? 'TapReview'} code={card.card_code} />
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-2">
        <Panel title="Recent activity" subtitle="Anonymous interactions — no customer location or identity is stored">
          {!events ? <Spinner /> : events.length === 0 ? <p className="muted">No interactions yet.</p> : (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td><span className={`badge plain ${e.event_type === 'GOOGLE_REVIEW_CLICK' ? 'active' : e.event_type === 'QR_SCAN' ? 'medium' : ''}`}>{EVENT_LABELS[e.event_type]}</span></td>
                      <td className="muted">{[e.device_type, e.browser].filter(Boolean).join(' · ')}</td>
                      <td className="right nowrap muted">{dateTime(e.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Card history" subtitle="Audit trail of every change">
          {!history ? <Spinner /> : history.length === 0 ? <p className="muted">No history.</p> : (
            <ul className="timeline">
              {history.map((l) => (
                <li key={l.id}>
                  <div className="when">{longDate(l.created_at)} · {new Date(l.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</div>
                  <div><ActionLabel log={l} hideCard /></div>
                  <div className="faint" style={{ fontSize: 12 }}>by {l.actor_email ?? 'system'}</div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {modal === 'edit' && <CardFormModal card={card} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload() }} />}
      {modal === 'replace' && <ReplaceCardModal card={card} onClose={() => setModal(null)} onDone={async (nid) => { setModal(null); await reload(); navigate(`${base}/cards/${nid}`) }} />}
      {modal === 'lost' && (
        <Modal
          title="Mark card as lost?"
          onClose={() => setModal(null)}
          footer={
            <>
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button variant="danger" onClick={async () => { setModal(null); await setStatus('lost', 'Card marked lost') }}>Mark lost</Button>
            </>
          }
        >
          <p>The public link for <b>{card.card_code}</b> will be disabled immediately. Anyone who taps or scans it will see “This NFC card has been disabled.” You can replace it afterwards to keep the branch covered.</p>
        </Modal>
      )}
    </div>
  )
}
