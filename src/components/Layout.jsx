import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, Bell, Building2, FileBarChart, LayoutDashboard, LogOut, Map, MapPin, Menu, Nfc, QrCode,
  ScrollText, Search, Settings, Star, Store, Users,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useWorkspace } from '../lib/workspace'
import { api } from '../lib/api'
import { IS_DEMO } from '../lib/config'
import { ago, initials } from '../lib/format'
import { matches } from '../lib/derive'
import { Avatar, Button, Spinner } from './ui'

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/map', label: 'Map', icon: Map },
  { to: '/admin/restaurants', label: 'Restaurants', icon: Store },
  { to: '/admin/branches', label: 'Branches', icon: Building2 },
  { to: '/admin/cards', label: 'NFC Cards', icon: Nfc },
  { to: '/admin/qr', label: 'QR Codes', icon: QrCode },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/logs', label: 'Activity Logs', icon: ScrollText },
  { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

const BUSINESS_NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/branches', label: 'My Branches', icon: Building2 },
  { to: '/app/cards', label: 'NFC Cards', icon: Nfc },
  { to: '/app/qr', label: 'QR Codes', icon: QrCode },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/review', label: 'Google Review', icon: Star },
  { to: '/app/profile', label: 'Profile', icon: Store },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  const { user, isAdmin, signOut } = useAuth()
  const { ws, error } = useWorkspace()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const navigate = useNavigate()
  useEffect(() => setOpen(false), [loc.pathname])
  const nav = isAdmin ? ADMIN_NAV : BUSINESS_NAV

  return (
    <>
      {IS_DEMO && (
        <div className="demo-banner">
          Demo mode — data lives in this browser only. Connect Supabase in <code>.env</code> for production.
        </div>
      )}
      <div className="shell">
        <aside className={`sidebar ${open ? 'open' : ''}`}>
          <div className="brand">
            <span className="brand-mark"><Nfc size={17} /></span>
            <div>
              TapReview
              <small>{isAdmin ? 'Administrator' : 'Business'}</small>
            </div>
          </div>
          <nav className="nav">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                <n.icon />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div className="user-chip">
              <Avatar name={user.full_name || user.email} />
              <div className="grow">
                <div className="truncate" style={{ fontWeight: 600 }}>{user.full_name || 'Account'}</div>
                <div className="truncate muted" style={{ fontSize: 12 }}>{user.email}</div>
              </div>
              <Button
                variant="ghost"
                icon={LogOut}
                aria-label="Sign out"
                title="Sign out"
                onClick={async () => {
                  await signOut()
                  navigate('/login')
                }}
              />
            </div>
          </div>
        </aside>
        <div className={`scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
        <div className="main">
          <header className="topbar">
            <Button className="menu-btn" variant="ghost" icon={Menu} onClick={() => setOpen(true)} aria-label="Open menu" />
            {ws && <GlobalSearch />}
            <div className="grow" />
            <Notifications />
          </header>
          <main className="content">
            {error ? <p className="alert">{error}</p> : ws ? <Outlet /> : <Spinner fill />}
          </main>
        </div>
      </div>
    </>
  )
}

function GlobalSearch() {
  const { ws, cards } = useWorkspace()
  const { base, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const [idx, setIdx] = useState(0)
  const box = useRef(null)

  const results = useMemo(() => {
    if (q.trim().length < 2) return []
    const out = []
    for (const b of ws.businesses.filter((b) => matches(q, b.name, b.owner_name, b.owner_email, b.email, b.phone)).slice(0, 5))
      out.push({ group: 'Restaurants', icon: Store, title: b.name, sub: [b.owner_name, b.owner_email].filter(Boolean).join(' · '), to: isAdmin ? `/admin/restaurants/${b.id}` : `/app/profile` })
    for (const b of ws.branches.filter((b) => matches(q, b.name, b.city, b.province, b.address, b.barangay)).slice(0, 5))
      out.push({ group: 'Branches', icon: MapPin, title: b.name, sub: `${b.city}, ${b.province}`, to: `${base}/branches?focus=${b.id}` })
    for (const c of cards.filter((c) => matches(q, c.card_code, c.nfc_uid, c.card_name, c.public_token, c.business_name, c.city)).slice(0, 6))
      out.push({ group: 'NFC cards', icon: Nfc, title: `${c.card_code} · ${c.card_name}`, sub: [c.business_name ?? 'Unassigned', c.branch_name, c.city].filter(Boolean).join(' · '), to: `${base}/cards/${c.id}` })
    return out
  }, [q, ws, cards, base, isAdmin])

  useEffect(() => setIdx(0), [q])
  useEffect(() => {
    const onDoc = (e) => !box.current?.contains(e.target) && setFocus(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const go = (r) => {
    navigate(r.to)
    setQ('')
    setFocus(false)
  }

  let lastGroup = null
  return (
    <div className="search" ref={box}>
      <Search />
      <input
        className="input"
        placeholder={isAdmin ? 'Search restaurant, branch, card ID, NFC UID, city, owner, email…' : 'Search branches and cards…'}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setIdx((i) => Math.min(i + 1, results.length - 1))
          if (e.key === 'ArrowUp') setIdx((i) => Math.max(i - 1, 0))
          if (e.key === 'Enter' && results[idx]) go(results[idx])
          if (e.key === 'Escape') setFocus(false)
        }}
        aria-label="Global search"
      />
      {focus && q.trim().length >= 2 && (
        <div className="search-results">
          {results.length === 0 && <div className="search-item muted">No matches for “{q}”</div>}
          {results.map((r, i) => {
            const head = r.group !== lastGroup ? <div className="search-group">{r.group}</div> : null
            lastGroup = r.group
            return (
              <div key={i}>
                {head}
                <div className={`search-item ${i === idx ? 'on' : ''}`} onMouseDown={() => go(r)} onMouseEnter={() => setIdx(i)}>
                  <r.icon />
                  <div className="grow">
                    <div className="truncate" style={{ fontWeight: 550 }}>{r.title}</div>
                    <div className="truncate muted" style={{ fontSize: 12 }}>{r.sub}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Notifications() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const { version } = useWorkspace()
  const navigate = useNavigate()
  const box = useRef(null)

  useEffect(() => {
    api.getNotifications().then(setItems).catch(() => {})
  }, [version])
  useEffect(() => {
    const onDoc = (e) => !box.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const unread = items.filter((n) => !n.read_at).length
  return (
    <div style={{ position: 'relative' }} ref={box}>
      <Button variant="ghost" icon={Bell} aria-label={`Notifications (${unread} unread)`} onClick={() => setOpen((o) => !o)} />
      {unread > 0 && <span className="notif-dot" />}
      {open && (
        <div className="popover">
          <div className="row between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <h3>Notifications</h3>
            {unread > 0 && (
              <button
                className="link"
                style={{ border: 0, background: 'none' }}
                onClick={async () => {
                  await api.markAllNotificationsRead()
                  setItems(await api.getNotifications())
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="popover-list">
            {items.length === 0 && <p className="muted" style={{ padding: 16 }}>You’re all caught up.</p>}
            {items.map((n) => (
              <div
                key={n.id}
                className={`notif ${n.read_at ? '' : 'unread'}`}
                onClick={() => {
                  setOpen(false)
                  if (n.link) navigate(n.link)
                }}
              >
                <span className="avatar sq" style={{ width: 28, height: 28, fontSize: 10 }}>{initials(n.type.replace('.', ' '))}</span>
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{n.title}</div>
                  {n.body && <div className="muted" style={{ fontSize: 12.5 }}>{n.body}</div>}
                  <div className="faint" style={{ fontSize: 11.5 }}>{ago(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

