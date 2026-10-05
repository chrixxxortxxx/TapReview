// Web NFC helpers for provisioning cards (Chrome on Android only).
// Customers never need this: their phones open the HTTPS URL stored on the tag natively.

export const webNfcSupported = typeof window !== 'undefined' && 'NDEFReader' in window

/** Reads the tag's serial number (UID). Resolves with e.g. "04:a1:7c:22:9b:51:80". */
export function readTagUid(timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    if (!webNfcSupported) return reject(new Error('Web NFC is not supported on this device/browser. Use Chrome on Android.'))
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      ctrl.abort()
      reject(new Error('No tag detected. Hold the card against the back of the phone.'))
    }, timeoutMs)
    const reader = new window.NDEFReader()
    reader
      .scan({ signal: ctrl.signal })
      .then(() => {
        reader.onreading = (e) => {
          clearTimeout(timer)
          ctrl.abort()
          resolve(String(e.serialNumber || '').toUpperCase())
        }
        reader.onreadingerror = () => {
          clearTimeout(timer)
          ctrl.abort()
          reject(new Error('Could not read the tag. Try again.'))
        }
      })
      .catch((e) => {
        clearTimeout(timer)
        reject(e)
      })
  })
}

/** Writes a single URL record to the tag. */
export async function writeTagUrl(url) {
  if (!webNfcSupported) throw new Error('Web NFC is not supported on this device/browser. Use Chrome on Android, or an app such as NFC Tools.')
  const writer = new window.NDEFReader()
  await writer.write({ records: [{ recordType: 'url', data: url }] }, { overwrite: true })
}
