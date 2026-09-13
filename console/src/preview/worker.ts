import {
  create,
  fromJson,
  toJson,
  type DescMessage,
  type JsonValue,
  type MessageInitShape,
} from '@bufbuild/protobuf'
import { http, HttpResponse } from 'msw'
import { setupWorker } from 'msw/browser'
import * as pb from '../gen/basisdb/kv/v1/kv_pb'

type Row = { namespace: string; key: string; body: Uint8Array; etag: string; generation: bigint }
const rows = new Map<string, Row>()
const id = (namespace: string, key: string) => JSON.stringify([namespace, key])
let generation = 1n
let client = 1n
const cache = new Map<string, { request: string; response: JsonValue }>()

for (const [namespace, key, value] of [
  ['app', 'api/limits', { requests_per_minute: 1200, burst: 100 }],
  ['app', 'api/version', { version: '2026-09-01', status: 'active' }],
  ['app', 'features/analytics', { enabled: false }],
  ['app', 'features/console', { enabled: true }],
  ['app', 'projects/basisdb', { name: 'BasisDB', environment: 'development', region: 'local' }],
  ['app', 'releases/current', { version: '0.0.1', channel: 'development' }],
  ['app', 'settings/default', { timezone: 'UTC', locale: 'en-US', retention_days: 30 }],
  ['app', 'settings/notifications', { email: false, webhooks: true }],
  ['app', 'workers/ingest', { concurrency: 4, batch_size: 128, state: 'idle' }],
  ['events', '2026-09-13/0001', { type: 'deployment.created', project: 'basisdb' }],
  ['events', '2026-09-13/0002', { type: 'configuration.updated', revision: 2 }],
  ['sessions', 'development', { last_seen: '2026-09-13T00:00:00Z', active: true }],
] as const) {
  rows.set(id(namespace, key), {
    namespace,
    key,
    body: new TextEncoder().encode(JSON.stringify(value, null, 2)),
    etag: `"preview-${generation}"`,
    generation: generation++,
  })
}

function json<S extends DescMessage>(schema: S, value: MessageInitShape<S>) {
  return HttpResponse.json(toJson(schema, create(schema, value)))
}
function failure(code: string, message: string, status = 400) {
  return HttpResponse.json({ code, message }, { status })
}
function metadata(row: Row) {
  return {
    namespace: row.namespace,
    key: row.key,
    etag: row.etag,
    generation: row.generation,
    size: BigInt(row.body.length),
  }
}

export const worker = setupWorker(
  http.post('*/basisdb.kv.v1.KvService/:method', async ({ request, params }) => {
    const body = (await request.json()) as JsonValue
    switch (params.method) {
      case 'Status':
        return json(pb.StatusResponseSchema, {
          nodeId: 0n,
          mode: 'leader',
          keyCount: BigInt(rows.size),
        })
      case 'RegisterSession':
        return json(pb.RegisterSessionResponseSchema, { clientId: client++ })
      case 'ListNamespaces': {
        const input = fromJson(pb.ListNamespacesRequestSchema, body)
        const limit = input.limit || 50
        if (limit > 100) return failure('invalid_argument', 'page limit must not exceed 100')
        const counts = new Map<string, bigint>()
        for (const row of rows.values())
          counts.set(row.namespace, (counts.get(row.namespace) ?? 0n) + 1n)
        const names = [...counts.keys()].sort().filter((name) => name > input.startAfter)
        const page = names.slice(0, limit)
        return json(pb.ListNamespacesResponseSchema, {
          namespaces: page.map((name) => ({ name, keyCount: counts.get(name) })),
          nextStartAfter: names.length > limit ? page.at(-1) : '',
        })
      }
      case 'List': {
        const input = fromJson(pb.ListRequestSchema, body)
        const limit = input.limit || 50
        if (limit > 100 || !input.namespace)
          return failure('invalid_argument', 'Invalid list request')
        const matches = [...rows.values()]
          .filter(
            (row) =>
              row.namespace === input.namespace &&
              row.key.startsWith(input.prefix) &&
              row.key > input.startAfter,
          )
          .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
        const page = matches.slice(0, limit)
        return json(pb.ListResponseSchema, {
          entries: page.map(metadata),
          nextStartAfter: matches.length > limit ? page.at(-1)?.key : '',
        })
      }
      case 'Get':
      case 'Head': {
        const input = fromJson(pb.GetRequestSchema, body)
        const row = rows.get(id(input.namespace, input.key))
        if (!row) return failure('not_found', 'key not found', 404)
        return params.method === 'Get'
          ? json(pb.GetResponseSchema, { ...metadata(row), body: row.body })
          : json(pb.HeadResponseSchema, metadata(row))
      }
      case 'Put':
      case 'Delete': {
        const input =
          params.method === 'Put'
            ? fromJson(pb.PutRequestSchema, body)
            : fromJson(pb.DeleteRequestSchema, body)
        const identity = `${input.clientId}:${input.sequence}`
        const serialized = JSON.stringify(body)
        const cached = cache.get(identity)
        if (cached)
          return cached.request === serialized
            ? HttpResponse.json(cached.response)
            : failure('aborted', 'sequence reused for different request', 409)
        if (!input.namespace || !input.key)
          return failure('invalid_argument', 'Namespace and key are required')
        const key = id(input.namespace, input.key)
        const current = rows.get(key)
        if (input.ifMatch && input.ifMatch !== current?.etag)
          return failure('failed_precondition', 'ETag precondition failed')
        let response: JsonValue
        if (input.$typeName === 'basisdb.kv.v1.PutRequest') {
          if (input.body.length > 64 * 1024)
            return failure('invalid_argument', 'Value exceeds 64 KiB')
          if (input.ifNoneMatch && current)
            return failure('failed_precondition', 'key already exists')
          const row = {
            namespace: input.namespace,
            key: input.key,
            body: input.body,
            generation: generation++,
            etag: `"preview-${generation - 1n}"`,
          }
          rows.set(key, row)
          response = toJson(pb.PutResponseSchema, create(pb.PutResponseSchema, metadata(row)))
        } else {
          const deleted = rows.delete(key)
          response = toJson(
            pb.DeleteResponseSchema,
            create(pb.DeleteResponseSchema, {
              namespace: input.namespace,
              key: input.key,
              deleted,
              generation: generation++,
            }),
          )
        }
        cache.set(identity, { request: serialized, response })
        return HttpResponse.json(response)
      }
      default:
        return failure('unimplemented', 'RPC is not implemented in the preview', 501)
    }
  }),
)
