#!/usr/bin/env bash
set -euo pipefail

root=$(git rev-parse --show-toplevel)
validator="$root/node_modules/.bin/commitlint"
if [[ ! -x "$validator" ]]; then
  printf 'error: install @commitlint/cli and @commitlint/config-conventional locally\n' >&2
  exit 127
fi

exec "$validator" --config "$root/commitlint.config.js" --strict "$@"
