const nf = new Intl.NumberFormat('en-PH')
export const num = (n) => nf.format(Math.round(n || 0))
export const compact = (n) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0)
export const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—')

export function date(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
export function longDate(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}
export function dateTime(v) {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
export function ago(v) {
  if (!v) return 'Never'
  const s = (Date.now() - new Date(v).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`
  return date(v)
}

export const CARD_STATUSES = ['active', 'inactive', 'suspended', 'lost', 'replaced']
export const statusLabel = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '—')

export const EVENT_LABELS = {
  NFC_TAP: 'NFC tap',
  QR_SCAN: 'QR scan',
  LANDING_PAGE_VIEW: 'Landing page view',
  GOOGLE_REVIEW_CLICK: 'Google Review click',
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}

export function escapeCsv(v) {
  const s = v === null || v === undefined ? '' : String(v)
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function downloadCsv(filename, columns, rows) {
  const lines = [columns.map((c) => escapeCsv(c.label)).join(',')]
  for (const r of rows) lines.push(columns.map((c) => escapeCsv(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','))
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function isSafeHttpUrl(v) {
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}
