CREATE TABLE `_bootstrap_duplicate_seasons` (
	`id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
INSERT INTO `_bootstrap_duplicate_seasons` (`id`)
SELECT duplicate.id
FROM seasons AS duplicate
JOIN seasons AS previous
  ON previous.number = duplicate.number - 1
WHERE duplicate.status = 'active'
  AND previous.status = 'active'
  AND previous.ends_at = duplicate.starts_at
  AND duplicate.starts_at > duplicate.created_at
  AND NOT EXISTS (
    SELECT 1 FROM faction_memberships WHERE season_id = duplicate.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM wallets WHERE season_id = duplicate.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM battle_orders
    JOIN battles ON battles.id = battle_orders.battle_id
    WHERE battles.season_id = duplicate.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM battle_ticks
    JOIN battles ON battles.id = battle_ticks.battle_id
    WHERE battles.season_id = duplicate.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM council_ballots
    JOIN governance_rounds ON governance_rounds.id = council_ballots.round_id
    WHERE governance_rounds.season_id = duplicate.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM council_seats
    JOIN council_terms ON council_terms.id = council_seats.term_id
    WHERE council_terms.season_id = duplicate.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM announcements WHERE season_id = duplicate.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM ownership_history WHERE season_id = duplicate.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM ledger_entries WHERE season_id = duplicate.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM purchases WHERE season_id = duplicate.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM game_events
    WHERE season_id = duplicate.id
      AND event_type <> 'WORLD_BOOTSTRAPPED'
  );
--> statement-breakpoint
DELETE FROM payment_events
WHERE purchase_id IN (
  SELECT id FROM purchases
  WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`)
);
--> statement-breakpoint
DELETE FROM entitlements
WHERE purchase_id IN (
  SELECT id FROM purchases
  WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`)
);
--> statement-breakpoint
DELETE FROM battle_orders
WHERE battle_id IN (
  SELECT id FROM battles
  WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`)
);
--> statement-breakpoint
DELETE FROM battle_ticks
WHERE battle_id IN (
  SELECT id FROM battles
  WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`)
);
--> statement-breakpoint
DELETE FROM ownership_history
WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`);
--> statement-breakpoint
DELETE FROM council_ballots
WHERE round_id IN (
  SELECT id FROM governance_rounds
  WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`)
);
--> statement-breakpoint
DELETE FROM council_seats
WHERE term_id IN (
  SELECT id FROM council_terms
  WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`)
);
--> statement-breakpoint
DELETE FROM territory_states
WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`);
--> statement-breakpoint
DELETE FROM battles
WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`);
--> statement-breakpoint
DELETE FROM campaign_rounds
WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`);
--> statement-breakpoint
DELETE FROM council_terms
WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`);
--> statement-breakpoint
DELETE FROM governance_rounds
WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`);
--> statement-breakpoint
DELETE FROM announcements
WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`);
--> statement-breakpoint
DELETE FROM ledger_entries
WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`);
--> statement-breakpoint
DELETE FROM game_events
WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`);
--> statement-breakpoint
DELETE FROM faction_memberships
WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`);
--> statement-breakpoint
DELETE FROM wallets
WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`);
--> statement-breakpoint
DELETE FROM purchases
WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`);
--> statement-breakpoint
DELETE FROM factions
WHERE season_id IN (SELECT id FROM `_bootstrap_duplicate_seasons`);
--> statement-breakpoint
DELETE FROM seasons
WHERE id IN (SELECT id FROM `_bootstrap_duplicate_seasons`);
--> statement-breakpoint
DROP TABLE `_bootstrap_duplicate_seasons`;
--> statement-breakpoint
CREATE UNIQUE INDEX `seasons_single_active_unique` ON `seasons` (`status`) WHERE `status` = 'active';
