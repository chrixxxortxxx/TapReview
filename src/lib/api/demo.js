// DEMO MODE adapter: an in-browser database seeded with Philippine demo data.
// Mirrors the Supabase adapter's API and enforces the same permission rules client-side.
// Not secure by design — it exists so the app can be explored without a backend.
import { buildSeed, buildDailyStats, DEMO_PASSWORD, makeToken, makeUuid, prng } from '../../demo/seed.js'

const KEY = 'tapreview-demo-v1'
const SESSION_KEY = 'tapreview-demo-session'
const listeners = new Set()
let db = null
let daily = null // Map key `${card}|${day}` -> row

const rand = prng(Date.now() & 0xffffffff)
const nowIso = () => new Date().toISOString()
const clone = (x) => structuredClone(x)
const delay = (v) => new Promise((r) => setTimeout(() => r(v), 60))

function fail(message) {
  throw new Error(message)
}

function freshDb() {
  const seed = buildSeed(new Date())
  const users = seed.users.map((u) => ({ ...u, password: DEMO_PASSWORD }))
  const admin = users.find((u) => u.role === 'admin')
  const owner = users.find((u) => u.email === 'owner@abccoffee.demo')
  const lost = seed.cards.filter((c) => c.status === 'lost')
  const notifications = [
    ...lost.map((c, i) => ({ id: i + 1, user_id: admin.id, type: 'card.lost', title: 'Card reported lost', body: c.card_code, link: `/admin/cards/${c.id}`, read_at: null, created_at: c.deactivated_at })),
    { id: 10, user_id: admin.id, type: 'business.registered', title: 'New business registration', body: 'Siargao Surf Café is awaiting approval', link: '/admin/restaurants', read_at: null, created_at: nowIso() },
    { id: 11, user_id: owner.id, type: 'card.replaced', title: 'Card replaced', body: 'A damaged Davao Downtown card was replaced', link: '/app/cards', read_at: null, created_at: nowIso() },
    { id: 12, user_id: owner.id, type: 'system', title: 'Welcome to TapReview', body: 'Your NFC cards and QR codes are ready.', link: '/app', read_at: nowIso(), created_at: nowIso() },
  ]
  return {
    version: 1,
    base: seed.base,
    users,
    businesses: seed.businesses,
    members: seed.members,
    destinations: seed.destinations,
    branches: seed.branches,
    cards: seed.cards.map(({ usage, ...c }) => c),
    // Frozen plan for regenerating historical stats deterministically.
    statsPlan: seed.cards.map((c) => ({ id: c.id, business_id: c.business_id, branch_id: c.branch_id, usage: c.usage, status: c.status, activated_at: c.activated_at, deactivated_at: c.deactivated_at })),
    audit: seed.audit,
    notifications,
    events: [],
    nextId: 100000,
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* storage full or unavailable: keep in memory */
  }
}

function load() {
  if (db) return db
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) db = JSON.parse(raw)
  } catch {
    db = null
  }
  if (!db || db.version !== 1) {
    db = freshDb()
    save()
  }
  daily = new Map()
  for (const r of buildDailyStats({ cards: db.statsPlan, base: db.base })) daily.set(`${r.card_id}|${r.day}`, r)
  for (const e of db.events) bumpDaily(e)
  return db
}

const manilaDay = (iso) => new Date(new Date(iso).getTime() + 8 * 36e5).toISOString().slice(0, 10)

function bumpDaily(e) {
  const day = manilaDay(e.created_at)
  const k = `${e.card_id}|${day}`
  const r = daily.get(k) ?? { card_id: e.card_id, business_id: e.business_id, branch_id: e.branch_id, day, nfc: 0, qr: 0, views: 0, clicks: 0 }
  if (e.event_type === 'NFC_TAP') r.nfc++
  if (e.event_type === 'QR_SCAN') r.qr++
  if (e.event_type === 'LANDING_PAGE_VIEW') r.views++
  if (e.event_type === 'GOOGLE_REVIEW_CLICK') r.clicks++
  daily.set(k, r)
}

