// Pure helpers that turn the raw workspace (businesses, branches, cards with totals) into view models.

export function indexBy(list, key = 'id') {
  const m = new Map()
  for (const x of list) m.set(x[key], x)
  return m
}

export function enrichCards(ws) {
  const biz = indexBy(ws.businesses)
  const br = indexBy(ws.branches)
  return ws.cards.map((c) => {
    const b = biz.get(c.business_id)
    const branch = br.get(c.branch_id)
    return {
      ...c,
      business_name: b?.name ?? null,
      branch_name: branch?.name ?? null,
      city: branch?.city ?? null,
      province: branch?.province ?? null,
      region_code: branch?.region_code ?? null,
      lat: branch?.lat ?? null,
      lng: branch?.lng ?? null,
      address: branch ? [branch.address, branch.barangay, branch.city, branch.province].filter(Boolean).join(', ') : null,
      interactions: (c.taps || 0) + (c.scans || 0),
    }
  })
}

const emptyStats = () => ({ cards: 0, active: 0, inactive: 0, taps: 0, scans: 0, views: 0, clicks: 0, last: null })

function addCard(s, c) {
  s.cards++
  if (c.status === 'active') s.active++
  else s.inactive++
  s.taps += c.taps || 0
  s.scans += c.scans || 0
  s.views += c.views || 0
  s.clicks += c.clicks || 0
  if (c.last_used_at && (!s.last || c.last_used_at > s.last)) s.last = c.last_used_at
}

export function branchStats(ws) {
  const out = new Map(ws.branches.map((b) => [b.id, emptyStats()]))
  for (const c of ws.cards) if (c.branch_id && out.has(c.branch_id)) addCard(out.get(c.branch_id), c)
  return out
}

export function businessStats(ws) {
  const out = new Map(ws.businesses.map((b) => [b.id, { ...emptyStats(), branches: 0 }]))
  for (const b of ws.branches) if (out.has(b.business_id)) out.get(b.business_id).branches++
  for (const c of ws.cards) if (c.business_id && out.has(c.business_id)) addCard(out.get(c.business_id), c)
  return out
}

export function totals(ws) {
  const t = emptyStats()
  for (const c of ws.cards) addCard(t, c)
  const located = new Set(ws.cards.filter((c) => c.branch_id).map((c) => c.branch_id))
  return {
    ...t,
    inactive: ws.cards.filter((c) => c.status !== 'active').length,
    businesses: ws.businesses.length,
    branches: ws.branches.length,
    locations: located.size,
    unassigned: ws.cards.filter((c) => !c.business_id).length,
    assigned: ws.cards.filter((c) => c.business_id).length,
    byStatus: Object.fromEntries(['active', 'inactive', 'suspended', 'lost', 'replaced'].map((s) => [s, ws.cards.filter((c) => c.status === s).length])),
  }
}

/** Usage level for a location/card from its total interactions. */
export function usageLevel(interactions, kind = 'branch') {
  const [hi, mid] = kind === 'card' ? [800, 150] : [3000, 600]
  if (!interactions) return 'none'
  if (interactions >= hi) return 'high'
  if (interactions >= mid) return 'medium'
  return 'low'
}

export const USAGE_LABELS = { high: 'High usage', medium: 'Medium usage', low: 'Low usage', none: 'No activity' }

/** Map points: one per branch that has at least one card. */
export function mapPoints(ws) {
  const biz = indexBy(ws.businesses)
  const stats = branchStats(ws)
  const points = []
  for (const b of ws.branches) {
    const s = stats.get(b.id)
    if (!s || s.cards === 0 || b.lat == null) continue
    const business = biz.get(b.business_id)
    points.push({
      id: b.id,
      business_id: b.business_id,
      business: business?.name ?? '—',
      logo_url: business?.logo_url ?? null,
      branch: b.name,
      address: [b.address, b.barangay, b.city, b.province].filter(Boolean).join(', '),
      city: b.city,
      province: b.province,
      region_code: b.region_code,
      lat: b.lat,
      lng: b.lng,
      ...s,
      usage: usageLevel(s.taps + s.scans),
    })
  }
  return points
}

export function groupSum(list, keyFn, valueFn) {
  const m = new Map()
  for (const x of list) {
    const k = keyFn(x)
    if (k == null) continue
    m.set(k, (m.get(k) || 0) + valueFn(x))
  }
  return [...m.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value)
}

export function matches(q, ...fields) {
  if (!q) return true
  const needle = q.trim().toLowerCase()
  return fields.some((f) => f && String(f).toLowerCase().includes(needle))
}
