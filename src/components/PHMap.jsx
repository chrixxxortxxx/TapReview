import { useEffect, useRef, useState } from 'react'
import { loadLeaflet } from '../lib/leaflet'
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from '../lib/config'
import { PH_BOUNDS, PH_CENTER } from '../lib/geo'
import { initials, longDate, num } from '../lib/format'

const NFC_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 8.32a7.43 7.43 0 0 1 0 7.36"/><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58"/><path d="M12.91 4.1a15.91 15.91 0 0 1 .01 15.8"/><path d="M16.37 2a20.16 20.16 0 0 1 0 20"/></svg>'

function el(tag, props = {}, children = []) {
  const n = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v
    else if (k === 'text') n.textContent = v
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v)
    else n.setAttribute(k, v)
  }
  for (const c of [].concat(children)) if (c) n.append(c)
  return n
}

function markerHtml(p, selected) {
  // Built with DOM APIs so business names are never interpreted as HTML.
  const pin = el('div', { class: `nfc-pin ${selected ? 'sel' : ''}` })
  const ic = el('span', { class: 'ic' })
  if (p.logo_url) ic.append(el('img', { src: p.logo_url, alt: '' }))
  else ic.innerHTML = NFC_SVG
  const st = p.active === 0 ? 'off' : p.inactive > 0 ? 'warn' : 'on'
  pin.append(ic, el('span', { text: `${p.cards}` }), el('span', { class: `st ${st}` }))
  pin.title = `${p.business} — ${p.branch}`
  return pin
}

function popupContent(p, onAction) {
  const avatar = el('span', { class: 'avatar sq' })
  if (p.logo_url) avatar.append(el('img', { src: p.logo_url, alt: '' }))
  else avatar.textContent = initials(p.business)
  const stat = (label, value) => el('div', {}, [el('span', { text: label }), el('b', { text: value })])
  const btn = (label, action, primary) => el('button', { class: primary ? 'primary' : '', text: label, onclick: () => onAction(action, p) })
  return el('div', { class: 'mp' }, [
    el('div', { class: 'mp-head' }, [
      avatar,
      el('div', {}, [el('div', { class: 'mp-title', text: `📡 ${p.business}` }), el('div', { class: 'mp-sub', text: p.branch })]),
    ]),
    el('div', { class: 'mp-sub', style: 'margin-bottom:10px', text: p.address || `${p.city}, ${p.province}` }),
    el('div', { class: 'mp-grid' }, [
      stat('NFC cards', num(p.cards)),
      stat('Active / inactive', `${p.active} / ${p.inactive}`),
      stat('Total taps', num(p.taps)),
      stat('QR scans', num(p.scans)),
      stat('City', p.city),
      stat('Last activity', p.last ? longDate(p.last) : 'None'),
    ]),
    el('div', { class: 'mp-actions' }, [btn('View restaurant', 'restaurant'), btn('Analytics', 'analytics'), btn('View cards', 'cards', true)]),
  ])
}

const MODE_VALUE = { nfc: (p) => p.taps, qr: (p) => p.scans, combined: (p) => p.taps + p.scans }
const MODE_CLASS = { nfc: '', qr: 'qr', combined: 'all' }

/**
 * Interactive Philippines map.
 * points: [{id, lat, lng, business, branch, cards, active, inactive, taps, scans, last, ...}]
 * mode: 'locations' | 'nfc' | 'qr' | 'combined'
 */
