import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, ScrollText, Search } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useAsync, useWorkspace } from '../../lib/workspace'
import { api } from '../../lib/api'
import { dateTime, downloadCsv } from '../../lib/format'
import { matches } from '../../lib/derive'
import { Button, EmptyState, Pager, Panel, Spinner, usePaged } from '../../components/ui'

const ACTIONS = {
  'card.received': 'Card received by administrator',
  'card.created': 'Card created',
  'card.assigned': 'Card assigned',
  'card.reassigned': 'Card reassigned',
  'card.status_changed': 'Status changed',
  'card.updated': 'Card details updated',
  'card.replaced': 'Card replaced',
  'business.created': 'Business registered',
  'business.updated': 'Business profile updated',
  'business.status_changed': 'Business status changed',
  'business.review_url_changed': 'Google Review link changed',
  'branch.created': 'Branch added',
  'branch.updated': 'Branch updated',
  'branch.deleted': 'Branch deleted',
  'member.added': 'Team member added',
  'member.removed': 'Team member removed',
  'user.updated': 'User updated',
}

export function describe(log) {
  const d = log.details ?? {}
  switch (log.action) {
    case 'card.assigned':
      return `Card assigned to ${d.to_business ?? '—'}${d.to_branch ? ` – ${d.to_branch}` : ''}`
    case 'card.reassigned':
      return `Reassigned from ${d.from_business ?? 'inventory'}${d.from_branch ? ` – ${d.from_branch}` : ''} to ${d.to_business ?? 'inventory'}${d.to_branch ? ` – ${d.to_branch}` : ''}`
    case 'card.status_changed':
      return d.to === 'active' ? 'Card activated' : `Status changed ${d.from ?? ''} → ${d.to ?? ''}`
    case 'card.replaced':
      return `Card replaced by ${d.new_card ?? 'a new card'}${d.reason ? ` (${d.reason})` : ''}`
    case 'card.created':
      return d.replaces ? `Card created as replacement for ${d.replaces}` : 'Card created'
    case 'card.received':
      return `Card received by administrator${d.batch ? ` (${d.batch})` : ''}`
    case 'business.created':
      return `Business registered: ${d.name ?? ''}`
    case 'business.status_changed':
      return `Business status ${d.from} → ${d.to}`
    case 'member.added':
      return `Team member added: ${d.email} (${d.role})`
    case 'branch.created':
    case 'branch.updated':
    case 'branch.deleted':
      return `${ACTIONS[log.action]}: ${d.name ?? ''}`
    case 'user.updated':
      return `User updated: ${d.email ?? ''}`
    default:
      return ACTIONS[log.action] ?? log.action
  }
}

export function ActionLabel({ log, hideCard }) {
  const { cards, businessById } = useWorkspace()
  const { base, isAdmin } = useAuth()
  const card = !hideCard && log.card_id && cards.find((c) => c.id === log.card_id)
  const biz = !card && log.entity_type === 'business' && businessById.get(log.business_id)
  return (
    <span>
      {card && <Link className="link mono" to={`${base}/cards/${card.id}`}>{card.card_code}</Link>}
      {card && ' · '}
      {biz && isAdmin && <><Link className="link" to={`/admin/restaurants/${biz.id}`}>{biz.name}</Link> · </>}
      {describe(log)}
    </span>
  )
}

export default function ActivityLogs() {
  const { version, cards } = useWorkspace()
  const [logs] = useAsync(() => api.getAuditLogs({ limit: 2000 }), [version])
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const rows = useMemo(() => {
    if (!logs) return []
    const code = new Map(cards.map((c) => [c.id, c.card_code]))
    return logs.filter((l) => (!type || l.action.startsWith(type)) && matches(q, describe(l), l.actor_email, code.get(l.card_id)))
  }, [logs, q, type, cards])
  const paged = usePaged(rows, 50, q + type)

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Activity Logs</h1>
          <p>Audit trail of card, business, branch and user changes — who did what, and when.</p>
        </div>
        <Button
          icon={Download}
          onClick={() =>
            downloadCsv('tapreview-activity-log.csv', [
              { label: 'Date/time', value: (l) => dateTime(l.created_at) },
              { label: 'Action', key: 'action' },
              { label: 'Description', value: describe },
              { label: 'Card', value: (l) => cards.find((c) => c.id === l.card_id)?.card_code ?? '' },
              { label: 'Performed by', key: 'actor_email' },
            ], rows)
          }
        >
          Export CSV
        </Button>
      </div>
      <Panel flush>
        <div className="toolbar">
          <div className="search">
            <Search />
            <input className="input" placeholder="Search card ID, description, user…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
            <option value="">All activity</option>
            <option value="card.">Cards</option>
            <option value="card.replaced">Replacements</option>
            <option value="card.reassigned">Reassignments</option>
            <option value="card.status">Status changes</option>
            <option value="business.">Businesses</option>
            <option value="branch.">Branches</option>
            <option value="member.">Team</option>
            <option value="user.">Users</option>
          </select>
        </div>
        {!logs ? <div style={{ padding: 24 }}><Spinner /></div> : rows.length === 0 ? <EmptyState icon={ScrollText} title="No activity found." /> : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>When</th><th>Activity</th><th>Performed by</th></tr>
                </thead>
                <tbody>
                  {paged.slice.map((l) => (
                    <tr key={l.id}>
                      <td className="nowrap muted">{dateTime(l.created_at)}</td>
                      <td><ActionLabel log={l} /></td>
                      <td className="muted">{l.actor_email ?? 'system'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager paged={paged} />
          </>
        )}
      </Panel>
    </div>
  )
}
