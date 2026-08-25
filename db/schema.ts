import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  locale: text('locale').notNull().default('es'),
  accountStatus: text('account_status').notNull().default('active'),
  purchasesPaused: integer('purchases_paused', { mode: 'boolean' }).notNull().default(false),
  dailySpendLimitCents: integer('daily_spend_limit_cents').notNull().default(5_000),
  seasonSpendLimitCents: integer('season_spend_limit_cents').notNull().default(15_000),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  uniqueIndex('users_email_unique').on(table.email),
  check('users_daily_limit_nonnegative', sql`${table.dailySpendLimitCents} >= 0`),
  check('users_season_limit_nonnegative', sql`${table.seasonSpendLimitCents} >= 0`),
]);

export const seasons = sqliteTable('seasons', {
  id: text('id').primaryKey(),
  number: integer('number').notNull(),
  name: text('name').notNull(),
  phase: text('phase').notNull().default('settlement'),
  status: text('status').notNull().default('scheduled'),
  startsAt: integer('starts_at').notNull(),
  endsAt: integer('ends_at').notNull(),
  lastResolvedTick: integer('last_resolved_tick').notNull().default(-1),
  engineVersion: text('engine_version').notNull(),
  winnerFactionId: text('winner_faction_id'),
  finalizedAt: integer('finalized_at'),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  uniqueIndex('seasons_number_unique').on(table.number),
  check('seasons_valid_window', sql`${table.endsAt} > ${table.startsAt}`),
]);

export const territories = sqliteTable('territories', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  nationalCode: text('national_code').notNull(),
  territoryKind: text('territory_kind').notNull().default('province'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
});

export const territoryAdjacencies = sqliteTable('territory_adjacencies', {
  fromCode: text('from_code').notNull().references(() => territories.code),
  toCode: text('to_code').notNull().references(() => territories.code),
  routeKind: text('route_kind').notNull(),
  costBp: integer('cost_bp').notNull().default(10_000),
}, (table) => [
  primaryKey({ columns: [table.fromCode, table.toCode] }),
  check('territory_adjacency_not_self', sql`${table.fromCode} <> ${table.toCode}`),
  check('territory_adjacency_cost_positive', sql`${table.costBp} > 0`),
]);

export const factions = sqliteTable('factions', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  name: text('name').notNull(),
  homeTerritoryCode: text('home_territory_code').notNull().references(() => territories.code),
  color: text('color').notNull(),
  score: integer('score').notNull().default(0),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  uniqueIndex('factions_season_home_unique').on(table.seasonId, table.homeTerritoryCode),
  index('factions_season_score_idx').on(table.seasonId, table.score),
]);

export const territoryStates = sqliteTable('territory_states', {
  seasonId: text('season_id').notNull().references(() => seasons.id),
  territoryCode: text('territory_code').notNull().references(() => territories.code),
  ownerFactionId: text('owner_faction_id').notNull().references(() => factions.id),
  attackerFactionId: text('attacker_faction_id').references(() => factions.id),
  activeBattleId: text('active_battle_id'),
  freeGarrison: integer('free_garrison').notNull().default(5_000),
  paidGarrison: integer('paid_garrison').notNull().default(0),
  supply: integer('supply').notNull().default(1_000),
  fortificationBp: integer('fortification_bp').notNull().default(10_000),
  siegeBp: integer('siege_bp').notNull().default(0),
  battleTickCount: integer('battle_tick_count').notNull().default(0),
  occupiedAt: integer('occupied_at'),
  updatedTick: integer('updated_tick').notNull().default(-1),
  version: integer('version').notNull().default(1),
}, (table) => [
  primaryKey({ columns: [table.seasonId, table.territoryCode] }),
  index('territory_states_owner_idx').on(table.seasonId, table.ownerFactionId),
  check('territory_states_free_garrison_nonnegative', sql`${table.freeGarrison} >= 0`),
  check('territory_states_paid_garrison_nonnegative', sql`${table.paidGarrison} >= 0`),
  check('territory_states_siege_range', sql`${table.siegeBp} >= 0 AND ${table.siegeBp} <= 10000`),
]);

