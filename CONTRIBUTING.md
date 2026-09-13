# Contributing to BasisDB

BasisDB is developed in the open under the MIT license. Start with the
[vision](spec/00-vision.md) and the specification for the subsystem you want to
change. Specifications describe the target; the [README](README)
identifies what is implemented.

## Build and Run

Install Rust 1.95 with rustfmt and clippy, plus `protoc` for generated RPC types.
The repository pins the Rust toolchain in `rust-toolchain.toml`.

```bash
git clone https://github.com/windsornguyen/basisdb
cd basisdb
cargo build --workspace --locked
cargo run -p basisdb --bin bdb -- check-config --config basisdb.example.toml
cargo run -p basisdb --bin bdb -- start --config basisdb.example.toml
```

The example starts one local replica. Its key is for development only. Use
`RUST_LOG=basisdb=debug` for diagnostic logging. The default configuration path
is `basisdb.toml`.

## Workspace

| Path | Responsibility |
| --- | --- |
| `basisdb/` | `bdb` executable and configuration loading |
| `basisdb-core/` | Shared filesystem, string, and synchronization utilities |
| `basisdb-node/` | Replicated KV service, Raft runtime, and peer transport |
| `basisdb-proto/` | Protobuf definitions and generated Connect RPC types |
| `basisdb-storage/` | Storage configuration |
| `basisdb-wal/` | Segmented write-ahead log and recovery |
| `consensus/basisdb-raft/` | I/O-free Raft state machine |
| `consensus/basisdb-raft-io/` | Consensus I/O contracts and client helpers |
| `jepsen/` | Clojure harness for testing the public KV service |
| `console/` | TypeScript developer console and generated API client |
| `spec/` | Target architecture and implementation order |

## Checks

Run the same Rust checks used by CI:

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
cargo doc --workspace --no-deps --locked
```

For Raft changes, the property and state-machine suites exercise generated
event sequences through the public API:

```bash
cargo test -p basisdb-raft --test property --test state_machine --locked
```

Cross-reference Raft changes with the
[dissertation checklist](consensus/basisdb-raft/DISSERTATION_CHECKLIST.md).
Keep source citations and focused tests current when changing consensus code.

### Jepsen

With Java and Leiningen installed:

```bash
cd jepsen
lein check
lein test
```

These check the harness. A distributed correctness result requires running a
cluster and checking its execution history. Follow the
[Jepsen instructions](jepsen/README.md) to build the Linux binary and run a test.

## Changes and Review

Console development and its checks are documented in [console/README.md](console/README.md).

Keep changes small and scoped to one behavior. Prefer explicit invariants,
typed errors, and the existing interfaces. Keep source files under 500 lines
where practical; avoid abstractions without a real consumer.

Behavior changes need focused tests. A regression test should demonstrate the
failure before the fix and exercise the corrected invariant afterward. Name
the precise workload and conditions for any performance or correctness claim.

Use Conventional Commits, such as `fix(consensus): preserve committed log entries`.
See the [commit workflow](.agents/skills/commit/SKILL.md) for scope selection and validation.
Follow the [pull request template](.github/PULL_REQUEST_TEMPLATE.md), document
breaking changes, and include the checks you ran. All workspace crates share
one release version.

Follow the [code of conduct](CODE_OF_CONDUCT.md). Report vulnerabilities through
the [security policy](SECURITY.md), not a public issue. Contributions are
licensed under the [MIT License](LICENSE).
