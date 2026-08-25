import {
  CAMPAIGN_COOLDOWN_MILLISECONDS,
  advanceCampaign,
  type BattleOutcome,
  type CampaignState,
} from '../src/domain/governance/campaign';
import {
  canonicalEvent,
  ENGINE_VERSION,
  hasSuppliedRoute,
  type SupplyRoute,
  type SupplyTerritory,
} from '../src/domain/world/world';
import { getRawD1 } from './index';
import { campaignId, governanceRoundId } from './world-bootstrap';

const HOUR_MILLISECONDS = 60 * 60 * 1_000;
const TARGET_BALLOT_MILLISECONDS = 6 * HOUR_MILLISECONDS;

export type CampaignRow = {
  id: string;
  season_id: string;
  ballot_round_id: string;
  cycle_number: number;
  phase: 'planning' | 'mobilizing' | 'active' | 'cooldown' | 'resolved';
  council_territory_code: string;
  origin_territory_code: string;
  target_territory_code: string | null;
  attacker_faction_id: string;
  battle_id: string | null;
  opens_at: number;
  ballot_closes_at: number;
  mobilizes_at: number | null;
  resolved_at: number | null;
  cooldown_ends_at: number | null;
  outcome: string | null;
};

export type ValidCampaignTarget = {
  code: string;
  name: string;
  routeKind: string;
  costBp: number;
};

type SupplyNetwork = {
  territories: SupplyTerritory[];
  routes: SupplyRoute[];
};

export async function reconcileCampaignLifecycle(seasonId: string, now: number): Promise<void> {
  const d1 = getRawD1();
  const latest = await all<CampaignRow>(d1.prepare(
    `SELECT campaign.* FROM campaign_rounds campaign
     JOIN (
       SELECT council_territory_code, MAX(cycle_number) AS cycle_number
       FROM campaign_rounds WHERE season_id = ?1 GROUP BY council_territory_code
     ) latest
       ON latest.council_territory_code = campaign.council_territory_code
      AND latest.cycle_number = campaign.cycle_number
     WHERE campaign.season_id = ?1 ORDER BY campaign.council_territory_code`,
  ).bind(seasonId));

  for (const campaign of latest) {
    if (campaign.phase === 'planning' && campaign.ballot_closes_at <= now) {
      await d1.batch([
        d1.prepare(
          `UPDATE campaign_rounds SET phase = 'resolved', resolved_at = ?1, outcome = 'no-target'
           WHERE id = ?2 AND phase = 'planning'`,
        ).bind(now, campaign.id),
        d1.prepare(
          `UPDATE governance_rounds SET status = 'closed', locked_at = COALESCE(locked_at, ?1)
           WHERE id = ?2 AND status = 'open'`,
        ).bind(now, campaign.ballot_round_id),
      ]);
      await openNextCampaign({ ...campaign, phase: 'resolved', resolved_at: now, outcome: 'no-target' }, now);
      continue;
    }
    if (
      campaign.phase === 'cooldown' &&
      campaign.cooldown_ends_at !== null &&
      campaign.cooldown_ends_at <= now
    ) {
      await d1.prepare(
        "UPDATE campaign_rounds SET phase = 'resolved' WHERE id = ?1 AND phase = 'cooldown'",
      ).bind(campaign.id).run();
      await openNextCampaign({ ...campaign, phase: 'resolved' }, now);
      continue;
    }
    if (campaign.phase === 'resolved') {
      await openNextCampaign(campaign, now);
    }
  }

  const ready = await all<CampaignRow>(d1.prepare(
    `SELECT * FROM campaign_rounds
     WHERE season_id = ?1 AND phase = 'mobilizing' AND mobilizes_at <= ?2
     ORDER BY mobilizes_at, id`,
  ).bind(seasonId, now));
  for (const campaign of ready) await startCampaignBattle(campaign, now);
}