export const factionMemberships = sqliteTable('faction_memberships', {
  seasonId: text('season_id').notNull().references(() => seasons.id),
  userId: text('user_id').notNull().references(() => users.id),
  factionId: text('faction_id').notNull().references(() => factions.id),
  homeTerritoryCode: text('home_territory_code').notNull().references(() => territories.code),
  role: text('role').notNull().default('defender'),
  joinedAt: integer('joined_at').notNull(),
  changeLockedUntil: integer('change_locked_until'),
  contributionScore: integer('contribution_score').notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.seasonId, table.userId] }),
  index('memberships_faction_score_idx').on(table.seasonId, table.factionId, table.contributionScore),
]);

export const wallets = sqliteTable('wallets', {
  seasonId: text('season_id').notNull().references(() => seasons.id),
  userId: text('user_id').notNull().references(() => users.id),
  freeSupport: integer('free_support').notNull().default(300),
  paidSupport: integer('paid_support').notNull().default(0),
  supporterPoints: integer('supporter_points').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.seasonId, table.userId] }),
  check('wallets_free_nonnegative', sql`${table.freeSupport} >= 0`),
  check('wallets_paid_nonnegative', sql`${table.paidSupport} >= 0`),
]);

export const battles = sqliteTable('battles', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  originTerritoryCode: text('origin_territory_code').notNull().references(() => territories.code),
  targetTerritoryCode: text('target_territory_code').notNull().references(() => territories.code),
  attackerFactionId: text('attacker_faction_id').notNull().references(() => factions.id),
  defenderFactionId: text('defender_faction_id').notNull().references(() => factions.id),
  campaignId: text('campaign_id').notNull().references(() => campaignRounds.id),
  status: text('status').notNull().default('active'),
  siegeBp: integer('siege_bp').notNull().default(0),
  tickCount: integer('tick_count').notNull().default(0),
  freeAttackPower: integer('free_attack_power').notNull().default(0),
  paidAttackPower: integer('paid_attack_power').notNull().default(0),
  startedAt: integer('started_at').notNull(),
  capturedAt: integer('captured_at'),
  endedAt: integer('ended_at'),
  engineVersion: text('engine_version').notNull(),
}, (table) => [
  index('battles_season_status_idx').on(table.seasonId, table.status),
  index('battles_target_idx').on(table.seasonId, table.targetTerritoryCode),
  uniqueIndex('battles_active_target_unique')
    .on(table.seasonId, table.targetTerritoryCode)
    .where(sql`${table.status} = 'active'`),
  uniqueIndex('battles_campaign_unique').on(table.campaignId),
  check('battles_siege_range', sql`${table.siegeBp} >= 0 AND ${table.siegeBp} <= 10000`),
]);

export const battleOrders = sqliteTable('battle_orders', {
  id: text('id').primaryKey(),
  battleId: text('battle_id').notNull().references(() => battles.id),
  userId: text('user_id').notNull().references(() => users.id),
  assetKind: text('asset_kind').notNull(),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('committed'),
  idempotencyKey: text('idempotency_key').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  uniqueIndex('battle_orders_idempotency_unique').on(table.userId, table.idempotencyKey),
  index('battle_orders_battle_idx').on(table.battleId, table.createdAt),
  check('battle_orders_amount_positive', sql`${table.amount} > 0`),
]);

export const battleTicks = sqliteTable('battle_ticks', {
  battleId: text('battle_id').notNull().references(() => battles.id),
  tickIndex: integer('tick_index').notNull(),
  resolvedAt: integer('resolved_at').notNull(),
  inputJson: text('input_json').notNull(),
  resultJson: text('result_json').notNull(),
  eventHash: text('event_hash').notNull(),
  engineVersion: text('engine_version').notNull(),
}, (table) => [
  primaryKey({ columns: [table.battleId, table.tickIndex] }),
  uniqueIndex('battle_ticks_hash_unique').on(table.eventHash),
]);

