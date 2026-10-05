// Web NFC helpers for provisioning cards (Chrome on Android only).
// Customers never need this: their phones open the HTTPS URL stored on the tag natively.

export const webNfcSupported = typeof window !== 'undefined' && 'NDEFReader' in window

/** Why Web NFC is unavailable on this device, or null if it is available. */
export function webNfcUnavailableReason() {
  if (webNfcSupported) return null
  if (typeof window === 'undefined') return 'Not running in a browser.'
  if (!window.isSecureContext) return 'Web NFC needs an HTTPS address. Open the app through its https:// link.'
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'iPhone browsers do not support Web NFC. Use an NFC app (e.g. NFC Tools) or an Android phone with Chrome.'
  if (!/android/i.test(navigator.userAgent)) return 'Web NFC only works in Chrome on Android phones.'
  return 'This browser does not support Web NFC. Open the app in Google Chrome on Android.'
}

/** Turns Web NFC errors into messages a person can act on. */
function friendly(e) {
  switch (e?.name) {
    case 'NotAllowedError':
      return 'NFC permission was blocked. Tap the lock icon in Chrome’s address bar → Permissions → NFC → Allow, then try again.'
    case 'NotSupportedError':
      return 'This phone has no NFC reader Chrome can use.'
    case 'NotReadableError':
      return 'NFC is turned off or busy. Turn on NFC in Android Settings → Connected devices, then try again.'
    case 'AbortError':
      return 'NFC scan was cancelled.'
    case 'NetworkError':
      return 'The tag moved away too quickly. Hold it still against the back of the phone.'
    default:
      return e?.message || 'NFC failed. Please try again.'
  }
}

/** Reads the tag's serial number (UID). Resolves with e.g. "04:A1:7C:22:9B:51:80". */
export function readTagUid(timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const unavailable = webNfcUnavailableReason()
    if (unavailable) return reject(new Error(unavailable))
    const ctrl = new AbortController()
    const done = (fn, v) => {
      clearTimeout(timer)
      ctrl.abort()
      fn(v)
    }
    const timer = setTimeout(() => done(reject, new Error('No tag detected. Hold the card flat against the middle of the phone’s back (near the camera) for 2 seconds.')), timeoutMs)
    const reader = new window.NDEFReader()
    // Attach handlers before scanning so a fast tap isn't missed.
    reader.onreading = (e) => {
      const uid = String(e.serialNumber || '').toUpperCase()
      if (uid) done(resolve, uid)
      else done(reject, new Error('The tag was detected but did not report a serial number. Type the UID printed on the packaging instead.'))
    }
    reader.onreadingerror = () =>
      done(
        reject,
        new Error('The tag was detected but Chrome can’t read it. It is probably blank/unformatted or a MIFARE Classic tag. Format it as NDEF (e.g. NFC Tools → Other → Format memory) or use NTAG213/215/216 cards.'),
      )
    reader.scan({ signal: ctrl.signal }).catch((e) => done(reject, new Error(friendly(e))))
  })
}

/** Writes a single URL record to the tag. */
export async function writeTagUrl(url) {
  const unavailable = webNfcUnavailableReason()
  if (unavailable) throw new Error(unavailable)
  try {
    const writer = new window.NDEFReader()
    await writer.write({ records: [{ recordType: 'url', data: url }] }, { overwrite: true })
  } catch (e) {
    throw new Error(
      e?.name === 'NotAllowedError' && /read-only|locked/i.test(e.message || '')
        ? 'This tag is locked (read-only) and cannot be rewritten.'
        : friendly(e),
    )
  }
}
