import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { initials, statusLabel } from '../lib/format'

export function Button({ variant, size, icon: Icon, children, className = '', loading, ...props }) {
  const cls = ['btn', variant, size, !children && Icon ? 'icon' : '', className].filter(Boolean).join(' ')
  return (
    <button className={cls} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : Icon && <Icon />}
      {children}
    </button>
  )
}

export function Panel({ title, subtitle, actions, children, flush, className = '', style }) {
  return (
    <section className={`panel ${className}`} style={style}>
      {(title || actions) && (
        <div className="panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="row wrap">{actions}</div>}
        </div>
      )}
      <div className={`panel-body ${flush ? 'flush' : ''}`}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, sub, icon: Icon, delay = 0 }) {
  return (
    <div className="panel stat" style={{ animationDelay: `${delay}ms` }}>
      <div className="stat-label">
        {Icon && <Icon />}
        {label}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{statusLabel(status)}</span>
}

export function Avatar({ name, src, size, square }) {
  return (
    <span className={`avatar ${size ?? ''} ${square ? 'sq' : ''}`}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="empty-icon">
          <Icon size={22} />
        </div>
      )}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function Spinner({ fill }) {
  return fill ? (
    <div className="center-fill">
      <div className="spinner" />
    </div>
  ) : (
    <div className="spinner" />
  )
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <Button variant="ghost" icon={X} onClick={onClose} aria-label="Close" />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)} type="button" role="tab" aria-selected={value === o.value}>
          {o.icon && <o.icon />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Tabs({ value, onChange, options }) {
  return (
    <div className="tabs">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)} type="button">
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function usePaged(rows, pageSize = 25, resetKey) {
  const [page, setPage] = useState(0)
  useEffect(() => setPage(0), [resetKey])
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safe = Math.min(page, pages - 1)
  return { page: safe, pages, setPage, slice: rows.slice(safe * pageSize, safe * pageSize + pageSize), total: rows.length, pageSize }
}

export function Pager({ paged }) {
  const { page, pages, setPage, total, pageSize } = paged
  if (total === 0) return null
  return (
    <div className="pager">
      <span className="muted">
        {page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} of {total}
      </span>
      <div className="row">
        <Button size="sm" icon={ChevronLeft} disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page" />
        <span className="muted">
          Page {page + 1} / {pages}
        </span>
        <Button size="sm" icon={ChevronRight} disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page" />
      </div>
    </div>
  )
}

export function useSort(rows, initial, dir = 'desc') {
  const [sort, setSort] = useState({ key: initial, dir })
  const sorted = useMemo(() => {
    if (!sort.key) return rows
    const m = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = a[sort.key] ?? ''
      const y = b[sort.key] ?? ''
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * m
    })
  }, [rows, sort])
  const header = (key, label, className = '') => (
    <th className={`sortable ${className}`} onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))}>
      {label}
      {sort.key === key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  )
  return [sorted, header]
}

// ---------- Toasts ----------
const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((message, kind = 'ok') => {
    const id = Math.random()
    setItems((x) => [...x, { id, message, kind }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3800)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

/** Wraps an async action with loading state and toast errors. Resolves to undefined on failure. */
export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = useCallback(
    async (fn, success) => {
      setBusy(true)
      try {
        const r = await fn()
        if (success) toast(success)
        return r
      } catch (e) {
        toast(e.message || 'Something went wrong.', 'error')
        return undefined
      } finally {
        setBusy(false)
      }
    },
    [toast],
  )
  return [run, busy]
}

export function BarList({ items, format = (v) => v, onClick }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (!items.length) return <p className="muted">No data yet.</p>
  return (
    <div className="bar-list">
      {items.map((i) => (
        <div className="bar-item" key={i.key} onClick={onClick ? () => onClick(i) : undefined} style={onClick ? { cursor: 'pointer' } : undefined}>
          <span className="truncate">
            {i.label ?? i.key}
            {i.sub && <span className="muted"> · {i.sub}</span>}
          </span>
          <b className="nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {format(i.value)}
          </b>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CopyField({ value }) {
  const toast = useToast()
  return (
    <div className="copy-field">
      <input className="input" readOnly value={value} onFocus={(e) => e.target.select()} />
      <Button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            toast('Copied to clipboard')
          } catch {
            toast('Copy failed — select and copy manually', 'error')
          }
        }}
      >
        Copy
      </Button>
    </div>
  )
}
