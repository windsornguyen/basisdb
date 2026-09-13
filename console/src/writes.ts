import { create, type MessageInitShape } from '@bufbuild/protobuf'
import { Code, ConnectError, type Client } from '@connectrpc/connect'
import { KvService, PutRequestSchema, DeleteRequestSchema } from './gen/basisdb/kv/v1/kv_pb'

type Put = Omit<MessageInitShape<typeof PutRequestSchema>, 'clientId' | 'sequence' | '$typeName'>
type Delete = Omit<
  MessageInitShape<typeof DeleteRequestSchema>,
  'clientId' | 'sequence' | '$typeName'
>
export type WriterClient = Pick<Client<typeof KvService>, 'registerSession' | 'put' | 'delete'>

export function canEditAfterFailure(error: unknown): boolean {
  if (!(error instanceof ConnectError)) return false
  return (
    error.code === Code.InvalidArgument ||
    (error.code === Code.FailedPrecondition &&
      ['key already exists', 'ETag precondition failed'].includes(error.rawMessage))
  )
}

// Keep the returned operation for retries: its session and sequence are immutable.
export function createWriter(client: WriterClient) {
  let session: Promise<bigint> | undefined
  let sequence = 0n
  async function identity() {
    session ??= client
      .registerSession({})
      .then((response) => response.clientId)
      .catch((error) => {
        session = undefined
        throw error
      })
    const clientId = await session
    if (sequence === 0xffff_ffff_ffff_ffffn) throw new Error('Client sequence exhausted')
    return { clientId, sequence: ++sequence }
  }
  return {
    async put(input: Put) {
      const request = create(PutRequestSchema, {
        ...input,
        body: input.body?.slice(),
        ...(await identity()),
      })
      return () => client.put(request)
    },
    async delete(input: Delete) {
      const request = create(DeleteRequestSchema, { ...input, ...(await identity()) })
      return () => client.delete(request)
    },
  }
}