export const ownershipHistory = sqliteTable('ownership_history', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  territoryCode: text('territory_code').notNull().references(() => territories.code),
  previousFactionId: text('previous_faction_id').references(() => factions.id),
  nextFactionId: text('next_faction_id').notNull().references(() => factions.id),
  battleId: text('battle_id').references(() => battles.id),
  capturedAt: integer('captured_at').notNull(),
}, (table) => [index('ownership_history_replay_idx').on(table.seasonId, table.capturedAt)]);

export const ledgerEntries = sqliteTable('ledger_entries', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  userId: text('user_id').references(() => users.id),
  territoryCode: text('territory_code').references(() => territories.code),
  assetKind: text('asset_kind').notNull(),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(),
  eventId: text('event_id').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  uniqueIndex('ledger_idempotency_unique').on(table.idempotencyKey),
  index('ledger_user_asset_idx').on(table.seasonId, table.userId, table.assetKind, table.createdAt),
]);

export const gameEvents = sqliteTable('game_events', {
  sequence: integer('sequence').primaryKey({ autoIncrement: true }),
  id: text('id').notNull(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  eventType: text('event_type').notNull(),
  actorUserId: text('actor_user_id').references(() => users.id),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  payloadJson: text('payload_json').notNull(),
  payloadHash: text('payload_hash').notNull(),
  engineVersion: text('engine_version'),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  uniqueIndex('game_events_id_unique').on(table.id),
  index('game_events_replay_idx').on(table.seasonId, table.sequence),
  index('game_events_aggregate_idx').on(table.aggregateType, table.aggregateId, table.sequence),
]);

export const governanceRounds = sqliteTable('governance_rounds', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  territoryCode: text('territory_code').notNull().references(() => territories.code),
  roundKind: text('round_kind').notNull(),
  sequence: integer('sequence').notNull(),
  status: text('status').notNull().default('open'),
  opensAt: integer('opens_at').notNull(),
  closesAt: integer('closes_at').notNull(),
  lockedAt: integer('locked_at'),
  winnerCode: text('winner_code'),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  uniqueIndex('governance_round_sequence_unique').on(
    table.seasonId,
    table.territoryCode,
    table.roundKind,
    table.sequence,
  ),
  index('governance_round_status_idx').on(table.seasonId, table.territoryCode, table.roundKind, table.status),
  check('governance_round_window', sql`${table.closesAt} > ${table.opensAt}`),
]);

export const councilTerms = sqliteTable('council_terms', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  territoryCode: text('territory_code').notNull().references(() => territories.code),
  electionRoundId: text('election_round_id').notNull().references(() => governanceRounds.id),
  termNumber: integer('term_number').notNull(),
  status: text('status').notNull().default('active'),
  startsAt: integer('starts_at').notNull(),
  endsAt: integer('ends_at').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  uniqueIndex('council_term_sequence_unique').on(table.seasonId, table.territoryCode, table.termNumber),
  uniqueIndex('council_term_election_unique').on(table.electionRoundId),
  index('council_term_active_idx').on(table.seasonId, table.territoryCode, table.status, table.endsAt),
  check('council_term_window', sql`${table.endsAt} > ${table.startsAt}`),
]);

