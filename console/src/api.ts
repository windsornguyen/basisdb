import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { KvService } from './gen/basisdb/kv/v1/kv_pb'
import { createWriter } from './writes'

export const api = createClient(
  KvService,
  createConnectTransport({
    baseUrl: window.location.origin,
    useBinaryFormat: false,
    defaultTimeoutMs: 10_000,
  }),
)

export const writer = createWriter(api)

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed'
}

export function formatBytes(bytes: bigint): string {
  if (bytes < 1024n) return `${bytes} B`
  if (bytes < 1024n * 1024n)
    return `${Number(bytes) / 1024 < 10 ? (Number(bytes) / 1024).toFixed(1) : Math.round(Number(bytes) / 1024)} KiB`
  return `${(Number(bytes) / (1024 * 1024)).toFixed(1)} MiB`
}
