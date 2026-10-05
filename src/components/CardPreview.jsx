import { Nfc } from 'lucide-react'
import { useQrDataUrl } from './QR'

/** Visual mock of the physical NFC review card. */
export function CardPreview({ name, url, light }) {
  const qr = useQrDataUrl(url, 320)
  return (
    <div className={`card-preview ${light ? 'light' : ''}`}>
      <div className="cp-left">
        <div className="cp-name">{name}</div>
        <div className="cp-stars">★★★★★</div>
        <div className="cp-cta">Scan or Tap to Review</div>
        <div>
          <span className="cp-nfc">
            <Nfc size={12} /> NFC
          </span>
        </div>
      </div>
      <div className="cp-qr">{qr && <img src={qr} alt="QR code" />}</div>
    </div>
  )
}
