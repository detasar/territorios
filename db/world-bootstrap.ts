import world from '../src/data/world.generated.json';
import { canonicalEvent, ENGINE_VERSION, tickIndexAt } from '../src/domain/world/world';
import { ensureDatabaseGuards } from './database-guards';
import { getRawD1 } from './index';

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const COUNCIL_TERM_MILLISECONDS = 7 * DAY_MILLISECONDS;
const TARGET_BALLOT_MILLISECONDS = 6 * 60 * 60 * 1_000;
const INITIAL_FRONT_COUNT = 8;
const FACTION_COLORS = ['coral', 'teal', 'gold', 'navy', 'slate'];

type WorldSeed = typeof world;

export type ActiveSeasonRecord = {
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

export async function ensureWorld(now = Date.now()): Promise<void> {
  await ensureDatabaseGuards();
  const active = await findActiveSeason();
  if (active) return;

  const latest = await getRawD1()
    .prepare('SELECT number, ends_at FROM seasons ORDER BY number DESC LIMIT 1')
    .first<{ number: number; ends_at: number }>();
  const number = (latest?.number ?? 0) + 1;
  const startsAt = latest ? Math.max(now, latest.ends_at) : now - 11 * DAY_MILLISECONDS;
  await createSeason(number, startsAt, now);
}

export async function activeSeasonRecord(): Promise<ActiveSeasonRecord> {
  const season = await findActiveSeason();
  if (!season) throw new Error('No active season exists.');
  return season;
}

export function factionId(seasonId: string, territoryCode: string): string {
  return `faction-${seasonId}-${territoryCode}`;
}

export function seasonIdFor(number: number): string {
  return `season-${number}`;
}

export function councilTermId(seasonId: string, territoryCode: string, termNumber: number): string {
  return `council-term-${seasonId}-${territoryCode}-${termNumber}`;
}

export function governanceRoundId(
  seasonId: string,
  territoryCode: string,
  kind: 'representative' | 'target',
  sequence: number,
): string {
  return `governance-${seasonId}-${territoryCode}-${kind}-${sequence}`;
}

export function campaignId(seasonId: string, councilTerritoryCode: string, cycleNumber: number): string {
  return `campaign-${seasonId}-${councilTerritoryCode}-${cycleNumber}`;
}

async function createSeason(number: number, startsAt: number, createdAt: number): Promise<void> {
  const d1 = getRawD1();
  const seasonId = seasonIdFor(number);
  const endsAt = startsAt + 28 * DAY_MILLISECONDS;
  const lastResolvedTick = Math.max(-1, tickIndexAt(createdAt, startsAt) - 1);
  const territories = (world as WorldSeed).territories;
  const directedEdges = (world as WorldSeed).adjacencies.flatMap((edge) => [
    edge,
    { ...edge, from: edge.to, to: edge.from },
  ]);
  const fronts = initialFronts((world as WorldSeed).adjacencies);
  const frontByAttacker = new Map(fronts.map((front) => [front.from, front]));
  const frontByTarget = new Map(fronts.map((front) => [front.to, front]));
  const bootstrapPayload = canonicalEvent({
    seasonId,
    territories: territories.length,
    routes: directedEdges.length,
    initialFronts: fronts.length,
    engineVersion: ENGINE_VERSION,
  });
  const bootstrapHash = await sha256(bootstrapPayload);

  const representativeRounds = territories.map((territory) => [
    governanceRoundId(seasonId, territory.code, 'representative', 1),
    seasonId,
    territory.code,
    'representative',
    1,
    'open',
    createdAt,
    Math.min(endsAt, createdAt + COUNCIL_TERM_MILLISECONDS),
    null,
    null,
    createdAt,
  ]);
  const targetRounds = territories.map((territory) => {
    const front = frontByAttacker.get(territory.code);
    return [
      governanceRoundId(seasonId, territory.code, 'target', 1),
      seasonId,
      territory.code,
      'target',
      1,
      front ? 'locked' : 'open',
      createdAt,
      Math.min(endsAt, createdAt + TARGET_BALLOT_MILLISECONDS),
      front ? createdAt : null,
      front?.to ?? null,
      createdAt,
    ];
  });
  const statements: D1PreparedStatement[] = [
    ...bindInsert(
      d1,
      'territories',
      ['code', 'name', 'national_code', 'territory_kind', 'enabled'],
      territories.map((territory) => [
        territory.code,
        territory.name,
        territory.nationalCode,
        territory.code === '51' || territory.code === '52' ? 'autonomous_city' : 'province',
        1,
      ]),
    ),
    ...bindInsert(
      d1,
      'territory_adjacencies',
      ['from_code', 'to_code', 'route_kind', 'cost_bp'],
      directedEdges.map((edge) => [edge.from, edge.to, edge.routeKind, edge.costBp]),
    ),
    d1.prepare(
      `INSERT INTO seasons
       (id, number, name, phase, status, starts_at, ends_at, last_resolved_tick, engine_version,
        winner_faction_id, finalized_at, created_at)
       VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?6, ?7, ?8, NULL, NULL, ?9)`,
    ).bind(
      seasonId,
      number,
      `Corona ${number}`,
      seasonPhaseAt(createdAt, startsAt),
      startsAt,
      endsAt,
      lastResolvedTick,
      ENGINE_VERSION,
      createdAt,
    ),
    ...bindInsert(
      d1,
      'factions',
      ['id', 'season_id', 'name', 'home_territory_code', 'color', 'score', 'created_at'],
      territories.map((territory, index) => [
        factionId(seasonId, territory.code),
        seasonId,
        `Casa de ${territory.name}`,
        territory.code,
        FACTION_COLORS[index % FACTION_COLORS.length],
        0,
        createdAt,
      ]),
    ),
    ...bindInsert(
      d1,
      'governance_rounds',
      ['id', 'season_id', 'territory_code', 'round_kind', 'sequence', 'status', 'opens_at', 'closes_at', 'locked_at', 'winner_code', 'created_at'],
      [...representativeRounds, ...targetRounds],
    ),
    ...bindInsert(
      d1,
      'council_terms',
      ['id', 'season_id', 'territory_code', 'election_round_id', 'term_number', 'status', 'starts_at', 'ends_at', 'created_at'],
      territories.map((territory) => [
        councilTermId(seasonId, territory.code, 1),
        seasonId,
        territory.code,
        governanceRoundId(seasonId, territory.code, 'representative', 1),
        1,
        'active',
        createdAt,
        Math.min(endsAt, createdAt + COUNCIL_TERM_MILLISECONDS),
        createdAt,
      ]),
    ),
    ...bindInsert(
      d1,
      'campaign_rounds',
      [
        'id', 'season_id', 'council_territory_code', 'origin_territory_code',
        'attacker_faction_id', 'ballot_round_id', 'cycle_number', 'phase',
        'target_territory_code', 'battle_id', 'opens_at', 'ballot_closes_at',
        'mobilizes_at', 'resolved_at', 'cooldown_ends_at', 'outcome', 'created_at',
      ],
      territories.map((territory) => {
        const front = frontByAttacker.get(territory.code);
        const id = campaignId(seasonId, territory.code, 1);
        return [
          id,
          seasonId,
          territory.code,
          territory.code,
          factionId(seasonId, territory.code),
          governanceRoundId(seasonId, territory.code, 'target', 1),
          1,
          front ? 'active' : 'planning',
          front?.to ?? null,
          front ? `battle-${id}` : null,
          createdAt,
          Math.min(endsAt, createdAt + TARGET_BALLOT_MILLISECONDS),
          front ? createdAt : null,
          null,
          null,
          null,
          createdAt,
        ];
      }),
    ),
    ...bindInsert(
      d1,
      'battles',
      [
        'id', 'season_id', 'origin_territory_code', 'target_territory_code',
        'attacker_faction_id', 'defender_faction_id', 'campaign_id', 'status',
        'siege_bp', 'tick_count', 'free_attack_power', 'paid_attack_power',
        'started_at', 'captured_at', 'ended_at', 'engine_version',
      ],
      fronts.map((front) => {
        const id = campaignId(seasonId, front.from, 1);
        return [
          `battle-${id}`,
          seasonId,
          front.from,
          front.to,
          factionId(seasonId, front.from),
          factionId(seasonId, front.to),
          id,
          'active',
          front.from === '28' && front.to === '45' ? 4_200 : 0,
          0,
          3_500,
          0,
          createdAt,
          null,
          null,
          ENGINE_VERSION,
        ];
      }),
    ),
    ...bindInsert(
      d1,
      'territory_states',
      [
        'season_id', 'territory_code', 'owner_faction_id', 'attacker_faction_id',
        'active_battle_id', 'free_garrison', 'paid_garrison', 'supply',
        'fortification_bp', 'siege_bp', 'battle_tick_count', 'occupied_at',
        'updated_tick', 'version',
      ],
      territories.map((territory) => {
        const incoming = frontByTarget.get(territory.code);
        const outgoing = frontByAttacker.get(territory.code);
        const incomingCampaign = incoming ? campaignId(seasonId, incoming.from, 1) : null;
        return [
          seasonId,
          territory.code,
          factionId(seasonId, territory.code),
          incoming ? factionId(seasonId, incoming.from) : null,
          incomingCampaign ? `battle-${incomingCampaign}` : null,
          incoming ? 3_000 : outgoing ? 1_500 : 5_000,
          0,
          1_000,
          10_000,
          incoming?.from === '28' && incoming.to === '45' ? 4_200 : 0,
          0,
          null,
          lastResolvedTick,
          1,
        ];
      }),
    ),
    ...bindInsert(
      d1,
      'catalog_products',
      ['id', 'name', 'description', 'price_cents', 'currency', 'paid_support', 'entitlement_kind', 'active'],
      [
        ['local-support', 'product.localSupport.name', 'product.localSupport.description', 499, 'eur', 300, 'badge:local-founder', 1],
        ['provincial-support', 'product.provincialSupport.name', 'product.provincialSupport.description', 999, 'eur', 700, 'frame:provincial', 1],
        ['regional-standard', 'product.regionalStandard.name', 'product.regionalStandard.description', 1999, 'eur', 1_500, 'banner:regional', 1],
      ],
    ),
    d1.prepare(
      `INSERT INTO game_events
       (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id,
        payload_json, payload_hash, engine_version, created_at)
       VALUES (?1, ?2, 'WORLD_BOOTSTRAPPED', NULL, 'season', ?2, ?3, ?4, ?5, ?6)`,
    ).bind(`event-world-bootstrap-${seasonId}`, seasonId, bootstrapPayload, bootstrapHash, ENGINE_VERSION, createdAt),
  ];

  await d1.batch(statements);
}

function initialFronts(edges: WorldSeed['adjacencies']): WorldSeed['adjacencies'] {
  const madridToledo = edges.find((edge) =>
    (edge.from === '28' && edge.to === '45') || (edge.from === '45' && edge.to === '28'));
  const ordered = madridToledo
    ? [{ ...madridToledo, from: '28', to: '45' }, ...edges.filter((edge) => edge !== madridToledo)]
    : [...edges];
  const used = new Set<string>();
  const fronts: WorldSeed['adjacencies'] = [];
  for (const edge of ordered) {
    if (used.has(edge.from) || used.has(edge.to)) continue;
    fronts.push(edge);
    used.add(edge.from);
    used.add(edge.to);
    if (fronts.length === INITIAL_FRONT_COUNT) break;
  }
  return fronts;
}

export function seasonPhaseAt(now: number, startsAt: number): string {
  const day = Math.floor((now - startsAt) / DAY_MILLISECONDS);
  if (day < 2) return 'settlement';
  if (day < 7) return 'local-expansion';
  if (day < 21) return 'regional-war';
  return 'crown-week';
}

async function findActiveSeason(): Promise<ActiveSeasonRecord | null> {
  return getRawD1()
    .prepare(
      `SELECT id, number, name, phase, status, starts_at, ends_at, last_resolved_tick,
              engine_version, winner_faction_id, finalized_at
       FROM seasons WHERE status = 'active' ORDER BY number DESC LIMIT 1`,
    )
    .first<ActiveSeasonRecord>();
}

function bindInsert(
  d1: D1Database,
  table: string,
  columns: string[],
  rows: unknown[][],
): D1PreparedStatement[] {
  const rowsPerStatement = Math.max(1, Math.floor(100 / columns.length));
  const statements: D1PreparedStatement[] = [];
  for (let offset = 0; offset < rows.length; offset += rowsPerStatement) {
    const chunk = rows.slice(offset, offset + rowsPerStatement);
    if (chunk.length === 0) continue;
    const placeholders = chunk
      .map((_, rowIndex) => {
        const start = rowIndex * columns.length;
        return `(${columns.map((__, columnIndex) => `?${start + columnIndex + 1}`).join(',')})`;
      })
      .join(',');
    const values = chunk.flat() as Array<string | number | null>;
    statements.push(
      d1.prepare(`INSERT OR IGNORE INTO ${table} (${columns.join(',')}) VALUES ${placeholders}`)
        .bind(...values),
    );
  }
  return statements;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
