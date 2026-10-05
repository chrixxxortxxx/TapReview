import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Button, Field } from '../../components/ui'
import { AuthSide } from './Login'

export default function Register() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [f, setF] = useState({ full_name: '', email: '', phone: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  if (!loading && user) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (f.password.length < 8) return setError('Password must be at least 8 characters.')
    setBusy(true)
    try {
      const r = await api.signUp(f)
      if (r.needsConfirmation) setSent(true)
      else navigate('/app')
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
          {sent ? (
            <div className="stack">
              <h1>Check your email</h1>
              <p className="muted">We sent a confirmation link to <b>{f.email}</b>. After confirming, sign in to set up your business.</p>
              <Link className="btn" to="/login">Back to sign in</Link>
            </div>
          ) : (
            <>
              <h1>Create your account</h1>
              <p className="muted" style={{ marginBottom: 20 }}>Register your restaurant or business. You’ll add your branches and NFC cards next.</p>
              <form className="stack" onSubmit={submit}>
                {error && <p className="alert">{error}</p>}
                <Field label="Full name">
                  <input className="input" required maxLength={80} autoComplete="name" value={f.full_name} onChange={set('full_name')} />
                </Field>
                <Field label="Email">
                  <input className="input" type="email" required autoComplete="email" value={f.email} onChange={set('email')} />
                </Field>
                <Field label="Mobile number">
                  <input className="input" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} placeholder="+63 9XX XXX XXXX" />
                </Field>
                <Field label="Password" hint="At least 8 characters.">
                  <input className="input" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set('password')} />
                </Field>
                <Button variant="primary" type="submit" loading={busy}>Create account</Button>
              </form>
              <p className="muted" style={{ marginTop: 16 }}>
                Already registered? <Link className="link" to="/login">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
