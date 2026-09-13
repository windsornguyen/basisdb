export type Encoding = 'json' | 'text' | 'base64'
export const MAX_VALUE_BYTES = 64 * 1024

export function displayValue(bytes: Uint8Array): { text: string; encoding: Encoding } {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    return { text: toBase64(bytes), encoding: 'base64' }
  }
  try {
    JSON.parse(text)
    return { text, encoding: 'json' }
  } catch {
    return { text, encoding: 'text' }
  }
}

export function encodeValue(text: string, encoding: Encoding): Uint8Array {
  if (encoding === 'json') JSON.parse(text)
  const bytes =
    encoding === 'base64'
      ? Uint8Array.from(atob(text), (character) => character.charCodeAt(0))
      : new TextEncoder().encode(text)
  if (bytes.length > MAX_VALUE_BYTES) throw new Error('Values must not exceed 64 KiB')
  return bytes
}

export function toBase64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
}

export function convertValue(text: string, from: Encoding, to: Encoding): string {
  const bytes = encodeValue(text, from === 'json' ? 'text' : from)
  const converted =
    to === 'base64'
      ? toBase64(bytes)
      : new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  if (to === 'json') JSON.parse(converted)
  return converted
}
