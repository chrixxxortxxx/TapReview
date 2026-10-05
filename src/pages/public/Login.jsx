import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ChevronRight, Nfc } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { IS_DEMO } from '../../lib/config'
import { Button, Field, useToast } from '../../components/ui'

export function AuthSide() {
  return (
    <div className="auth-side">
      <div className="brand" style={{ padding: 0 }}>
        <span className="brand-mark" style={{ background: '#fff', color: '#0b0b0b' }}><Nfc size={17} /></span>
        TapReview
      </div>
      <div>
        <h2>Tap. Scan. Review.</h2>
        <p>NFC cards and QR codes that send customers straight to your Google Review page — managed from one dashboard, across every branch in the Philippines.</p>
      </div>
      <p style={{ fontSize: 12, color: '#74746f' }}>No app needed for customers · Privacy-friendly analytics</p>
    </div>
  )
}

export default function Login() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!loading && user) return <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace />

  const submit = async (e, creds) => {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const u = await api.signIn(creds?.email ?? email, creds?.password ?? password)
      navigate(u.role === 'admin' ? '/admin' : '/app')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <AuthSide />
      <div className="auth-main">
        <div className="auth-card">
          <h1>Sign in</h1>
          <p className="muted" style={{ marginBottom: 20 }}>Welcome back. Sign in to manage your NFC cards.</p>
          <form className="stack" onSubmit={submit}>
            {error && <p className="alert">{error}</p>}
            <Field label="Email">
              <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password">
              <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button variant="primary" type="submit" loading={busy}>Sign in</Button>
            {!IS_DEMO && (
              <button
                type="button"
                className="link"
                style={{ border: 0, background: 'none', alignSelf: 'flex-start' }}
                onClick={async () => {
                  if (!email) return setError('Enter your email first.')
                  try {
                    await api.requestPasswordReset(email)
                    toast('Password reset email sent')
                  } catch (err) {
                    setError(err.message)
                  }
                }}
              >
                Forgot password?
              </button>
            )}
          </form>
          <p className="muted" style={{ marginTop: 16 }}>
            New business? <Link className="link" to="/register">Create an account</Link>
          </p>

          {IS_DEMO && (
            <div className="demo-accounts">
              <div className="row between" style={{ marginBottom: 6 }}>
                <b>Demo accounts</b>
                <span className="muted mono">password: {api.DEMO_PASSWORD}</span>
              </div>
              {api.DEMO_ACCOUNTS.map((a) => (
                <button key={a.email} type="button" onClick={() => submit(null, { email: a.email, password: api.DEMO_PASSWORD })}>
                  <span>
                    <b style={{ display: 'block' }}>{a.label}</b>
                    <span className="muted mono">{a.email}</span>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
