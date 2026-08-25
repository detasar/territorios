#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_state_dir="$(mktemp -d /tmp/territorios-local-bootstrap.XXXXXX)"
server_log="$runtime_state_dir/server.log"
game_body="$runtime_state_dir/game.json"
server_pid=""
verification_port="${TERRITORIOS_BOOTSTRAP_PORT:-3021}"
base_url="http://localhost:$verification_port"

terminate_process_tree() {
  local parent_pid="$1"
  local child_pid

  while IFS= read -r child_pid; do
    if [[ -n "$child_pid" ]]; then
      terminate_process_tree "$child_pid"
    fi
  done < <(pgrep -P "$parent_pid" 2>/dev/null || true)

  if kill -0 "$parent_pid" 2>/dev/null; then
    kill "$parent_pid" 2>/dev/null || true
  fi
}

cleanup() {
  if [[ -n "$server_pid" ]]; then
    terminate_process_tree "$server_pid"
    wait "$server_pid" 2>/dev/null || true
    server_pid=""
  fi
  if [[ "$runtime_state_dir" == /tmp/territorios-local-bootstrap.* ]]; then
    rm -rf -- "$runtime_state_dir"
  fi
}
trap cleanup EXIT

cd "$project_dir"
TERRITORIOS_D1_STATE_PATH="$runtime_state_dir" \
  npm run dev -- \
  --host 127.0.0.1 \
  --port "$verification_port" >"$server_log" 2>&1 &
server_pid=$!

ready=false
last_status="000"
for _ in {1..240}; do
  last_status="$(curl --silent \
    --output "$game_body" \
    --write-out '%{http_code}' \
    "$base_url/api/game" || true)"
  if [[ "$last_status" == "200" ]]; then
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
  if [[ -s "$game_body" ]]; then
    sed -n '1,120p' "$game_body" >&2
  fi
  echo "Local bootstrap did not produce a healthy game API (HTTP $last_status)." >&2
  exit 1
fi

node - "$game_body" <<'NODE'
const fs = require('node:fs');

const game = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (game.mode !== 'live-world') {
  throw new Error(`Expected live-world mode, received ${game.mode}`);
}
if (game.territories?.length !== 52) {
  throw new Error(`Expected 52 territories, received ${game.territories?.length}`);
}
if (!Array.isArray(game.battles) || game.battles.length === 0) {
  throw new Error('Expected at least one active battle after local bootstrap.');
}
NODE

cleanup
trap - EXIT
echo "LOCAL_BOOTSTRAP_PASS territories=52 automatic_migrations=true"
