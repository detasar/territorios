import { canonicalEvent, ENGINE_VERSION, resolveWorldTick, tickIndexAt } from '../src/domain/world/world';
import type { WorldSnapshot } from '../src/contracts/game';
import { getRawD1 } from './index';
import { ACTIVE_SEASON_ID, ensureWorld, factionId } from './world-bootstrap';

const HOUR_MILLISECONDS = 60 * 60 * 1_000;
const DAY_MILLISECONDS = 24 * HOUR_MILLISECONDS;
const MAX_TICKS_PER_REQUEST = 48;

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
};

type BattleRow = {
  id: string;
  season_id: string;
  origin_territory_code: string;
  target_territory_code: string;
  attacker_faction_id: string;
  defender_faction_id: string;
  siege_bp: number;
  tick_count: number;
  free_attack_power: number;
  paid_attack_power: number;
  engine_version: string;
};

type TerritoryStateRow = {
  territory_code: string;
  owner_faction_id: string;
  attacker_faction_id: string | null;
  free_garrison: number;
  paid_garrison: number;
  siege_bp: number;
  battle_tick_count: number;
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
              EXISTS(SELECT 1 FROM council_seats seat WHERE seat.season_id = membership.season_id AND seat.user_id = membership.user_id AND seat.term_ends_at > ?3) AS is_council
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
    factionId: factionId(territoryCode),
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
    ).bind(season.id, user.userId, factionId(territoryCode), territoryCode, role, now, nextChangeAt),
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
    ).bind(eventId, season.id, user.userId, `${season.id}:${user.userId}`, payload, payloadHash, ENGINE_VERSION, now),
    d1.prepare(
      `INSERT OR IGNORE INTO audit_events
       (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
       VALUES (?1, ?2, 'command.join', 'faction', ?3, 'allowed', ?4, ?5)`,
    ).bind(auditId, user.userId, factionId(territoryCode), canonicalEvent({ idempotencyKey }), now),
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
  const [territoryRows, battleRows, factionRows, playerRows, eventRows, catalogRows] = await Promise.all([
    all<{
      code: string; name: string; owner_faction_id: string; owner_faction_name: string;
      color: string; siege_bp: number; attacker_faction_id: string | null;
      free_garrison: number; paid_garrison: number; supply: number; occupied_at: number | null;
    }>(d1.prepare(
      `SELECT territory.code, territory.name, state.owner_faction_id, faction.name AS owner_faction_name,
              faction.color, state.siege_bp, state.attacker_faction_id, state.free_garrison,
              state.paid_garrison, state.supply, state.occupied_at
       FROM territory_states state
       JOIN territories territory ON territory.code = state.territory_code
       JOIN factions faction ON faction.id = state.owner_faction_id
       WHERE state.season_id = ?1 ORDER BY territory.code`,
    ).bind(season.id)),
    all<BattleRow & { origin_name: string; target_name: string }>(d1.prepare(
      `SELECT battle.*, origin.name AS origin_name, target.name AS target_name
       FROM battles battle
       JOIN territories origin ON origin.code = battle.origin_territory_code
       JOIN territories target ON target.code = battle.target_territory_code
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
    all<{ sequence: number; event_type: string; aggregate_id: string; payload_json: string; payload_hash: string; created_at: number }>(d1.prepare(
      `SELECT sequence, event_type, aggregate_id, payload_json, payload_hash, created_at
       FROM game_events WHERE season_id = ?1 ORDER BY sequence DESC LIMIT 30`,
    ).bind(season.id)),
    all<{ id: string; name: string; description: string; price_cents: number; currency: string; paid_support: number }>(d1.prepare(
      `SELECT id, name, description, price_cents, currency, paid_support
       FROM catalog_products WHERE active = 1 ORDER BY price_cents`,
    )),
  ]);

  let viewer: WorldSnapshot['viewer'] = null;
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

  return {
    mode: 'live-world',
    serverTime: now,
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
    },
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
      occupiedAt: row.occupied_at,
    })),
    battles: battleRows.map((row) => ({
      id: row.id,
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
      engineVersion: row.engine_version,
    })),
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
      aggregateId: row.aggregate_id,
      payload: safeJson(row.payload_json),
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
  };
}

async function resolveOneTick(
  season: SeasonRow,
  tickIndex: number,
  resolvedAt: number,
): Promise<boolean> {
  const d1 = getRawD1();
  const battles = await all<BattleRow>(
    d1.prepare("SELECT * FROM battles WHERE season_id = ?1 AND status = 'active' ORDER BY id")
      .bind(season.id),
  );
  const statements: D1PreparedStatement[] = [];

  for (const battle of battles) {
    const territory = await d1
      .prepare(
        `SELECT territory_code, owner_faction_id, attacker_faction_id, free_garrison,
                paid_garrison, siege_bp, battle_tick_count
         FROM territory_states WHERE season_id = ?1 AND territory_code = ?2 AND active_battle_id = ?3`,
      )
      .bind(season.id, battle.target_territory_code, battle.id)
      .first<TerritoryStateRow>();
    if (!territory || !territory.attacker_faction_id) continue;

    const result = resolveWorldTick({
      tickIndex,
      resolvedAt,
      territory: {
        code: territory.territory_code,
        ownerFactionId: territory.owner_faction_id,
        attackerFactionId: territory.attacker_faction_id,
        siegeBp: territory.siege_bp,
        battleTickCount: territory.battle_tick_count,
        supplyConnected: true,
      },
      attacker: {
        freeUnits: BigInt(battle.free_attack_power),
        paidUnits: BigInt(battle.paid_attack_power),
      },
      defender: {
        freeUnits: BigInt(territory.free_garrison),
        paidUnits: BigInt(territory.paid_garrison),
      },
    });
    const attackerPower = allocateLosses(
      battle.free_attack_power,
      battle.paid_attack_power,
      Number(result.combat.attackerLosses),
    );
    const defenderPower = allocateLosses(
      territory.free_garrison,
      territory.paid_garrison,
      Number(result.combat.defenderLosses),
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
      statements.push(
        d1.prepare(
          `UPDATE battles SET status = 'captured', siege_bp = 0, tick_count = ?1,
                  free_attack_power = ?2, paid_attack_power = ?3, captured_at = ?4
           WHERE id = ?5 AND status = 'active'`,
        ).bind(result.battleTickCount, attackerPower.free, attackerPower.paid, resolvedAt, battle.id),
        d1.prepare(
          `UPDATE territory_states SET owner_faction_id = ?1, attacker_faction_id = NULL,
                  active_battle_id = NULL, free_garrison = ?2, paid_garrison = ?3,
                  siege_bp = 0, battle_tick_count = 0, occupied_at = ?4,
                  updated_tick = ?5, version = version + 1
           WHERE season_id = ?6 AND territory_code = ?7 AND active_battle_id = ?8`,
        ).bind(battle.attacker_faction_id, attackerPower.free, attackerPower.paid, resolvedAt, tickIndex, season.id, battle.target_territory_code, battle.id),
        d1.prepare(
          `INSERT INTO ownership_history
           (id, season_id, territory_code, previous_faction_id, next_faction_id, battle_id, captured_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
        ).bind(crypto.randomUUID(), season.id, battle.target_territory_code, battle.defender_faction_id, battle.attacker_faction_id, battle.id, resolvedAt),
        d1.prepare('UPDATE factions SET score = score + 100 WHERE id = ?1')
          .bind(battle.attacker_faction_id),
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
    } else {
      statements.push(
        d1.prepare(
          `UPDATE battles SET siege_bp = ?1, tick_count = ?2, free_attack_power = ?3, paid_attack_power = ?4
           WHERE id = ?5 AND status = 'active'`,
        ).bind(result.siegeBp, result.battleTickCount, attackerPower.free, attackerPower.paid, battle.id),
        d1.prepare(
          `UPDATE territory_states SET free_garrison = ?1, paid_garrison = ?2, siege_bp = ?3,
                  battle_tick_count = ?4, updated_tick = ?5, version = version + 1
           WHERE season_id = ?6 AND territory_code = ?7 AND active_battle_id = ?8`,
        ).bind(defenderPower.free, defenderPower.paid, result.siegeBp, result.battleTickCount, tickIndex, season.id, battle.target_territory_code, battle.id),
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

  const worldPayload = canonicalEvent({ tickIndex, resolvedAt, battleCount: battles.length });
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

async function activeSeason(): Promise<SeasonRow> {
  const season = await getRawD1()
    .prepare(
      `SELECT id, number, name, phase, status, starts_at, ends_at, last_resolved_tick, engine_version
       FROM seasons WHERE id = ?1`,
    )
    .bind(ACTIVE_SEASON_ID)
    .first<SeasonRow>();
  if (!season) throw new Error('Active season bootstrap failed.');
  return season;
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

function allocateLosses(free: number, paid: number, losses: number): { free: number; paid: number } {
  const total = free + paid;
  if (total <= 0 || losses <= 0) return { free, paid };
  const boundedLosses = Math.min(total, losses);
  const freeLosses = Math.min(free, Math.floor((boundedLosses * free) / total));
  const paidLosses = Math.min(paid, boundedLosses - freeLosses);
  const remainder = boundedLosses - freeLosses - paidLosses;
  return {
    free: Math.max(0, free - freeLosses - Math.min(remainder, free - freeLosses)),
    paid: Math.max(0, paid - paidLosses),
  };
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

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
