# Developer Console

BasisDB includes a developer console in `console/`. Manageability is part of the
database interface: an engineer should be able to inspect data and understand
the connected node without learning internal Rust modules.

## Product Boundary

The console is a client of public, typed APIs. It has no private storage access
and does not implement database semantics in the browser. The same operations
must be available to SDK users and test harnesses.

Start with a compact data explorer and a node view. Add table, schema, and query
editing as the corresponding database capabilities land. Do not inherit a
PostgreSQL administration model: BasisDB's catalog, dialects, and consistency
contracts define the interface.

## First Version

- Browse nonempty KV namespaces and key metadata with bounded pagination.
- Inspect values as JSON, text, or binary without changing their bytes.
- Insert, conditionally update, and conditionally delete records.
- Inspect the connected node's identity, Raft role, and key count.

Namespace and key listing are ordinary KV API operations. Each page observes a
read barrier. Pagination is not a long-lived snapshot; concurrent writes may
change subsequent pages.

## Architecture

The frontend is a static React/TypeScript application built with Vite. Connect
clients are generated from the same Protobuf contracts used by Rust. TanStack
Query owns request state and cache invalidation.

Development uses a loopback-only server with a fixed API proxy destination.
The long-term distribution target is to serve the compiled static assets with
`bdb`, without requiring Node.js on database hosts. That packaging is not yet
implemented.

## Design

Use a persistent navigation sidebar, compact toolbars, structured data grids,
and an adjacent record inspector. Status, loading, errors, and destructive
actions must have explicit states. Make datasets addressable through URLs.

Supabase Studio informs the data workflows. Oxide informs the restrained layout
and the principle that the console exposes the API directly. Authentication
products, secret vaults, edge functions, billing, and unrelated service controls
are outside this console's scope.

## Verification

Backend tests cover pagination, ordering, prefix boundaries, validation, and
the public HTTP methods. Frontend tests cover value preservation and retry
identity. An explicitly selected preview uses test fixtures for visual work;
it never substitutes for failed live requests or proves database correctness.