export const campaignRounds = sqliteTable('campaign_rounds', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  councilTerritoryCode: text('council_territory_code').notNull().references(() => territories.code),
  originTerritoryCode: text('origin_territory_code').notNull().references(() => territories.code),
  attackerFactionId: text('attacker_faction_id').notNull().references(() => factions.id),
  ballotRoundId: text('ballot_round_id').notNull().references(() => governanceRounds.id),
  cycleNumber: integer('cycle_number').notNull(),
  phase: text('phase').notNull(),
  targetTerritoryCode: text('target_territory_code').references(() => territories.code),
  battleId: text('battle_id'),
  opensAt: integer('opens_at').notNull(),
  ballotClosesAt: integer('ballot_closes_at').notNull(),
  mobilizesAt: integer('mobilizes_at'),
  resolvedAt: integer('resolved_at'),
  cooldownEndsAt: integer('cooldown_ends_at'),
  outcome: text('outcome'),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  uniqueIndex('campaign_cycle_unique').on(table.seasonId, table.attackerFactionId, table.cycleNumber),
  uniqueIndex('campaign_ballot_round_unique').on(table.ballotRoundId),
  index('campaign_phase_idx').on(table.seasonId, table.phase, table.mobilizesAt, table.cooldownEndsAt),
  index('campaign_council_idx').on(table.seasonId, table.councilTerritoryCode, table.cycleNumber),
  check('campaign_ballot_window', sql`${table.ballotClosesAt} > ${table.opensAt}`),
]);

export const councilSeats = sqliteTable('council_seats', {
  termId: text('term_id').notNull().references(() => councilTerms.id),
  seatKind: text('seat_kind').notNull(),
  userId: text('user_id').references(() => users.id),
}, (table) => [
  primaryKey({ columns: [table.termId, table.seatKind] }),
  index('council_user_idx').on(table.termId, table.userId),
]);

export const councilBallots = sqliteTable('council_ballots', {
  id: text('id').primaryKey(),
  roundId: text('round_id').notNull().references(() => governanceRounds.id),
  electionKind: text('election_kind').notNull(),
  voterUserId: text('voter_user_id').notNull().references(() => users.id),
  rankedChoicesJson: text('ranked_choices_json').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  castAt: integer('cast_at').notNull(),
}, (table) => [
  uniqueIndex('council_ballot_voter_unique').on(table.roundId, table.electionKind, table.voterUserId),
  uniqueIndex('council_ballot_idempotency_unique').on(table.idempotencyKey),
]);

export const announcements = sqliteTable('announcements', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  territoryCode: text('territory_code').notNull().references(() => territories.code),
  authorUserId: text('author_user_id').notNull().references(() => users.id),
  messageKey: text('message_key').notNull(),
  status: text('status').notNull().default('published'),
  upvotes: integer('upvotes').notNull().default(0),
  downvotes: integer('downvotes').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  reporterUserId: text('reporter_user_id').notNull().references(() => users.id),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  reason: text('reason').notNull(),
  details: text('details'),
  status: text('status').notNull().default('open'),
  createdAt: integer('created_at').notNull(),
}, (table) => [index('reports_review_queue_idx').on(table.status, table.createdAt)]);

