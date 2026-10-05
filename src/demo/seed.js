// Deterministic Philippine demo dataset.
// Used by demo mode (src/lib/api/demo.js) and by scripts/generate-seed.mjs for supabase/seed.sql.
import { findCity, PROVINCE_REGION } from '../lib/geo.js'

export function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TOKEN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export function makeToken(rand, len = 10) {
  let s = ''
  for (let i = 0; i < len; i++) s += TOKEN_ALPHABET[Math.floor(rand() * TOKEN_ALPHABET.length)]
  return s
}

export function makeUuid(rand) {
  const h = () => Math.floor(rand() * 16).toString(16)
  const part = (n) => Array.from({ length: n }, h).join('')
  return `${part(8)}-${part(4)}-4${part(3)}-${'89ab'[Math.floor(rand() * 4)]}${part(3)}-${part(12)}`
}

export const DEMO_PASSWORD = 'demo1234'

// usage: H(igh) M(edium) L(ow) N(one)
const BUSINESSES = [
  {
    name: 'ABC Coffee', category: 'Café', owner: 'Juan Dela Cruz', email: 'owner@abccoffee.demo', phone: '+63 917 555 0101',
    description: 'Specialty coffee roasted in Davao, served with local pastries.',
    branches: [
      { name: 'Davao Downtown', province: 'Davao del Sur', city: 'Davao City', barangay: 'Poblacion', address: '88 San Pedro St.', cards: 12, usage: 'HHHHMMMMMLLL' },
      { name: 'Lanang Branch', province: 'Davao del Sur', city: 'Davao City', barangay: 'Lanang', address: 'JP Laurel Ave.', cards: 8, usage: 'HHMMMLLN', offset: [0.06, 0.04] },
      { name: 'Matina Branch', province: 'Davao del Sur', city: 'Davao City', barangay: 'Matina', address: 'MacArthur Hwy.', cards: 6, usage: 'MMMLLN', offset: [-0.03, -0.04] },
    ],
  },
  {
    name: 'Sample Restaurant', category: 'Restaurant', owner: 'Ana Reyes', email: 'owner@samplerestaurant.demo', phone: '+63 917 555 0102',
    description: 'Filipino comfort food, family-style.',
    branches: [
      { name: 'Cebu IT Park', province: 'Cebu', city: 'Cebu City', barangay: 'Apas', address: 'Lahug, IT Park', cards: 15, usage: 'HHHHHMMMMMMLLLN', offset: [0.02, 0.02] },
      { name: 'Mandaue Branch', province: 'Cebu', city: 'Mandaue', barangay: 'Centro', address: 'A.C. Cortes Ave.', cards: 6, usage: 'MMLLLN' },
    ],
  },
  {
    name: 'Manila Cafe', category: 'Café', owner: 'Carlo Mendoza', email: 'owner@manilacafe.demo', phone: '+63 917 555 0103',
    description: 'All-day café and brunch spot in the heart of the metro.',
    branches: [
      { name: 'Makati Legazpi', province: 'Metro Manila', city: 'Makati', barangay: 'Legazpi Village', address: 'Rufino St.', cards: 10, usage: 'HHHHHMMMLL' },
      { name: 'BGC High Street', province: 'Metro Manila', city: 'Taguig', barangay: 'Fort Bonifacio', address: '9th Ave.', cards: 8, usage: 'HHHMMMLL' },
      { name: 'Ortigas Center', province: 'Metro Manila', city: 'Pasig', barangay: 'San Antonio', address: 'ADB Ave.', cards: 6, usage: 'MMMLLN' },
    ],
  },
  {
    name: 'Sample Bistro', category: 'Bistro', owner: 'Liza Fernandez', email: 'owner@samplebistro.demo', phone: '+63 917 555 0104',
    description: 'Neighborhood bistro with seasonal plates.',
    branches: [
      { name: 'Maginhawa', province: 'Metro Manila', city: 'Quezon City', barangay: 'Teachers Village', address: 'Maginhawa St.', cards: 7, usage: 'HHMMMLL' },
      { name: 'Eastwood', province: 'Metro Manila', city: 'Quezon City', barangay: 'Bagumbayan', address: 'Eastwood Ave.', cards: 5, usage: 'MMLLN', offset: [-0.06, 0.05] },
    ],
  },
  {
    name: 'Island Coffee', category: 'Café', owner: 'Rafael Gonzaga', email: 'owner@islandcoffee.demo', phone: '+63 917 555 0105',
    description: 'Ilonggo coffee house since 2015.',
    branches: [
      { name: 'Smallville', province: 'Iloilo', city: 'Iloilo City', barangay: 'Mandurriao', address: 'Diversion Rd.', cards: 6, usage: 'HMMMLL' },
      { name: 'Molo Plaza', province: 'Iloilo', city: 'Iloilo City', barangay: 'Molo', address: 'Molo Plaza', cards: 4, usage: 'MLLN', offset: [-0.02, -0.03] },
    ],
  },
  {
    name: 'Pine Hill Eatery', category: 'Restaurant', owner: 'Grace Bautista', email: 'owner@pinehill.demo', phone: '+63 917 555 0106',
    description: 'Highland comfort food near Session Road.',
    branches: [{ name: 'Session Road', province: 'Benguet', city: 'Baguio City', barangay: 'Session Road Area', address: 'Session Rd.', cards: 6, usage: 'HHMMLL' }],
  },
  {
    name: 'Kagay-an Grill', category: 'Grill', owner: 'Miguel Abellana', email: 'owner@kagayangrill.demo', phone: '+63 917 555 0107',
    description: 'Charcoal-grilled favorites from Northern Mindanao.',
    branches: [
      { name: 'Divisoria', province: 'Misamis Oriental', city: 'Cagayan de Oro', barangay: 'Poblacion', address: 'Tiano Bros. St.', cards: 7, usage: 'HMMMLLL' },
      { name: 'Limketkai', province: 'Misamis Oriental', city: 'Cagayan de Oro', barangay: 'Lapasan', address: 'Limketkai Dr.', cards: 4, usage: 'MMLL', offset: [0.01, 0.02] },
    ],
  },
  {
    name: 'Bacolod Inasal House', category: 'Restaurant', owner: 'Teresa Lacson', email: 'owner@inasalhouse.demo', phone: '+63 917 555 0108',
    description: 'Chicken inasal the Negrense way.',
    branches: [{ name: 'Lacson Street', province: 'Negros Occidental', city: 'Bacolod', barangay: 'Mandalagan', address: 'Lacson St.', cards: 6, usage: 'HHMMLL' }],
  },
  {
    name: 'Palawan Seafood Shack', category: 'Seafood', owner: 'Ramon Villanueva', email: 'owner@seafoodshack.demo', phone: '+63 917 555 0109',
    description: 'Fresh catch from Palawan waters.',
    branches: [
      { name: 'Puerto Princesa Baywalk', province: 'Palawan', city: 'Puerto Princesa', barangay: 'Bagong Pag-asa', address: 'Baywalk', cards: 4, usage: 'MMLL' },
      { name: 'El Nido Town', province: 'Palawan', city: 'El Nido', barangay: 'Buena Suerte', address: 'Calle Hama', cards: 3, usage: 'HML' },
    ],
  },
  {
    name: 'Ridge View Cafe', category: 'Café', owner: 'Paolo Aquino', email: 'owner@ridgeview.demo', phone: '+63 917 555 0110',
    description: 'Coffee with a view of Taal.',
    branches: [{ name: 'Tagaytay Ridge', province: 'Cavite', city: 'Tagaytay', barangay: 'Kaybagal', address: 'Aguinaldo Hwy.', cards: 5, usage: 'HHMLL' }],
  },
  {
    name: 'Tuna Bay Kitchen', category: 'Seafood', owner: 'Nestor Alonzo', email: 'owner@tunabay.demo', phone: '+63 917 555 0111',
    description: 'Tuna capital favorites.',
    branches: [{ name: 'GenSan Fishport Road', province: 'South Cotabato', city: 'General Santos', barangay: 'Labangal', address: 'Makar Wharf Rd.', cards: 5, usage: 'MMLLN' }],
  },
  {
    name: 'Curacha House', category: 'Seafood', owner: 'Fatima Hassan', email: 'owner@curachahouse.demo', phone: '+63 917 555 0112',
    description: 'Zamboanga seafood and local delicacies.',
    branches: [{ name: 'Pasonanca', province: 'Zamboanga del Sur', city: 'Zamboanga City', barangay: 'Pasonanca', address: 'Pasonanca Rd.', cards: 4, usage: 'MLLN' }],
  },
  {
    name: 'Siargao Surf Café', category: 'Café', owner: 'Jasmine Lim', email: 'owner@surfcafe.demo', phone: '+63 917 555 0113', status: 'pending',
    description: 'Smoothie bowls steps from Cloud 9.',
    branches: [{ name: 'Tourism Road', province: 'Surigao del Norte', city: 'General Luna (Siargao)', barangay: 'Catangnan', address: 'Tourism Rd.', cards: 3, usage: 'LLN' }],
  },
]

