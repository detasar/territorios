#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
persist_args=()

if [[ -n "${TERRITORIOS_D1_STATE_PATH:-}" ]]; then
  mkdir -p "$TERRITORIOS_D1_STATE_PATH"
  persist_args=(--persist-to "$TERRITORIOS_D1_STATE_PATH")
fi

cd "$project_dir"
CI=1 ./node_modules/.bin/wrangler d1 migrations apply site-creator-d1 \
  --local \
  "${persist_args[@]}"

exec ./node_modules/.bin/vinext dev "$@"
