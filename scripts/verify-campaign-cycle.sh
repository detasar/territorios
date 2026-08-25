#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_state_dir="$(mktemp -d /tmp/territorios-campaign-cycle.XXXXXX)"
worker_log="$runtime_state_dir/worker.log"
worker_pid=""
verification_port=3017

cleanup() {
  if [[ -n "$worker_pid" ]] && kill -0 "$worker_pid" 2>/dev/null; then
    kill "$worker_pid" 2>/dev/null || true
    wait "$worker_pid" 2>/dev/null || true
  fi
  if [[ "$runtime_state_dir" == /tmp/territorios-campaign-cycle.* ]]; then
    rm -rf -- "$runtime_state_dir"
  fi
}
trap cleanup EXIT

cd "$project_dir"
npx wrangler d1 migrations apply site-creator-d1 \
  --local \
  --persist-to "$runtime_state_dir" >/dev/null

npx wrangler dev scripts/campaign-cycle-harness.ts \
  --config wrangler.jsonc \
  --local \
  --persist-to "$runtime_state_dir" \
  --port "$verification_port" \
  --show-interactive-dev-session=false \
  --log-level=error >"$worker_log" 2>&1 &
worker_pid=$!

ready=false
for _ in {1..80}; do
  if curl --silent --output /dev/null "http://127.0.0.1:$verification_port/health"; then
    ready=true
    break
  fi
  if ! kill -0 "$worker_pid" 2>/dev/null; then
    sed -n '1,160p' "$worker_log" >&2
    exit 1
  fi
  sleep 0.25
done

if [[ "$ready" != true ]]; then
  sed -n '1,160p' "$worker_log" >&2
  echo "Campaign verification worker did not become ready." >&2
  exit 1
fi

result_file="$runtime_state_dir/result.json"
if ! curl --fail-with-body --silent --show-error \
  "http://127.0.0.1:$verification_port/verify" >"$result_file"; then
  sed -n '1,80p' "$result_file" >&2
  sed -n '1,160p' "$worker_log" >&2
  exit 1
fi

node - "$result_file" <<'NODE'
const fs = require('node:fs');
const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (
  result.status !== 'pass' ||
  result.votedConquestCycles !== 5 ||
  result.totalConquestsIncludingOpeningFront !== 6 ||
  result.nextCampaign?.cycle_number !== 7 ||
  result.nextCampaign?.phase !== 'planning' ||
  result.seasonReset?.nextSeasonNumber !== 2
) {
  throw new Error(`Campaign verification failed: ${JSON.stringify(result)}`);
}
process.stdout.write(
  `CAMPAIGN_CYCLE_PASS voted_cycles=${result.votedConquestCycles} ` +
  `total_captures=${result.totalConquestsIncludingOpeningFront} ` +
  `next_cycle=${result.nextCampaign.cycle_number} ` +
  `next_season=${result.seasonReset.nextSeasonNumber}\n`,
);
NODE