export async function listValidCampaignTargets(
  seasonId: string,
  originTerritoryCode: string,
  attackerFactionId: string,
): Promise<ValidCampaignTarget[]> {
  const d1 = getRawD1();
  if (!(await campaignOriginIsSupplied(seasonId, originTerritoryCode, attackerFactionId))) {
    return [];
  }
  const rows = await all<{
    code: string;
    name: string;
    route_kind: string;
    cost_bp: number;
  }>(d1.prepare(
    `SELECT adjacency.to_code AS code, territory.name, adjacency.route_kind, adjacency.cost_bp
     FROM territory_adjacencies adjacency
     JOIN territories territory ON territory.code = adjacency.to_code
     JOIN territory_states target
       ON target.season_id = ?1 AND target.territory_code = adjacency.to_code
     JOIN territory_states origin
       ON origin.season_id = ?1 AND origin.territory_code = adjacency.from_code
     WHERE adjacency.from_code = ?2
       AND origin.owner_faction_id = ?3
       AND target.owner_faction_id <> ?3
       AND target.active_battle_id IS NULL
     ORDER BY territory.name`,
  ).bind(seasonId, originTerritoryCode, attackerFactionId));
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    routeKind: row.route_kind,
    costBp: row.cost_bp,
  }));
}

export function campaignState(row: CampaignRow): CampaignState {
  return {
    id: row.id,
    seasonId: row.season_id,
    councilTerritoryCode: row.council_territory_code,
    originTerritoryCode: row.origin_territory_code,
    attackerFactionId: row.attacker_faction_id,
    cycleNumber: row.cycle_number,
    phase: row.phase === 'resolved' ? 'cooldown' : row.phase,
    opensAt: row.opens_at,
    ballotClosesAt: row.ballot_closes_at,
    targetTerritoryCode: row.target_territory_code,
    mobilizesAt: row.mobilizes_at,
    battleId: row.battle_id,
    resolvedAt: row.resolved_at,
    cooldownEndsAt: row.cooldown_ends_at,
    outcome: row.outcome === 'captured' || row.outcome === 'repelled' ? row.outcome : null,
  };
}

export function campaignResolutionValues(outcome: BattleOutcome, now: number): {
  phase: 'cooldown';
  resolvedAt: number;
  cooldownEndsAt: number;
  outcome: BattleOutcome;
} {
  return {
    phase: 'cooldown',
    resolvedAt: now,
    cooldownEndsAt: now + CAMPAIGN_COOLDOWN_MILLISECONDS,
    outcome,
  };
}

