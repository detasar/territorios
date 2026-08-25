#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_state_dir="$(mktemp -d /tmp/territorios-runtime-smoke.XXXXXX)"
worker_log="$runtime_state_dir/worker.log"
worker_pid=""
verification_port="${TERRITORIOS_RUNTIME_PORT:-3019}"
base_url="http://localhost:$verification_port"
expected_release_sha="$(git -C "$project_dir" rev-parse HEAD)"

cleanup() {
  if [[ -n "$worker_pid" ]] && kill -0 "$worker_pid" 2>/dev/null; then
    kill "$worker_pid" 2>/dev/null || true
    wait "$worker_pid" 2>/dev/null || true
  fi
  if [[ "$runtime_state_dir" == /tmp/territorios-runtime-smoke.* ]]; then
    rm -rf -- "$runtime_state_dir"
  fi
}
trap cleanup EXIT

cd "$project_dir"
npx wrangler d1 migrations apply site-creator-d1 \
  --local \
  --persist-to "$runtime_state_dir" >/dev/null

npx wrangler dev \
  --config dist/server/wrangler.json \
  --local \
  --persist-to "$runtime_state_dir" \
  --port "$verification_port" \
  --show-interactive-dev-session=false \
  --log-level=error >"$worker_log" 2>&1 &
worker_pid=$!

ready=false
for _ in {1..160}; do
  if curl --fail --silent --output /dev/null "$base_url/api/game"; then
    ready=true
    break
  fi
  if ! kill -0 "$worker_pid" 2>/dev/null; then
    sed -n '1,200p' "$worker_log" >&2
    exit 1
  fi
  sleep 0.25
done

if [[ "$ready" != true ]]; then
  sed -n '1,200p' "$worker_log" >&2
  echo "Production runtime smoke server did not become ready." >&2
  exit 1
fi

game_headers="$runtime_state_dir/game.headers"
game_body="$runtime_state_dir/game.json"
community_body="$runtime_state_dir/community.json"
province_body="$runtime_state_dir/province.html"

curl --fail-with-body --silent --show-error \
  --dump-header "$game_headers" \
  --output "$game_body" \
  "$base_url/api/game"
curl --fail-with-body --silent --show-error \
  --output "$community_body" \
  "$base_url/api/community"
curl --fail-with-body --silent --show-error \
  --output "$province_body" \
  "$base_url/province/28"

node - "$game_headers" "$game_body" "$community_body" "$province_body" "$expected_release_sha" <<'NODE'
const fs = require('node:fs');

const headers = fs.readFileSync(process.argv[2], 'utf8').toLowerCase();
const rawGame = fs.readFileSync(process.argv[3], 'utf8');
const game = JSON.parse(rawGame);
const community = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
const province = fs.readFileSync(process.argv[5], 'utf8');
const expectedReleaseSha = process.argv[6];

const fail = (message) => {
  throw new Error(`Runtime smoke failed: ${message}`);
};

if (game.mode !== 'live-world') fail('world mode');
if (game.release?.version !== '0.2.0-beta.1') fail('release version');
if (game.release?.sha !== expectedReleaseSha) fail('release SHA');
if (game.release?.realMoney !== false || game.release?.channel !== 'closed-beta') {
  fail('closed-beta money boundary');
}
if (game.territories?.length !== 52) fail('territory count');
if (game.battles?.length !== 8) fail('opening front count');
if (new Set(game.battles.map((battle) => battle.targetTerritoryCode)).size !== 8) {
  fail('opening targets are not unique');
}
if (game.season?.engineVersion !== 'combat-2.0.0') fail('combat engine version');
if (!game.battles.every((battle) => battle.campaignId && battle.combatContext)) {
  fail('campaign or combat context missing');
}
if (rawGame.includes('payload_json') || rawGame.includes('aggregate_id')) {
  fail('private event internals leaked');
}
if (community.viewer !== null) fail('anonymous community viewer');
if (!headers.includes('content-type: application/json')) fail('JSON content type');
if (!headers.includes('cache-control: private, no-store')) fail('private no-store cache policy');
if (!headers.includes('content-security-policy:')) fail('content security policy');
if (!headers.includes('x-content-type-options: nosniff')) fail('nosniff policy');
if (!headers.includes('referrer-policy: strict-origin-when-cross-origin')) fail('referrer policy');
if (!headers.includes('permissions-policy:')) fail('permissions policy');
if (!province.includes('Madrid — Territorios')) fail('province metadata');

process.stdout.write(
  `RUNTIME_SMOKE_PASS territories=${game.territories.length} ` +
  `fronts=${game.battles.length} engine=${game.season.engineVersion} ` +
  `anonymous_viewer=true\n`,
);
NODE
