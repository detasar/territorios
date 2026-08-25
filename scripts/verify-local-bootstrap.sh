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
    --output /dev/null \
    --write-out '%{http_code}' \
    "$base_url/" || true)"
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

node - "$base_url" <<'NODE'
const baseUrl = process.argv[2];

(async () => {
  const responses = await Promise.all(
    Array.from({ length: 8 }, () => fetch(`${baseUrl}/api/game`)),
  );
  if (responses.some((response) => !response.ok)) {
    throw new Error(`Concurrent bootstrap returned HTTP ${responses.map((response) => response.status).join(',')}`);
  }
  const worlds = await Promise.all(responses.map((response) => response.json()));
  const seasonIds = new Set(worlds.map((world) => world.season?.id));
  if (seasonIds.size !== 1) {
    throw new Error(`Expected one season, received ${seasonIds.size}`);
  }
  for (const world of worlds) {
    const age = world.serverTime - world.season.startsAt;
    if (age < 0 || age > 30_000) {
      throw new Error(`Fresh season did not start on day 1 (age=${age}).`);
    }
    if (world.territories?.length !== 52 || world.battles?.length !== 8) {
      throw new Error('Concurrent bootstrap did not return the complete opening world.');
    }
    const ownerColors = new Set(world.territories.map((territory) => territory.color));
    if (ownerColors.size !== 52 || [...ownerColors].some((color) => !/^hsl\(\d+ \d+% \d+%\)$/.test(color))) {
      throw new Error('Fresh world did not receive 52 deterministic owner visual tokens.');
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
NODE

curl --fail --silent --output "$game_body" "$base_url/api/game"

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
