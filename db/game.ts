import { allocateCombatLosses } from '../src/domain/combat/combat';
import {
  canonicalEvent,
  battleParticipatesInTick,
  ENGINE_VERSION,
  hasSuppliedRoute,
  resolveWorldTick,
  tickIndexAt,
  worldCombatModifiers,
  type SupplyRoute,
  type SupplyTerritory,
} from '../src/domain/world/world';
import type { WorldSnapshot } from '../src/contracts/game';
import { campaignResolutionValues, reconcileCampaignLifecycle } from './campaigns';
import { getRawD1 } from './index';
import { activeSeasonRecord, ensureWorld, factionId, seasonPhaseAt } from './world-bootstrap';

const HOUR_MILLISECONDS = 60 * 60 * 1_000;
const DAY_MILLISECONDS = 24 * HOUR_MILLISECONDS;
const MAX_TICKS_PER_REQUEST = 48;
const MAX_BATTLE_TICKS = 72;

export type IdentityUser = {
  userId: string;
  email: string;
  displayName: string;
};

export class GameCommandError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 429,
  ) {
    super(message);
  }
}

type SeasonRow = {
  id: string;
  number: number;
  name: string;
  phase: string;
  status: string;
  starts_at: number;
  ends_at: number;
  last_resolved_tick: number;
  engine_version: string;
  winner_faction_id: string | null;
  finalized_at: number | null;
};

type BattleRow = {
  id: string;
  season_id: string;
  origin_territory_code: string;
  target_territory_code: string;
  attacker_faction_id: string;
  defender_faction_id: string;
  campaign_id: string;
  siege_bp: number;
  tick_count: number;
  free_attack_power: number;
  paid_attack_power: number;
  engine_version: string;
  started_at: number;
};

type TerritoryStateRow = {
  territory_code: string;
  owner_faction_id: string;
  attacker_faction_id: string | null;
  free_garrison: number;
  paid_garrison: number;
  supply: number;
  fortification_bp: number;
  siege_bp: number;
  battle_tick_count: number;
  occupied_at: number | null;
};

export async function upsertUser(user: IdentityUser, now = Date.now()): Promise<void> {
  const d1 = getRawD1();
  await d1.batch([
    d1.prepare(
      `INSERT INTO users (id, email, display_name, locale, account_status, purchases_paused, daily_spend_limit_cents, season_spend_limit_cents, created_at, updated_at)
       VALUES (?1, ?2, ?3, 'es', 'active', 0, 5000, 15000, ?4, ?4)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, updated_at = excluded.updated_at`,
    ).bind(user.userId, user.email.toLowerCase(), user.displayName.slice(0, 120), now),
    d1.prepare(
      `INSERT OR IGNORE INTO notification_preferences
       (user_id, locale, quiet_hours_start, quiet_hours_end, max_war_alerts_per_day, council_alerts, updated_at)
       VALUES (?1, 'es', 22, 8, 1, 1, ?2)`,
    ).bind(user.userId, now),
  ]);
}

export async function joinFaction(
  user: IdentityUser,
  territoryCode: string,
  role: string,
  idempotencyKey: string,
  now = Date.now(),
): Promise<WorldSnapshot> {
  await ensureWorld(now);
  await upsertUser(user, now);
  await assertRateLimit(user.userId, 'command.join', 8, HOUR_MILLISECONDS, now);
  const d1 = getRawD1();
  const season = await activeSeason();
  const target = await d1
    .prepare('SELECT code, name FROM territories WHERE code = ?1 AND enabled = 1')
    .bind(territoryCode)
    .first<{ code: string; name: string }>();
  if (!target) throw new GameCommandError('La provincia no existe.', 404);

  const current = await d1
    .prepare(
      `SELECT membership.faction_id, membership.home_territory_code, membership.change_locked_until,
              state.active_battle_id,
              EXISTS(
                SELECT 1 FROM council_seats seat
                JOIN council_terms term ON term.id = seat.term_id
                WHERE term.season_id = membership.season_id AND seat.user_id = membership.user_id
                  AND term.status = 'active' AND term.starts_at <= ?3 AND term.ends_at > ?3
              ) AS is_council
       FROM faction_memberships membership
       LEFT JOIN territory_states state ON state.season_id = membership.season_id AND state.territory_code = membership.home_territory_code
       WHERE membership.season_id = ?1 AND membership.user_id = ?2`,
    )
    .bind(season.id, user.userId, now)
    .first<{
      faction_id: string;
      home_territory_code: string;
      change_locked_until: number | null;
      active_battle_id: string | null;
      is_council: number;
    }>();

  if (current && current.home_territory_code !== territoryCode) {
    if (current.is_council) {
      throw new GameCommandError('Un miembro del consejo no puede cambiar de facción.', 409);
    }
    if (current.active_battle_id) {
      throw new GameCommandError('No puedes abandonar una provincia en combate.', 409);
    }
    if ((current.change_locked_until ?? 0) > now) {
      throw new GameCommandError('El cambio de facción todavía está en enfriamiento.', 409);
    }
  }

  const firstWindowEnds = season.starts_at + 2 * DAY_MILLISECONDS;
  const nextChangeAt = now < firstWindowEnds ? firstWindowEnds : now + 7 * DAY_MILLISECONDS;
  const eventId = crypto.randomUUID();
  const payload = canonicalEvent({
    previousFactionId: current?.faction_id ?? null,
    factionId: factionId(season.id, territoryCode),
    territoryCode,
    role,
  });
  const payloadHash = await sha256(payload);
  const auditId = crypto.randomUUID();

  await d1.batch([
    d1.prepare(
      `INSERT INTO faction_memberships
       (season_id, user_id, faction_id, home_territory_code, role, joined_at, change_locked_until, contribution_score)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)
       ON CONFLICT(season_id, user_id) DO UPDATE SET
         faction_id = excluded.faction_id,
         home_territory_code = excluded.home_territory_code,
         role = excluded.role,
         change_locked_until = excluded.change_locked_until`,
    ).bind(season.id, user.userId, factionId(season.id, territoryCode), territoryCode, role, now, nextChangeAt),
    d1.prepare(
      `INSERT OR IGNORE INTO wallets
       (season_id, user_id, free_support, paid_support, supporter_points, updated_at)
       VALUES (?1, ?2, 300, 0, 0, ?3)`,
    ).bind(season.id, user.userId, now),
    d1.prepare(
      `INSERT OR IGNORE INTO ledger_entries
       (id, season_id, user_id, territory_code, asset_kind, amount, reason, event_id, idempotency_key, created_at)
       VALUES (?1, ?2, ?3, ?4, 'free_support', 300, 'WELCOME_GRANT', ?5, ?6, ?7)`,
    ).bind(crypto.randomUUID(), season.id, user.userId, territoryCode, eventId, `welcome-${season.id}-${user.userId}`, now),
    d1.prepare(
      `INSERT OR IGNORE INTO game_events
       (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id, payload_json, payload_hash, engine_version, created_at)
       VALUES (?1, ?2, 'PLAYER_JOINED_FACTION', ?3, 'membership', ?4, ?5, ?6, ?7, ?8)`,
    ).bind(eventId, season.id, user.userId, territoryCode, payload, payloadHash, ENGINE_VERSION, now),
    d1.prepare(
      `INSERT OR IGNORE INTO audit_events
       (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
       VALUES (?1, ?2, 'command.join', 'faction', ?3, 'allowed', ?4, ?5)`,
    ).bind(auditId, user.userId, factionId(season.id, territoryCode), canonicalEvent({ idempotencyKey }), now),
  ]);

  return getWorldSnapshot(user.userId, now);
}

