import { create } from '@bufbuild/protobuf'
import { expect, it } from 'vitest'
import { GetResponseSchema } from './gen/basisdb/kv/v1/kv_pb'
import { initialDraft, reduceDraft } from './draft'

it('keeps an edited value bound to its original revision across background refreshes', () => {
  const first = create(GetResponseSchema, {
    etag: 'v1',
    body: new TextEncoder().encode('original'),
  })
  const newer = create(GetResponseSchema, {
    etag: 'v2',
    body: new TextEncoder().encode('concurrent'),
  })
  const loaded = reduceDraft(initialDraft(false), { type: 'loaded', record: first })
  const edited = reduceDraft(loaded, { type: 'edited', text: 'my draft' })
  const refreshed = reduceDraft(edited, { type: 'loaded', record: newer })
  expect(refreshed.text).toBe('my draft')
  expect(refreshed.record?.etag).toBe('v1')
  const reloaded = reduceDraft(refreshed, { type: 'reload', record: newer })
  expect(reloaded.text).toBe('concurrent')
  expect(reloaded.record?.etag).toBe('v2')
  expect(reloaded.dirty).toBe(false)
})

it('updates untouched values and revisions together', () => {
  const newer = create(GetResponseSchema, { etag: 'v2', body: new TextEncoder().encode('new') })
  const draft = reduceDraft(initialDraft(false), { type: 'loaded', record: newer })
  expect(draft.record?.etag).toBe('v2')
  expect(draft.text).toBe('new')
})
