import { Link } from 'react-router-dom'
import { CircleX } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="state-page">
      <div>
        <div className="empty-icon"><CircleX size={28} /></div>
        <h1 style={{ marginBottom: 8 }}>Page not found</h1>
        <p className="muted" style={{ marginBottom: 20 }}>The page you’re looking for doesn’t exist.</p>
        <Link className="btn primary" to="/">Go home</Link>
      </div>
    </div>
  )
}
