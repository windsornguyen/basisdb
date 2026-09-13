# BasisDB Console

A TypeScript client for the public BasisDB API. The first version provides
namespace browsing, paginated key metadata, value inspection, conditional
writes and deletes, and node status.

The layout takes the data-first navigation of Supabase Studio and the compact,
API-oriented approach of Oxide's console. The application uses React, Vite,
TanStack Query, and generated Protobuf/Connect bindings. It has no server-side
JavaScript application and no privileged database connection.

## Development

Use Node 22.12 or later and `protoc`:

```bash
npm ci
npm run generate
npm run dev
```

The dev server listens on `127.0.0.1:4173` and forwards KV RPCs to
`http://127.0.0.1:19090`. Start `bdb` with the repository's example configuration
in another terminal. Set `BASISDB_API_URL` to change the proxy destination. Point
it at the leader; automatic leader routing is not implemented.

The console uses the existing API's access model. It is a local development
tool; the database's public API does not yet provide production user
authentication. Do not expose the dev server as a hosted administration service.

## Visual Preview

```bash
npm run dev:preview
```

Preview mode explicitly selects a browser-only Mock Service Worker fixture and
labels the connection as **Preview**. Writes affect that fixture until reload.
An unreachable live API never switches to preview data. Production builds do
not activate the preview.

## Checks

```bash
npm run check
npm test
npm run build
```

`src/gen/` is generated from `basisdb-proto/proto/basisdb/kv/v1/kv.proto`.
Regenerate it after protocol changes; do not hand-edit generated types.

## Data Contract

The current source dialect is KV. A namespace is not a SQL schema or table.
The grid lists key metadata; opening a row loads its value through `Get`.
JSON display preserves the original text, including integers that JavaScript
cannot represent exactly. Binary values use Base64.

`ListNamespaces` and `List` use bounded lexical pagination. Each page passes a
Raft read barrier, but cursors do not hold a snapshot across requests. Concurrent
writes can therefore change later pages. Edits and deletes use the fetched ETag;
inserts require that the key does not already exist. Retrying a prepared mutation
reuses its session and sequence.

An edited draft retains the ETag of the value originally loaded. Background
refreshes cannot advance that ETag; adopting a newer value requires an explicit
reload. Definite validation and precondition rejections unlock the form, while
ambiguous failures keep the original operation available for retry.

## Next Capabilities

Table and schema editors require the catalog and relational dialect. SQL query
execution requires a SQL endpoint. Cluster-wide topology and metrics require an
administration API. These views should be added with their corresponding typed
contracts, not inferred from KV values or PostgreSQL-specific system tables.

## References

- [Oxide console architecture](https://github.com/oxidecomputer/console)
- [Supabase Studio](https://github.com/supabase/supabase/tree/master/apps/studio)
