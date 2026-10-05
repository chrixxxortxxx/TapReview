import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Ban, CircleX, Globe, Link as LinkIcon, Mail, MapPin, Nfc, Phone, Star, TriangleAlert } from 'lucide-react'
import { api } from '../../lib/api'
import { initials, isSafeHttpUrl } from '../../lib/format'

// Guards against double-logging when React StrictMode mounts effects twice in development.
const visited = new Map()

function StatePage({ icon: Icon, title, text }) {
  return (
    <div className="state-page">
      <div>
        <div className="empty-icon"><Icon size={28} /></div>
        <h1 style={{ marginBottom: 8 }}>{title}</h1>
        <p className="muted" style={{ maxWidth: 320, margin: '0 auto' }}>{text}</p>
        <p className="faint" style={{ marginTop: 28, fontSize: 12 }}>Powered by TapReview</p>
      </div>
    </div>
  )
}

export default function Landing() {
  const { token } = useParams()
  const [params] = useSearchParams()
  const source = params.get('src') === 'qr' ? 'qr' : 'nfc'
  const [data, setData] = useState(null)
  const [details, setDetails] = useState(false)
  const [going, setGoing] = useState(false)

  useEffect(() => {
    const key = `${token}|${source}`
    if (!visited.has(key)) visited.set(key, api.publicVisit(token, source, document.referrer || null).catch(() => ({ state: 'error' })))
    let alive = true
    visited.get(key).then((d) => alive && setData(d))
    return () => {
      alive = false
    }
  }, [token, source])

  useEffect(() => {
    if (data?.business?.name) document.title = `Review ${data.business.name}`
  }, [data])

  if (!data) return <div className="state-page"><div className="spinner" /></div>
  if (data.state === 'not_found') return <StatePage icon={CircleX} title="Card Not Found" text="This NFC card or QR code isn’t registered. Please ask the staff for assistance." />
  if (data.state === 'inactive') return <StatePage icon={Ban} title="Card inactive" text="This NFC card is currently inactive." />
  if (data.state === 'disabled') return <StatePage icon={Ban} title="Card disabled" text="This NFC card has been disabled." />
  if (data.state !== 'ok') return <StatePage icon={TriangleAlert} title="Something went wrong" text="We couldn’t load this page. Please try again in a moment." />

  const { business: b, branch } = data
  const reviewUrl = isSafeHttpUrl(data.review_url) ? data.review_url : null

  const writeReview = async () => {
    setGoing(true)
    const url = (await api.publicReviewClick(token).catch(() => null)) || reviewUrl
    if (url && isSafeHttpUrl(url)) window.location.href = url
    else setGoing(false)
  }

  return (
    <div className="landing">
      <div className="landing-inner">
        <div className="landing-cover" style={b.cover_url && isSafeHttpUrl(b.cover_url) ? { backgroundImage: `url("${encodeURI(b.cover_url)}")` } : undefined} />
        <div className="landing-body">
          <div className="landing-logo">{b.logo_url && isSafeHttpUrl(b.logo_url) ? <img src={b.logo_url} alt={`${b.name} logo`} /> : initials(b.name)}</div>
          <div>
            <h1>{b.name}</h1>
            {branch && <p className="muted">{branch.name} · {branch.city}</p>}
          </div>
          <p style={{ fontSize: 17, fontWeight: 600 }}>Thank you for visiting us!</p>
          <div className="landing-stars" aria-hidden="true">★★★★★</div>
          <p className="muted" style={{ maxWidth: 320 }}>We’d love to hear about your experience. Your honest feedback helps us improve.</p>

          {reviewUrl ? (
            <button className="btn primary lg" onClick={writeReview} disabled={going}>
              <Star size={18} fill="#f5b400" color="#f5b400" /> {going ? 'Opening Google…' : 'Write a Google Review'}
            </button>
          ) : (
            <p className="alert warn" style={{ width: '100%' }}>This business has not configured its Google Review page yet.</p>
          )}
          <button className="btn lg" onClick={() => setDetails((d) => !d)}>{details ? 'Hide details' : 'View Restaurant'}</button>

          {details && (
            <div className="panel" style={{ width: '100%', textAlign: 'left' }}>
              <div className="panel-body stack-sm">
                {b.description && <p>{b.description}</p>}
                {branch?.address && <div className="row"><MapPin size={16} /> {[branch.address, branch.city, branch.province].filter(Boolean).join(', ')}</div>}
                {b.phone && <a className="row" href={`tel:${b.phone.replace(/[^+\d]/g, '')}`}><Phone size={16} /> {b.phone}</a>}
                {b.email && <a className="row" href={`mailto:${b.email}`}><Mail size={16} /> {b.email}</a>}
                {b.website && isSafeHttpUrl(b.website) && <a className="row" href={b.website} target="_blank" rel="noopener noreferrer"><Globe size={16} /> Website</a>}
                {b.facebook_url && isSafeHttpUrl(b.facebook_url) && <a className="row" href={b.facebook_url} target="_blank" rel="noopener noreferrer"><LinkIcon size={16} /> Facebook page</a>}
              </div>
            </div>
          )}
        </div>
        <div className="landing-foot">
          <span className="row" style={{ justifyContent: 'center' }}><Nfc size={13} /> Powered by TapReview · No app needed</span>
        </div>
      </div>
    </div>
  )
}
