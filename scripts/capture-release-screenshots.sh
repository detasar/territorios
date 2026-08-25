#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_dirs=()
server_pid=""
server_log=""
base_url=""
capture_port="${TERRITORIOS_SCREENSHOT_PORT:-3021}"

cleanup() {
  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  for runtime_dir in "${runtime_dirs[@]}"; do
    if [[ "$runtime_dir" == /tmp/territorios-release-screenshots.* ]]; then
      rm -rf -- "$runtime_dir"
    fi
  done
}
trap cleanup EXIT

start_server() {
  local runtime_state_dir="$1"
  local port="$2"
  server_log="$runtime_state_dir/server.log"
  base_url="http://localhost:$port"

  npx wrangler d1 migrations apply site-creator-d1 \
    --local \
    --persist-to "$runtime_state_dir" >/dev/null

  TERRITORIOS_D1_STATE_PATH="$runtime_state_dir" \
    ./node_modules/.bin/vinext dev \
    --host 127.0.0.1 \
    --port "$port" >"$server_log" 2>&1 &
  server_pid=$!

  local ready=false
  for _ in {1..480}; do
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
    echo "Release screenshot server did not become ready." >&2
    exit 1
  fi
}

stop_server() {
  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  server_pid=""
}

cd "$project_dir"
primary_state_dir="$(mktemp -d /tmp/territorios-release-screenshots.XXXXXX)"
runtime_dirs+=("$primary_state_dir")
start_server "$primary_state_dir" "$capture_port"
TERRITORIOS_SCREENSHOT_BASE_URL="$base_url" \
  TERRITORIOS_SCREENSHOT_MODE="primary" \
  node scripts/capture-release-screenshots.mjs
stop_server

defender_state_dir="$(mktemp -d /tmp/territorios-release-screenshots.XXXXXX)"
runtime_dirs+=("$defender_state_dir")
defender_port="$((capture_port + 1))"
start_server "$defender_state_dir" "$defender_port"
TERRITORIOS_SCREENSHOT_BASE_URL="$base_url" \
  TERRITORIOS_SCREENSHOT_MODE="defender" \
  node scripts/capture-release-screenshots.mjs
stop_server

echo "RELEASE_SCREENSHOTS_PASS isolated_d1=true"