async function startCampaignBattle(campaign: CampaignRow, now: number): Promise<void> {
  if (!campaign.target_territory_code || campaign.mobilizes_at === null) return;
  const d1 = getRawD1();
  const targets = await listValidCampaignTargets(
    campaign.season_id,
    campaign.origin_territory_code,
    campaign.attacker_faction_id,
  );
  const target = targets.find((candidate) => candidate.code === campaign.target_territory_code);
  const [origin, targetState] = await Promise.all([
    d1.prepare(
      `SELECT free_garrison, paid_garrison, supply FROM territory_states
       WHERE season_id = ?1 AND territory_code = ?2 AND owner_faction_id = ?3`,
    ).bind(
      campaign.season_id,
      campaign.origin_territory_code,
      campaign.attacker_faction_id,
    ).first<{ free_garrison: number; paid_garrison: number; supply: number }>(),
    d1.prepare(
      `SELECT owner_faction_id FROM territory_states
       WHERE season_id = ?1 AND territory_code = ?2 AND active_battle_id IS NULL`,
    ).bind(campaign.season_id, campaign.target_territory_code)
      .first<{ owner_faction_id: string }>(),
  ]);
  const freeAttackPower = Math.floor(Number(origin?.free_garrison ?? 0) / 2);
  const paidAttackPower = Math.floor(Number(origin?.paid_garrison ?? 0) / 2);
  if (!target || !origin || !targetState || freeAttackPower + paidAttackPower <= 0) {
    await invalidateCampaign(campaign, now);
    return;
  }

  const transition = advanceCampaign(campaignState(campaign), { now });
  const effect = transition.effects.find((item) => item.type === 'create-battle');
  if (!effect || transition.campaign.phase !== 'active') return;
  const payload = canonicalEvent({
    battleId: effect.battleId,
    campaignId: campaign.id,
    originTerritoryCode: campaign.origin_territory_code,
    targetTerritoryCode: campaign.target_territory_code,
  });
  const statements = [
    d1.prepare(
      `INSERT INTO battles
       (id, season_id, origin_territory_code, target_territory_code, attacker_faction_id,
        defender_faction_id, campaign_id, status, siege_bp, tick_count, free_attack_power,
        paid_attack_power, started_at, captured_at, ended_at, engine_version)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'active', 0, 0, ?8, ?9, ?10, NULL, NULL, ?11)`,
    ).bind(
      effect.battleId,
      campaign.season_id,
      campaign.origin_territory_code,
      campaign.target_territory_code,
      campaign.attacker_faction_id,
      targetState.owner_faction_id,
      campaign.id,
      freeAttackPower,
      paidAttackPower,
      effect.startedAt,
      ENGINE_VERSION,
    ),
    d1.prepare(
      `UPDATE territory_states SET free_garrison = free_garrison - ?1,
              paid_garrison = paid_garrison - ?2, supply = MAX(0, supply - 100),
              version = version + 1
       WHERE season_id = ?3 AND territory_code = ?4 AND owner_faction_id = ?5
         AND free_garrison >= ?1 AND paid_garrison >= ?2`,
    ).bind(
      freeAttackPower,
      paidAttackPower,
      campaign.season_id,
      campaign.origin_territory_code,
      campaign.attacker_faction_id,
    ),
    d1.prepare(
      `UPDATE territory_states SET attacker_faction_id = ?1, active_battle_id = ?2,
              siege_bp = 0, battle_tick_count = 0, version = version + 1
       WHERE season_id = ?3 AND territory_code = ?4 AND active_battle_id IS NULL
         AND owner_faction_id = ?5`,
    ).bind(
      campaign.attacker_faction_id,
      effect.battleId,
      campaign.season_id,
      campaign.target_territory_code,
      targetState.owner_faction_id,
    ),
    d1.prepare(
      `UPDATE campaign_rounds SET phase = 'active', battle_id = ?1
       WHERE id = ?2 AND phase = 'mobilizing'`,
    ).bind(effect.battleId, campaign.id),
    d1.prepare(
      `INSERT OR IGNORE INTO game_events
       (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id,
        payload_json, payload_hash, engine_version, created_at)
       VALUES (?1, ?2, 'BATTLE_STARTED', NULL, 'battle', ?3, ?4, ?5, ?6, ?7)`,
    ).bind(
      `event-battle-started-${effect.battleId}`,
      campaign.season_id,
      effect.battleId,
      payload,
      await sha256(payload),
      ENGINE_VERSION,
      effect.startedAt,
    ),
  ];
  try {
    await d1.batch(statements);
  } catch (error) {
    const existing = await d1.prepare(
      'SELECT id FROM battles WHERE id = ?1 AND campaign_id = ?2',
    ).bind(effect.battleId, campaign.id).first<{ id: string }>();
    if (existing) return;
    throw error;
  }
}

async function invalidateCampaign(campaign: CampaignRow, now: number): Promise<void> {
  const d1 = getRawD1();
  const values = campaignResolutionValues('repelled', now);
  const payload = canonicalEvent({
    campaignId: campaign.id,
    outcome: 'repelled',
    reason: 'invalid-origin-target-or-garrison',
  });
  await d1.batch([
    d1.prepare(
      `UPDATE campaign_rounds SET phase = ?1, resolved_at = ?2, cooldown_ends_at = ?3,
              outcome = ?4 WHERE id = ?5 AND phase = 'mobilizing'`,
    ).bind(values.phase, values.resolvedAt, values.cooldownEndsAt, values.outcome, campaign.id),
    d1.prepare(
      `INSERT OR IGNORE INTO game_events
       (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id,
        payload_json, payload_hash, engine_version, created_at)
       VALUES (?1, ?2, 'CAMPAIGN_INVALIDATED', NULL, 'campaign', ?3, ?4, ?5, ?6, ?7)`,
    ).bind(
      `event-campaign-invalidated-${campaign.id}`,
      campaign.season_id,
      campaign.id,
      payload,
      await sha256(payload),
      ENGINE_VERSION,
      now,
    ),
  ]);
}

