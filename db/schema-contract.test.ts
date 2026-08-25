import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'drizzle/0000_melodic_captain_flint.sql'),
  'utf8',
);
const activeSeasonMigration = readFileSync(
  resolve(process.cwd(), 'drizzle/0001_single_active_season.sql'),
  'utf8',
);
const campaignRuntime = readFileSync(resolve(process.cwd(), 'db/campaigns.ts'), 'utf8');

describe('governance and conquest schema contract', () => {
  it('stores durable governance rounds, council terms, and campaign rounds', () => {
    expect(migration).toContain('CREATE TABLE `governance_rounds`');
    expect(migration).toContain('CREATE TABLE `council_terms`');
    expect(migration).toContain('CREATE TABLE `campaign_rounds`');
    expect(migration).toContain('`council_territory_code` text NOT NULL');
    expect(migration).toContain('`cycle_number` integer NOT NULL');
    expect(migration).toContain('`phase` text NOT NULL');
  });

  it('scopes every ballot to a durable round instead of an entire season', () => {
    expect(migration).toContain('`round_id` text NOT NULL');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX `council_ballot_voter_unique` ON `council_ballots` (`round_id`,`election_kind`,`voter_user_id`)',
    );
    expect(migration).not.toContain(
      '(`season_id`,`territory_code`,`election_kind`,`voter_user_id`)',
    );
  });

  it('binds seats to a term so expired rosters cannot masquerade as active', () => {
    expect(migration).toContain('CREATE TABLE `council_seats`');
    expect(migration).toContain('`term_id` text NOT NULL');
    expect(migration).toContain('PRIMARY KEY(`term_id`, `seat_kind`)');
  });

  it('allows only one active battle per target territory', () => {
    expect(migration).toContain(
      "CREATE UNIQUE INDEX `battles_active_target_unique` ON `battles` (`season_id`,`target_territory_code`) WHERE `status` = 'active'",
    );
  });

  it('allows only one active season and only removes untouched bootstrap duplicates', () => {
    expect(activeSeasonMigration).toContain(
      "CREATE UNIQUE INDEX `seasons_single_active_unique` ON `seasons` (`status`) WHERE `status` = 'active'",
    );
    expect(activeSeasonMigration).toContain('duplicate.starts_at > duplicate.created_at');
    expect(activeSeasonMigration).toContain('faction_memberships');
    expect(activeSeasonMigration).toContain('battle_orders');
    expect(activeSeasonMigration).toContain('council_ballots');
    expect(activeSeasonMigration).toContain('purchases');
  });

  it('fails a racing battle insert atomically instead of double-debiting the origin', () => {
    expect(campaignRuntime).toContain('`INSERT INTO battles');
    expect(campaignRuntime).not.toContain('`INSERT OR IGNORE INTO battles');
    expect(campaignRuntime.indexOf('`INSERT INTO battles')).toBeLessThan(
      campaignRuntime.indexOf('`UPDATE territory_states SET free_garrison = free_garrison - ?1'),
    );
  });
});
