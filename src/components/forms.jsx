import { useMemo, useState } from 'react'
import { Nfc, ScanLine } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useWorkspace } from '../lib/workspace'
import { CITIES, PROVINCES, PROVINCE_REGION, REGIONS, citiesOf, findCity } from '../lib/geo'
import { readTagUid, webNfcSupported } from '../lib/nfc'
import { isSafeHttpUrl } from '../lib/format'
import { Button, Field, Modal, useAction, useToast } from './ui'
import LocationPicker from './LocationPicker'

const CARD_TYPES = ['Card', 'Table Stand', 'Stand', 'Sticker', 'Keychain', 'Plaque']
const TAG_TYPES = ['NTAG213', 'NTAG215', 'NTAG216', 'MIFARE Classic', 'Other']
const MATERIALS = ['PVC', 'Wood', 'Metal', 'Epoxy', 'Paper', 'Acrylic']

export function CardFormModal({ card, defaults = {}, onClose, onSaved }) {
  const { isAdmin, isOwnerOf } = useAuth()
  const { ws } = useWorkspace()
  const toast = useToast()
  const [run, busy] = useAction()
  const editing = !!card
  const [f, setF] = useState(() => ({
    card_name: card?.card_name ?? 'Counter Review Card',
    card_type: card?.card_type ?? 'Card',
    nfc_uid: card?.nfc_uid ?? '',
    business_id: card?.business_id ?? defaults.business_id ?? (isAdmin ? '' : ws.businesses.find((b) => isOwnerOf(b.id))?.id ?? ''),
    branch_id: card?.branch_id ?? defaults.branch_id ?? '',
    review_destination_id: card?.review_destination_id ?? '',
    status: card?.status ?? (isAdmin ? 'inactive' : 'active'),
    manufacturer: card?.manufacturer ?? '',
    tag_type: card?.tag_type ?? 'NTAG215',
    material: card?.material ?? 'PVC',
    purchase_batch: card?.purchase_batch ?? '',
    purchase_date: card?.purchase_date ?? '',
    notes: card?.notes ?? '',
  }))
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const businesses = isAdmin ? ws.businesses : ws.businesses.filter((b) => (editing ? b.id === card.business_id : isOwnerOf(b.id)))
  const branches = ws.branches.filter((b) => b.business_id === f.business_id)
  const destinations = ws.destinations.filter((d) => d.business_id === f.business_id)
  const statuses = isAdmin ? ['inactive', 'active', 'suspended', 'lost'] : card?.status === 'suspended' ? ['suspended'] : ['active', 'inactive', 'lost']
  const [reading, setReading] = useState(false)

  const readUid = async () => {
    setReading(true)
    try {
      const uid = await readTagUid()
      setF((x) => ({ ...x, nfc_uid: uid }))
      toast('NFC UID captured')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setReading(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    const payload = { ...f, business_id: f.business_id || null, branch_id: f.business_id ? f.branch_id || null : null }
    if (!isAdmin && editing && payload.nfc_uid === (card.nfc_uid ?? '')) delete payload.nfc_uid
    const saved = await run(() => (editing ? api.updateCard(card.id, payload) : api.createCard(payload)), editing ? 'Card updated' : 'NFC card registered')
    if (saved) onSaved?.(saved)
  }

  return (
    <Modal
      title={editing ? `Edit ${card.card_code}` : 'Register NFC card'}
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="card-form" loading={busy}>
            {editing ? 'Save changes' : 'Create card'}
          </Button>
        </>
      }
    >
      <form id="card-form" onSubmit={submit} className="stack">
        {!editing && <p className="alert info">A unique Card ID and an unpredictable public URL are generated automatically. A QR code is created for the same URL.</p>}
        <div className="form-grid">
          <Field label="Card name">
            <input className="input" required maxLength={80} value={f.card_name} onChange={set('card_name')} />
          </Field>
          <Field label="Card type">
            <select className="input" value={f.card_type} onChange={set('card_type')}>
              {CARD_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Business / restaurant" hint={isAdmin ? 'Leave empty to keep the card in unassigned inventory.' : undefined}>
            <select className="input" value={f.business_id} onChange={(e) => setF((x) => ({ ...x, business_id: e.target.value, branch_id: '', review_destination_id: '' }))} disabled={!isAdmin && editing}>
              {isAdmin && <option value="">— Unassigned (inventory) —</option>}
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Branch / location">
            <select className="input" value={f.branch_id} onChange={set('branch_id')} disabled={!f.business_id}>
              <option value="">— No branch —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.city}</option>)}
            </select>
          </Field>
          <Field label="Destination" hint="Where the “Write a Google Review” button sends customers.">
            <select className="input" value={f.review_destination_id} onChange={set('review_destination_id')} disabled={!f.business_id}>
              <option value="">Business default Google Review link</option>
              {destinations.filter((d) => !d.is_default).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={f.status} onChange={set('status')} disabled={card?.status === 'replaced'}>
              {statuses.map((s) => <option key={s} value={s} disabled={s === 'active' && !f.business_id}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              {card?.status === 'replaced' && <option value="replaced">Replaced</option>}
            </select>
          </Field>
        </div>

        <div className="divider" />
        <h3>Physical card</h3>
        <div className="form-grid">
          <Field label="NFC UID / serial" hint={webNfcSupported ? 'Tap “Read tag” and hold the card to the phone.' : 'Printed on packaging or read with an NFC app.'}>
            <div className="row">
              <input className="input mono" value={f.nfc_uid} onChange={set('nfc_uid')} placeholder="04:A1:7C:22:9B:51:80" maxLength={64} disabled={!isAdmin && !!card?.nfc_uid} />
              {webNfcSupported && <Button type="button" icon={ScanLine} onClick={readUid} loading={reading}>Read tag</Button>}
            </div>
          </Field>
          <Field label="Tag type">
            <select className="input" value={f.tag_type} onChange={set('tag_type')}>
              {TAG_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Manufacturer">
            <input className="input" value={f.manufacturer} onChange={set('manufacturer')} maxLength={80} />
          </Field>
          <Field label="Material">
            <select className="input" value={f.material} onChange={set('material')}>
              {MATERIALS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Purchase batch">
            <input className="input" value={f.purchase_batch} onChange={set('purchase_batch')} maxLength={40} placeholder="BATCH-2026-04" />
          </Field>
          <Field label="Purchase date">
            <input className="input" type="date" value={f.purchase_date ?? ''} onChange={set('purchase_date')} />
          </Field>
          <Field label="Notes" className="full">
            <textarea className="input" value={f.notes ?? ''} onChange={set('notes')} maxLength={500} />
          </Field>
        </div>
      </form>
    </Modal>
  )
}

export function ReplaceCardModal({ card, onClose, onDone }) {
  const [run, busy] = useAction()
  const [uid, setUid] = useState('')
  const [reason, setReason] = useState('Damaged')
  const toast = useToast()
  return (
    <Modal
      title={`Replace ${card.card_code}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={async () => {
              const id = await run(() => api.replaceCard(card.id, { nfc_uid: uid, reason }), 'Card replaced')
              if (id) onDone(id)
            }}>
            Replace card
          </Button>
        </>
      }
    >
      <div className="stack">
        <p>This will:</p>
        <ol className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Mark <b>{card.card_code}</b> as <b>Replaced</b> and disable its public link</li>
          <li>Create a new card with a new public URL and QR code</li>
          <li>Keep the same restaurant, branch and destination</li>
          <li>Keep all historical analytics and record the replacement</li>
        </ol>
        <Field label="Reason">
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            {['Damaged', 'Lost', 'Stolen', 'Faulty chip', 'Rebranding', 'Other'].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="New card NFC UID (optional)">
          <div className="row">
            <input className="input mono" value={uid} onChange={(e) => setUid(e.target.value)} placeholder="04:..." />
            {webNfcSupported && (
              <Button type="button" icon={Nfc} onClick={() => readTagUid().then(setUid, (e) => toast(e.message, 'error'))}>
                Read
              </Button>
            )}
          </div>
        </Field>
        <p className="alert warn">Remember to write the new URL to the replacement tag after creating it.</p>
      </div>
    </Modal>
  )
}

export function BranchFormModal({ branch, businessId, onClose, onSaved }) {
  const { isAdmin, isOwnerOf } = useAuth()
  const { ws } = useWorkspace()
  const [run, busy] = useAction()
  const ownedBiz = ws.businesses.filter((b) => isAdmin || isOwnerOf(b.id))
  const [f, setF] = useState(() => ({
    business_id: branch?.business_id ?? businessId ?? ownedBiz[0]?.id ?? '',
    name: branch?.name ?? '',
    address: branch?.address ?? '',
    barangay: branch?.barangay ?? '',
    region_code: branch?.region_code ?? '',
    province: branch?.province ?? '',
    city: branch?.city ?? '',
    phone: branch?.phone ?? '',
    lat: branch?.lat ?? null,
    lng: branch?.lng ?? null,
  }))
  const [center, setCenter] = useState(null)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const cityOptions = useMemo(() => citiesOf(f.province), [f.province])

  const pickCity = (name) => {
    setF((x) => ({ ...x, city: name }))
    const c = findCity(f.province, name)
    if (c) {
      setCenter([c.lat, c.lng])
      setF((x) => ({ ...x, lat: x.lat ?? c.lat, lng: x.lng ?? c.lng }))
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    const saved = await run(() => api.saveBranch({ ...f, id: branch?.id }), branch ? 'Branch updated' : 'Branch added')
    if (saved) onSaved?.(saved)
  }

  return (
    <Modal
      title={branch ? `Edit ${branch.name}` : 'Add branch'}
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="branch-form" loading={busy}>Save branch</Button>
        </>
      }
    >
      <form id="branch-form" className="stack" onSubmit={submit}>
        <div className="form-grid">
          {!branch && ownedBiz.length > 1 && (
            <Field label="Business" className="full">
              <select className="input" value={f.business_id} onChange={set('business_id')} required>
                {ownedBiz.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Branch name">
            <input className="input" required maxLength={120} value={f.name} onChange={set('name')} placeholder="Davao Downtown" />
          </Field>
          <Field label="Phone">
            <input className="input" value={f.phone ?? ''} onChange={set('phone')} maxLength={40} />
          </Field>
          <Field label="Region">
            <select className="input" required value={f.region_code} onChange={(e) => setF((x) => ({ ...x, region_code: e.target.value, province: '', city: '' }))}>
              <option value="">Select region</option>
              {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.short} — {r.name}</option>)}
            </select>
          </Field>
          <Field label="Province">
            <select className="input" required value={f.province} onChange={(e) => setF((x) => ({ ...x, province: e.target.value, city: '' }))} disabled={!f.region_code}>
              <option value="">Select province</option>
              {(PROVINCES[f.region_code] ?? []).map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="City / municipality" hint="Pick from the list or type a name.">
            <input className="input" required list="city-options" value={f.city} onChange={(e) => pickCity(e.target.value)} disabled={!f.province} maxLength={80} />
            <datalist id="city-options">
              {cityOptions.map((c) => <option key={c.name} value={c.name} />)}
            </datalist>
          </Field>
          <Field label="Barangay">
            <input className="input" value={f.barangay ?? ''} onChange={set('barangay')} maxLength={80} />
          </Field>
          <Field label="Street address" className="full">
            <input className="input" value={f.address ?? ''} onChange={set('address')} maxLength={200} />
          </Field>
        </div>
        <Field label="Registered location" hint="Click the map or drag the pin to the exact branch location. This is what appears on the admin map.">
          <LocationPicker lat={f.lat} lng={f.lng} center={center} onChange={(lat, lng) => setF((x) => ({ ...x, lat, lng }))} />
        </Field>
        <div className="row muted mono">{f.lat != null ? `Lat ${f.lat}, Lng ${f.lng}` : 'No location set yet'}</div>
      </form>
    </Modal>
  )
}

/** Creates a business with its first branch. Used for self-registration and by admins. */
export function BusinessForm({ onDone, submitLabel = 'Create business', compact }) {
  const [run, busy] = useAction()
  const [f, setF] = useState({ name: '', category: 'Restaurant', phone: '', review_url: '', branch_name: 'Main Branch', region_code: '', province: '', city: '', address: '', barangay: '' })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const [pin, setPin] = useState({ lat: null, lng: null })
  const [center, setCenter] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (f.review_url && (!isSafeHttpUrl(f.review_url) || !f.review_url.startsWith('https://'))) throw new Error('Review link must start with https://')
    const city = findCity(f.province, f.city)
    const lat = pin.lat ?? city?.lat
    const lng = pin.lng ?? city?.lng
    const branch = f.city ? { name: f.branch_name, region_code: f.region_code, province: f.province, city: f.city, address: f.address, barangay: f.barangay, lat, lng } : null
    if (branch && lat == null) {
      throw new Error('Set the branch location on the map.')
    }
    const id = await run(() => api.registerBusiness({ name: f.name, category: f.category, phone: f.phone, review_url: f.review_url, branch }), 'Business created')
    if (id) onDone?.(id)
  }

  const toast = useToast()
  return (
    <form className="stack" onSubmit={(e) => submit(e).catch((err) => toast(err.message, 'error'))}>
      <div className="form-grid">
        <Field label="Business / restaurant name" className="full">
          <input className="input" required minLength={2} maxLength={120} value={f.name} onChange={set('name')} placeholder="ABC Coffee" />
        </Field>
        <Field label="Category">
          <select className="input" value={f.category} onChange={set('category')}>
            {['Restaurant', 'Café', 'Bistro', 'Bakery', 'Grill', 'Seafood', 'Bar', 'Hotel', 'Salon', 'Clinic', 'Retail', 'Other'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Contact number">
          <input className="input" value={f.phone} onChange={set('phone')} placeholder="+63 9XX XXX XXXX" maxLength={40} />
        </Field>
        <Field label="Google Review link" className="full" hint="From Google Business Profile → “Ask for reviews”. You can add it later.">
          <input className="input" type="url" value={f.review_url} onChange={set('review_url')} placeholder="https://g.page/r/..." />
        </Field>
        <Field label="First branch name">
          <input className="input" value={f.branch_name} onChange={set('branch_name')} maxLength={120} />
        </Field>
        <Field label="Region">
          <select className="input" value={f.region_code} onChange={(e) => setF((x) => ({ ...x, region_code: e.target.value, province: '', city: '' }))}>
            <option value="">Select region</option>
            {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.short} — {r.name}</option>)}
          </select>
        </Field>
        <Field label="Province">
          <select className="input" value={f.province} onChange={(e) => setF((x) => ({ ...x, province: e.target.value, city: '' }))} disabled={!f.region_code}>
            <option value="">Select province</option>
            {(PROVINCES[f.region_code] ?? []).map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="City / municipality">
          <input
            className="input"
            list="biz-city-options"
            value={f.city}
            disabled={!f.province}
            onChange={(e) => {
              setF((x) => ({ ...x, city: e.target.value }))
              const c = findCity(f.province, e.target.value)
              if (c) setCenter([c.lat, c.lng])
            }}
          />
          <datalist id="biz-city-options">
            {citiesOf(f.province).map((c) => <option key={c.name} value={c.name} />)}
          </datalist>
        </Field>
        <Field label="Street address" className="full">
          <input className="input" value={f.address} onChange={set('address')} maxLength={200} />
        </Field>
      </div>
      {!compact && f.city && (
        <Field label="Pin the exact branch location (optional)">
          <LocationPicker lat={pin.lat} lng={pin.lng} center={center} onChange={(lat, lng) => setPin({ lat, lng })} />
        </Field>
      )}
      <Button variant="primary" type="submit" loading={busy}>{submitLabel}</Button>
    </form>
  )
}

// Re-exported for pages that need the full lists.
export { CITIES, PROVINCE_REGION }
