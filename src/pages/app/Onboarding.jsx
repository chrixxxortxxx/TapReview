import { useNavigate } from 'react-router-dom'
import { LogOut, Nfc } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { BusinessForm } from '../../components/forms'
import { Button } from '../../components/ui'

/** Shown to business users who don't belong to any business yet. */
export default function Onboarding() {
  const { user, refresh, signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="panel" style={{ width: '100%', maxWidth: 720 }}>
        <div className="panel-body stack">
          <div className="row between">
            <div className="brand" style={{ padding: 0 }}>
              <span className="brand-mark"><Nfc size={17} /></span>
              TapReview
            </div>
            <Button variant="ghost" icon={LogOut} onClick={async () => { await signOut(); navigate('/login') }}>Sign out</Button>
          </div>
          <div>
            <h1>Set up your business</h1>
            <p className="muted">Hi {user.full_name || user.email}. Tell us about your restaurant and its first branch. You can add more branches later.</p>
          </div>
          <p className="alert info">Were you invited as staff? Ask the business owner to add <b>{user.email}</b> to their team, then sign in again.</p>
          <BusinessForm
            onDone={async () => {
              await refresh()
              navigate('/app')
            }}
          />
        </div>
      </div>
    </div>
  )
}
