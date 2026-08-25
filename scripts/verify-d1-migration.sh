#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
migrations=()
while IFS= read -r migration; do
  migrations+=("$migration")
done < <(find "$repo_root/drizzle" -maxdepth 1 -type f -name '*.sql' -print | sort)
if [[ "${#migrations[@]}" -eq 0 ]]; then
  echo 'D1 migration not found.' >&2
  exit 1
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
database="$work_dir/territorios.sqlite"
for migration in "${migrations[@]}"; do
  sqlite3 "$database" < "$migration"
done
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
active_season_index="$(sqlite3 "$database" "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='seasons_single_active_unique';")"
active_season_guard="$(sqlite3 "$database" "
  BEGIN;
  INSERT INTO seasons
    (id, number, name, phase, status, starts_at, ends_at, last_resolved_tick, engine_version, created_at)
    VALUES ('guard-season-1', 9001, 'Guard 1', 'settlement', 'active', 1000, 2000, -1, 'test', 1000);
  INSERT OR IGNORE INTO seasons
    (id, number, name, phase, status, starts_at, ends_at, last_resolved_tick, engine_version, created_at)
    VALUES ('guard-season-2', 9002, 'Guard 2', 'settlement', 'active', 2000, 3000, -1, 'test', 2000);
  SELECT COUNT(*) FROM seasons WHERE status = 'active';
  ROLLBACK;
")"

upgrade_database="$work_dir/territorios-upgrade.sqlite"
sqlite3 "$upgrade_database" < "${migrations[0]}"
sqlite3 "$upgrade_database" "
  INSERT INTO seasons
    (id, number, name, phase, status, starts_at, ends_at, last_resolved_tick, engine_version, created_at)
    VALUES ('season-1', 1, 'Corona 1', 'settlement', 'active', 1000, 2419201000, -1, 'combat-2.0.0', 1000);
  INSERT INTO seasons
    (id, number, name, phase, status, starts_at, ends_at, last_resolved_tick, engine_version, created_at)
    VALUES ('season-2', 2, 'Corona 2', 'settlement', 'active', 2419201000, 4838401000, -1, 'combat-2.0.0', 2000);
"
for migration in "${migrations[@]:1}"; do
  sqlite3 "$upgrade_database" < "$migration"
done
upgrade_active_seasons="$(sqlite3 "$upgrade_database" "SELECT COUNT(*) FROM seasons WHERE status = 'active';")"
upgrade_total_seasons="$(sqlite3 "$upgrade_database" 'SELECT COUNT(*) FROM seasons;')"
upgrade_duplicate_seasons="$(sqlite3 "$upgrade_database" "SELECT COUNT(*) FROM seasons WHERE id = 'season-2';")"
upgrade_foreign_key_violations="$(sqlite3 "$upgrade_database" 'PRAGMA foreign_key_check;' | wc -l | tr -d ' ')"

protected_database="$work_dir/territorios-protected-upgrade.sqlite"
sqlite3 "$protected_database" < "${migrations[0]}"
sqlite3 "$protected_database" "
  INSERT INTO seasons
    (id, number, name, phase, status, starts_at, ends_at, last_resolved_tick, engine_version, created_at)
    VALUES ('season-1', 1, 'Corona 1', 'settlement', 'active', 1000, 2419201000, -1, 'combat-2.0.0', 1000);
  INSERT INTO seasons
    (id, number, name, phase, status, starts_at, ends_at, last_resolved_tick, engine_version, created_at)
    VALUES ('season-2', 2, 'Corona 2', 'settlement', 'active', 2419201000, 4838401000, -1, 'combat-2.0.0', 2000);
  INSERT INTO ledger_entries
    (id, season_id, user_id, territory_code, asset_kind, amount, reason, event_id, idempotency_key, created_at)
    VALUES ('protected-ledger', 'season-2', NULL, NULL, 'free-support', 1, 'test', 'protected-event', 'protected-key', 3000);
"
if sqlite3 "$protected_database" < "${migrations[1]}" >/dev/null 2>&1; then
  echo 'Upgrade silently removed or accepted an active season with durable activity.' >&2
  exit 1
fi
protected_duplicate_seasons="$(sqlite3 "$protected_database" "SELECT COUNT(*) FROM seasons WHERE id = 'season-2';")"

[[ "$tables" == '29' ]] || { echo "Expected 29 tables, found $tables." >&2; exit 1; }
[[ "$triggers" == '19' ]] || { echo "Expected 19 triggers, found $triggers." >&2; exit 1; }
[[ "$purchase_columns" == '21' ]] || { echo "Expected 21 purchase columns, found $purchase_columns." >&2; exit 1; }
[[ "$integrity" == 'ok' ]] || { echo "SQLite integrity check failed: $integrity" >&2; exit 1; }
[[ "$foreign_key_violations" == '0' ]] || { echo "Foreign-key violations: $foreign_key_violations" >&2; exit 1; }
[[ "$active_season_index" == '1' ]] || { echo "Single-active-season index missing." >&2; exit 1; }
[[ "$active_season_guard" == '1' ]] || { echo "Single-active-season guard accepted more than one active row." >&2; exit 1; }
[[ "$upgrade_active_seasons" == '1' ]] || { echo "Upgrade retained $upgrade_active_seasons active seasons." >&2; exit 1; }
[[ "$upgrade_total_seasons" == '1' ]] || { echo "Upgrade retained $upgrade_total_seasons total seasons." >&2; exit 1; }
[[ "$upgrade_duplicate_seasons" == '0' ]] || { echo 'Upgrade retained the untouched future bootstrap duplicate.' >&2; exit 1; }
[[ "$upgrade_foreign_key_violations" == '0' ]] || { echo "Upgrade foreign-key violations: $upgrade_foreign_key_violations" >&2; exit 1; }
[[ "$protected_duplicate_seasons" == '1' ]] || { echo 'Upgrade removed an active season with durable activity.' >&2; exit 1; }

echo "D1_MIGRATION_PASS tables=$tables triggers=$triggers purchase_columns=$purchase_columns active_season_guard=$active_season_guard upgrade_cleanup=pass activity_protection=pass integrity=$integrity"
