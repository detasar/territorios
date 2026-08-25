#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_state_dir="$(mktemp -d /tmp/territorios-browser-e2e.XXXXXX)"
server_log="$runtime_state_dir/server.log"
server_pid=""
verification_port="${TERRITORIOS_E2E_PORT:-3018}"
base_url="http://localhost:$verification_port"

cleanup() {
  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  if [[ "$runtime_state_dir" == /tmp/territorios-browser-e2e.* ]]; then
    rm -rf -- "$runtime_state_dir"
  fi
}
trap cleanup EXIT

cd "$project_dir"
npx wrangler d1 migrations apply site-creator-d1 \
  --local \
  --persist-to "$runtime_state_dir" >/dev/null

TERRITORIOS_D1_STATE_PATH="$runtime_state_dir" \
  ./node_modules/.bin/vinext dev \
  --host 127.0.0.1 \
  --port "$verification_port" >"$server_log" 2>&1 &
server_pid=$!

ready=false
for _ in {1..240}; do
  if curl --fail --silent --output /dev/null "$base_url/api/game"; then
    ready=true
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    sed -n '1,200p' "$server_log" >&2
    exit 1
  fi
  sleep 0.25
done

if [[ "$ready" != true ]]; then
  sed -n '1,200p' "$server_log" >&2
  echo "Isolated browser verification server did not become ready." >&2
  exit 1
fi

if ! PLAYWRIGHT_BASE_URL="$base_url" npx playwright test "$@"; then
  sed -n '1,200p' "$server_log" >&2
  exit 1
fi

echo "BROWSER_E2E_PASS isolated_d1=true"
