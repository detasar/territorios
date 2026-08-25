import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('closed-beta aggregate metrics export', () => {
  it('writes Markdown and CSV without identities and suppresses small cells', () => {
    const directory = mkdtempSync(join(tmpdir(), 'territorios-metrics-'));
    const database = join(directory, 'beta.sqlite');
    const output = join(directory, 'report');
    execFileSync('sqlite3', [database, fixtureSql()]);

    execFileSync(process.execPath, ['scripts/export-beta-metrics.mjs', database, output], {
      cwd: process.cwd(),
    });

    const markdown = readFileSync(join(output, 'beta-metrics.md'), 'utf8');
    const csv = readFileSync(join(output, 'beta-metrics.csv'), 'utf8');
    expect(markdown).toContain('| Consented participants | 3 | 3 |');
    expect(markdown).toContain('| Share opened | SUPPRESSED | 3 |');
    expect(csv).toContain('share_opened,SUPPRESSED,3');
    expect(`${markdown}\n${csv}`).not.toMatch(/user-1|one@example|P-00000001/);
  });
});

function fixtureSql() {
  return `
    CREATE TABLE audit_events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE faction_memberships (season_id TEXT, user_id TEXT, faction_id TEXT);
    CREATE TABLE battles (id TEXT, season_id TEXT, attacker_faction_id TEXT, defender_faction_id TEXT, status TEXT);
    CREATE TABLE battle_orders (id TEXT, user_id TEXT);
    INSERT INTO battles VALUES ('b1','s1','f1','f2','active');
    INSERT INTO faction_memberships VALUES ('s1','user-1','f1'),('s1','user-2','f1'),('s1','user-3','f2');
    INSERT INTO battle_orders VALUES ('o1','user-1'),('o2','user-2'),('o3','user-3');
    INSERT INTO audit_events (id,actor_user_id,action,target_type,target_id,outcome,metadata_json,created_at) VALUES
      ('c1','user-1','beta.consent','participant','P-00000001','accepted','{"consentVersion":"closed-beta-2026-08-25-v1"}',0),
      ('c2','user-2','beta.consent','participant','P-00000002','accepted','{"consentVersion":"closed-beta-2026-08-25-v1"}',0),
      ('c3','user-3','beta.consent','participant','P-00000003','accepted','{"consentVersion":"closed-beta-2026-08-25-v1"}',0),
      ('j1','user-1','command.join','faction','f1','allowed','{}',100),
      ('j2','user-2','command.join','faction','f1','allowed','{}',100),
      ('j3','user-3','command.join','faction','f2','allowed','{}',100),
      ('a1','user-1','command.support','battle','b1','allowed','{}',200),
      ('a2','user-2','command.support','battle','b1','allowed','{}',200),
      ('a3','user-3','command.support','battle','b1','allowed','{}',200),
      ('r1','user-1','community.report','announcement','x','queued','{}',300),
      ('s1','user-1','beta.metric','participant','P-00000001','recorded','{"event":"share-opened"}',400),
      ('d1','user-1','beta.metric','participant','P-00000001','recorded','{"event":"beta-notice-viewed"}',86400001),
      ('d2','user-2','beta.metric','participant','P-00000002','recorded','{"event":"beta-notice-viewed"}',86400001),
      ('d3','user-3','beta.metric','participant','P-00000003','recorded','{"event":"beta-notice-viewed"}',86400001);
  `;
}
