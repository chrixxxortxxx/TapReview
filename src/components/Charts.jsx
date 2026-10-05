import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { num } from '../lib/format'

const C = { nfc: '#0b0b0b', qr: '#2f5bea', views: '#a3a39e', clicks: '#138a4b' }
const LABELS = { nfc: 'NFC taps', qr: 'QR scans', views: 'Page views', clicks: 'Review clicks' }

const tickDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
const tickMonth = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', year: '2-digit' })
const tooltipStyle = { borderRadius: 10, border: '1px solid #e6e6e3', boxShadow: '0 8px 24px rgba(0,0,0,.08)', fontSize: 12 }

export function isoDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Fill missing days with zeros so lines don't skip. */
export function fillDays(rows, from) {
  const m = new Map(rows.map((r) => [r.day, r]))
  const out = []
  const d = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${isoDaysAgo(0)}T00:00:00Z`)
  while (d <= end) {
    const k = d.toISOString().slice(0, 10)
    out.push(m.get(k) ?? { day: k, nfc: 0, qr: 0, views: 0, clicks: 0 })
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

/** Group daily rows into weeks or months. */
export function bucket(rows, by) {
  if (by === 'day') return rows
  const m = new Map()
  for (const r of rows) {
    const d = new Date(`${r.day}T00:00:00Z`)
    let key
    if (by === 'week') {
      const monday = new Date(d)
      monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
      key = monday.toISOString().slice(0, 10)
    } else key = r.day.slice(0, 7) + '-01'
    const x = m.get(key) ?? { day: key, nfc: 0, qr: 0, views: 0, clicks: 0 }
    x.nfc += r.nfc
    x.qr += r.qr
    x.views += r.views
    x.clicks += r.clicks
    m.set(key, x)
  }
  return [...m.values()]
}

export function sumRows(rows) {
  return rows.reduce((s, r) => ({ nfc: s.nfc + r.nfc, qr: s.qr + r.qr, views: s.views + r.views, clicks: s.clicks + r.clicks }), { nfc: 0, qr: 0, views: 0, clicks: 0 })
}

export function ActivityChart({ data, series = ['nfc', 'qr'], small, by = 'day', area }) {
  const fmt = by === 'month' ? tickMonth : tickDate
  const Chart = area ? AreaChart : LineChart
  return (
    <div className={`chart-box ${small ? 'sm' : ''}`}>
      <ResponsiveContainer>
        <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#efefec" vertical={false} />
          <XAxis dataKey="day" tickFormatter={fmt} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={fmt} formatter={(v, n) => [num(v), LABELS[n] ?? n]} />
          {series.length > 1 && <Legend formatter={(v) => LABELS[v] ?? v} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
          {series.map((k) =>
            area ? (
              <Area key={k} type="monotone" dataKey={k} stroke={C[k]} fill={C[k]} fillOpacity={0.08} strokeWidth={2} dot={false} />
            ) : (
              <Line key={k} type="monotone" dataKey={k} stroke={C[k]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  )
}

export function CompareBars({ data, keys = ['nfc', 'qr'], labelKey = 'label', small }) {
  return (
    <div className={`chart-box ${small ? 'sm' : ''}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#efefec" vertical={false} />
          <XAxis dataKey={labelKey} tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [num(v), LABELS[n] ?? n]} cursor={{ fill: 'rgba(0,0,0,.03)' }} />
          <Legend formatter={(v) => LABELS[v] ?? v} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {keys.map((k) => (
            <Bar key={k} dataKey={k} fill={C[k]} radius={[4, 4, 0, 0]} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SplitBar({ a, b, labelA = 'NFC', labelB = 'QR' }) {
  const total = a + b || 1
  return (
    <div className="stack-sm">
      <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', background: 'var(--surface-2)' }}>
        <div style={{ width: `${(a / total) * 100}%`, background: C.nfc, transition: 'width .5s' }} />
        <div style={{ width: `${(b / total) * 100}%`, background: C.qr, transition: 'width .5s' }} />
      </div>
      <div className="row between wrap">
        <span>
          <i className="dot" style={{ background: C.nfc }} /> {labelA} <b>{num(a)}</b> <span className="muted">({Math.round((a / total) * 100)}%)</span>
        </span>
        <span>
          <i className="dot" style={{ background: C.qr }} /> {labelB} <b>{num(b)}</b> <span className="muted">({Math.round((b / total) * 100)}%)</span>
        </span>
      </div>
    </div>
  )
}