export async function commitSupport(
  user: IdentityUser,
  command: { battleId: string; amount: number; assetKind: 'free_support' | 'paid_support' },
  idempotencyKey: string,
  now = Date.now(),
): Promise<WorldSnapshot> {
  await ensureWorld(now);
  await upsertUser(user, now);
  await reconcileWorld(now);
  await assertRateLimit(user.userId, 'command.support', 30, HOUR_MILLISECONDS, now);
  const d1 = getRawD1();

  const duplicate = await d1
    .prepare('SELECT id FROM battle_orders WHERE user_id = ?1 AND idempotency_key = ?2')
    .bind(user.userId, idempotencyKey)
    .first<{ id: string }>();
  if (duplicate) return getWorldSnapshot(user.userId, now);

  const battle = await d1
    .prepare(
      `SELECT battle.*, membership.faction_id AS viewer_faction_id
       FROM battles battle
       JOIN faction_memberships membership ON membership.season_id = battle.season_id AND membership.user_id = ?2
       WHERE battle.id = ?1 AND battle.status = 'active'`,
    )
    .bind(command.battleId, user.userId)
    .first<BattleRow & { viewer_faction_id: string }>();
  if (!battle) throw new GameCommandError('La batalla activa no existe.', 404);
  const supportsAttack = battle.viewer_faction_id === battle.attacker_faction_id;
  const supportsDefense = battle.viewer_faction_id === battle.defender_faction_id;
  if (!supportsAttack && !supportsDefense) {
    throw new GameCommandError('Tu facción no participa en esta batalla.', 403);
  }

  const orderId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const payload = canonicalEvent({
    battleId: battle.id,
    side: supportsAttack ? 'attacker' : 'defender',
    assetKind: command.assetKind,
    amount: command.amount,
  });
  const payloadHash = await sha256(payload);
  const powerColumn = command.assetKind === 'free_support'
    ? 'free_attack_power'
    : 'paid_attack_power';
  const garrisonColumn = command.assetKind === 'free_support'
    ? 'free_garrison'
    : 'paid_garrison';

  const statements: D1PreparedStatement[] = [
    d1.prepare(
      `INSERT INTO battle_orders (id, battle_id, user_id, asset_kind, amount, status, idempotency_key, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'committed', ?6, ?7)`,
    ).bind(orderId, battle.id, user.userId, command.assetKind, command.amount, idempotencyKey, now),
  ];
  if (supportsAttack) {
    statements.push(
      d1.prepare(`UPDATE battles SET ${powerColumn} = ${powerColumn} + ?1 WHERE id = ?2 AND status = 'active'`)
        .bind(command.amount, battle.id),
    );
  } else {
    statements.push(
      d1.prepare(
        `UPDATE territory_states SET ${garrisonColumn} = ${garrisonColumn} + ?1, version = version + 1
         WHERE season_id = ?2 AND territory_code = ?3 AND active_battle_id = ?4`,
      ).bind(command.amount, battle.season_id, battle.target_territory_code, battle.id),
    );
  }
  statements.push(
    d1.prepare(
      `INSERT INTO ledger_entries
       (id, season_id, user_id, territory_code, asset_kind, amount, reason, event_id, idempotency_key, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'SUPPORT_COMMITTED', ?7, ?8, ?9)`,
    ).bind(crypto.randomUUID(), battle.season_id, user.userId, battle.target_territory_code, command.assetKind, -command.amount, eventId, `ledger-${user.userId}-${idempotencyKey}`, now),
    d1.prepare(
      `INSERT INTO game_events
       (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id, payload_json, payload_hash, engine_version, created_at)
       VALUES (?1, ?2, 'SUPPORT_COMMITTED', ?3, 'battle', ?4, ?5, ?6, ?7, ?8)`,
    ).bind(eventId, battle.season_id, user.userId, battle.id, payload, payloadHash, ENGINE_VERSION, now),
    d1.prepare(
      'UPDATE faction_memberships SET contribution_score = contribution_score + ?1 WHERE season_id = ?2 AND user_id = ?3',
    ).bind(command.amount, battle.season_id, user.userId),
    d1.prepare(
      `INSERT INTO audit_events
       (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
       VALUES (?1, ?2, 'command.support', 'battle', ?3, 'allowed', ?4, ?5)`,
    ).bind(auditId, user.userId, battle.id, canonicalEvent({ amount: command.amount, assetKind: command.assetKind }), now),
  );

  try {
    await d1.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('insufficient')) {
      throw new GameCommandError('No tienes suficientes refuerzos.', 409);
    }
    if (message.includes('battle is not active')) {
      throw new GameCommandError('La batalla ya ha terminado.', 409);
    }
    if (message.includes('UNIQUE') || message.includes('unique')) {
      return getWorldSnapshot(user.userId, now);
    }
    throw error;
  }

  return getWorldSnapshot(user.userId, now);
}

