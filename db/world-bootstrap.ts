import world from '../src/data/world.generated.json';
import { canonicalEvent, ENGINE_VERSION, tickIndexAt } from '../src/domain/world/world';
import { getRawD1 } from './index';

export const ACTIVE_SEASON_ID = 'season-1';
export const DEMO_BATTLE_ID = 'battle-madrid-toledo';

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const FACTION_COLORS = ['coral', 'teal', 'gold', 'navy', 'slate'];

type WorldSeed = typeof world;

export async function ensureWorld(now = Date.now()): Promise<void> {
  const d1 = getRawD1();
  const existing = await d1
    .prepare('SELECT id FROM seasons WHERE id = ?1 LIMIT 1')
    .bind(ACTIVE_SEASON_ID)
    .first<{ id: string }>();
  if (existing) return;

  const startsAt = now - 11 * DAY_MILLISECONDS;
  const endsAt = startsAt + 28 * DAY_MILLISECONDS;
  const lastResolvedTick = Math.max(-1, tickIndexAt(now, startsAt) - 1);
  const createdAt = now;
  const territories = (world as WorldSeed).territories;
  const directedEdges = (world as WorldSeed).adjacencies.flatMap((edge) => [
    edge,
    { ...edge, from: edge.to, to: edge.from },
  ]);
  const bootstrapPayload = canonicalEvent({
    seasonId: ACTIVE_SEASON_ID,
    territories: territories.length,
    routes: directedEdges.length,
    engineVersion: ENGINE_VERSION,
  });
  const bootstrapHash = await sha256(bootstrapPayload);

  const statements = [
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
      'INSERT OR IGNORE INTO seasons (id, number, name, phase, status, starts_at, ends_at, last_resolved_tick, engine_version, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)',
    ).bind(
      ACTIVE_SEASON_ID,
      1,
      'La Primera Corona',
      'regional-war',
      'active',
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
        factionId(territory.code),
        ACTIVE_SEASON_ID,
        `Casa de ${territory.name}`,
        territory.code,
        FACTION_COLORS[index % FACTION_COLORS.length],
        0,
        createdAt,
      ]),
    ),
    d1.prepare(
      'INSERT OR IGNORE INTO battles (id, season_id, origin_territory_code, target_territory_code, attacker_faction_id, defender_faction_id, status, siege_bp, tick_count, free_attack_power, paid_attack_power, started_at, engine_version) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)',
    ).bind(
      DEMO_BATTLE_ID,
      ACTIVE_SEASON_ID,
      '28',
      '45',
      factionId('28'),
      factionId('45'),
      'active',
      4_200,
      0,
      7_000,
      0,
      createdAt,
      ENGINE_VERSION,
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
        const contested = territory.code === '45';
        return [
          ACTIVE_SEASON_ID,
          territory.code,
          factionId(territory.code),
          contested ? factionId('28') : null,
          contested ? DEMO_BATTLE_ID : null,
          contested ? 3_000 : territory.code === '28' ? 7_000 : 5_000,
          0,
          1_000,
          10_000,
          contested ? 4_200 : 0,
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
        ['local-support', 'Apoyo Local', '300 unidades de apoyo común y la insignia Fundador Local.', 499, 'eur', 300, 'badge:local-founder', 1],
        ['provincial-support', 'Apoyo Provincial', '700 unidades de apoyo común y un marco de campaña.', 999, 'eur', 700, 'frame:provincial', 1],
        ['regional-standard', 'Estandarte Regional', '1.500 unidades de apoyo común y un estandarte de temporada.', 1999, 'eur', 1_500, 'banner:regional', 1],
      ],
    ),
    d1.prepare(
      'INSERT OR IGNORE INTO game_events (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id, payload_json, payload_hash, engine_version, created_at) VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7, ?8, ?9)',
    ).bind(
      'event-world-bootstrap-v1',
      ACTIVE_SEASON_ID,
      'WORLD_BOOTSTRAPPED',
      'season',
      ACTIVE_SEASON_ID,
      bootstrapPayload,
      bootstrapHash,
      ENGINE_VERSION,
      createdAt,
    ),
  ];

  await d1.batch(statements);
}

export function factionId(territoryCode: string): string {
  return `faction-${territoryCode}`;
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
    const placeholders = chunk
      .map((_, rowIndex) => {
        const start = rowIndex * columns.length;
        return `(${columns.map((__, columnIndex) => `?${start + columnIndex + 1}`).join(',')})`;
      })
      .join(',');
    const values = chunk.flat() as Array<string | number | null>;
    statements.push(
      d1
        .prepare(`INSERT OR IGNORE INTO ${table} (${columns.join(',')}) VALUES ${placeholders}`)
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