// ---------------------------------------------------------------------------
// Session & permissions
// ---------------------------------------------------------------------------
function sessionUser() {
  load()
  let id = null
  try {
    id = localStorage.getItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
  const u = db.users.find((x) => x.id === id && x.is_active)
  return u ?? null
}

function profileOf(u) {
  if (!u) return null
  const { password, ...rest } = u
  return { ...rest, memberships: db.members.filter((m) => m.user_id === u.id).map(({ user_id, ...m }) => m) }
}

function requireUser() {
  const u = sessionUser()
  if (!u) fail('Please sign in again.')
  return u
}

const isAdmin = (u) => u?.role === 'admin'
const membership = (u, bizId) => db.members.find((m) => m.user_id === u.id && m.business_id === bizId)
const isOwner = (u, bizId) => isAdmin(u) || membership(u, bizId)?.role === 'owner'
function canAccessBranch(u, bizId, branchId) {
  if (isAdmin(u)) return true
  const m = membership(u, bizId)
  if (!m) return false
  return m.role === 'owner' || !m.branch_ids || m.branch_ids.includes(branchId)
}
const canSeeCard = (u, c) => isAdmin(u) || (c.business_id && canAccessBranch(u, c.business_id, c.branch_id))

function audit(u, action, entity_type, entity_id, extra = {}) {
  db.audit.push({ id: db.nextId++, created_at: nowIso(), action, entity_type, entity_id, actor_id: u?.id ?? null, actor_email: u?.email ?? null, details: {}, ...extra })
}

function notify(userIds, n) {
  for (const user_id of userIds) db.notifications.push({ id: db.nextId++, user_id, read_at: null, created_at: nowIso(), ...n })
}
const adminIds = () => db.users.filter((u) => u.role === 'admin').map((u) => u.id)
const memberIds = (bizId) => db.members.filter((m) => m.business_id === bizId).map((m) => m.user_id)

function emit() {
  const p = profileOf(sessionUser())
  listeners.forEach((cb) => cb(p))
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export async function getSessionUser() {
  return delay(profileOf(sessionUser()))
}

export async function signIn(email, password) {
  load()
  const u = db.users.find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase())
  if (!u || u.password !== password) fail('Invalid email or password.')
  if (!u.is_active) fail('This account has been deactivated.')
  localStorage.setItem(SESSION_KEY, u.id)
  emit()
  return delay(profileOf(u))
}

export async function signUp({ email, password, full_name, phone }) {
  load()
  email = String(email).trim().toLowerCase()
  if (db.users.some((x) => x.email.toLowerCase() === email)) fail('An account with this email already exists.')
  if (String(password).length < 8) fail('Password must be at least 8 characters.')
  const u = { id: makeUuid(rand), email, full_name, phone: phone || null, role: 'business', is_active: true, created_at: nowIso(), password }
  db.users.push(u)
  save()
  localStorage.setItem(SESSION_KEY, u.id)
  emit()
  return delay({ needsConfirmation: false })
}

export async function signOut() {
  localStorage.removeItem(SESSION_KEY)
  emit()
}

export async function requestPasswordReset() {
  return delay(true)
}

export function onAuthChange(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export async function updateMyProfile(patch) {
  const u = requireUser()
  u.full_name = patch.full_name ?? u.full_name
  u.phone = patch.phone ?? u.phone
  if (patch.password) {
    if (patch.password.length < 8) fail('Password must be at least 8 characters.')
    u.password = patch.password
  }
  save()
  emit()
  return delay(profileOf(u))
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
function cardTotals(cardIds, from) {
  const t = new Map()
  for (const r of daily.values()) {
    if (!cardIds.has(r.card_id) || (from && r.day < from)) continue
    const x = t.get(r.card_id) ?? { taps: 0, scans: 0, views: 0, clicks: 0, last_day: null }
    x.taps += r.nfc
    x.scans += r.qr
    x.views += r.views
    x.clicks += r.clicks
    if (!x.last_day || r.day > x.last_day) x.last_day = r.day
    t.set(r.card_id, x)
  }
  return t
}

export async function getWorkspace() {
  const u = requireUser()
  const admin = isAdmin(u)
  const businesses = db.businesses.filter((b) => admin || membership(u, b.id))
  const bizIds = new Set(businesses.map((b) => b.id))
  const branches = db.branches.filter((b) => bizIds.has(b.business_id) && canAccessBranch(u, b.business_id, b.id))
  const cards = db.cards.filter((c) => canSeeCard(u, c))
  const totalsMap = cardTotals(new Set(cards.map((c) => c.id)))
  const lastLive = new Map()
  for (const e of db.events) if (!lastLive.has(e.card_id) || e.created_at > lastLive.get(e.card_id)) lastLive.set(e.card_id, e.created_at)
  const destinations = db.destinations.filter((d) => bizIds.has(d.business_id))
  return delay(clone({
    businesses: businesses.map((b) => {
      const owner = db.users.find((x) => x.id === b.owner_id)
      const dest = destinations.find((d) => d.business_id === b.id && d.is_default)
      return { ...b, owner_name: owner?.full_name ?? null, owner_email: owner?.email ?? null, review_url: dest?.url ?? null }
    }),
    branches,
    destinations,
    cards: cards.map((c) => {
      const t = totalsMap.get(c.id) ?? { taps: 0, scans: 0, views: 0, clicks: 0 }
      const last = lastLive.get(c.id) ?? (t.last_day ? `${t.last_day}T10:00:00.000Z` : null)
      return { ...c, taps: t.taps, scans: t.scans, views: t.views, clicks: t.clicks, last_used_at: last ?? c.last_used_at }
    }),
  }))
}

export async function getActivity({ from, businessId, branchId, cardId } = {}) {
  const u = requireUser()
  const byDay = new Map()
  for (const r of daily.values()) {
    if (from && r.day < from) continue
    if (businessId && r.business_id !== businessId) continue
    if (branchId && r.branch_id !== branchId) continue
    if (cardId && r.card_id !== cardId) continue
    if (!isAdmin(u) && !(r.business_id && canAccessBranch(u, r.business_id, r.branch_id))) continue
    const x = byDay.get(r.day) ?? { day: r.day, nfc: 0, qr: 0, views: 0, clicks: 0 }
    x.nfc += r.nfc
    x.qr += r.qr
    x.views += r.views
    x.clicks += r.clicks
    byDay.set(r.day, x)
  }
  return delay([...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)))
}

export async function getCardTotalsSince(from) {
  const u = requireUser()
  const ids = new Set(db.cards.filter((c) => canSeeCard(u, c)).map((c) => c.id))
  return delay([...cardTotals(ids, from).entries()].map(([card_id, t]) => ({ card_id, ...t })))
}

export async function getCardEvents(cardId, limit = 30) {
  const u = requireUser()
  const card = db.cards.find((c) => c.id === cardId)
  if (!card || !canSeeCard(u, card)) return delay([])
  const live = db.events.filter((e) => e.card_id === cardId)
  // Synthesize a recent feed from the last two days of seeded stats.
  const r = prng(parseInt(cardId.slice(0, 8), 16) ^ 0x5eed)
  const synthetic = []
  const types = ['NFC_TAP', 'LANDING_PAGE_VIEW', 'GOOGLE_REVIEW_CLICK', 'QR_SCAN', 'LANDING_PAGE_VIEW']
  const devices = [['mobile', 'Chrome'], ['mobile', 'Safari'], ['mobile', 'Samsung Internet'], ['tablet', 'Safari']]
  const recentDays = [...daily.values()].filter((x) => x.card_id === cardId).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 2)
  for (const d of recentDays) {
    const n = Math.min(d.nfc + d.qr + d.clicks, 12)
    for (let i = 0; i < n; i++) {
      const [device_type, browser] = devices[Math.floor(r() * devices.length)]
      const t = new Date(`${d.day}T00:00:00+08:00`).getTime() + (9 + r() * 12) * 36e5
      if (t > Date.now()) continue
      synthetic.push({ id: `s${d.day}${i}`, card_id: cardId, event_type: types[Math.floor(r() * types.length)], created_at: new Date(t).toISOString(), device_type, browser })
    }
  }
  return delay(clone([...live, ...synthetic].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit)))
}

