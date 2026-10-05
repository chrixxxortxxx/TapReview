import { useEffect, useRef } from 'react'
import { loadLeaflet } from '../lib/leaflet'
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from '../lib/config'
import { PH_BOUNDS } from '../lib/geo'

/** Small map: click or drag the pin to set a branch's registered location. */
export default function LocationPicker({ lat, lng, onChange, center }) {
  const holder = useRef(null)
  const s = useRef({})
  const cb = useRef(onChange)
  cb.current = onChange

  useEffect(() => {
    let off = false
    loadLeaflet().then((L) => {
      if (off || !holder.current) return
      const map = L.map(holder.current, { minZoom: 5 })
      L.tileLayer(MAP_TILE_URL, { attribution: MAP_TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
      const icon = L.divIcon({ className: 'nfc-marker', iconSize: null, html: '<div class="nfc-pin"><span class="ic">📍</span><span>Branch</span></div>' })
      const marker = L.marker([lat ?? 12.3, lng ?? 122.6], { draggable: true, icon })
      if (lat != null) {
        marker.addTo(map)
        map.setView([lat, lng], 14)
      } else map.fitBounds(PH_BOUNDS)
      marker.on('dragend', () => {
        const p = marker.getLatLng()
        cb.current(+p.lat.toFixed(6), +p.lng.toFixed(6))
      })
      map.on('click', (e) => {
        marker.setLatLng(e.latlng).addTo(map)
        cb.current(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6))
      })
      s.current = { map, marker }
      setTimeout(() => map.invalidateSize(), 50)
    })
    return () => {
      off = true
      s.current.map?.remove()
      s.current = {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const { map, marker } = s.current
    if (!map || lat == null) return
    marker.setLatLng([lat, lng])
    if (!map.hasLayer(marker)) marker.addTo(map)
  }, [lat, lng])

  useEffect(() => {
    if (center && s.current.map) s.current.map.setView(center, 13)
  }, [center])

  return (
    <div className="map-wrap sm">
      <div ref={holder} className="map-canvas" />
    </div>
  )
}
