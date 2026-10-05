import { useMemo, useState } from 'react'
import { Download, FileBarChart, Printer } from 'lucide-react'
import { useAsync, useWorkspace } from '../../lib/workspace'
import { api } from '../../lib/api'
import { cardUrl } from '../../lib/config'
import { branchStats, businessStats, groupSum } from '../../lib/derive'
import { date, dateTime, downloadCsv, num } from '../../lib/format'
import { regionName } from '../../lib/geo'
import { Button, Panel, Segmented, Spinner } from '../../components/ui'
import { isoDaysAgo } from '../../components/Charts'
import { describe } from './ActivityLogs'

const REPORTS = [
  { id: 'cards', title: 'NFC Card Report', text: 'Every card with assignment, location, status and usage.' },
  { id: 'restaurants', title: 'Restaurant Report', text: 'Businesses with owners, branches, cards and totals.' },
  { id: 'branches', title: 'Branch Report', text: 'Branches with address, coordinates and card activity.' },
  { id: 'usage', title: 'Usage Report', text: 'Daily NFC taps, QR scans, visits and review clicks.' },
  { id: 'regional', title: 'Regional Usage Report', text: 'Interactions grouped by region, province and city.' },
  { id: 'activity', title: 'Activity Report', text: 'Audit log of changes across the platform.' },
  { id: 'replacement', title: 'Replacement Report', text: 'Replaced cards and their replacements.' },
  { id: 'lost', title: 'Lost Card Report', text: 'Cards reported lost and where they were used.' },
]

