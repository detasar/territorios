#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
migration="$(find "$repo_root/drizzle" -maxdepth 1 -type f -name '0000_*.sql' -print -quit)"
if [[ -z "$migration" ]]; then
  echo 'D1 migration not found.' >&2
  exit 1
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
database="$work_dir/territorios.sqlite"
sqlite3 "$database" < "$migration"
node -e '
  const { execFileSync } = require("node:child_process");
  const { readFileSync } = require("node:fs");
  const [database, manifest] = process.argv.slice(1);
  const definitions = JSON.parse(readFileSync(manifest, "utf8"));
  for (const definition of definitions) execFileSync("sqlite3", [database, definition]);
' "$database" "$repo_root/db/database-guards.json"

tables="$(sqlite3 "$database" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")"
triggers="$(sqlite3 "$database" "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger';")"
purchase_columns="$(sqlite3 "$database" "SELECT COUNT(*) FROM pragma_table_info('purchases');")"
integrity="$(sqlite3 "$database" 'PRAGMA integrity_check;')"
foreign_key_violations="$(sqlite3 "$database" 'PRAGMA foreign_key_check;' | wc -l | tr -d ' ')"

[[ "$tables" == '29' ]] || { echo "Expected 29 tables, found $tables." >&2; exit 1; }
[[ "$triggers" == '19' ]] || { echo "Expected 19 triggers, found $triggers." >&2; exit 1; }
[[ "$purchase_columns" == '21' ]] || { echo "Expected 21 purchase columns, found $purchase_columns." >&2; exit 1; }
[[ "$integrity" == 'ok' ]] || { echo "SQLite integrity check failed: $integrity" >&2; exit 1; }
[[ "$foreign_key_violations" == '0' ]] || { echo "Foreign-key violations: $foreign_key_violations" >&2; exit 1; }

echo "D1_MIGRATION_PASS tables=$tables triggers=$triggers purchase_columns=$purchase_columns integrity=$integrity"
