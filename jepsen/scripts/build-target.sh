#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo"

if [[ "$(uname -s)" != Linux ]]; then
  printf 'error: build bdb on a Linux host matching the Jepsen DB nodes\n' >&2
  exit 1
fi

cargo build --release -p basisdb --bin bdb --locked

printf '  ok  bdb (%s)\n' "$repo/target/release/bdb"
