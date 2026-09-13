import { describe, expect, it } from 'vitest'
import { convertValue, displayValue, encodeValue, MAX_VALUE_BYTES } from './value'

describe('value integrity', () => {
  it('allows unfinished JSON to become text, but validates a switch into JSON', () => {
    expect(convertValue('plain text', 'json', 'text')).toBe('plain text')
    expect(() => convertValue('plain text', 'text', 'json')).toThrow()
    const encoded = convertValue('{ unfinished', 'json', 'base64')
    expect(convertValue(encoded, 'base64', 'text')).toBe('{ unfinished')
  })
  it('preserves a UTF8 byte-order mark instead of silently stripping it', () => {
    const bytes = new Uint8Array([239, 187, 191, 97])
    const display = displayValue(bytes)
    expect(encodeValue(display.text, display.encoding)).toEqual(bytes)
  })
  it('preserves JSON bytes, whitespace, and integers beyond JavaScript precision', () => {
    const text = '{ "id": 9007199254740993, "name": "Basis" }\n'
    const original = new TextEncoder().encode(text)
    const displayed = displayValue(original)
    expect(displayed.encoding).toBe('json')
    expect(displayed.text).toBe(text)
    expect(encodeValue(displayed.text, displayed.encoding)).toEqual(original)
  })
  it('preserves non-UTF8 values through the binary editor', () => {
    const original = new Uint8Array([0, 255, 128, 42])
    const displayed = displayValue(original)
    expect(displayed.encoding).toBe('base64')
    expect(encodeValue(displayed.text, displayed.encoding)).toEqual(original)
  })
  it('enforces the UTF8 byte limit rather than character count', () => {
    expect(() => encodeValue('é'.repeat(MAX_VALUE_BYTES), 'text')).toThrow('64 KiB')
    expect(encodeValue('x'.repeat(MAX_VALUE_BYTES), 'text')).toHaveLength(MAX_VALUE_BYTES)
  })
  it('rejects malformed JSON and malformed binary input before a mutation', () => {
    expect(() => encodeValue('{', 'json')).toThrow()
    expect(() => encodeValue('not base64!', 'base64')).toThrow()
  })
})
