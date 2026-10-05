import { useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useAsync, useWorkspace } from '../../lib/workspace'
import { isSafeHttpUrl } from '../../lib/format'
import { Avatar, Button, Field, Panel, Spinner, useAction } from '../../components/ui'

export default function Profile() {
  const { ws } = useWorkspace()
  const [id, setId] = useState(ws.businesses[0]?.id)
  const biz = ws.businesses.find((b) => b.id === id)
  if (!biz) return null
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Restaurant profile</h1>
          <p>Shown to customers on your NFC/QR landing page.</p>
        </div>
        {ws.businesses.length > 1 && (
          <select className="input" style={{ width: 'auto' }} value={id} onChange={(e) => setId(e.target.value)}>
            {ws.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>
      <BusinessProfileForm key={biz.id} business={biz} />
      <TeamPanel businessId={biz.id} />
    </div>
  )
}

const urlOk = (v) => !v || (isSafeHttpUrl(v) && v.startsWith('https://'))

export function BusinessProfileForm({ business }) {
  const { isOwnerOf } = useAuth()
  const { reload } = useWorkspace()
  const [run, busy] = useAction()
  const canEdit = isOwnerOf(business.id)
  const [f, setF] = useState({
    name: business.name ?? '', category: business.category ?? '', description: business.description ?? '', phone: business.phone ?? '',
    email: business.email ?? '', website: business.website ?? '', facebook_url: business.facebook_url ?? '', logo_url: business.logo_url ?? '', cover_url: business.cover_url ?? '',
  })
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const bad = ['website', 'facebook_url', 'logo_url', 'cover_url'].find((k) => !urlOk(f[k]))
    if (bad) return setErr('Links and image URLs must start with https://')
    setErr(null)
    if (await run(() => api.updateBusiness(business.id, f), 'Profile saved')) reload()
  }

  return (
    <Panel title="Business details" subtitle={canEdit ? undefined : 'Only owners can edit the profile.'}>
      <form className="stack" onSubmit={submit}>
        {err && <p className="alert">{err}</p>}
        <div className="row" style={{ gap: 14 }}>
          <Avatar name={f.name} src={urlOk(f.logo_url) ? f.logo_url : null} size="lg" />
          <div>
            <div className="cell-title" style={{ fontSize: 16 }}>{f.name || 'Business name'}</div>
            <div className="muted">{f.category}</div>
          </div>
        </div>
        <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <Field label="Restaurant name"><input className="input" required minLength={2} maxLength={120} value={f.name} onChange={set('name')} /></Field>
            <Field label="Category"><input className="input" value={f.category} onChange={set('category')} maxLength={40} /></Field>
            <Field label="Description" className="full"><textarea className="input" value={f.description} onChange={set('description')} maxLength={1000} /></Field>
            <Field label="Contact number"><input className="input" value={f.phone} onChange={set('phone')} maxLength={40} /></Field>
            <Field label="Email"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
            <Field label="Website"><input className="input" type="url" placeholder="https://" value={f.website} onChange={set('website')} /></Field>
            <Field label="Facebook page"><input className="input" type="url" placeholder="https://facebook.com/..." value={f.facebook_url} onChange={set('facebook_url')} /></Field>
            <Field label="Logo image URL" hint="Square image, at least 256×256."><input className="input" type="url" placeholder="https://" value={f.logo_url} onChange={set('logo_url')} /></Field>
            <Field label="Cover image URL" hint="Wide image shown at the top of the landing page."><input className="input" type="url" placeholder="https://" value={f.cover_url} onChange={set('cover_url')} /></Field>
          </div>
        </fieldset>
        {canEdit && <div><Button variant="primary" type="submit" loading={busy}>Save profile</Button></div>}
      </form>
    </Panel>
  )
}

export function TeamPanel({ businessId }) {
  const { isOwnerOf, user } = useAuth()
  const { ws } = useWorkspace()
  const [members, loading, , refresh] = useAsync(() => api.listMembers(businessId), [businessId])
  const [run, busy] = useAction()
  const [f, setF] = useState({ email: '', role: 'staff', branch_ids: [] })
  const canEdit = isOwnerOf(businessId)
  const branches = ws.branches.filter((b) => b.business_id === businessId)
  const branchName = (id) => branches.find((b) => b.id === id)?.name ?? 'Unknown branch'

  const add = async (e) => {
    e.preventDefault()
    if (await run(() => api.addMember(businessId, f.email, f.role, f.role === 'staff' ? f.branch_ids : null), 'Team member added')) {
      setF({ email: '', role: 'staff', branch_ids: [] })
      refresh()
    }
  }

  return (
    <Panel title="Team" subtitle="Owners manage everything. Staff can view and manage cards for their assigned branches.">
      {loading ? <Spinner /> : (
        <div className="stack">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Member</th><th>Role</th><th>Branch access</th><th /></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id}>
                    <td><div className="cell-title">{m.full_name ?? '—'}</div><div className="cell-sub">{m.email}</div></td>
                    <td><span className={`badge plain ${m.role === 'owner' ? 'admin' : ''}`}>{m.role}</span></td>
                    <td className="muted">{m.role === 'owner' || !m.branch_ids ? 'All branches' : m.branch_ids.map(branchName).join(', ')}</td>
                    <td className="right">
                      {canEdit && m.user_id !== user.id && (
                        <Button size="sm" variant="ghost" icon={Trash2} title="Remove" onClick={async () => (await run(() => api.removeMember(businessId, m.user_id), 'Member removed')) && refresh()} />
                      )}
                    </td>
                  </tr>
                ))}
                {members.length === 0 && <tr><td colSpan={4} className="muted">No team members yet.</td></tr>}
              </tbody>
            </table>
          </div>
          {canEdit && (
            <form className="stack-sm" onSubmit={add}>
              <h3>Add team member</h3>
              <p className="muted" style={{ fontSize: 12.5 }}>The person must create a TapReview account first.</p>
              <div className="row wrap">
                <input className="input grow" style={{ minWidth: 200 }} type="email" required placeholder="email@example.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
                <select className="input" style={{ width: 'auto' }} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                  <option value="staff">Staff</option>
                  <option value="owner">Owner</option>
                </select>
                <Button type="submit" icon={UserPlus} loading={busy}>Add</Button>
              </div>
              {f.role === 'staff' && branches.length > 0 && (
                <div className="row wrap">
                  <span className="muted">Branches (none selected = all):</span>
                  {branches.map((b) => (
                    <label key={b.id} className="check">
                      <input
                        type="checkbox"
                        checked={f.branch_ids.includes(b.id)}
                        onChange={(e) => setF({ ...f, branch_ids: e.target.checked ? [...f.branch_ids, b.id] : f.branch_ids.filter((x) => x !== b.id) })}
                      />
                      {b.name}
                    </label>
                  ))}
                </div>
              )}
            </form>
          )}
        </div>
      )}
    </Panel>
  )
}
