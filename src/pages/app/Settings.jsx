import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { IS_DEMO, PUBLIC_BASE_URL } from '../../lib/config'
import { webNfcSupported } from '../../lib/nfc'
import { Button, Field, Panel, useAction } from '../../components/ui'

export default function Settings() {
  const { user, isAdmin, refresh } = useAuth()
  const navigate = useNavigate()
  const [run, busy] = useAction()
  const [f, setF] = useState({ full_name: user.full_name ?? '', phone: user.phone ?? '', password: '' })

  const save = async (e) => {
    e.preventDefault()
    if (await run(() => api.updateMyProfile(f), 'Account updated')) {
      setF((x) => ({ ...x, password: '' }))
      refresh()
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Your account{isAdmin ? ' and platform configuration' : ''}.</p>
        </div>
      </div>

      <Panel title="Account">
        <form className="stack" onSubmit={save} style={{ maxWidth: 560 }}>
          <div className="form-grid">
            <Field label="Full name"><input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} maxLength={80} /></Field>
            <Field label="Mobile number"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={40} /></Field>
            <Field label="Email"><input className="input" value={user.email} disabled /></Field>
            <Field label="New password" hint="Leave blank to keep your current password."><input className="input" type="password" minLength={8} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          </div>
          <div><Button variant="primary" type="submit" loading={busy}>Save</Button></div>
        </form>
      </Panel>

      {isAdmin && (
        <Panel title="Platform">
          <dl className="dl">
            <dt>Mode</dt><dd>{IS_DEMO ? 'Demo (in-browser data)' : 'Production (Supabase)'}</dd>
            <dt>Public card base URL</dt><dd className="mono">{PUBLIC_BASE_URL}/t/…</dd>
            <dt>Web NFC on this device</dt><dd>{webNfcSupported ? 'Supported — cards can be read and written from card pages' : 'Not supported — use Chrome on Android, or an NFC writer app'}</dd>
          </dl>
        </Panel>
      )}

      <Panel title="NFC card provisioning guide">
        <ol style={{ margin: 0, paddingLeft: 18 }} className="stack-sm">
          <li>Register the card in <b>NFC Cards → Register NFC card</b>. The system generates the Card ID, an unpredictable public URL and a QR code.</li>
          <li>Write the <b>public card URL</b> to the tag as a single <b>URL (NDEF) record</b>: use “Write to NFC tag” on Android Chrome, or any NFC writer app.</li>
          <li>Optionally lock the tag (read-only) so it can’t be overwritten. The destination can still be changed any time in TapReview — the tag never needs rewriting.</li>
          <li>Tap the card with a phone to test. Android and iPhone (XS and newer) open the link without any app.</li>
          <li>Print the QR code on the card or stand as a fallback for phones without NFC.</li>
        </ol>
      </Panel>

      {IS_DEMO && (
        <Panel title="Demo data">
          <div className="row between wrap">
            <p className="muted">Reset all demo businesses, cards and activity in this browser to the original sample data.</p>
            <Button
              icon={RefreshCw}
              onClick={async () => {
                await api.resetDemo()
                navigate('/login')
              }}
            >
              Reset demo data
            </Button>
          </div>
        </Panel>
      )}
    </div>
  )
}
