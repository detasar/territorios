import { describe, expect, it } from 'vitest';
import {
  DATABASE_GUARD_DEFINITIONS,
  DATABASE_GUARD_NAMES,
} from './database-guards';

describe('database guard manifest', () => {
  it('contains 19 uniquely named, idempotent single trigger statements', () => {
    expect(DATABASE_GUARD_DEFINITIONS).toHaveLength(19);
    expect(new Set(DATABASE_GUARD_NAMES).size).toBe(19);
    for (const definition of DATABASE_GUARD_DEFINITIONS) {
      expect(definition).toMatch(/^CREATE TRIGGER IF NOT EXISTS [a-z0-9_]+ /);
      expect(definition).toMatch(/; END$/);
    }
  });
});
