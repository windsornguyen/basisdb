# Contributing to BasisDB

Thank you for your interest in contributing to BasisDB. This document provides guidelines and instructions for setting up your development environment, running tests, and submitting changes.

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Be respectful, inclusive, and professional in all interactions.

## Development Setup

### Prerequisites

- **Rust**: 1.95.0 or later (install via [rustup](https://rustup.rs/))
- **protoc**: Required to generate the Connect RPC types
- **Git**: For version control
- **Cargo tools**:
  ```bash
  cargo install cargo-nextest  # Faster test runner
  cargo install cargo-watch    # Auto-rebuild on changes
  ```

### Clone and Build

```bash
git clone https://github.com/windsornguyen/basisdb
cd basisdb
cargo build
```

### Running BasisDB

```bash
# Single-node instance
cargo run --bin bdb -- start --config basisdb.example.toml

# With debug logging
RUST_LOG=debug cargo run --bin bdb -- start --config basisdb.example.toml
```

## Testing

BasisDB has a multi-layered test strategy to ensure correctness and reliability.

### Unit Tests

Unit tests live alongside implementation code and cover individual components.

```bash
# Run all unit tests
cargo test --workspace

# Run tests for a specific crate
cargo test -p basisdb-kv

# Run a specific test
cargo test test_mvcc_snapshot_isolation
```

### Integration Tests

Integration tests live in `tests/` directories and validate end-to-end behavior.

```bash
# Run integration tests
cargo test --workspace --test '*'

# Run with nextest (faster, better output)
cargo nextest run --workspace
```

### Concurrency Tests (Loom)

Loom tests explore all possible thread interleavings to catch concurrency bugs.

```bash
# Run loom tests (requires --cfg loom)
RUSTFLAGS="--cfg loom" cargo test --release --lib loom

# Run specific loom test
RUSTFLAGS="--cfg loom" cargo test --release -p basisdb-txn loom_lock_manager
```

**Note**: Loom tests are expensive. Set limits for faster iteration:
```bash
LOOM_MAX_PREEMPTIONS=2 LOOM_MAX_BRANCHES=5000 RUSTFLAGS="--cfg loom" cargo test --release loom
```

### Simulation Tests

Deterministic simulation tests run the full system in a virtual environment with controlled time, network, and disk.

```bash
# Run simulation tests
cargo test -p basisdb-sim --release

# Run specific scenario
cargo test -p basisdb-sim --release test_partition_during_commit

# Long chaos run
cargo test -p basisdb-sim --release --ignored
```

### Property Tests

Property-based tests use `proptest` to generate random inputs and verify invariants.

```bash
# Run property tests
cargo test prop_

# Run with more cases
PROPTEST_CASES=10000 cargo test prop_mvcc_serializability
```

### Jepsen-Style Tests

External consistency checkers validate distributed correctness properties.

```bash
# Run Jepsen harness (requires Docker)
cargo build --release -p basisdb-jepsen
docker compose -f tests/jepsen/docker-compose.yml up

# Analyze history
cargo run -p basisdb-jepsen -- check history.edn
```

### Benchmarks

```bash
# Run all benchmarks
cargo bench --workspace

# Run specific benchmark
cargo bench -p basisdb-kv mvcc_write_throughput
```

### Full Test Suite

Before submitting a PR, run the full suite:

```bash
# Standard tests
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all -- --check

# Concurrency tests
RUSTFLAGS="--cfg loom" cargo test --release --lib loom

# Simulation (quick)
cargo test -p basisdb-sim --release
```

## Code Style

BasisDB follows standard Rust conventions with additional rules defined in `clippy.toml` and `rustfmt.toml`.

### Formatting

```bash
# Check formatting
cargo fmt --all -- --check

# Apply formatting
cargo fmt --all
```

### Linting

```bash
# Run clippy
cargo clippy --workspace --all-targets -- -D warnings

# Fix auto-fixable issues
cargo clippy --workspace --all-targets --fix
```

### Documentation

- Public APIs must have doc comments
- Use `///` for item documentation, `//!` for module documentation
- Include examples in doc comments when helpful
- Run `cargo doc --open` to preview

```rust
/// Commits a transaction at the given timestamp.
///
/// # Errors
///
/// Returns `CommitError::ConflictDetected` if a write-write conflict exists.
///
/// # Example
///
/// ```
/// let ts = coordinator.commit(txn_id, commit_ts).await?;
/// ```
pub async fn commit(&self, txn_id: TxnId, commit_ts: Timestamp) -> Result<(), CommitError> {
    // ...
}
```

## Project Structure

```
basisdb/
├── crates/
│   ├── basisdb/              # Core database binary and library
│   ├── basisdb-kv/           # MVCC key-value storage
│   ├── basisdb-raft/         # Consensus implementation
│   ├── basisdb-txn/          # Transaction coordinator
│   ├── basisdb-sql/          # SQL layer
│   ├── basisdb-client/       # Client SDK
│   ├── basisdb-test/         # Test utilities
│   ├── basisdb-sim/          # Deterministic simulator
│   ├── basisdb-jepsen/       # Jepsen harness
│   └── basisdb-bench/        # Benchmarks
├── .github/workflows/       # CI configuration
├── docs/                    # Additional documentation
├── Cargo.toml               # Workspace configuration
├── clippy.toml              # Clippy configuration
└── rustfmt.toml             # Rustfmt configuration
```

## Making Changes

### Workflow

1. **Fork** the repository
2. **Create a branch** for your changes: `git checkout -b feature/my-feature`
3. **Make your changes** with clear, logical commits
4. **Add tests** for new functionality
5. **Run the test suite** (see Testing section)
6. **Update documentation** if needed
7. **Push** to your fork and **open a Pull Request**

### Commit Messages

BasisDB follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `perf`: Performance improvement
- `refactor`: Code restructuring without behavior change
- `test`: Adding or updating tests
- `docs`: Documentation changes
- `chore`: Build, CI, or tooling changes

**Scopes**: `core`, `consensus`, `storage`, `node`, `proto`, `ci`, `deps`,
`docs`

**Examples**:
```
feat(core): implement bounded-time commit-wait

Reject unhealthy time intervals and delay acknowledgment until the commit
timestamp is certainly in the past.

Closes #123
```

```
fix(kv): prevent stale reads during range split

Ensure that follower reads check applied index before serving
snapshots at a timestamp that spans a range boundary.
```

### Versioning

BasisDB follows [Semantic Versioning](https://semver.org/):
- **MAJOR** (x.0.0): Breaking API changes
- **MINOR** (0.x.0): New features, backward compatible
- **PATCH** (0.0.x): Bug fixes, backward compatible

All crates in the workspace share the same version and are released together. This ensures consistency across the project and simplifies dependency management.

### Pull Request Guidelines

- **Title**: Clear and descriptive
- **Description**: Explain what changed and why
- **Tests**: Include test coverage for new code
- **Documentation**: Update docs if behavior changed
- **Breaking changes**: Call out explicitly

Your PR must pass:
- All test suites (unit, integration, loom, sim)
- Clippy without warnings
- Rustfmt checks
- No new compiler warnings

CI will run these checks automatically. You can run them locally before pushing.

## Testing Requirements

All contributions must meet these testing standards:

### Unit Tests
- Every public function must have test coverage
- Edge cases and error paths must be tested
- Use `#[cfg(test)]` modules in the same file

### Integration Tests
- New features require end-to-end integration tests
- Place in `tests/` directory or crate-specific `tests/` folder

### Concurrency Tests
- Any code touching shared state requires loom tests
- Lock managers, MVCC structures, and coordination logic are critical

### Property Tests
- Stateful components (MVCC, txn coordinator) require property tests
- Define clear invariants and verify with proptest

### Simulation Tests
- Distributed logic (2PC, range splits, replication) requires sim tests
- Test under partition, crash, and time skew scenarios

### Documentation Tests
- Public API examples in doc comments must compile and run
- Use ` ```rust` blocks for runnable examples

## Performance Considerations

- Avoid allocations in hot paths
- Use `#[inline]` for small, frequently called functions
- Profile before optimizing: `cargo flamegraph`
- Benchmark regressions are caught in CI

## Questions and Help

- **Issues**: Open an issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Report vulnerabilities privately to <security@dedaluslabs.ai>

## License

By contributing to BasisDB, you agree that your contributions will be licensed under the [MIT License](LICENSE).
