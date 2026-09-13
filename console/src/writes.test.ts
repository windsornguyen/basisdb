import { create } from '@bufbuild/protobuf'
import { Code, ConnectError } from '@connectrpc/connect'
import { describe, expect, it, vi } from 'vitest'
import {
  PutResponseSchema,
  DeleteResponseSchema,
  RegisterSessionResponseSchema,
} from './gen/basisdb/kv/v1/kv_pb'
import { canEditAfterFailure, createWriter, type WriterClient } from './writes'

function fixture() {
  return {
    registerSession: vi
      .fn<WriterClient['registerSession']>()
      .mockResolvedValue(create(RegisterSessionResponseSchema, { clientId: 9007199254740993n })),
    put: vi.fn<WriterClient['put']>().mockResolvedValue(create(PutResponseSchema)),
    delete: vi.fn<WriterClient['delete']>().mockResolvedValue(create(DeleteResponseSchema)),
  }
}

describe('mutation identity', () => {
  it('allows correcting rejected preconditions without reusing the rejected sequence', () => {
    expect(
      canEditAfterFailure(new ConnectError('key already exists', Code.FailedPrecondition)),
    ).toBe(true)
    expect(
      canEditAfterFailure(new ConnectError('ETag precondition failed', Code.FailedPrecondition)),
    ).toBe(true)
    expect(
      canEditAfterFailure(new ConnectError('key must not be empty', Code.InvalidArgument)),
    ).toBe(true)
  })
  it('keeps the same operation for ambiguous network and leadership failures', () => {
    for (const code of [Code.Unavailable, Code.DeadlineExceeded, Code.Internal, Code.Canceled]) {
      expect(canEditAfterFailure(new ConnectError('request failed', code))).toBe(false)
    }
    expect(canEditAfterFailure(new ConnectError('not leader', Code.FailedPrecondition))).toBe(false)
    expect(canEditAfterFailure(new Error('network error'))).toBe(false)
  })
  it('retries a lost response with the same request, including exact u64 identifiers', async () => {
    const client = fixture()
    client.put.mockRejectedValueOnce(new Error('lost response'))
    const writer = createWriter(client)
    const bytes = new Uint8Array([42])
    const execute = await writer.put({
      namespace: 'test',
      key: 'key',
      body: bytes,
      ifMatch: 'version-1',
    })
    bytes[0] = 7
    await expect(execute()).rejects.toThrow('lost response')
    await execute()
    expect(client.registerSession).toHaveBeenCalledTimes(1)
    expect(client.put.mock.calls[0]?.[0]).toBe(client.put.mock.calls[1]?.[0])
    expect(client.put.mock.calls[1]?.[0]).toMatchObject({
      clientId: 9007199254740993n,
      sequence: 1n,
      ifMatch: 'version-1',
      body: new Uint8Array([42]),
    })
    await (
      await writer.delete({ namespace: 'test', key: 'key', ifMatch: 'version-2' })
    )()
    expect(client.delete.mock.calls[0]?.[0]).toMatchObject({ sequence: 2n })
  })
})
