import { useState } from 'react'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useWorkspace } from '../../lib/workspace'
import { cardUrl } from '../../lib/config'
import { isSafeHttpUrl } from '../../lib/format'
import { Button, Field, Panel, useAction } from '../../components/ui'

export default function GoogleReview() {
  const { ws, cards } = useWorkspace()
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Google Review</h1>
          <p>Where the “Write a Google Review” button sends your customers.</p>
        </div>
      </div>
      {ws.businesses.map((b) => (
        <ReviewLinkForm key={b.id} business={b} sampleCard={cards.find((c) => c.business_id === b.id && c.status === 'active')} />
      ))}
      <Panel title="How to get your Google Review link">
        <ol style={{ margin: 0, paddingLeft: 18 }} className="stack-sm">
          <li>Sign in to your <b>Google Business Profile</b> (search your business name on Google while signed in, or open business.google.com).</li>
          <li>Click <b>“Ask for reviews”</b> (or “Get more reviews”).</li>
          <li>Copy the short link — it looks like <span className="mono">https://g.page/r/…/review</span>.</li>
          <li>Paste it above and save. All your NFC cards and QR codes update instantly — no reprinting needed.</li>
        </ol>
      </Panel>
      <Panel>
        <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
          <ShieldCheck size={20} />
          <div className="stack-sm">
            <b>Fair review policy</b>
            <p className="muted">
              TapReview only links customers to your legitimate Google review page. It never creates, submits or filters reviews, and every customer sees the same button
              regardless of their experience. Google’s policies prohibit offering incentives for reviews or asking only happy customers to leave them.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  )
}

export function ReviewLinkForm({ business, sampleCard }) {
  const { isOwnerOf } = useAuth()
  const { reload } = useWorkspace()
  const [run, busy] = useAction()
  const [url, setUrl] = useState(business.review_url ?? '')
  const [err, setErr] = useState(null)
  const canEdit = isOwnerOf(business.id)

  const save = async (e) => {
    e.preventDefault()
    if (url && !(isSafeHttpUrl(url) && url.startsWith('https://'))) return setErr('The link must start with https://')
    setErr(null)
    if (await run(() => api.setReviewUrl(business.id, url.trim()), 'Google Review link saved')) reload()
  }

  return (
    <Panel title={business.name} subtitle={business.review_url ? 'Configured' : 'Not configured — customers will see a notice instead of the review button.'}>
      <form className="stack" onSubmit={save}>
        {err && <p className="alert">{err}</p>}
        <Field label="Google Review URL">
          <input className="input" type="url" placeholder="https://g.page/r/XXXXXXXX/review" value={url} onChange={(e) => setUrl(e.target.value)} disabled={!canEdit} />
        </Field>
        <div className="row wrap">
          {canEdit && <Button variant="primary" type="submit" loading={busy}>Save link</Button>}
          {business.review_url && <a className="btn" href={business.review_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Test review link</a>}
          {sampleCard && <a className="btn" href={cardUrl(sampleCard.public_token)} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Preview customer page</a>}
        </div>
      </form>
    </Panel>
  )
}
