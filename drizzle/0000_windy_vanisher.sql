CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`territory_code` text NOT NULL,
	`author_user_id` text NOT NULL,
	`message_key` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`upvotes` integer DEFAULT 0 NOT NULL,
	`downvotes` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`territory_code`) REFERENCES `territories`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`outcome` text NOT NULL,
	`metadata_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_events_id_unique` ON `audit_events` (`id`);--> statement-breakpoint
CREATE INDEX `audit_events_target_idx` ON `audit_events` (`target_type`,`target_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `battle_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`battle_id` text NOT NULL,
	`user_id` text NOT NULL,
	`asset_kind` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'committed' NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`battle_id`) REFERENCES `battles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "battle_orders_amount_positive" CHECK("battle_orders"."amount" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `battle_orders_idempotency_unique` ON `battle_orders` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `battle_orders_battle_idx` ON `battle_orders` (`battle_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `battle_ticks` (
	`battle_id` text NOT NULL,
	`tick_index` integer NOT NULL,
	`resolved_at` integer NOT NULL,
	`input_json` text NOT NULL,
	`result_json` text NOT NULL,
	`event_hash` text NOT NULL,
	`engine_version` text NOT NULL,
	PRIMARY KEY(`battle_id`, `tick_index`),
	FOREIGN KEY (`battle_id`) REFERENCES `battles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `battle_ticks_hash_unique` ON `battle_ticks` (`event_hash`);--> statement-breakpoint
CREATE TABLE `battles` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`origin_territory_code` text NOT NULL,
	`target_territory_code` text NOT NULL,
	`attacker_faction_id` text NOT NULL,
	`defender_faction_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`siege_bp` integer DEFAULT 0 NOT NULL,
	`tick_count` integer DEFAULT 0 NOT NULL,
	`free_attack_power` integer DEFAULT 0 NOT NULL,
	`paid_attack_power` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`captured_at` integer,
	`engine_version` text NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`origin_territory_code`) REFERENCES `territories`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_territory_code`) REFERENCES `territories`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`attacker_faction_id`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`defender_faction_id`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "battles_siege_range" CHECK("battles"."siege_bp" >= 0 AND "battles"."siege_bp" <= 10000)
);
--> statement-breakpoint
CREATE INDEX `battles_season_status_idx` ON `battles` (`season_id`,`status`);--> statement-breakpoint
CREATE INDEX `battles_target_idx` ON `battles` (`season_id`,`target_territory_code`);--> statement-breakpoint
CREATE TABLE `catalog_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`price_cents` integer NOT NULL,
	`currency` text DEFAULT 'eur' NOT NULL,
	`paid_support` integer DEFAULT 0 NOT NULL,
	`entitlement_kind` text,
	`active` integer DEFAULT true NOT NULL,
	CONSTRAINT "catalog_price_positive" CHECK("catalog_products"."price_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE `council_ballots` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`territory_code` text NOT NULL,
	`election_kind` text NOT NULL,
	`voter_user_id` text NOT NULL,
	`ranked_choices_json` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`cast_at` integer NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`territory_code`) REFERENCES `territories`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`voter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `council_ballot_voter_unique` ON `council_ballots` (`season_id`,`territory_code`,`election_kind`,`voter_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `council_ballot_idempotency_unique` ON `council_ballots` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `council_seats` (
	`season_id` text NOT NULL,
	`territory_code` text NOT NULL,
	`seat_kind` text NOT NULL,
	`user_id` text,
	`term_starts_at` integer NOT NULL,
	`term_ends_at` integer NOT NULL,
	PRIMARY KEY(`season_id`, `territory_code`, `seat_kind`),
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`territory_code`) REFERENCES `territories`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `council_user_idx` ON `council_seats` (`season_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purchase_id` text NOT NULL,
	`entitlement_kind` text NOT NULL,
	`entitlement_key` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`granted_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entitlements_purchase_kind_unique` ON `entitlements` (`purchase_id`,`entitlement_kind`,`entitlement_key`);--> statement-breakpoint
CREATE INDEX `entitlements_user_idx` ON `entitlements` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `faction_memberships` (
	`season_id` text NOT NULL,
	`user_id` text NOT NULL,
	`faction_id` text NOT NULL,
	`home_territory_code` text NOT NULL,
	`role` text DEFAULT 'defender' NOT NULL,
	`joined_at` integer NOT NULL,
	`change_locked_until` integer,
	`contribution_score` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`season_id`, `user_id`),
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`faction_id`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`home_territory_code`) REFERENCES `territories`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `memberships_faction_score_idx` ON `faction_memberships` (`season_id`,`faction_id`,`contribution_score`);--> statement-breakpoint
CREATE TABLE `factions` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`name` text NOT NULL,
	`home_territory_code` text NOT NULL,
	`color` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`home_territory_code`) REFERENCES `territories`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `factions_season_home_unique` ON `factions` (`season_id`,`home_territory_code`);--> statement-breakpoint