export default function Reports() {
  const { ws, cards, version } = useWorkspace()
  const [report, setReport] = useState('cards')
  const [range, setRange] = useState('30')
  const from = isoDaysAgo(Number(range) - 1)
  const needsUsage = report === 'usage' || report === 'regional'
  const [usage] = useAsync(() => (needsUsage ? api.getActivity({ from }) : Promise.resolve(null)), [needsUsage, from, version])
  const [periodTotals] = useAsync(() => (report === 'regional' ? api.getCardTotalsSince(from) : Promise.resolve(null)), [report, from, version])
  const [logs] = useAsync(() => (report === 'activity' ? api.getAuditLogs({ limit: 2000 }) : Promise.resolve(null)), [report, version])

  const def = useMemo(() => {
    const code = new Map(cards.map((c) => [c.id, c]))
    switch (report) {
      case 'cards':
        return {
          cols: [['Card ID', 'card_code'], ['NFC UID', 'nfc_uid'], ['Restaurant', 'business_name'], ['Branch', 'branch_name'], ['City', 'city'], ['Province', 'province'], ['Region', (c) => regionName(c.region_code)], ['Status', 'status'], ['URL', (c) => cardUrl(c.public_token)], ['Taps', 'taps'], ['QR scans', 'scans'], ['Assigned', (c) => date(c.assigned_at)], ['Last used', (c) => date(c.last_used_at)]],
          rows: cards,
        }
      case 'restaurants': {
        const s = businessStats(ws)
        return {
          cols: [['Restaurant', 'name'], ['Owner', 'owner_name'], ['Email', 'owner_email'], ['Phone', 'phone'], ['Category', 'category'], ['Status', 'status'], ['Registered', (b) => date(b.created_at)], ['Branches', (b) => s.get(b.id).branches], ['NFC cards', (b) => s.get(b.id).cards], ['Active', (b) => s.get(b.id).active], ['Taps', (b) => s.get(b.id).taps], ['QR scans', (b) => s.get(b.id).scans]],
          rows: ws.businesses,
        }
      }
      case 'branches': {
        const s = branchStats(ws)
        return {
          cols: [['Restaurant', (b) => ws.businesses.find((x) => x.id === b.business_id)?.name], ['Branch', 'name'], ['Address', 'address'], ['City', 'city'], ['Province', 'province'], ['Region', (b) => regionName(b.region_code)], ['Latitude', 'lat'], ['Longitude', 'lng'], ['NFC cards', (b) => s.get(b.id).cards], ['Taps', (b) => s.get(b.id).taps], ['QR scans', (b) => s.get(b.id).scans], ['Last activity', (b) => date(s.get(b.id).last)]],
          rows: ws.branches,
        }
      }
      case 'usage':
        return { cols: [['Date', 'day'], ['NFC taps', 'nfc'], ['QR scans', 'qr'], ['Landing page views', 'views'], ['Google Review clicks', 'clicks']], rows: usage ? [...usage].reverse() : null }
      case 'regional': {
        if (!periodTotals) return { cols: [], rows: null }
        const t = new Map(periodTotals.map((x) => [x.card_id, x]))
        const withT = cards.filter((c) => c.business_id).map((c) => ({ ...c, pt: t.get(c.id) ?? { taps: 0, scans: 0 } }))
        const rows = groupSum(withT, (c) => `${c.region_code}|${c.province}|${c.city}`, (c) => c.pt.taps + c.pt.scans).map((g) => {
          const [region, province, city] = g.key.split('|')
          const inG = withT.filter((c) => c.region_code === region && c.province === province && c.city === city)
          return { region: regionName(region), province, city, cards: inG.length, taps: inG.reduce((s, c) => s + c.pt.taps, 0), scans: inG.reduce((s, c) => s + c.pt.scans, 0), total: g.value }
        })
        return { cols: [['Region', 'region'], ['Province', 'province'], ['City / municipality', 'city'], ['NFC cards', 'cards'], ['NFC taps', 'taps'], ['QR scans', 'scans'], ['Total', 'total']], rows }
      }
      case 'activity':
        return { cols: [['Date/time', (l) => dateTime(l.created_at)], ['Card', (l) => code.get(l.card_id)?.card_code ?? ''], ['Activity', describe], ['By', 'actor_email']], rows: logs }
      case 'replacement':
        return {
          cols: [['Old card', 'card_code'], ['Restaurant', 'business_name'], ['Branch', 'branch_name'], ['Replaced on', (c) => date(c.deactivated_at)], ['New card', (c) => code.get(c.replaced_by)?.card_code ?? ''], ['New card status', (c) => code.get(c.replaced_by)?.status ?? ''], ['Taps (old card)', 'taps'], ['QR scans (old card)', 'scans']],
          rows: cards.filter((c) => c.status === 'replaced'),
        }
      case 'lost':
        return {
          cols: [['Card ID', 'card_code'], ['NFC UID', 'nfc_uid'], ['Restaurant', 'business_name'], ['Branch', 'branch_name'], ['City', 'city'], ['Province', 'province'], ['Reported lost', (c) => date(c.deactivated_at)], ['Last used', (c) => date(c.last_used_at)], ['Taps', 'taps']],
          rows: cards.filter((c) => c.status === 'lost'),
        }
      default:
        return { cols: [], rows: [] }
    }
  }, [report, ws, cards, usage, periodTotals, logs])

  const meta = REPORTS.find((r) => r.id === report)
  const value = (row, col) => (typeof col[1] === 'function' ? col[1](row) : row[col[1]])
  const csv = () => downloadCsv(`tapreview-${report}-report-${isoDaysAgo(0)}.csv`, def.cols.map(([label, k]) => ({ label, value: typeof k === 'function' ? k : (r) => r[k] })), def.rows ?? [])

  return (
    <div className="stack">
      <div className="page-head no-print">
        <div>
          <h1>Reports</h1>
          <p>Generate a report, preview it, then export to CSV or print / save as PDF.</p>
        </div>
      </div>
      <div className="grid grid-4 no-print">
        {REPORTS.map((r) => (
          <button key={r.id} className="panel" style={{ textAlign: 'left', padding: 14, cursor: 'pointer', borderColor: report === r.id ? 'var(--text)' : undefined }} onClick={() => setReport(r.id)}>
            <div className="row"><FileBarChart size={16} /><b>{r.title}</b></div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{r.text}</div>
          </button>
        ))}
      </div>

      <Panel
        title={meta.title}
        subtitle={`Generated ${dateTime(new Date())}${needsUsage ? ` · last ${range} days` : ''} · ${def.rows ? def.rows.length : '…'} rows`}
        actions={
          <div className="row wrap no-print">
            {needsUsage && <Segmented value={range} onChange={setRange} options={[{ value: '7', label: '7d' }, { value: '30', label: '30d' }, { value: '90', label: '90d' }]} />}
            <Button icon={Download} onClick={csv} disabled={!def.rows}>Export CSV</Button>
            <Button icon={Printer} onClick={() => window.print()} disabled={!def.rows}>Print / PDF</Button>
          </div>
        }
        flush
      >
        {!def.rows ? <div style={{ padding: 20 }}><Spinner /></div> : def.rows.length === 0 ? <p className="muted" style={{ padding: 20 }}>Nothing to report.</p> : (
          <div className="table-wrap" style={{ marginTop: 12, maxHeight: 640 }}>
            <table className="table">
              <thead><tr>{def.cols.map((c) => <th key={c[0]}>{c[0]}</th>)}</tr></thead>
              <tbody>
                {def.rows.slice(0, 500).map((r, i) => (
                  <tr key={r.id ?? i}>
                    {def.cols.map((c) => {
                      const v = value(r, c)
                      return <td key={c[0]} className={typeof v === 'number' ? 'num' : ''}>{typeof v === 'number' ? num(v) : v ?? '—'}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {def.rows.length > 500 && <p className="muted" style={{ padding: 14 }}>Showing first 500 rows — export CSV for all {def.rows.length}.</p>}
          </div>
        )}
      </Panel>
    </div>
  )
}