export async function reconcileWorld(now = Date.now()): Promise<number> {
  await ensureWorld(now);
  const initialSeason = await activeSeason();
  await reconcileCampaignLifecycle(initialSeason.id, now);
  let resolved = 0;
  for (let attempt = 0; attempt < MAX_TICKS_PER_REQUEST; attempt += 1) {
    const season = await activeSeason();
    const lastPossibleTick = tickIndexAt(Math.min(now, season.ends_at), season.starts_at) - 1;
    const nextTick = season.last_resolved_tick + 1;
    if (nextTick > lastPossibleTick) break;
    const resolvedAt = season.starts_at + (nextTick + 1) * HOUR_MILLISECONDS;
    const success = await resolveOneTick(season, nextTick, resolvedAt);
    if (success) resolved += 1;
  }
  const season = await activeSeason();
  await getRawD1().prepare(
    "UPDATE seasons SET phase = ?1 WHERE id = ?2 AND status = 'active'",
  ).bind(
    seasonPhaseAt(Math.min(now, season.ends_at - 1), season.starts_at),
    season.id,
  ).run();
  await reconcileCampaignLifecycle(season.id, now);
  await finalizeSeasonIfReady(season.id, now);
  await ensureWorld(now);
  return resolved;
}

export async function getWorldSnapshot(
  viewerUserId: string | null,
  now = Date.now(),
): Promise<WorldSnapshot> {
  await ensureWorld(now);
  await reconcileWorld(now);
  const d1 = getRawD1();
  const season = await activeSeason();
  const [territoryRows, battleRows, factionRows, playerRows, eventRows, catalogRows, routeRows, factionHomeRows] = await Promise.all([
    all<{
      code: string; name: string; owner_faction_id: string; owner_faction_name: string;
      color: string; siege_bp: number; attacker_faction_id: string | null;
      free_garrison: number; paid_garrison: number; supply: number; fortification_bp: number;
      occupied_at: number | null;
    }>(d1.prepare(
      `SELECT territory.code, territory.name, state.owner_faction_id, faction.name AS owner_faction_name,
              faction.color, state.siege_bp, state.attacker_faction_id, state.free_garrison,
              state.paid_garrison, state.supply, state.fortification_bp, state.occupied_at
       FROM territory_states state
       JOIN territories territory ON territory.code = state.territory_code
       JOIN factions faction ON faction.id = state.owner_faction_id
       WHERE state.season_id = ?1 ORDER BY territory.code`,
    ).bind(season.id)),
    all<BattleRow & { origin_name: string; target_name: string; route_kind: string; cost_bp: number }>(d1.prepare(
      `SELECT battle.*, origin.name AS origin_name, target.name AS target_name,
              adjacency.route_kind, adjacency.cost_bp
       FROM battles battle
       JOIN territories origin ON origin.code = battle.origin_territory_code
       JOIN territories target ON target.code = battle.target_territory_code
       JOIN territory_adjacencies adjacency
         ON adjacency.from_code = battle.origin_territory_code
        AND adjacency.to_code = battle.target_territory_code
       WHERE battle.season_id = ?1 AND battle.status = 'active'
       ORDER BY battle.started_at`,
    ).bind(season.id)),
    all<{ faction_id: string; name: string; color: string; territories: number; score: number }>(d1.prepare(
      `SELECT faction.id AS faction_id, faction.name, faction.color, COUNT(state.territory_code) AS territories, faction.score
       FROM factions faction
       LEFT JOIN territory_states state ON state.season_id = faction.season_id AND state.owner_faction_id = faction.id
       WHERE faction.season_id = ?1
       GROUP BY faction.id ORDER BY territories DESC, faction.score DESC, faction.name LIMIT 12`,
    ).bind(season.id)),
    all<{ user_id: string; role: string; contribution_score: number; faction_name: string }>(d1.prepare(
      `SELECT membership.user_id, membership.role, membership.contribution_score, faction.name AS faction_name
       FROM faction_memberships membership
       JOIN factions faction ON faction.id = membership.faction_id
       WHERE membership.season_id = ?1
       ORDER BY membership.contribution_score DESC, membership.joined_at LIMIT 20`,
    ).bind(season.id)),
    all<{
      sequence: number; event_type: string; payload_json: string; payload_hash: string;
      created_at: number; origin_name: string | null; target_name: string | null;
      territory_name: string | null;
    }>(d1.prepare(
      `SELECT event.sequence, event.event_type, event.payload_json, event.payload_hash,
              event.created_at, origin.name AS origin_name, target.name AS target_name,
              territory.name AS territory_name
       FROM game_events event
       LEFT JOIN battles battle
         ON event.aggregate_type = 'battle' AND battle.id = event.aggregate_id
       LEFT JOIN territories origin ON origin.code = battle.origin_territory_code
       LEFT JOIN territories target ON target.code = battle.target_territory_code
       LEFT JOIN territories territory
         ON event.aggregate_type = 'territory' AND territory.code = event.aggregate_id
       WHERE event.season_id = ?1 ORDER BY event.sequence DESC LIMIT 30`,
    ).bind(season.id)),
    all<{ id: string; name: string; description: string; price_cents: number; currency: string; paid_support: number }>(d1.prepare(
      `SELECT id, name, description, price_cents, currency, paid_support
      FROM catalog_products WHERE active = 1 ORDER BY price_cents`,
    )),
    all<{ from_code: string; to_code: string }>(d1.prepare(
      'SELECT from_code, to_code FROM territory_adjacencies',
    )),
    all<{ id: string; home_territory_code: string }>(d1.prepare(
      'SELECT id, home_territory_code FROM factions WHERE season_id = ?1',
    ).bind(season.id)),
  ]);

  let viewer: WorldSnapshot['viewer'] = null;
  let viewerFactionId: string | null = null;
  let hasSupportedThisSeason = false;
  if (viewerUserId) {
    const viewerRow = await d1
      .prepare('SELECT display_name FROM users WHERE id = ?1')
      .bind(viewerUserId)
      .first<{ display_name: string }>();
    if (viewerRow) {
      const membership = await d1
        .prepare(
          `SELECT membership.faction_id, faction.name AS faction_name, membership.home_territory_code,
                  membership.role, membership.contribution_score
           FROM faction_memberships membership
           JOIN factions faction ON faction.id = membership.faction_id
           WHERE membership.season_id = ?1 AND membership.user_id = ?2`,
        )
        .bind(season.id, viewerUserId)
        .first<{
          faction_id: string; faction_name: string; home_territory_code: string;
          role: string; contribution_score: number;
        }>();
      viewerFactionId = membership?.faction_id ?? null;
      const supportRow = await d1.prepare(
        `SELECT EXISTS(
           SELECT 1 FROM battle_orders order_row
           JOIN battles battle ON battle.id = order_row.battle_id
           WHERE order_row.user_id = ?1 AND battle.season_id = ?2
         ) AS supported`,
      ).bind(viewerUserId, season.id).first<{ supported: number }>();
      hasSupportedThisSeason = Boolean(supportRow?.supported);
      const wallet = await d1
        .prepare(
          'SELECT free_support, paid_support, supporter_points FROM wallets WHERE season_id = ?1 AND user_id = ?2',
        )
        .bind(season.id, viewerUserId)
        .first<{ free_support: number; paid_support: number; supporter_points: number }>();
      const preferences = await d1
        .prepare(
          `SELECT locale, quiet_hours_start, quiet_hours_end, max_war_alerts_per_day, council_alerts
           FROM notification_preferences WHERE user_id = ?1`,
        )
        .bind(viewerUserId)
        .first<{
          locale: string; quiet_hours_start: number; quiet_hours_end: number;
          max_war_alerts_per_day: number; council_alerts: number;
        }>();
      viewer = {
        displayName: viewerRow.display_name,
        membership: membership ? {
          factionId: membership.faction_id,
          factionName: membership.faction_name,
          territoryCode: membership.home_territory_code,
          role: membership.role,
          contributionScore: membership.contribution_score,
        } : null,
        wallet: wallet ? {
          freeSupport: wallet.free_support,
          paidSupport: wallet.paid_support,
          supporterPoints: wallet.supporter_points,
        } : null,
        preferences: preferences ? {
          locale: preferences.locale,
          quietHoursStart: preferences.quiet_hours_start,
          quietHoursEnd: preferences.quiet_hours_end,
          maxWarAlertsPerDay: preferences.max_war_alerts_per_day,
          councilAlerts: Boolean(preferences.council_alerts),
        } : null,
      };
    }
  }

  const supplyTerritories: SupplyTerritory[] = territoryRows.map((row) => ({
    code: row.code,
    ownerFactionId: row.owner_faction_id,
    supply: row.supply,
  }));
  const supplyRoutes: SupplyRoute[] = routeRows.map((row) => ({
    fromCode: row.from_code,
    toCode: row.to_code,
  }));
  const factionHomes = new Map(factionHomeRows.map((row) => [row.id, row.home_territory_code]));
  const activeFronts = new Map<string, number>();
  for (const battle of battleRows) {
    activeFronts.set(
      battle.attacker_faction_id,
      (activeFronts.get(battle.attacker_faction_id) ?? 0) + 1,
    );
  }
  const battleSnapshots: WorldSnapshot['battles'] = battleRows.map((row) => {
    const targetState = territoryRows.find((territory) => territory.code === row.target_territory_code);
    const attackerHome = factionHomes.get(row.attacker_faction_id);
    const supplyConnected = Boolean(attackerHome && hasSuppliedRoute({
      factionId: row.attacker_faction_id,
      homeTerritoryCode: attackerHome,
      originTerritoryCode: row.origin_territory_code,
      territories: supplyTerritories,
      routes: supplyRoutes,
    }));
    const modifiers = worldCombatModifiers({
      supplyConnected,
      routeCostBp: row.cost_bp,
      controlledFronts: activeFronts.get(row.attacker_faction_id) ?? 1,
      defenderFortificationBp: targetState?.fortification_bp ?? 10_000,
      defenderIsHomeland: factionHomes.get(row.defender_faction_id) === row.target_territory_code,
      defenderOccupiedAt: targetState?.occupied_at ?? null,
      resolvedAt: now,
    });
    const viewerSide = viewerFactionId === row.attacker_faction_id
      ? 'attacker' as const
      : viewerFactionId === row.defender_faction_id
        ? 'defender' as const
        : null;
    const supportDisabledReason = !viewer
      ? 'sign-in-required' as const
      : !viewer.membership
        ? 'join-faction' as const
        : !viewerSide
          ? 'not-party' as const
          : null;
    return {
      id: row.id,
      campaignId: row.campaign_id,
      originTerritoryCode: row.origin_territory_code,
      targetTerritoryCode: row.target_territory_code,
      originName: row.origin_name,
      targetName: row.target_name,
      attackerFactionId: row.attacker_faction_id,
      defenderFactionId: row.defender_faction_id,
      siegeBp: row.siege_bp,
      tickCount: row.tick_count,
      freeAttackPower: row.free_attack_power,
      paidAttackPower: row.paid_attack_power,
      startedAt: row.started_at,
      engineVersion: row.engine_version,
      routeKind: row.route_kind,
      routeCostBp: row.cost_bp,
      viewerSide,
      canSupport: supportDisabledReason === null,
      supportDisabledReason,
      combatContext: {
        supplyConnected,
        attacker: modifiers.attacker,
        defender: modifiers.defender,
      },
    };
  });
  const eligibleBattleCount = battleSnapshots.filter((battle) => battle.canSupport).length;
  const previousSeason = await d1.prepare(
    `SELECT season.id, season.number, season.name, season.winner_faction_id,
            winner.name AS winner_faction_name, season.finalized_at
     FROM seasons season
     JOIN factions winner ON winner.id = season.winner_faction_id
     WHERE season.status = 'completed' AND season.number < ?1
     ORDER BY season.number DESC LIMIT 1`,
  ).bind(season.number).first<{
    id: string;
    number: number;
    name: string;
    winner_faction_id: string;
    winner_faction_name: string;
    finalized_at: number;
  }>();

  return {
    mode: 'live-world',
    serverTime: now,
    lastUpdatedAt: now,
    season: {
      id: season.id,
      number: season.number,
      name: season.name,
      phase: season.phase,
      status: season.status,
      startsAt: season.starts_at,
      endsAt: season.ends_at,
      lastResolvedTick: season.last_resolved_tick,
      engineVersion: season.engine_version,
      nextTickAt: season.starts_at + (season.last_resolved_tick + 2) * HOUR_MILLISECONDS,
    },
    previousSeason: previousSeason ? {
      id: previousSeason.id,
      number: previousSeason.number,
      name: previousSeason.name,
      winnerFactionId: previousSeason.winner_faction_id,
      winnerFactionName: previousSeason.winner_faction_name,
      finalizedAt: previousSeason.finalized_at,
    } : null,
    territories: territoryRows.map((row) => ({
      code: row.code,
      name: row.name,
      ownerFactionId: row.owner_faction_id,
      ownerFactionName: row.owner_faction_name,
      color: row.color,
      siegeBp: row.siege_bp,
      attackerFactionId: row.attacker_faction_id,
      freeGarrison: row.free_garrison,
      paidGarrison: row.paid_garrison,
      supply: row.supply,
      fortificationBp: row.fortification_bp,
      occupiedAt: row.occupied_at,
    })),
    battles: battleSnapshots,
    factionLeaderboard: factionRows.map((row) => ({
      factionId: row.faction_id,
      name: row.name,
      color: row.color,
      territories: Number(row.territories),
      score: row.score,
    })),
    playerLeaderboard: playerRows.map((row) => ({
      player: `Estratega ${row.user_id.slice(-4).toUpperCase()}`,
      role: row.role,
      contributionScore: row.contribution_score,
      factionName: row.faction_name,
    })),
    recentEvents: eventRows.map((row) => ({
      sequence: row.sequence,
      eventType: row.event_type,
      ...publicEventSummary(row),
      payloadHash: row.payload_hash,
      createdAt: row.created_at,
    })),
    catalog: catalogRows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      priceCents: row.price_cents,
      currency: row.currency,
      paidSupport: row.paid_support,
    })),
    viewer,
    onboarding: {
      nextAction: !viewer
        ? 'sign-in'
        : !viewer.membership
          ? 'join-faction'
          : hasSupportedThisSeason
            ? 'complete'
            : eligibleBattleCount > 0
              ? 'support-front'
              : 'wait-for-front',
      eligibleBattleCount,
      hasSupportedThisSeason,
    },
  };
}

