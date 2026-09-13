import type { GetResponse } from './gen/basisdb/kv/v1/kv_pb'
import { displayValue, type Encoding } from './value'

export type Draft = {
  record: GetResponse | null
  text: string
  encoding: Encoding
  dirty: boolean
}
type Action =
  | { type: 'loaded' | 'reload'; record: GetResponse }
  | { type: 'edited'; text: string }
  | { type: 'encoding'; text: string; encoding: Encoding }

export function initialDraft(creating: boolean): Draft {
  return { record: null, text: creating ? '{}' : '', encoding: 'json', dirty: false }
}

export function reduceDraft(draft: Draft, action: Action): Draft {
  switch (action.type) {
    case 'loaded':
    case 'reload':
      // The value and its conditional-write revision must always move together.
      if (action.type === 'loaded' && draft.dirty) return draft
      return { record: action.record, ...displayValue(action.record.body), dirty: false }
    case 'edited':
      return { ...draft, text: action.text, dirty: true }
    case 'encoding':
      return { ...draft, text: action.text, encoding: action.encoding }
  }
}
