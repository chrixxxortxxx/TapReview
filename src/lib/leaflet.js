import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'

let ready
/** Leaflet plugins are UMD scripts that expect a global `L`, so load them after exposing it. */
export function loadLeaflet() {
  if (!ready) {
    window.L = L
    ready = Promise.all([import('leaflet.markercluster'), import('leaflet.heat')]).then(() => L)
  }
  return ready
}