async function resolveOneTick(
  season: SeasonRow,
  tickIndex: number,
  resolvedAt: number,
): Promise<boolean> {
  const d1 = getRawD1();
  const [battles, supplyRows, routeRows, factionRows] = await Promise.all([
    all<BattleRow>(
      d1.prepare("SELECT * FROM battles WHERE season_id = ?1 AND status = 'active' ORDER BY id")
        .bind(season.id),
    ),
    all<{ code: string; owner_faction_id: string; supply: number }>(d1.prepare(
      `SELECT territory_code AS code, owner_faction_id, supply
       FROM territory_states WHERE season_id = ?1`,
    ).bind(season.id)),
    all<{ from_code: string; to_code: string; cost_bp: number }>(d1.prepare(
      'SELECT from_code, to_code, cost_bp FROM territory_adjacencies',
    )),
    all<{ id: string; home_territory_code: string }>(d1.prepare(
      'SELECT id, home_territory_code FROM factions WHERE season_id = ?1',
    ).bind(season.id)),
  ]);
  const supplyTerritories: SupplyTerritory[] = supplyRows.map((row) => ({
    code: row.code,
    ownerFactionId: row.owner_faction_id,
    supply: row.supply,
  }));
  const supplyRoutes: SupplyRoute[] = routeRows.map((row) => ({
    fromCode: row.from_code,
    toCode: row.to_code,
  }));
  const factionHomes = new Map(factionRows.map((row) => [row.id, row.home_territory_code]));
  const activeFronts = new Map<string, number>();
  const eligibleBattles = battles.filter((battle) => battleParticipatesInTick({
    startedAt: battle.started_at,
    resolvedAt,
  }));
  for (const battle of eligibleBattles) {
    activeFronts.set(
      battle.attacker_faction_id,
      (activeFronts.get(battle.attacker_faction_id) ?? 0) + 1,
    );
  }
  const statements: D1PreparedStatement[] = [];

  for (const battle of eligibleBattles) {
    const territory = await d1
      .prepare(
        `SELECT territory_code, owner_faction_id, attacker_faction_id, free_garrison,
                paid_garrison, supply, fortification_bp, siege_bp, battle_tick_count, occupied_at
         FROM territory_states WHERE season_id = ?1 AND territory_code = ?2 AND active_battle_id = ?3`,
      )
      .bind(season.id, battle.target_territory_code, battle.id)
      .first<TerritoryStateRow>();
    if (!territory || !territory.attacker_faction_id) continue;

    const routeCostBp = routeRows.find(
      (route) =>
        route.from_code === battle.origin_territory_code &&
        route.to_code === battle.target_territory_code,
    )?.cost_bp ?? 20_000;
    const attackerHome = factionHomes.get(battle.attacker_faction_id);
    const supplyConnected = Boolean(attackerHome && hasSuppliedRoute({
      factionId: battle.attacker_faction_id,
      homeTerritoryCode: attackerHome,
      originTerritoryCode: battle.origin_territory_code,
      territories: supplyTerritories,
      routes: supplyRoutes,
    }));
    const modifiers = worldCombatModifiers({
      supplyConnected,
      routeCostBp,
      controlledFronts: activeFronts.get(battle.attacker_faction_id) ?? 1,
      defenderFortificationBp: territory.fortification_bp,
      defenderIsHomeland:
        factionHomes.get(battle.defender_faction_id) === battle.target_territory_code,
      defenderOccupiedAt: territory.occupied_at,
      resolvedAt,
    });

    const result = resolveWorldTick({
      tickIndex,
      resolvedAt,
      territory: {
        code: territory.territory_code,
        ownerFactionId: territory.owner_faction_id,
        attackerFactionId: territory.attacker_faction_id,
        siegeBp: territory.siege_bp,
        battleTickCount: territory.battle_tick_count,
        supplyConnected,
      },
      attacker: {
        freeUnits: BigInt(battle.free_attack_power),
        paidUnits: BigInt(battle.paid_attack_power),
        modifiers: modifiers.attacker,
      },
      defender: {
        freeUnits: BigInt(territory.free_garrison),
        paidUnits: BigInt(territory.paid_garrison),
        modifiers: modifiers.defender,
      },
    });
    const attackerPower = allocateCombatLosses({
      freeUnits: BigInt(battle.free_attack_power),
      paidUnits: BigInt(battle.paid_attack_power),
      effectivePaidUnits: result.combat.attacker.effectivePaidUnits,
      losses: result.combat.attackerLosses,
    });
    const defenderPower = allocateCombatLosses({
      freeUnits: BigInt(territory.free_garrison),
      paidUnits: BigInt(territory.paid_garrison),
      effectivePaidUnits: result.combat.defender.effectivePaidUnits,
      losses: result.combat.defenderLosses,
    });
    const attackerFree = Number(attackerPower.freeUnits);
    const attackerPaid = Number(attackerPower.paidUnits);
    const defenderFree = Number(defenderPower.freeUnits);
    const defenderPaid = Number(defenderPower.paidUnits);
    const repelled = !result.captured && (
      result.battleTickCount >= MAX_BATTLE_TICKS || attackerFree + attackerPaid === 0
    );
    const inputJson = canonicalEvent({
      battleId: battle.id,
      tickIndex,
      attacker: {
        freeUnits: String(battle.free_attack_power),
        paidUnits: String(battle.paid_attack_power),
      },
      defender: {
        freeUnits: String(territory.free_garrison),
        paidUnits: String(territory.paid_garrison),
      },
      previousSiegeBp: territory.siege_bp,
      routeCostBp,
      supplyConnected,
      modifiers,
    });
    const resultJson = canonicalEvent({
      captured: result.captured,
      siegeBp: result.siegeBp,
      siegeDeltaBp: result.combat.siegeDeltaBp,
      attackShareBp: result.combat.attackShareBp,
      attackerLosses: String(result.combat.attackerLosses),
      defenderLosses: String(result.combat.defenderLosses),
      paidShareBp: result.combat.attacker.paidShareBp,
      queuedPaidPower: String(result.combat.attacker.queuedPaidPower),
      queuedPaidUnits: String(result.combat.attacker.queuedPaidUnits),
      outcome: result.captured ? 'captured' : repelled ? 'repelled' : 'active',
    });
    const eventHash = await sha256(canonicalEvent({ battleId: battle.id, tickIndex, inputJson, resultJson }));
    const tickEventId = `event-battle-tick-${battle.id}-${tickIndex}`;

    statements.push(
      d1.prepare(
        `INSERT INTO battle_ticks
         (battle_id, tick_index, resolved_at, input_json, result_json, event_hash, engine_version)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      ).bind(battle.id, tickIndex, resolvedAt, inputJson, resultJson, eventHash, ENGINE_VERSION),
    );

    if (result.captured) {
      const resolution = campaignResolutionValues('captured', resolvedAt);
      statements.push(
        d1.prepare(
          `UPDATE battles SET status = 'captured', siege_bp = 0, tick_count = ?1,
                  free_attack_power = ?2, paid_attack_power = ?3, captured_at = ?4, ended_at = ?4
           WHERE id = ?5 AND status = 'active'`,
        ).bind(result.battleTickCount, attackerFree, attackerPaid, resolvedAt, battle.id),
        d1.prepare(
          `UPDATE territory_states SET owner_faction_id = ?1, attacker_faction_id = NULL,
                  active_battle_id = NULL, free_garrison = ?2, paid_garrison = ?3,
                  siege_bp = 0, battle_tick_count = 0, occupied_at = ?4,
                  supply = MIN(supply, 250), fortification_bp = MAX(10000, fortification_bp - 1000),
                  updated_tick = ?5, version = version + 1
           WHERE season_id = ?6 AND territory_code = ?7 AND active_battle_id = ?8`,
        ).bind(battle.attacker_faction_id, attackerFree, attackerPaid, resolvedAt, tickIndex, season.id, battle.target_territory_code, battle.id),
        d1.prepare(
          `INSERT INTO ownership_history
           (id, season_id, territory_code, previous_faction_id, next_faction_id, battle_id, captured_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
        ).bind(crypto.randomUUID(), season.id, battle.target_territory_code, battle.defender_faction_id, battle.attacker_faction_id, battle.id, resolvedAt),
        d1.prepare('UPDATE factions SET score = score + 100 WHERE id = ?1')
          .bind(battle.attacker_faction_id),
        d1.prepare(
          `UPDATE campaign_rounds SET phase = ?1, resolved_at = ?2, cooldown_ends_at = ?3,
                  outcome = ?4 WHERE id = ?5 AND phase = 'active' AND battle_id = ?6`,
        ).bind(
          resolution.phase,
          resolution.resolvedAt,
          resolution.cooldownEndsAt,
          resolution.outcome,
          battle.campaign_id,
          battle.id,
        ),
      );
      const capturePayload = canonicalEvent({
        battleId: battle.id,
        territoryCode: battle.target_territory_code,
        previousFactionId: battle.defender_faction_id,
        nextFactionId: battle.attacker_faction_id,
        tickIndex,
      });
      statements.push(
        d1.prepare(
          `INSERT INTO game_events
           (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id, payload_json, payload_hash, engine_version, created_at)
           VALUES (?1, ?2, 'TERRITORY_CAPTURED', NULL, 'territory', ?3, ?4, ?5, ?6, ?7)`,
        ).bind(`event-capture-${battle.id}`, season.id, battle.target_territory_code, capturePayload, await sha256(capturePayload), ENGINE_VERSION, resolvedAt),
      );
    } else if (repelled) {
      const resolution = campaignResolutionValues('repelled', resolvedAt);
      statements.push(
        d1.prepare(
          `UPDATE battles SET status = 'repelled', siege_bp = ?1, tick_count = ?2,
                  free_attack_power = ?3, paid_attack_power = ?4, ended_at = ?5
           WHERE id = ?6 AND status = 'active'`,
        ).bind(result.siegeBp, result.battleTickCount, attackerFree, attackerPaid, resolvedAt, battle.id),
        d1.prepare(
          `UPDATE territory_states SET attacker_faction_id = NULL, active_battle_id = NULL,
                  free_garrison = ?1, paid_garrison = ?2, siege_bp = 0,
                  battle_tick_count = 0, updated_tick = ?3, version = version + 1
           WHERE season_id = ?4 AND territory_code = ?5 AND active_battle_id = ?6`,
        ).bind(defenderFree, defenderPaid, tickIndex, season.id, battle.target_territory_code, battle.id),
        d1.prepare(
          `UPDATE territory_states SET free_garrison = free_garrison + ?1,
                  paid_garrison = paid_garrison + ?2, version = version + 1
           WHERE season_id = ?3 AND territory_code = ?4 AND owner_faction_id = ?5`,
        ).bind(attackerFree, attackerPaid, season.id, battle.origin_territory_code, battle.attacker_faction_id),
        d1.prepare(
          `UPDATE campaign_rounds SET phase = ?1, resolved_at = ?2, cooldown_ends_at = ?3,
                  outcome = ?4 WHERE id = ?5 AND phase = 'active' AND battle_id = ?6`,
        ).bind(
          resolution.phase,
          resolution.resolvedAt,
          resolution.cooldownEndsAt,
          resolution.outcome,
          battle.campaign_id,
          battle.id,
        ),
      );
      const repelledPayload = canonicalEvent({
        battleId: battle.id,
        territoryCode: battle.target_territory_code,
        tickIndex,
      });
      statements.push(
        d1.prepare(
          `INSERT INTO game_events
           (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id, payload_json, payload_hash, engine_version, created_at)
           VALUES (?1, ?2, 'BATTLE_REPELLED', NULL, 'battle', ?3, ?4, ?5, ?6, ?7)`,
        ).bind(
          `event-repelled-${battle.id}`,
          season.id,
          battle.id,
          repelledPayload,
          await sha256(repelledPayload),
          ENGINE_VERSION,
          resolvedAt,
        ),
      );
    } else {
      statements.push(
        d1.prepare(
          `UPDATE battles SET siege_bp = ?1, tick_count = ?2, free_attack_power = ?3, paid_attack_power = ?4
           WHERE id = ?5 AND status = 'active'`,
        ).bind(result.siegeBp, result.battleTickCount, attackerFree, attackerPaid, battle.id),
        d1.prepare(
          `UPDATE territory_states SET free_garrison = ?1, paid_garrison = ?2, siege_bp = ?3,
                  battle_tick_count = ?4, updated_tick = ?5, version = version + 1
           WHERE season_id = ?6 AND territory_code = ?7 AND active_battle_id = ?8`,
        ).bind(defenderFree, defenderPaid, result.siegeBp, result.battleTickCount, tickIndex, season.id, battle.target_territory_code, battle.id),
      );
    }
    statements.push(
      d1.prepare(
        `INSERT INTO game_events
         (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id, payload_json, payload_hash, engine_version, created_at)
         VALUES (?1, ?2, 'BATTLE_TICK_RESOLVED', NULL, 'battle', ?3, ?4, ?5, ?6, ?7)`,
      ).bind(tickEventId, season.id, battle.id, resultJson, eventHash, ENGINE_VERSION, resolvedAt),
    );
  }

  const worldPayload = canonicalEvent({ tickIndex, resolvedAt, battleCount: eligibleBattles.length });
  statements.push(
    d1.prepare(
      `INSERT INTO game_events
       (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id, payload_json, payload_hash, engine_version, created_at)
       VALUES (?1, ?2, 'WORLD_TICK_RESOLVED', NULL, 'season', ?3, ?4, ?5, ?6, ?7)`,
    ).bind(`event-world-tick-${season.id}-${tickIndex}`, season.id, season.id, worldPayload, await sha256(worldPayload), ENGINE_VERSION, resolvedAt),
    d1.prepare(
      'UPDATE seasons SET last_resolved_tick = ?1 WHERE id = ?2 AND last_resolved_tick = ?3',
    ).bind(tickIndex, season.id, season.last_resolved_tick),
  );

  try {
    await d1.batch(statements);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE') || message.includes('unique')) return false;
    throw error;
  }
}