export const moderationDecisions = sqliteTable('moderation_decisions', {
  id: text('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => reports.id),
  decision: text('decision').notNull(),
  ruleCodesJson: text('rule_codes_json').notNull(),
  reviewerUserId: text('reviewer_user_id').references(() => users.id),
  appealStatus: text('appeal_status'),
  createdAt: integer('created_at').notNull(),
});

export const notificationPreferences = sqliteTable('notification_preferences', {
  userId: text('user_id').primaryKey().references(() => users.id),
  locale: text('locale').notNull().default('es'),
  quietHoursStart: integer('quiet_hours_start').notNull().default(22),
  quietHoursEnd: integer('quiet_hours_end').notNull().default(8),
  maxWarAlertsPerDay: integer('max_war_alerts_per_day').notNull().default(1),
  councilAlerts: integer('council_alerts', { mode: 'boolean' }).notNull().default(true),
  updatedAt: integer('updated_at').notNull(),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  kind: text('kind').notNull(),
  payloadJson: text('payload_json').notNull(),
  dedupeKey: text('dedupe_key').notNull(),
  readAt: integer('read_at'),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  uniqueIndex('notifications_dedupe_unique').on(table.userId, table.dedupeKey),
  index('notifications_inbox_idx').on(table.userId, table.createdAt),
]);

export const catalogProducts = sqliteTable('catalog_products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  priceCents: integer('price_cents').notNull(),
  currency: text('currency').notNull().default('eur'),
  paidSupport: integer('paid_support').notNull().default(0),
  entitlementKind: text('entitlement_kind'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
}, (table) => [check('catalog_price_positive', sql`${table.priceCents} > 0`)]);

export const purchases = sqliteTable('purchases', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  territoryCode: text('territory_code').references(() => territories.code),
  productId: text('product_id').notNull().references(() => catalogProducts.id),
  provider: text('provider').notNull().default('stripe'),
  providerSessionId: text('provider_session_id'),
  providerPaymentIntentId: text('provider_payment_intent_id'),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull().default('pending'),
  paymentVersion: integer('payment_version').notNull().default(0),
  paidSupportGranted: integer('paid_support_granted').notNull().default(0),
  paidSupportRevoked: integer('paid_support_revoked').notNull().default(0),
  refundedCents: integer('refunded_cents').notNull().default(0),
  disputedCents: integer('disputed_cents').notNull().default(0),
  consentVersion: text('consent_version').notNull(),
  ageConfirmedAt: integer('age_confirmed_at').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  uniqueIndex('purchases_idempotency_unique').on(table.userId, table.idempotencyKey),
  uniqueIndex('purchases_provider_session_unique').on(table.providerSessionId),
  uniqueIndex('purchases_provider_payment_intent_unique').on(table.providerPaymentIntentId),
  index('purchases_spend_idx').on(table.userId, table.createdAt, table.status),
  check('purchases_amount_positive', sql`${table.amountCents} > 0`),
  check('purchases_grant_nonnegative', sql`${table.paidSupportGranted} >= 0`),
  check(
    'purchases_revocation_range',
    sql`${table.paidSupportRevoked} >= 0 AND ${table.paidSupportRevoked} <= ${table.paidSupportGranted}`,
  ),
  check(
    'purchases_refund_range',
    sql`${table.refundedCents} >= 0 AND ${table.refundedCents} <= ${table.amountCents}`,
  ),
  check(
    'purchases_dispute_range',
    sql`${table.disputedCents} >= 0 AND ${table.disputedCents} <= ${table.amountCents}`,
  ),
]);

export const paymentEvents = sqliteTable('payment_events', {
  id: text('id').primaryKey(),
  providerEventId: text('provider_event_id').notNull(),
  purchaseId: text('purchase_id').references(() => purchases.id),
  eventType: text('event_type').notNull(),
  payloadHash: text('payload_hash').notNull(),
  status: text('status').notNull(),
  receivedAt: integer('received_at').notNull(),
}, (table) => [uniqueIndex('payment_events_provider_unique').on(table.providerEventId)]);

export const entitlements = sqliteTable('entitlements', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  purchaseId: text('purchase_id').notNull().references(() => purchases.id),
  entitlementKind: text('entitlement_kind').notNull(),
  entitlementKey: text('entitlement_key').notNull(),
  status: text('status').notNull().default('active'),
  grantedAt: integer('granted_at').notNull(),
  revokedAt: integer('revoked_at'),
}, (table) => [
  uniqueIndex('entitlements_purchase_kind_unique').on(table.purchaseId, table.entitlementKind, table.entitlementKey),
  index('entitlements_user_idx').on(table.userId, table.status),
]);

export const auditEvents = sqliteTable('audit_events', {
  sequence: integer('sequence').primaryKey({ autoIncrement: true }),
  id: text('id').notNull(),
  actorUserId: text('actor_user_id').references(() => users.id),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  outcome: text('outcome').notNull(),
  metadataJson: text('metadata_json').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  uniqueIndex('audit_events_id_unique').on(table.id),
  index('audit_events_target_idx').on(table.targetType, table.targetId, table.sequence),
]);