async function openNextCampaign(previous: CampaignRow, now: number): Promise<void> {
  const d1 = getRawD1();
  const season = await d1.prepare(
    "SELECT ends_at FROM seasons WHERE id = ?1 AND status = 'active'",
  ).bind(previous.season_id).first<{ ends_at: number }>();
  if (!season || season.ends_at <= now) return;
  const cycleNumber = previous.cycle_number + 1;
  const id = campaignId(previous.season_id, previous.council_territory_code, cycleNumber);
  const roundId = governanceRoundId(
    previous.season_id,
    previous.council_territory_code,
    'target',
    cycleNumber,
  );
  const originTerritoryCode = await nextControlledOrigin(previous);
  const closesAt = Math.min(season.ends_at, now + TARGET_BALLOT_MILLISECONDS);
  if (closesAt <= now) return;
  const payload = canonicalEvent({
    campaignId: id,
    cycleNumber,
    originTerritoryCode,
    previousCampaignId: previous.id,
  });
  await d1.batch([
    d1.prepare(
      `INSERT OR IGNORE INTO governance_rounds
       (id, season_id, territory_code, round_kind, sequence, status, opens_at, closes_at,
        locked_at, winner_code, created_at)
       VALUES (?1, ?2, ?3, 'target', ?4, 'open', ?5, ?6, NULL, NULL, ?5)`,
    ).bind(roundId, previous.season_id, previous.council_territory_code, cycleNumber, now, closesAt),
    d1.prepare(
      `INSERT OR IGNORE INTO campaign_rounds
       (id, season_id, council_territory_code, origin_territory_code, attacker_faction_id,
        ballot_round_id, cycle_number, phase, target_territory_code, battle_id, opens_at,
        ballot_closes_at, mobilizes_at, resolved_at, cooldown_ends_at, outcome, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'planning', NULL, NULL, ?8, ?9,
               NULL, NULL, NULL, NULL, ?8)`,
    ).bind(
      id,
      previous.season_id,
      previous.council_territory_code,
      originTerritoryCode,
      previous.attacker_faction_id,
      roundId,
      cycleNumber,
      now,
      closesAt,
    ),
    d1.prepare(
      `INSERT OR IGNORE INTO game_events
       (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id,
        payload_json, payload_hash, engine_version, created_at)
       VALUES (?1, ?2, 'CAMPAIGN_ROUND_OPENED', NULL, 'campaign', ?3, ?4, ?5, ?6, ?7)`,
    ).bind(
      `event-campaign-opened-${id}`,
      previous.season_id,
      id,
      payload,
      await sha256(payload),
      ENGINE_VERSION,
      now,
    ),
  ]);
}

async function nextControlledOrigin(previous: CampaignRow): Promise<string> {
  const preferred = previous.outcome === 'captured' && previous.target_territory_code
    ? previous.target_territory_code
    : previous.origin_territory_code;
  if (await campaignOriginIsSupplied(previous.season_id, preferred, previous.attacker_faction_id)) {
    return preferred;
  }
  const faction = await getRawD1().prepare(
    'SELECT home_territory_code FROM factions WHERE id = ?1 AND season_id = ?2',
  ).bind(previous.attacker_faction_id, previous.season_id)
    .first<{ home_territory_code: string }>();
  return faction?.home_territory_code ?? previous.council_territory_code;
}

async function campaignOriginIsSupplied(
  seasonId: string,
  originTerritoryCode: string,
  attackerFactionId: string,
): Promise<boolean> {
  const d1 = getRawD1();
  const [faction, network] = await Promise.all([
    d1.prepare(
      'SELECT home_territory_code FROM factions WHERE id = ?1 AND season_id = ?2',
    ).bind(attackerFactionId, seasonId).first<{ home_territory_code: string }>(),
    loadSupplyNetwork(seasonId),
  ]);
  if (!faction) return false;
  return hasSuppliedRoute({
    factionId: attackerFactionId,
    homeTerritoryCode: faction.home_territory_code,
    originTerritoryCode,
    territories: network.territories,
    routes: network.routes,
  });
}

async function loadSupplyNetwork(seasonId: string): Promise<SupplyNetwork> {
  const d1 = getRawD1();
  const [territories, routes] = await Promise.all([
    all<{ code: string; owner_faction_id: string; supply: number }>(d1.prepare(
      `SELECT territory_code AS code, owner_faction_id, supply
       FROM territory_states WHERE season_id = ?1`,
    ).bind(seasonId)),
    all<{ from_code: string; to_code: string }>(d1.prepare(
      'SELECT from_code, to_code FROM territory_adjacencies',
    )),
  ]);
  return {
    territories: territories.map((row) => ({
      code: row.code,
      ownerFactionId: row.owner_faction_id,
      supply: row.supply,
    })),
    routes: routes.map((row) => ({ fromCode: row.from_code, toCode: row.to_code })),
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
