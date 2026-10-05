import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download, Printer } from 'lucide-react'
import { Button } from './ui'

export function useQrDataUrl(text, size = 512) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b0b0b', light: '#ffffff' } }).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [text, size])
  return url
}

export function QRImage({ text, size = 512, style }) {
  const url = useQrDataUrl(text, size)
  return (
    <div className="qr-box" style={style}>
      {url ? <img src={url} alt={`QR code for ${text}`} /> : <div className="spinner" />}
    </div>
  )
}

export async function downloadQr(text, filename) {
  const url = await QRCode.toDataURL(text, { width: 1024, margin: 2, errorCorrectionLevel: 'M' })
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.png`
  a.click()
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/** Opens a print window with one or more QR labels. items: [{text, title, code}] */
export async function printQrs(items) {
  const imgs = await Promise.all(items.map((i) => QRCode.toDataURL(i.text, { width: 600, margin: 1 })))
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  const body = items
    .map(
      (i, k) =>
        `<div class="lbl"><div class="t">${escapeHtml(i.title)}</div><div class="s">&#9733;&#9733;&#9733;&#9733;&#9733;</div><img src="${imgs[k]}"/><div class="c">Scan or tap to review</div><div class="code">${escapeHtml(i.code ?? '')}</div></div>`,
    )
    .join('')
  w.document.write(`<!doctype html><html><head><title>TapReview QR codes</title><style>
    body{font-family:system-ui,sans-serif;margin:16px;color:#0b0b0b}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .lbl{border:1px dashed #bbb;border-radius:10px;padding:14px;text-align:center;break-inside:avoid}
    .t{font-weight:800;text-transform:uppercase;letter-spacing:.04em}.s{color:#f5b400;letter-spacing:2px}
    img{width:100%;max-width:180px;image-rendering:pixelated}.c{font-size:12px}.code{font:11px ui-monospace,monospace;color:#777;margin-top:4px}
  </style></head><body><div class="grid">${body}</div></body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

export function QRActions({ text, filename, title, code }) {
  return (
    <div className="row wrap">
      <Button size="sm" icon={Download} onClick={() => downloadQr(text, filename)}>
        Download QR
      </Button>
      <Button size="sm" icon={Printer} onClick={() => printQrs([{ text, title, code }])}>
        Print QR
      </Button>
    </div>
  )
}