const CARD_NAMES = ['Counter Review Card', 'Table Stand', 'Cashier Card', 'Entrance Stand', 'Receipt Tray Card', 'Menu Insert', 'Takeout Bag Tag', 'Window Sticker']
const CARD_TYPES = ['Card', 'Table Stand', 'Card', 'Stand', 'Card', 'Card', 'Sticker', 'Sticker']
const TAG_TYPES = ['NTAG213', 'NTAG215', 'NTAG216']
const MATERIALS = ['PVC', 'PVC', 'Wood', 'Metal', 'Epoxy']
const BATCHES = ['BATCH-2026-01', 'BATCH-2026-02', 'BATCH-2026-03']

export const USAGE_RATE = { H: 16, M: 7, L: 2.2, N: 0 }
export const HISTORY_DAYS = 120

export function isoDay(d) {
  return d.toISOString().slice(0, 10)
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + n)
  return d
}

/** Build the structural dataset (no per-day stats). `today` is a Date. */
export function buildSeed(today = new Date()) {
  const rand = prng(20261005)
  // Anchor on the local calendar day so "today" in charts matches the viewer's date.
  const base = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 8))
  const at = (daysAgo, hours = 0) => new Date(base.getTime() - daysAgo * 864e5 + hours * 36e5).toISOString()

  const users = [
    { id: makeUuid(rand), email: 'admin@tapreview.demo', full_name: 'System Administrator', role: 'admin', phone: '+63 917 555 0000', is_active: true, created_at: at(HISTORY_DAYS + 10) },
  ]
  const businesses = []
  const members = []
  const destinations = []
  const branches = []
  const cards = []
  const audit = []
  const adminId = users[0].id
  let cardSeq = 0

  const log = (created_at, action, entity_type, entity_id, extra = {}) =>
    audit.push({ id: audit.length + 1, created_at, action, entity_type, entity_id, actor_id: adminId, actor_email: 'admin@tapreview.demo', details: {}, ...extra })

  BUSINESSES.forEach((b, bi) => {
    const owner = { id: makeUuid(rand), email: b.email, full_name: b.owner, role: 'business', phone: b.phone, is_active: true, created_at: at(HISTORY_DAYS + 5 - bi * 3) }
    users.push(owner)
    const slug = b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const biz = {
      id: makeUuid(rand), name: b.name, slug, category: b.category, description: b.description,
      logo_url: null, cover_url: null, phone: b.phone, email: b.email.replace('owner@', 'hello@'),
      website: `https://${slug}.example.ph`, facebook_url: `https://facebook.com/${slug.replace(/-/g, '')}`,
      owner_id: owner.id, status: b.status ?? 'active', created_at: owner.created_at, updated_at: owner.created_at,
    }
    businesses.push(biz)
    members.push({ business_id: biz.id, user_id: owner.id, role: 'owner', branch_ids: null })
    const dest = { id: makeUuid(rand), business_id: biz.id, label: 'Google Reviews', url: `https://search.google.com/local/writereview?placeid=DEMO_${slug.toUpperCase().replace(/-/g, '_')}`, is_default: true, created_at: biz.created_at }
    destinations.push(dest)
    log(biz.created_at, 'business.created', 'business', biz.id, { business_id: biz.id, actor_id: owner.id, actor_email: owner.email, details: { name: biz.name } })

    b.branches.forEach((br, bri) => {
      const city = findCity(br.province, br.city)
      const [dLat, dLng] = br.offset ?? [0, 0]
      const branch = {
        id: makeUuid(rand), business_id: biz.id, name: br.name, address: br.address, barangay: br.barangay,
        city: br.city, province: br.province, region_code: PROVINCE_REGION[br.province],
        lat: +(city.lat + dLat + (rand() - 0.5) * 0.01).toFixed(6), lng: +(city.lng + dLng + (rand() - 0.5) * 0.01).toFixed(6),
        phone: b.phone, status: 'active', created_at: at(HISTORY_DAYS - bi * 2 - bri * 6),
      }
      branches.push(branch)

      for (let i = 0; i < br.cards; i++) {
        cardSeq++
        const createdAgo = HISTORY_DAYS - bi * 2 - bri * 6 - Math.floor(rand() * 10)
        const nameIdx = i % CARD_NAMES.length
        const card = {
          id: makeUuid(rand), card_code: `TR-NFC-${String(cardSeq).padStart(6, '0')}`,
          nfc_uid: Array.from({ length: 7 }, () => Math.floor(rand() * 256).toString(16).padStart(2, '0').toUpperCase()).join(':'),
          public_token: makeToken(rand), card_name: `${CARD_NAMES[nameIdx]}${i >= CARD_NAMES.length ? ` ${Math.floor(i / CARD_NAMES.length) + 1}` : ''}`,
          card_type: CARD_TYPES[nameIdx], status: 'active', business_id: biz.id, branch_id: branch.id, review_destination_id: null,
          manufacturer: rand() > 0.5 ? 'NXP' : 'Shenzhen Tag Co.', tag_type: TAG_TYPES[Math.floor(rand() * 3)], material: MATERIALS[Math.floor(rand() * MATERIALS.length)],
          purchase_batch: BATCHES[Math.floor(rand() * BATCHES.length)], purchase_date: at(createdAgo + 14).slice(0, 10), notes: null, photo_url: null,
          created_at: at(createdAgo), assigned_at: at(createdAgo - 1), activated_at: at(createdAgo - 1, 2), deactivated_at: null,
          last_used_at: null, replaced_by: null, replaces: null, usage: br.usage[i] ?? 'L',
        }
        cards.push(card)
        log(at(createdAgo + 1), 'card.received', 'card', card.id, { card_id: card.id, details: { batch: card.purchase_batch } })
        log(card.created_at, 'card.created', 'card', card.id, { card_id: card.id, details: { card_code: card.card_code } })
        log(card.assigned_at, 'card.assigned', 'card', card.id, { card_id: card.id, business_id: biz.id, details: { to_business: biz.name, to_branch: branch.name } })
        log(card.activated_at, 'card.status_changed', 'card', card.id, { card_id: card.id, business_id: biz.id, details: { from: 'inactive', to: 'active' } })
      }
    })
  })

  // A few non-active statuses so the inventory and filters have something to show.
  const setStatus = (card, status, daysAgo) => {
    card.status = status
    card.deactivated_at = at(daysAgo)
    log(at(daysAgo), 'card.status_changed', 'card', card.id, { card_id: card.id, business_id: card.business_id, details: { from: 'active', to: status } })
  }
  setStatus(cards[11], 'inactive', 20)
  setStatus(cards[25], 'lost', 12)
  setStatus(cards[40], 'suspended', 8)
  setStatus(cards[61], 'inactive', 30)
  setStatus(cards[90], 'lost', 4)

  // Replacement chain: card 5 of ABC Coffee was damaged and replaced.
  const old = cards[4]
  const repl = {
    ...old, id: makeUuid(rand), card_code: `TR-NFC-${String(++cardSeq).padStart(6, '0')}`, public_token: makeToken(rand),
    nfc_uid: '04:A1:7C:22:9B:51:80', created_at: at(15), assigned_at: at(15), activated_at: at(15, 1), replaces: old.id, usage: old.usage,
  }
  old.status = 'replaced'
  old.replaced_by = repl.id
  old.deactivated_at = at(15)
  cards.push(repl)
  log(at(15), 'card.replaced', 'card', old.id, { card_id: old.id, business_id: old.business_id, details: { new_card: repl.card_code, reason: 'Damaged (water exposure)' } })
  log(at(15), 'card.created', 'card', repl.id, { card_id: repl.id, business_id: repl.business_id, details: { card_code: repl.card_code, replaces: old.card_code } })

  // Unassigned inventory.
  for (let i = 0; i < 14; i++) {
    const card = {
      id: makeUuid(rand), card_code: `TR-NFC-${String(++cardSeq).padStart(6, '0')}`,
      nfc_uid: i < 9 ? Array.from({ length: 7 }, () => Math.floor(rand() * 256).toString(16).padStart(2, '0').toUpperCase()).join(':') : null,
      public_token: makeToken(rand), card_name: 'Unassigned stock', card_type: 'Card', status: 'inactive',
      business_id: null, branch_id: null, review_destination_id: null, manufacturer: 'NXP', tag_type: 'NTAG215', material: 'PVC',
      purchase_batch: 'BATCH-2026-03', purchase_date: at(20).slice(0, 10), notes: 'In admin storage', photo_url: null,
      created_at: at(18), assigned_at: null, activated_at: null, deactivated_at: null, last_used_at: null, replaced_by: null, replaces: null, usage: 'N',
    }
    cards.push(card)
    log(card.created_at, 'card.created', 'card', card.id, { card_id: card.id, details: { card_code: card.card_code } })
  }

  // Staff member for ABC Coffee limited to the Davao Downtown branch.
  const staff = { id: makeUuid(rand), email: 'staff@abccoffee.demo', full_name: 'Maria Santos', role: 'business', phone: '+63 917 555 0201', is_active: true, created_at: at(60) }
  users.push(staff)
  members.push({ business_id: businesses[0].id, user_id: staff.id, role: 'staff', branch_ids: [branches[0].id] })

  return { users, businesses, members, destinations, branches, cards, audit, base: base.toISOString() }
}

