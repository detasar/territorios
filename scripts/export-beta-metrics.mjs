#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const databasePath = process.argv[2] ? resolve(process.argv[2]) : '';
const outputDirectory = process.argv[3] ? resolve(process.argv[3]) : '';
if (!databasePath || !outputDirectory) {
  process.stderr.write('Usage: npm run beta:metrics -- <d1-sqlite-file> <output-directory>\n');
  process.exit(2);
}
if (!statSync(databasePath).isFile()) throw new Error('The D1 SQLite path must be a file.');

const sql = `
WITH participants AS (
  SELECT actor_user_id, MIN(created_at) AS consented_at
  FROM audit_events
  WHERE action = 'beta.consent' AND outcome = 'accepted'
  GROUP BY actor_user_id
), denominator AS (
  SELECT COUNT(*) AS total FROM participants
)
SELECT 'participants_consented' AS metric, COUNT(*) AS value, (SELECT total FROM denominator) AS denominator FROM participants
UNION ALL
SELECT 'activation_joined', COUNT(*), (SELECT total FROM denominator) FROM participants p
 WHERE EXISTS (SELECT 1 FROM audit_events a WHERE a.actor_user_id = p.actor_user_id AND a.action = 'command.join' AND a.outcome = 'allowed')
UNION ALL
SELECT 'first_free_action', COUNT(*), (SELECT total FROM denominator) FROM participants p
 WHERE EXISTS (SELECT 1 FROM audit_events a WHERE a.actor_user_id = p.actor_user_id AND a.action IN ('command.support','community.role-action') AND a.outcome IN ('allowed','accepted'))
UNION ALL
SELECT 'front_eligible_now', COUNT(DISTINCT p.actor_user_id), (SELECT total FROM denominator)
 FROM participants p JOIN faction_memberships m ON m.user_id = p.actor_user_id
 JOIN battles b ON b.season_id = m.season_id AND b.status = 'active'
   AND m.faction_id IN (b.attacker_faction_id, b.defender_faction_id)
UNION ALL
SELECT 'representative_vote', COUNT(*), (SELECT total FROM denominator) FROM participants p
 WHERE EXISTS (SELECT 1 FROM audit_events a WHERE a.actor_user_id = p.actor_user_id AND a.action = 'community.ballot' AND json_extract(a.metadata_json, '$.electionKind') = 'representative')
UNION ALL
SELECT 'target_vote', COUNT(*), (SELECT total FROM denominator) FROM participants p
 WHERE EXISTS (SELECT 1 FROM audit_events a WHERE a.actor_user_id = p.actor_user_id AND a.action = 'community.ballot' AND json_extract(a.metadata_json, '$.electionKind') = 'target')
UNION ALL
SELECT 'role_action', COUNT(*), (SELECT total FROM denominator) FROM participants p
 WHERE EXISTS (SELECT 1 FROM audit_events a WHERE a.actor_user_id = p.actor_user_id AND a.action = 'community.role-action' AND a.outcome = 'accepted')
UNION ALL
SELECT 'share_opened', COUNT(*), (SELECT total FROM denominator) FROM participants p
 WHERE EXISTS (SELECT 1 FROM audit_events a WHERE a.actor_user_id = p.actor_user_id AND a.action = 'beta.metric' AND json_extract(a.metadata_json, '$.event') = 'share-opened')
UNION ALL
SELECT 'd1_retained', COUNT(*), (SELECT total FROM denominator) FROM participants p
 WHERE EXISTS (SELECT 1 FROM audit_events a WHERE a.actor_user_id = p.actor_user_id AND a.created_at >= p.consented_at + 86400000)
UNION ALL
SELECT 'd7_retained', COUNT(*), (SELECT total FROM denominator) FROM participants p
 WHERE EXISTS (SELECT 1 FROM audit_events a WHERE a.actor_user_id = p.actor_user_id AND a.created_at >= p.consented_at + 604800000)
UNION ALL
SELECT 'client_error_users', COUNT(*), (SELECT total FROM denominator) FROM participants p
 WHERE EXISTS (SELECT 1 FROM audit_events a WHERE a.actor_user_id = p.actor_user_id AND a.action = 'beta.metric' AND json_extract(a.metadata_json, '$.event') = 'client-error')
UNION ALL
SELECT 'report_submitters', COUNT(*), (SELECT total FROM denominator) FROM participants p
 WHERE EXISTS (SELECT 1 FROM audit_events a WHERE a.actor_user_id = p.actor_user_id AND a.action = 'community.report')
UNION ALL
SELECT 'battle_participants', COUNT(*), (SELECT total FROM denominator) FROM participants p
 WHERE EXISTS (SELECT 1 FROM battle_orders o WHERE o.user_id = p.actor_user_id);
`;

const raw = execFileSync('sqlite3', ['-json', databasePath, sql], { encoding: 'utf8' }).trim();
const rows = raw ? JSON.parse(raw) : [];
const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
let releaseSha = 'unknown';
try {
  releaseSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {
  // Export remains usable from an isolated backup without a Git checkout.
}

const labels = {
  participants_consented: 'Consented participants',
  activation_joined: 'Activated (joined faction)',
  first_free_action: 'First free action',
  front_eligible_now: 'Eligible for an active front',
  representative_vote: 'Representative vote',
  target_vote: 'Target vote',
  role_action: 'Daily role action',
  share_opened: 'Share opened',
  d1_retained: 'D1 retained',
  d7_retained: 'D7 retained',
  client_error_users: 'Users with client error',
  report_submitters: 'Report submitters',
  battle_participants: 'Battle participants',
};

const presented = rows.map((row) => ({
  metric: row.metric,
  label: labels[row.metric] ?? row.metric,
  value: suppressSmallCell(Number(row.value)),
  denominator: suppressSmallCell(Number(row.denominator)),
}));

mkdirSync(outputDirectory, { recursive: true });
const markdown = [
  '# Territorios closed-beta aggregate metrics',
  '',
  `- Release: v${packageJson.version}`,
  `- SHA: ${releaseSha}`,
  `- Generated: ${new Date().toISOString()}`,
  '- Privacy: no email, display name, platform user ID, participant ID, IP, or free text is exported; non-zero cells below 3 are suppressed.',
  '',
  '| Metric | Value | Consented denominator |',
  '| --- | ---: | ---: |',
  ...presented.map((row) => `| ${row.label} | ${row.value} | ${row.denominator} |`),
  '',
].join('\n');
const csv = [
  'metric,value,consented_denominator',
  ...presented.map((row) => `${row.metric},${row.value},${row.denominator}`),
  '',
].join('\n');
writeFileSync(resolve(outputDirectory, 'beta-metrics.md'), markdown, { mode: 0o600 });
writeFileSync(resolve(outputDirectory, 'beta-metrics.csv'), csv, { mode: 0o600 });
process.stdout.write(`BETA_METRICS_EXPORT_PASS metrics=${presented.length} pii_fields=0 output=${outputDirectory}\n`);

function suppressSmallCell(value) {
  if (!Number.isInteger(value) || value < 0) return 'NOT_AVAILABLE';
  return value > 0 && value < 3 ? 'SUPPRESSED' : String(value);
}
