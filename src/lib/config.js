export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const IS_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY

export const PUBLIC_BASE_URL = (import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin).replace(/\/$/, '')

/** URL written to the NFC tag (no query) or encoded in the QR code (?src=qr so scans are counted separately). */
export function cardUrl(token, source = 'nfc') {
  return `${PUBLIC_BASE_URL}/t/${token}${source === 'qr' ? '?src=qr' : ''}`
}

export const MAP_TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const MAP_TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