/** Per-card daily stats, deterministic. Returns rows {card_id, business_id, branch_id, day, nfc, qr, views, clicks}. */
export function buildDailyStats(seed) {
  const base = new Date(seed.base)
  const rows = []
  for (const card of seed.cards) {
    if (!card.business_id) continue
    const rate = USAGE_RATE[card.usage] ?? 0
    const rand = prng(parseInt(card.id.slice(0, 8), 16))
    const startAgo = Math.floor((base - new Date(card.activated_at)) / 864e5)
    const endAgo = card.status === 'active' ? 0 : Math.ceil((base - new Date(card.deactivated_at ?? base)) / 864e5)
    for (let ago = startAgo; ago >= Math.max(endAgo, 0); ago--) {
      if (rate === 0) break
      const day = addDays(base, -ago)
      const dow = day.getUTCDay()
      const growth = 0.6 + 0.4 * (1 - ago / HISTORY_DAYS)
      const weekend = dow === 0 || dow === 6 ? 1.45 : dow === 5 ? 1.2 : 1
      const lambda = rate * growth * weekend * (0.7 + rand() * 0.6)
      const nfc = Math.round(lambda)
      const qr = Math.round(lambda * (0.32 + rand() * 0.2))
      const views = nfc + qr
      const clicks = Math.round(views * (0.48 + rand() * 0.2))
      if (views === 0) continue
      rows.push({ card_id: card.id, business_id: card.business_id, branch_id: card.branch_id, day: isoDay(day), nfc, qr, views, clicks })
    }
  }
  return rows
}