async function finalizeSeasonIfReady(seasonId: string, now: number): Promise<boolean> {
  const d1 = getRawD1();
  const season = await d1.prepare(
    `SELECT id, number, name, phase, status, starts_at, ends_at, last_resolved_tick,
            engine_version, winner_faction_id, finalized_at
     FROM seasons WHERE id = ?1 AND status = 'active'`,
  ).bind(seasonId).first<SeasonRow>();
  if (!season || now < season.ends_at) return false;
  const finalTick = tickIndexAt(season.ends_at, season.starts_at) - 1;
  if (season.last_resolved_tick < finalTick) return false;

  const winner = await d1.prepare(
    `SELECT faction.id, faction.name, COUNT(state.territory_code) AS territories, faction.score
     FROM factions faction
     LEFT JOIN territory_states state
       ON state.season_id = faction.season_id AND state.owner_faction_id = faction.id
     WHERE faction.season_id = ?1
     GROUP BY faction.id
     ORDER BY territories DESC, faction.score DESC, faction.name ASC LIMIT 1`,
  ).bind(season.id).first<{
    id: string;
    name: string;
    territories: number;
    score: number;
  }>();
  if (!winner) throw new Error('An active season cannot close without a faction.');
  const payload = canonicalEvent({
    seasonId: season.id,
    seasonNumber: season.number,
    winnerFactionId: winner.id,
    winnerFactionName: winner.name,
    territories: Number(winner.territories),
    score: winner.score,
  });
  await d1.batch([
    d1.prepare(
      `UPDATE seasons SET phase = 'closed', status = 'completed', winner_faction_id = ?1,
              finalized_at = ?2 WHERE id = ?3 AND status = 'active'`,
    ).bind(winner.id, now, season.id),
    d1.prepare(
      `UPDATE council_terms SET status = 'expired'
       WHERE season_id = ?1 AND status = 'active'`,
    ).bind(season.id),
    d1.prepare(
      `UPDATE governance_rounds SET status = 'closed', locked_at = COALESCE(locked_at, ?2)
       WHERE season_id = ?1 AND status IN ('open','locked')`,
    ).bind(season.id, now),
    d1.prepare(
      `UPDATE campaign_rounds SET phase = 'resolved', resolved_at = COALESCE(resolved_at, ?2),
              outcome = COALESCE(outcome, 'season-ended')
       WHERE season_id = ?1 AND phase <> 'resolved'`,
    ).bind(season.id, now),
    d1.prepare(
      `UPDATE battles SET status = 'season-ended', ended_at = COALESCE(ended_at, ?2)
       WHERE season_id = ?1 AND status = 'active'`,
    ).bind(season.id, now),
    d1.prepare(
      `UPDATE territory_states SET attacker_faction_id = NULL, active_battle_id = NULL,
              siege_bp = 0, battle_tick_count = 0, version = version + 1
       WHERE season_id = ?1 AND active_battle_id IS NOT NULL`,
    ).bind(season.id),
    d1.prepare(
      `INSERT OR IGNORE INTO game_events
       (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id,
        payload_json, payload_hash, engine_version, created_at)
       VALUES (?1, ?2, 'SEASON_COMPLETED', NULL, 'season', ?2, ?3, ?4, ?5, ?6)`,
    ).bind(
      `event-season-completed-${season.id}`,
      season.id,
      payload,
      await sha256(payload),
      ENGINE_VERSION,
      now,
    ),
  ]);
  return true;
}