CREATE INDEX `factions_season_score_idx` ON `factions` (`season_id`,`score`);--> statement-breakpoint
CREATE TABLE `game_events` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`season_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_user_id` text,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`engine_version` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_events_id_unique` ON `game_events` (`id`);--> statement-breakpoint
CREATE INDEX `game_events_replay_idx` ON `game_events` (`season_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `game_events_aggregate_idx` ON `game_events` (`aggregate_type`,`aggregate_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`user_id` text,
	`territory_code` text,
	`asset_kind` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`territory_code`) REFERENCES `territories`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_idempotency_unique` ON `ledger_entries` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `ledger_user_asset_idx` ON `ledger_entries` (`season_id`,`user_id`,`asset_kind`,`created_at`);--> statement-breakpoint
CREATE TABLE `moderation_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`decision` text NOT NULL,
	`rule_codes_json` text NOT NULL,
	`reviewer_user_id` text,
	`appeal_status` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`locale` text DEFAULT 'es' NOT NULL,
	`quiet_hours_start` integer DEFAULT 22 NOT NULL,
	`quiet_hours_end` integer DEFAULT 8 NOT NULL,
	`max_war_alerts_per_day` integer DEFAULT 1 NOT NULL,
	`council_alerts` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe_unique` ON `notifications` (`user_id`,`dedupe_key`);--> statement-breakpoint
CREATE INDEX `notifications_inbox_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ownership_history` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`territory_code` text NOT NULL,
	`previous_faction_id` text,
	`next_faction_id` text NOT NULL,
	`battle_id` text,
	`captured_at` integer NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`territory_code`) REFERENCES `territories`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`previous_faction_id`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`next_faction_id`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`battle_id`) REFERENCES `battles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ownership_history_replay_idx` ON `ownership_history` (`season_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_event_id` text NOT NULL,
	`purchase_id` text,
	`event_type` text NOT NULL,
	`payload_hash` text NOT NULL,
	`status` text NOT NULL,
	`received_at` integer NOT NULL,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_events_provider_unique` ON `payment_events` (`provider_event_id`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`season_id` text NOT NULL,
	`territory_code` text,
	`product_id` text NOT NULL,
	`provider` text DEFAULT 'stripe' NOT NULL,
	`provider_session_id` text,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`territory_code`) REFERENCES `territories`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_idempotency_unique` ON `purchases` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_provider_session_unique` ON `purchases` (`provider_session_id`);--> statement-breakpoint
CREATE INDEX `purchases_spend_idx` ON `purchases` (`user_id`,`created_at`,`status`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`reporter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reports_review_queue_idx` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`name` text NOT NULL,
	`phase` text DEFAULT 'settlement' NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`last_resolved_tick` integer DEFAULT -1 NOT NULL,
	`engine_version` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "seasons_valid_window" CHECK("seasons"."ends_at" > "seasons"."starts_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seasons_number_unique` ON `seasons` (`number`);--> statement-breakpoint
CREATE TABLE `territories` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`national_code` text NOT NULL,
	`territory_kind` text DEFAULT 'province' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `territory_adjacencies` (
	`from_code` text NOT NULL,
	`to_code` text NOT NULL,
	`route_kind` text NOT NULL,
	`cost_bp` integer DEFAULT 10000 NOT NULL,
	PRIMARY KEY(`from_code`, `to_code`),
	FOREIGN KEY (`from_code`) REFERENCES `territories`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_code`) REFERENCES `territories`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "territory_adjacency_not_self" CHECK("territory_adjacencies"."from_code" <> "territory_adjacencies"."to_code"),
	CONSTRAINT "territory_adjacency_cost_positive" CHECK("territory_adjacencies"."cost_bp" > 0)
);
--> statement-breakpoint
CREATE TABLE `territory_states` (
	`season_id` text NOT NULL,
	`territory_code` text NOT NULL,
	`owner_faction_id` text NOT NULL,
	`attacker_faction_id` text,
	`active_battle_id` text,
	`free_garrison` integer DEFAULT 5000 NOT NULL,
	`paid_garrison` integer DEFAULT 0 NOT NULL,
	`supply` integer DEFAULT 1000 NOT NULL,
	`fortification_bp` integer DEFAULT 10000 NOT NULL,
	`siege_bp` integer DEFAULT 0 NOT NULL,
	`battle_tick_count` integer DEFAULT 0 NOT NULL,
	`occupied_at` integer,
	`updated_tick` integer DEFAULT -1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`season_id`, `territory_code`),
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`territory_code`) REFERENCES `territories`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_faction_id`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`attacker_faction_id`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "territory_states_free_garrison_nonnegative" CHECK("territory_states"."free_garrison" >= 0),
	CONSTRAINT "territory_states_paid_garrison_nonnegative" CHECK("territory_states"."paid_garrison" >= 0),
	CONSTRAINT "territory_states_siege_range" CHECK("territory_states"."siege_bp" >= 0 AND "territory_states"."siege_bp" <= 10000)
);
--> statement-breakpoint
CREATE INDEX `territory_states_owner_idx` ON `territory_states` (`season_id`,`owner_faction_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`locale` text DEFAULT 'es' NOT NULL,
	`account_status` text DEFAULT 'active' NOT NULL,
	`purchases_paused` integer DEFAULT false NOT NULL,
	`daily_spend_limit_cents` integer DEFAULT 5000 NOT NULL,
	`season_spend_limit_cents` integer DEFAULT 15000 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "users_daily_limit_nonnegative" CHECK("users"."daily_spend_limit_cents" >= 0),
	CONSTRAINT "users_season_limit_nonnegative" CHECK("users"."season_spend_limit_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `wallets` (
	`season_id` text NOT NULL,
	`user_id` text NOT NULL,
	`free_support` integer DEFAULT 300 NOT NULL,
	`paid_support` integer DEFAULT 0 NOT NULL,
	`supporter_points` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`season_id`, `user_id`),
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "wallets_free_nonnegative" CHECK("wallets"."free_support" >= 0),
	CONSTRAINT "wallets_paid_nonnegative" CHECK("wallets"."paid_support" >= 0)
);
--> statement-breakpoint
CREATE TRIGGER `game_events_no_update` BEFORE UPDATE ON `game_events`
BEGIN SELECT RAISE(ABORT, 'game_events is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `game_events_no_delete` BEFORE DELETE ON `game_events`
BEGIN SELECT RAISE(ABORT, 'game_events is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `ledger_entries_no_update` BEFORE UPDATE ON `ledger_entries`
BEGIN SELECT RAISE(ABORT, 'ledger_entries is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `ledger_entries_no_delete` BEFORE DELETE ON `ledger_entries`
BEGIN SELECT RAISE(ABORT, 'ledger_entries is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `battle_ticks_no_update` BEFORE UPDATE ON `battle_ticks`
BEGIN SELECT RAISE(ABORT, 'battle_ticks is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `battle_ticks_no_delete` BEFORE DELETE ON `battle_ticks`
BEGIN SELECT RAISE(ABORT, 'battle_ticks is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `payment_events_no_update` BEFORE UPDATE ON `payment_events`
BEGIN SELECT RAISE(ABORT, 'payment_events is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `payment_events_no_delete` BEFORE DELETE ON `payment_events`
BEGIN SELECT RAISE(ABORT, 'payment_events is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `audit_events_no_update` BEFORE UPDATE ON `audit_events`
BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `audit_events_no_delete` BEFORE DELETE ON `audit_events`
BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `ownership_history_no_update` BEFORE UPDATE ON `ownership_history`
BEGIN SELECT RAISE(ABORT, 'ownership_history is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `ownership_history_no_delete` BEFORE DELETE ON `ownership_history`
BEGIN SELECT RAISE(ABORT, 'ownership_history is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `battle_orders_balance_guard` BEFORE INSERT ON `battle_orders`
BEGIN
	SELECT CASE
		WHEN NEW.asset_kind NOT IN ('free_support', 'paid_support')
			THEN RAISE(ABORT, 'unsupported battle order asset')
		WHEN COALESCE((SELECT status FROM battles WHERE id = NEW.battle_id), '') <> 'active'
			THEN RAISE(ABORT, 'battle is not active')
		WHEN NOT EXISTS (
			SELECT 1 FROM faction_memberships AS membership
			JOIN battles AS battle ON battle.id = NEW.battle_id
			WHERE membership.user_id = NEW.user_id
			AND membership.season_id = battle.season_id
			AND membership.faction_id IN (battle.attacker_faction_id, battle.defender_faction_id)
		)
			THEN RAISE(ABORT, 'user faction is not in this battle')
		WHEN NEW.asset_kind = 'free_support' AND COALESCE((
			SELECT free_support FROM wallets
			WHERE user_id = NEW.user_id
			AND season_id = (SELECT season_id FROM battles WHERE id = NEW.battle_id)
		), -1) < NEW.amount
			THEN RAISE(ABORT, 'insufficient free support')
		WHEN NEW.asset_kind = 'paid_support' AND COALESCE((
			SELECT paid_support FROM wallets
			WHERE user_id = NEW.user_id
			AND season_id = (SELECT season_id FROM battles WHERE id = NEW.battle_id)
		), -1) < NEW.amount
			THEN RAISE(ABORT, 'insufficient paid support')
	END;
END;
--> statement-breakpoint
CREATE TRIGGER `battle_orders_debit_wallet` AFTER INSERT ON `battle_orders`
BEGIN
	UPDATE wallets
	SET free_support = free_support - CASE WHEN NEW.asset_kind = 'free_support' THEN NEW.amount ELSE 0 END,
		paid_support = paid_support - CASE WHEN NEW.asset_kind = 'paid_support' THEN NEW.amount ELSE 0 END,
		updated_at = NEW.created_at
	WHERE user_id = NEW.user_id
	AND season_id = (SELECT season_id FROM battles WHERE id = NEW.battle_id);
END;
