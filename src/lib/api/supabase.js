// Supabase adapter. All authorization is enforced server-side by RLS policies and
// security-definer RPCs in supabase/migrations/001_schema.sql; the client never chooses its own permissions.
import { supabase } from '../supabase'

function check({ data, error }) {
  if (error) {
    console.error(error)
    // Surface our own raised messages; hide internal database details.
    const msg = error.code === 'P0001' ? error.message : error.code === '23505' ? 'That value is already in use.' : error.code === '42501' ? 'You do not have permission to do that.' : 'Something went wrong. Please try again.'
    throw new Error(msg)
  }
  return data
}

async function fetchAll(build, pageSize = 1000) {
  const out = []
  for (let from = 0; ; from += pageSize) {
    const data = check(await build().range(from, from + pageSize - 1))
    out.push(...data)
    if (data.length < pageSize) return out
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
async function loadProfile(userId) {
  if (!userId) return null
  const profile = check(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle())
  if (!profile) return null
  const memberships = check(await supabase.from('business_users').select('business_id, role, branch_ids').eq('user_id', userId))
  return { ...profile, memberships }
}

export async function getSessionUser() {
  const { data } = await supabase.auth.getSession()
  return loadProfile(data.session?.user?.id)
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Invalid email or password.' : error.message)
  const p = await loadProfile(data.user.id)
  if (!p?.is_active) {
    await supabase.auth.signOut()
    throw new Error('This account has been deactivated.')
  }
  return p
}

export async function signUp({ email, password, full_name, phone }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name, phone }, emailRedirectTo: `${window.location.origin}/login` },
  })
  if (error) throw new Error(error.message)
  return { needsConfirmation: !data.session }
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/app/settings` })
  if (error) throw new Error(error.message)
  return true
}

export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(async () => cb(await loadProfile(session?.user?.id)), 0)
  })
  return () => data.subscription.unsubscribe()
}

export async function updateMyProfile(patch) {
  const { data } = await supabase.auth.getUser()
  const id = data.user.id
  check(await supabase.from('profiles').update({ full_name: patch.full_name, phone: patch.phone }).eq('id', id))
  if (patch.password) {
    const { error } = await supabase.auth.updateUser({ password: patch.password })
    if (error) throw new Error(error.message)
  }
  return loadProfile(id)
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
export async function getWorkspace() {
  const [businesses, branches, cards, destinations, totals] = await Promise.all([
    fetchAll(() => supabase.from('businesses').select('*, owner:profiles!businesses_owner_id_fkey(full_name, email)').order('name')),
    fetchAll(() => supabase.from('branches').select('*').order('name')),
    fetchAll(() => supabase.from('nfc_cards').select('*').order('card_code')),
    fetchAll(() => supabase.from('review_destinations').select('*')),
    fetchAll(() => supabase.from('card_totals').select('*')),
  ])
  const t = new Map(totals.map((x) => [x.card_id, x]))
  return {
    businesses: businesses.map(({ owner, ...b }) => ({
      ...b,
      owner_name: owner?.full_name ?? null,
      owner_email: owner?.email ?? null,
      review_url: destinations.find((d) => d.business_id === b.id && d.is_default)?.url ?? null,
    })),
    branches,
    destinations,
    cards: cards.map((c) => {
      const x = t.get(c.id)
      return { ...c, taps: x?.taps ?? 0, scans: x?.scans ?? 0, views: x?.views ?? 0, clicks: x?.clicks ?? 0 }
    }),
  }
}

export async function getActivity({ from, businessId, branchId, cardId } = {}) {
  const rows = check(await supabase.rpc('activity_by_day', { p_from: from, p_business: businessId ?? null, p_branch: branchId ?? null, p_card: cardId ?? null }))
  return rows.map((r) => ({ day: r.day, nfc: +r.nfc, qr: +r.qr, views: +r.views, clicks: +r.clicks }))
}

export async function getCardTotalsSince(from) {
  const rows = check(await supabase.rpc('card_totals_since', { p_from: from }))
  return rows.map((r) => ({ card_id: r.card_id, taps: +r.taps, scans: +r.scans, views: +r.views, clicks: +r.clicks }))
}

export async function getCardEvents(cardId, limit = 30) {
  return check(await supabase.from('interaction_events').select('id, event_type, created_at, device_type, browser').eq('card_id', cardId).order('created_at', { ascending: false }).limit(limit))
}

export async function getAuditLogs({ cardId, businessId, limit = 300 } = {}) {
  let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit)
  if (cardId) q = q.eq('card_id', cardId)
  if (businessId) q = q.eq('business_id', businessId)
  return check(await q)
}

export async function getCardAssignments(cardId) {
  const rows = await getAuditLogs({ cardId })
  return rows.filter((r) => r.action === 'card.assigned' || r.action === 'card.reassigned')
}

export async function getNotifications() {
  return check(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50))
}

export async function markAllNotificationsRead() {
  check(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null))
  return true
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
const CARD_FIELDS = ['nfc_uid', 'card_name', 'card_type', 'status', 'business_id', 'branch_id', 'review_destination_id', 'manufacturer', 'tag_type', 'material', 'purchase_batch', 'purchase_date', 'notes', 'photo_url']
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k] === '' ? null : obj[k]]))

export async function createCard(input) {
  return check(await supabase.from('nfc_cards').insert(pick(input, CARD_FIELDS)).select().single())
}

export async function updateCard(id, patch) {
  return check(await supabase.from('nfc_cards').update(pick(patch, CARD_FIELDS)).eq('id', id).select().single())
}

export async function replaceCard(id, { nfc_uid, reason } = {}) {
  return check(await supabase.rpc('replace_card', { p_card: id, p_nfc_uid: nfc_uid || null, p_reason: reason || null }))
}

// ---------------------------------------------------------------------------
// Businesses, branches, review destinations
// ---------------------------------------------------------------------------
const BUSINESS_FIELDS = ['name', 'category', 'description', 'logo_url', 'cover_url', 'phone', 'email', 'website', 'facebook_url', 'status']

export async function registerBusiness(input) {
  const b = input.branch ?? {}
  return check(await supabase.rpc('register_business', {
    p_name: input.name, p_category: input.category || null, p_phone: input.phone || null, p_review_url: input.review_url || null,
    p_branch_name: b.name || null, p_address: b.address || null, p_barangay: b.barangay || null, p_city: b.city || null,
    p_province: b.province || null, p_region: b.region_code || null, p_lat: b.lat ?? null, p_lng: b.lng ?? null,
  }))
}

export async function updateBusiness(id, patch) {
  return check(await supabase.from('businesses').update(pick(patch, BUSINESS_FIELDS)).eq('id', id).select().single())
}

export async function setReviewUrl(businessId, url) {
  const existing = check(await supabase.from('review_destinations').select('id').eq('business_id', businessId).eq('is_default', true).maybeSingle())
  if (!url && existing) check(await supabase.from('review_destinations').delete().eq('id', existing.id))
  else if (existing) check(await supabase.from('review_destinations').update({ url }).eq('id', existing.id))
  else if (url) check(await supabase.from('review_destinations').insert({ business_id: businessId, url, is_default: true }))
  return true
}

const BRANCH_FIELDS = ['business_id', 'name', 'address', 'barangay', 'city', 'province', 'region_code', 'lat', 'lng', 'phone', 'status']

export async function saveBranch(input) {
  const row = pick(input, BRANCH_FIELDS)
  if (input.id) return check(await supabase.from('branches').update(row).eq('id', input.id).select().single())
  return check(await supabase.from('branches').insert(row).select().single())
}

export async function deleteBranch(id) {
  const { count } = await supabase.from('nfc_cards').select('id', { count: 'exact', head: true }).eq('branch_id', id).neq('status', 'replaced')
  if (count) throw new Error('Move or unassign this branch’s cards first.')
  check(await supabase.from('branches').delete().eq('id', id))
  return true
}

// ---------------------------------------------------------------------------
// Users & members
// ---------------------------------------------------------------------------
export async function listUsers() {
  const [profiles, members] = await Promise.all([
    fetchAll(() => supabase.from('profiles').select('*').order('created_at')),
    fetchAll(() => supabase.from('business_users').select('*')),
  ])
  return profiles.map((p) => ({ ...p, memberships: members.filter((m) => m.user_id === p.id) }))
}

export async function updateUser(id, patch) {
  return check(await supabase.from('profiles').update(pick(patch, ['role', 'is_active', 'full_name', 'phone'])).eq('id', id).select().single())
}

export async function listMembers(businessId) {
  const rows = check(await supabase.from('business_users').select('*, profile:profiles(email, full_name)').eq('business_id', businessId))
  return rows.map(({ profile, ...m }) => ({ ...m, email: profile?.email, full_name: profile?.full_name }))
}

export async function addMember(businessId, email, role, branchIds) {
  check(await supabase.rpc('add_business_member', { p_business: businessId, p_email: email, p_role: role, p_branch_ids: branchIds?.length ? branchIds : null }))
  return true
}

export async function removeMember(businessId, userId) {
  check(await supabase.from('business_users').delete().eq('business_id', businessId).eq('user_id', userId))
  return true
}

// ---------------------------------------------------------------------------
// Public (anonymous)
// ---------------------------------------------------------------------------
export async function publicVisit(token, source = 'nfc', referrer = null) {
  const { data, error } = await supabase.rpc('public_card_visit', { p_token: token, p_source: source, p_referrer: referrer })
  if (error) return { state: 'error' }
  return data
}

export async function publicReviewClick(token) {
  const { data, error } = await supabase.rpc('public_review_click', { p_token: token })
  if (error) return null
  return data
}

export async function resetDemo() {}
export const DEMO_ACCOUNTS = []
export const DEMO_PASSWORD = ''