export default function PHMap({ points, mode = 'locations', selectedId, onSelect, onAction, size = '', fitKey }) {
  const holder = useRef(null)
  const state = useRef({})
  const cb = useRef({ onSelect, onAction })
  cb.current = { onSelect, onAction }
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let disposed = false
    loadLeaflet().then((L) => {
      if (disposed || !holder.current) return
      const map = L.map(holder.current, { center: PH_CENTER, zoom: 6, minZoom: 5, zoomSnap: 0.25, zoomDelta: 0.5, maxBounds: [[2, 112], [23.5, 131]], zoomControl: true, worldCopyJump: false })
      L.tileLayer(MAP_TILE_URL, { attribution: MAP_TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
      map.fitBounds(PH_BOUNDS)
      state.current = { L, map, layer: null }
      setReady(true)
    })
    return () => {
      disposed = true
      state.current.map?.remove()
      state.current = {}
    }
  }, [])

  // (Re)draw markers when data, mode or selection changes.
  useEffect(() => {
    const { L, map } = state.current
    if (!ready || !map) return
    if (state.current.layer) map.removeLayer(state.current.layer)
    const group = L.layerGroup()

    const markers = new Map()
    const openPopup = (marker, p) => {
      marker.bindPopup(() => popupContent(p, (a, x) => cb.current.onAction?.(a, x)), { maxWidth: 320, minWidth: 300, closeButton: true, autoPanPadding: [24, 24] }).openPopup()
      state.current.clicked = p.id
      cb.current.onSelect?.(p)
    }
    let cluster = null

    if (mode === 'locations') {
      cluster = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (c) => {
          const kids = c.getAllChildMarkers()
          const cards = kids.reduce((s, m) => s + (m.options.cards || 0), 0)
          const d = Math.min(64, 36 + Math.log2(cards + 1) * 4)
          const node = el('div', { class: 'nfc-cluster', style: `width:${d}px;height:${d}px` }, [
            el('div', { style: 'text-align:center;line-height:1.1' }, [el('div', { text: num(cards) }), el('small', { text: `${kids.length} loc` })]),
          ])
          return L.divIcon({ html: node, className: 'nfc-marker', iconSize: null })
        },
      })
      for (const p of points) {
        const m = L.marker([p.lat, p.lng], { icon: L.divIcon({ html: markerHtml(p, false), className: 'nfc-marker', iconSize: null }), cards: p.cards, riseOnHover: true, keyboard: true, title: `${p.business} — ${p.branch}` })
        m.on('click', () => openPopup(m, p))
        markers.set(p.id, m)
        cluster.addLayer(m)
      }
      group.addLayer(cluster)
    } else {
      const val = MODE_VALUE[mode]
      const max = Math.max(1, ...points.map(val))
      if (L.heatLayer && points.length) {
        group.addLayer(L.heatLayer(points.map((p) => [p.lat, p.lng, val(p) / max]), { radius: 38, blur: 28, maxZoom: 11, minOpacity: 0.25, gradient: { 0.2: '#c7d2fe', 0.5: '#6d8cf0', 0.8: '#2f5bea', 1: '#0b0b0b' } }))
      }
      for (const p of [...points].sort((a, b) => val(b) - val(a))) {
        const v = val(p)
        const d = 14 + Math.sqrt(v / max) * 46
        const node = el('div', { class: `activity-bubble ${MODE_CLASS[mode]}`, style: `width:${d}px;height:${d}px`, title: `${p.business} — ${num(v)}` })
        const m = L.marker([p.lat, p.lng], { icon: L.divIcon({ html: node, className: 'nfc-marker', iconSize: null }) })
        m.on('click', () => openPopup(m, p))
        markers.set(p.id, m)
        group.addLayer(m)
      }
    }
    group.addTo(map)
    Object.assign(state.current, { layer: group, markers, cluster })
  }, [ready, points, mode])

  // Highlight the selected marker; when selection comes from outside the map, reveal and open it.
  useEffect(() => {
    const { markers, cluster } = state.current
    if (!ready || !markers) return
    for (const [id, m] of markers) m.getElement()?.querySelector('.nfc-pin')?.classList.toggle('sel', id === selectedId)
    const m = selectedId && markers.get(selectedId)
    if (m && state.current.clicked !== selectedId) {
      const open = () => m.fire('click')
      if (cluster) cluster.zoomToShowLayer(m, open)
      else open()
    }
  }, [ready, selectedId, points, mode])

  // Fit to the filtered points when filters change.
  useEffect(() => {
    const { L, map } = state.current
    if (!ready || !map) return
    // Defer one frame so the container has its final size, and skip animation so
    // marker-cluster redraws can't interrupt the zoom.
    const raf = requestAnimationFrame(() => {
      map.invalidateSize()
      if (!points.length) return map.fitBounds(PH_BOUNDS, { animate: false })
      const b = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
      map.fitBounds(b.pad(0.05), { maxZoom: 14, animate: false, padding: [28, 28] })
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey])

  // Keep tiles sized correctly when the container changes size (sidebar, rotation).
  useEffect(() => {
    if (!holder.current) return
    const ro = new ResizeObserver(() => state.current.map?.invalidateSize())
    ro.observe(holder.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div className={`map-wrap ${size}`}>
      <div ref={holder} className="map-canvas" aria-label="Map of the Philippines" />
      {!ready && (
        <div className="map-overlay map-empty">
          <div className="spinner" />
        </div>
      )}
      {ready && mode === 'locations' && (
        <div className="map-overlay map-legend">
          <span><i className="dot" style={{ background: 'var(--green)' }} /> All cards active</span>
          <span><i className="dot" style={{ background: 'var(--amber)' }} /> Some inactive</span>
          <span><i className="dot" style={{ background: '#9a9a95' }} /> No active cards</span>
          <span className="muted">Number = NFC cards at location</span>
        </div>
      )}
      {ready && mode !== 'locations' && (
        <div className="map-overlay map-legend">
          <span>Bubble size & heat = {mode === 'nfc' ? 'NFC taps' : mode === 'qr' ? 'QR scans' : 'NFC taps + QR scans'} at the registered branch location</span>
        </div>
      )}
    </div>
  )
}
