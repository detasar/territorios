import definitions from './database-guards.json';
import { getRawD1 } from './index';

export const DATABASE_GUARD_DEFINITIONS = Object.freeze([...definitions]);
export const DATABASE_GUARD_NAMES = Object.freeze(
  DATABASE_GUARD_DEFINITIONS.map((definition) => {
    const match = /^CREATE TRIGGER IF NOT EXISTS ([a-z0-9_]+) /.exec(definition);
    if (!match) throw new Error('Invalid database guard definition.');
    return match[1];
  }),
);

let guardsReady: Promise<void> | null = null;

export function ensureDatabaseGuards(): Promise<void> {
  guardsReady ??= installDatabaseGuards().catch((error: unknown) => {
    guardsReady = null;
    throw error;
  });
  return guardsReady;
}

async function installDatabaseGuards(): Promise<void> {
  const d1 = getRawD1();
  const existing = await triggerNames(d1);
  const missing = DATABASE_GUARD_DEFINITIONS.filter(
    (_, index) => !existing.has(DATABASE_GUARD_NAMES[index]),
  );
  if (missing.length > 0) {
    await d1.batch(missing.map((definition) => d1.prepare(definition)));
  }

  const installed = await triggerNames(d1);
  const absent = DATABASE_GUARD_NAMES.filter((name) => !installed.has(name));
  if (absent.length > 0) {
    throw new Error('Database guards were not installed completely.');
  }
}

async function triggerNames(d1: D1Database): Promise<Set<string>> {
  const result = await d1
    .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
    .all<{ name: string }>();
  return new Set(result.results.map((row) => row.name));
}