async function activeSeason(): Promise<SeasonRow> {
  return activeSeasonRecord();
}

async function assertRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMilliseconds: number,
  now: number,
): Promise<void> {
  const row = await getRawD1()
    .prepare(
      'SELECT COUNT(*) AS count FROM audit_events WHERE actor_user_id = ?1 AND action = ?2 AND created_at >= ?3',
    )
    .bind(userId, action, now - windowMilliseconds)
    .first<{ count: number }>();
  if (Number(row?.count ?? 0) >= limit) {
    throw new GameCommandError('Demasiadas órdenes. Inténtalo de nuevo más tarde.', 429);
  }
}

async function all<T>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>();
  return result.results ?? [];
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function publicEventSummary(row: {
  event_type: string;
  payload_json: string;
  origin_name: string | null;
  target_name: string | null;
  territory_name: string | null;
}): { summaryKey: string; summaryArgs: Record<string, string | number> } {
  const payload = safeJson(row.payload_json);
  const values = payload && typeof payload === 'object'
    ? payload as Record<string, unknown>
    : {};
  const routeArgs = {
    origin: row.origin_name ?? '—',
    target: row.target_name ?? row.territory_name ?? '—',
  };
  switch (row.event_type) {
    case 'WORLD_BOOTSTRAPPED':
      return { summaryKey: 'worldBootstrapped', summaryArgs: {} };
    case 'WORLD_TICK_RESOLVED':
      return {
        summaryKey: 'worldTickResolved',
        summaryArgs: { tick: publicNumber(values.tickIndex) },
      };
    case 'BATTLE_STARTED':
      return { summaryKey: 'battleStarted', summaryArgs: routeArgs };
    case 'BATTLE_TICK_RESOLVED': {
      const siegeBp = publicNumber(values.siegeBp);
      const siegeDeltaBp = publicSignedNumber(values.siegeDeltaBp);
      return {
        summaryKey: 'battleTickResolved',
        summaryArgs: {
          ...routeArgs,
          previousProgress: Math.floor(Math.max(0, siegeBp - siegeDeltaBp) / 100),
          progress: Math.floor(siegeBp / 100),
          attackerLosses: publicNumber(values.attackerLosses),
          defenderLosses: publicNumber(values.defenderLosses),
        },
      };
    }
    case 'BATTLE_REPELLED':
      return { summaryKey: 'battleRepelled', summaryArgs: routeArgs };
    case 'TERRITORY_CAPTURED':
      return {
        summaryKey: 'territoryCaptured',
        summaryArgs: { territory: row.territory_name ?? row.target_name ?? '—' },
      };
    case 'PLAYER_JOINED_FACTION':
      return {
        summaryKey: 'playerJoinedFaction',
        summaryArgs: { territory: row.territory_name ?? publicString(values.territoryCode) },
      };
    case 'SUPPORT_COMMITTED':
      return {
        summaryKey: 'supportCommitted',
        summaryArgs: { ...routeArgs, amount: publicNumber(values.amount) },
      };
    case 'CAMPAIGN_TARGET_LOCKED':
      return {
        summaryKey: 'campaignTargetLocked',
        summaryArgs: { target: publicString(values.targetTerritoryCode) },
      };
    case 'CAMPAIGN_ROUND_OPENED':
      return {
        summaryKey: 'campaignRoundOpened',
        summaryArgs: { cycle: publicNumber(values.cycleNumber) },
      };
    case 'SEASON_COMPLETED':
      return {
        summaryKey: 'seasonCompleted',
        summaryArgs: { winner: publicString(values.winnerFactionName) },
      };
    case 'COUNCIL_VOTE_CAST':
      return { summaryKey: 'councilVoteCast', summaryArgs: {} };
    case 'COUNCIL_ROSTER_RESOLVED':
      return { summaryKey: 'councilRosterResolved', summaryArgs: {} };
    case 'ROLE_ACTION_COMPLETED':
      return { summaryKey: 'roleActionCompleted', summaryArgs: {} };
    case 'ANNOUNCEMENT_PUBLISHED':
      return { summaryKey: 'announcementPublished', summaryArgs: {} };
    default:
      return { summaryKey: 'verifiedEvent', summaryArgs: {} };
  }
}

function publicNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : 0;
  }
  return 0;
}

function publicSignedNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : 0;
  }
  return 0;
}

function publicString(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 80) : '—';
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
