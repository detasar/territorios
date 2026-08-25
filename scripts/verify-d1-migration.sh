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

tables="$(sqlite3 "$database" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")"
triggers="$(sqlite3 "$database" "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger';")"
purchase_columns="$(sqlite3 "$database" "SELECT COUNT(*) FROM pragma_table_info('purchases');")"
integrity="$(sqlite3 "$database" 'PRAGMA integrity_check;')"
foreign_key_violations="$(sqlite3 "$database" 'PRAGMA foreign_key_check;' | wc -l | tr -d ' ')"

[[ "$tables" == '26' ]]
[[ "$triggers" == '18' ]]
[[ "$purchase_columns" == '21' ]]
[[ "$integrity" == 'ok' ]]
[[ "$foreign_key_violations" == '0' ]]

echo "D1_MIGRATION_PASS tables=$tables triggers=$triggers purchase_columns=$purchase_columns integrity=$integrity"