export async function getAuditLogs({ cardId, businessId, limit = 300 } = {}) {
  const u = requireUser()
  const visibleBiz = new Set(db.members.filter((m) => m.user_id === u.id).map((m) => m.business_id))
  const rows = db.audit
    .filter((a) => isAdmin(u) || (a.business_id && visibleBiz.has(a.business_id)))
    .filter((a) => (!cardId || a.card_id === cardId) && (!businessId || a.business_id === businessId))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
  return delay(clone(rows))
}

export async function getCardAssignments(cardId) {
  const rows = await getAuditLogs({ cardId })
  return rows.filter((r) => r.action === 'card.assigned' || r.action === 'card.reassigned')
}

export async function getNotifications() {
  const u = requireUser()
  return delay(clone(db.notifications.filter((n) => n.user_id === u.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50)))
}

export async function markAllNotificationsRead() {
  const u = requireUser()
  for (const n of db.notifications) if (n.user_id === u.id && !n.read_at) n.read_at = nowIso()
  save()
  return delay(true)
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
const CARD_FIELDS = ['nfc_uid', 'card_name', 'card_type', 'status', 'business_id', 'branch_id', 'review_destination_id', 'manufacturer', 'tag_type', 'material', 'purchase_batch', 'purchase_date', 'notes', 'photo_url']

function validateCard(c) {
  if (c.branch_id && !db.branches.some((b) => b.id === c.branch_id && b.business_id === c.business_id)) fail('Branch does not belong to the selected business.')
  if (c.status === 'active' && !c.business_id) fail('Assign a business before activating a card.')
  if (c.nfc_uid && db.cards.some((x) => x.id !== c.id && x.nfc_uid && x.nfc_uid.toLowerCase() === c.nfc_uid.toLowerCase())) fail('Another card already uses this NFC UID.')
}

export async function createCard(input) {
  const u = requireUser()
  if (!isAdmin(u) && !(input.business_id && isOwner(u, input.business_id))) fail('You are not allowed to create cards for this business.')
  const seq = db.cards.length + 1
  const card = {
    id: makeUuid(rand), card_code: `TR-NFC-${String(seq).padStart(6, '0')}`, public_token: makeToken(rand),
    card_name: 'Review Card', card_type: 'Card', status: 'inactive', business_id: null, branch_id: null, review_destination_id: null,
    created_at: nowIso(), assigned_at: null, activated_at: null, deactivated_at: null, last_used_at: null, replaced_by: null, replaces: null,
  }
  for (const k of CARD_FIELDS) if (input[k] !== undefined) card[k] = input[k] === '' ? null : input[k]
  if (card.status === 'replaced') fail('Use Replace to replace cards.')
  if (!card.business_id) card.branch_id = null
  validateCard(card)
  if (card.business_id) card.assigned_at = nowIso()
  if (card.status === 'active') card.activated_at = nowIso()
  db.cards.push(card)
  audit(u, 'card.created', 'card', card.id, { card_id: card.id, business_id: card.business_id, details: { card_code: card.card_code } })
  if (card.business_id) {
    const biz = db.businesses.find((b) => b.id === card.business_id)
    const br = db.branches.find((b) => b.id === card.branch_id)
    audit(u, 'card.assigned', 'card', card.id, { card_id: card.id, business_id: card.business_id, details: { to_business: biz?.name, to_branch: br?.name } })
    notify(memberIds(card.business_id), { type: 'card.assigned', title: 'New NFC card assigned', body: `${card.card_code} — ${card.card_name}`, link: `/app/cards/${card.id}` })
  }
  save()
  return delay(clone(card))
}

export async function updateCard(id, patch) {
  const u = requireUser()
  const card = db.cards.find((c) => c.id === id)
  if (!card || !canSeeCard(u, card)) fail('Card not found.')
  const next = { ...card }
  for (const k of CARD_FIELDS) if (patch[k] !== undefined) next[k] = patch[k] === '' ? null : patch[k]
  if (!next.business_id) next.branch_id = null
  if (!isAdmin(u)) {
    if (next.business_id !== card.business_id) fail('Only administrators can reassign cards to another business.')
    if (next.status === 'suspended' && card.status !== 'suspended') fail('Only administrators can suspend cards.')
    if (card.status === 'suspended' && next.status !== 'suspended') fail('This card was suspended by an administrator.')
    if (card.nfc_uid && next.nfc_uid !== card.nfc_uid) fail('Only administrators can change a recorded NFC UID.')
    if (!canAccessBranch(u, next.business_id, next.branch_id)) fail('You do not have access to that branch.')
  }
  if (card.status === 'replaced' && next.status !== 'replaced') fail('Replaced cards cannot be reactivated.')
  if (next.status === 'replaced' && card.status !== 'replaced') fail('Use Replace to replace cards.')
  validateCard(next)

  if (next.status !== card.status) {
    if (next.status === 'active') {
      next.activated_at = nowIso()
      next.deactivated_at = null
    } else next.deactivated_at = nowIso()
    audit(u, 'card.status_changed', 'card', id, { card_id: id, business_id: next.business_id, details: { from: card.status, to: next.status } })
    if (next.business_id) notify(memberIds(next.business_id), { type: `card.${next.status}`, title: `Card ${next.status}`, body: `${card.card_code} is now ${next.status}`, link: `/app/cards/${id}` })
    if (next.status === 'lost') notify(adminIds(), { type: 'card.lost', title: 'Card reported lost', body: card.card_code, link: `/admin/cards/${id}` })
  }
  if (next.business_id !== card.business_id || next.branch_id !== card.branch_id) {
    const name = (list, x) => list.find((y) => y.id === x)?.name ?? null
    next.assigned_at = next.business_id ? nowIso() : null
    if (next.business_id !== card.business_id) next.review_destination_id = null
    audit(u, card.business_id ? 'card.reassigned' : 'card.assigned', 'card', id, {
      card_id: id, business_id: next.business_id ?? card.business_id,
      details: { from_business: name(db.businesses, card.business_id), from_branch: name(db.branches, card.branch_id), to_business: name(db.businesses, next.business_id), to_branch: name(db.branches, next.branch_id) },
    })
    if (next.business_id && next.business_id !== card.business_id) notify(memberIds(next.business_id), { type: 'card.assigned', title: 'New NFC card assigned', body: `${card.card_code} — ${next.card_name}`, link: `/app/cards/${id}` })
  }
  const meta = ['card_name', 'card_type', 'nfc_uid', 'notes', 'manufacturer', 'tag_type', 'material', 'purchase_batch', 'review_destination_id']
  if (meta.some((k) => (next[k] ?? null) !== (card[k] ?? null))) audit(u, 'card.updated', 'card', id, { card_id: id, business_id: next.business_id })
  Object.assign(card, next)
  save()
  return delay(clone(card))
}

export async function replaceCard(id, { nfc_uid, reason } = {}) {
  const u = requireUser()
  const old = db.cards.find((c) => c.id === id)
  if (!old || !canSeeCard(u, old)) fail('Card not found.')
  if (!isAdmin(u) && !(old.business_id && isOwner(u, old.business_id))) fail('Only administrators or owners can replace cards.')
  if (old.status === 'replaced') fail('Card was already replaced.')
  if (nfc_uid && db.cards.some((x) => x.nfc_uid && x.nfc_uid.toLowerCase() === nfc_uid.toLowerCase())) fail('Another card already uses this NFC UID.')
  const fresh = {
    ...old, id: makeUuid(rand), card_code: `TR-NFC-${String(db.cards.length + 1).padStart(6, '0')}`, public_token: makeToken(rand),
    nfc_uid: nfc_uid || null, status: old.business_id ? 'active' : 'inactive', created_at: nowIso(), assigned_at: old.business_id ? nowIso() : null,
    activated_at: old.business_id ? nowIso() : null, deactivated_at: null, last_used_at: null, replaced_by: null, replaces: old.id,
  }
  db.cards.push(fresh)
  old.status = 'replaced'
  old.replaced_by = fresh.id
  old.deactivated_at = nowIso()
  audit(u, 'card.created', 'card', fresh.id, { card_id: fresh.id, business_id: fresh.business_id, details: { card_code: fresh.card_code, replaces: old.card_code } })
  audit(u, 'card.replaced', 'card', old.id, { card_id: old.id, business_id: old.business_id, details: { new_card: fresh.card_code, reason: reason || null } })
  if (old.business_id) notify(memberIds(old.business_id), { type: 'card.replaced', title: 'Card replaced', body: `${old.card_code} was replaced by ${fresh.card_code}`, link: `/app/cards/${fresh.id}` })
  save()
  return delay(fresh.id)
}

// ---------------------------------------------------------------------------
// Businesses, branches, review destinations
// ---------------------------------------------------------------------------
const BUSINESS_FIELDS = ['name', 'category', 'description', 'logo_url', 'cover_url', 'phone', 'email', 'website', 'facebook_url']

export async function registerBusiness(input) {
  const u = requireUser()
  if (!input.name || input.name.trim().length < 2) fail('Business name is required.')
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + makeToken(rand, 4).toLowerCase()
  const forOther = isAdmin(u)
  const biz = {
    id: makeUuid(rand), name: input.name.trim(), slug, category: input.category || null, description: null, logo_url: null, cover_url: null,
    phone: input.phone || null, email: forOther ? null : u.email, website: null, facebook_url: null,
    owner_id: forOther ? null : u.id, status: forOther ? 'active' : 'pending', created_at: nowIso(), updated_at: nowIso(),
  }
  db.businesses.push(biz)
  if (!forOther) db.members.push({ business_id: biz.id, user_id: u.id, role: 'owner', branch_ids: null })
  if (input.review_url) db.destinations.push({ id: makeUuid(rand), business_id: biz.id, label: 'Google Reviews', url: input.review_url, is_default: true, created_at: nowIso() })
  if (input.branch?.name) db.branches.push({ id: makeUuid(rand), business_id: biz.id, status: 'active', created_at: nowIso(), ...input.branch })
  audit(u, 'business.created', 'business', biz.id, { business_id: biz.id, details: { name: biz.name } })
  notify(adminIds().filter((x) => x !== u.id), { type: 'business.registered', title: 'New business registration', body: biz.name, link: `/admin/restaurants/${biz.id}` })
  save()
  emit()
  return delay(biz.id)
}

export async function updateBusiness(id, patch) {
  const u = requireUser()
  const biz = db.businesses.find((b) => b.id === id)
  if (!biz || !isOwner(u, id)) fail('Not allowed.')
  for (const k of BUSINESS_FIELDS) if (patch[k] !== undefined) biz[k] = patch[k] || null
  if (patch.status !== undefined && patch.status !== biz.status) {
    if (!isAdmin(u)) fail('Only administrators can change business status.')
    audit(u, 'business.status_changed', 'business', id, { business_id: id, details: { from: biz.status, to: patch.status } })
    biz.status = patch.status
  }
  biz.updated_at = nowIso()
  audit(u, 'business.updated', 'business', id, { business_id: id })
  save()
  return delay(clone(biz))
}

export async function setReviewUrl(businessId, url) {
  const u = requireUser()
  if (!isOwner(u, businessId)) fail('Only owners can change the Google Review link.')
  if (url && !/^https:\/\//i.test(url)) fail('The review link must start with https://')
  const d = db.destinations.find((x) => x.business_id === businessId && x.is_default)
  if (!url) db.destinations = db.destinations.filter((x) => x !== d)
  else if (d) d.url = url
  else db.destinations.push({ id: makeUuid(rand), business_id: businessId, label: 'Google Reviews', url, is_default: true, created_at: nowIso() })
  audit(u, 'business.review_url_changed', 'business', businessId, { business_id: businessId, details: { url } })
  save()
  return delay(true)
}

const BRANCH_FIELDS = ['name', 'address', 'barangay', 'city', 'province', 'region_code', 'lat', 'lng', 'phone', 'status']

export async function saveBranch(input) {
  const u = requireUser()
  if (!isOwner(u, input.business_id)) fail('Only owners and administrators can manage branches.')
  if (!input.name || !input.city || !input.province || !input.region_code) fail('Name, city, province and region are required.')
  if (input.lat == null || input.lng == null) fail('Set the branch location on the map.')
  let br = input.id && db.branches.find((b) => b.id === input.id)
  if (br) {
    if (br.business_id !== input.business_id) fail('Branches cannot move between businesses.')
    for (const k of BRANCH_FIELDS) if (input[k] !== undefined) br[k] = input[k]
    audit(u, 'branch.updated', 'branch', br.id, { business_id: br.business_id, details: { name: br.name } })
  } else {
    br = { id: makeUuid(rand), business_id: input.business_id, status: 'active', created_at: nowIso() }
    for (const k of BRANCH_FIELDS) if (input[k] !== undefined) br[k] = input[k]
    db.branches.push(br)
    audit(u, 'branch.created', 'branch', br.id, { business_id: br.business_id, details: { name: br.name } })
  }
  save()
  return delay(clone(br))
}

export async function deleteBranch(id) {
  const u = requireUser()
  const br = db.branches.find((b) => b.id === id)
  if (!br || !isOwner(u, br.business_id)) fail('Not allowed.')
  if (db.cards.some((c) => c.branch_id === id && c.status !== 'replaced')) fail('Move or unassign this branch’s cards first.')
  db.branches = db.branches.filter((b) => b.id !== id)
  audit(u, 'branch.deleted', 'branch', id, { business_id: br.business_id, details: { name: br.name } })
  save()
  return delay(true)
}

// ---------------------------------------------------------------------------
// Users & members
// ---------------------------------------------------------------------------
export async function listUsers() {
  const u = requireUser()
  if (!isAdmin(u)) fail('Administrators only.')
  return delay(clone(db.users.map(profileOf)))
}

export async function updateUser(id, patch) {
  const u = requireUser()
  if (!isAdmin(u)) fail('Administrators only.')
  const target = db.users.find((x) => x.id === id)
  if (!target) fail('User not found.')
  if (target.id === u.id && (patch.role === 'business' || patch.is_active === false)) fail('You cannot demote or deactivate yourself.')
  for (const k of ['role', 'is_active', 'full_name', 'phone']) if (patch[k] !== undefined) target[k] = patch[k]
  audit(u, 'user.updated', 'user', id, { details: { email: target.email, ...patch } })
  save()
  return delay(profileOf(target))
}

export async function listMembers(businessId) {
  const u = requireUser()
  if (!isAdmin(u) && !membership(u, businessId)) fail('Not allowed.')
  return delay(clone(db.members.filter((m) => m.business_id === businessId).map((m) => {
    const p = db.users.find((x) => x.id === m.user_id)
    return { ...m, email: p?.email, full_name: p?.full_name }
  })))
}

export async function addMember(businessId, email, role, branchIds) {
  const u = requireUser()
  if (!isOwner(u, businessId)) fail('Only owners can add team members.')
  const target = db.users.find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase())
  if (!target) fail('No account with that email. Ask them to sign up first.')
  const existing = membership(target, businessId)
  if (existing) Object.assign(existing, { role, branch_ids: branchIds?.length ? branchIds : null })
  else db.members.push({ business_id: businessId, user_id: target.id, role, branch_ids: branchIds?.length ? branchIds : null })
  if (role === 'owner' && !db.businesses.find((b) => b.id === businessId).owner_id) db.businesses.find((b) => b.id === businessId).owner_id = target.id
  audit(u, 'member.added', 'business', businessId, { business_id: businessId, details: { email: target.email, role } })
  save()
  return delay(true)
}

export async function removeMember(businessId, userId) {
  const u = requireUser()
  if (!isOwner(u, businessId)) fail('Only owners can remove team members.')
  if (userId === u.id && !isAdmin(u)) fail('You cannot remove yourself.')
  db.members = db.members.filter((m) => !(m.business_id === businessId && m.user_id === userId))
  audit(u, 'member.removed', 'business', businessId, { business_id: businessId, details: { user_id: userId } })
  save()
  return delay(true)
}

// ---------------------------------------------------------------------------
// Public (no account)
// ---------------------------------------------------------------------------
function resolvePublic(token) {
  load()
  const c = db.cards.find((x) => x.public_token === token)
  if (!c) return { state: 'not_found' }
  if (c.status === 'lost' || c.status === 'replaced') return { state: 'disabled' }
  if (c.status !== 'active' || !c.business_id) return { state: 'inactive' }
  const b = db.businesses.find((x) => x.id === c.business_id)
  if (!b || b.status === 'suspended') return { state: 'inactive' }
  const dest = db.destinations.find((d) => d.id === c.review_destination_id) ?? db.destinations.find((d) => d.business_id === b.id && d.is_default)
  return { state: 'ok', card: c, business: b, branch: db.branches.find((x) => x.id === c.branch_id) ?? null, review_url: dest?.url ?? null }
}

function logEvent(c, event_type, referrer) {
  const ua = navigator.userAgent
  const device_type = /ipad|tablet/i.test(ua) ? 'tablet' : /mobi|iphone|android/i.test(ua) ? 'mobile' : 'desktop'
  const browser = /edg\//i.test(ua) ? 'Edge' : /samsungbrowser/i.test(ua) ? 'Samsung Internet' : /crios|chrome/i.test(ua) ? 'Chrome' : /fxios|firefox/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Other'
  const recent = db.events.filter((e) => e.card_id === c.id && Date.now() - new Date(e.created_at).getTime() < 60000).length
  if (recent >= 60) return
  const e = { id: db.nextId++, card_id: c.id, branch_id: c.branch_id, business_id: c.business_id, event_type, created_at: nowIso(), device_type, browser, referrer: referrer || null }
  db.events.push(e)
  if (db.events.length > 3000) db.events = db.events.slice(-3000)
  bumpDaily(e)
  c.last_used_at = e.created_at
}

export async function publicVisit(token, source = 'nfc', referrer = null) {
  const r = resolvePublic(token)
  if (r.state !== 'ok') return delay({ state: r.state })
  logEvent(r.card, source === 'qr' ? 'QR_SCAN' : 'NFC_TAP', referrer)
  logEvent(r.card, 'LANDING_PAGE_VIEW', referrer)
  save()
  const { name, description, logo_url, cover_url, phone, email, website, facebook_url, category } = r.business
  return delay({
    state: 'ok',
    business: { name, description, logo_url, cover_url, phone, email, website, facebook_url, category },
    branch: r.branch ? { name: r.branch.name, address: r.branch.address, city: r.branch.city, province: r.branch.province } : null,
    review_url: r.review_url,
  })
}

export async function publicReviewClick(token) {
  const r = resolvePublic(token)
  if (r.state !== 'ok' || !r.review_url) return null
  logEvent(r.card, 'GOOGLE_REVIEW_CLICK')
  save()
  return r.review_url
}

export async function resetDemo() {
  localStorage.removeItem(KEY)
  localStorage.removeItem(SESSION_KEY)
  db = null
  load()
  emit()
}

export const DEMO_ACCOUNTS = [
  { email: 'admin@tapreview.demo', label: 'Administrator' },
  { email: 'owner@abccoffee.demo', label: 'Business owner (ABC Coffee)' },
  { email: 'staff@abccoffee.demo', label: 'Staff (ABC Coffee, Davao Downtown only)' },
]
export { DEMO_PASSWORD }
