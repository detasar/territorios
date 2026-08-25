import {
  resolveBattleTick,
  type BattleTickResult,
  type CombatModifiers,
} from '../combat/combat';

export const ENGINE_VERSION = 'combat-2.0.0';
export const HOUR_MILLISECONDS = 60 * 60 * 1_000;

type TerritoryTickState = {
  code: string;
  ownerFactionId: string;
  attackerFactionId: string;
  siegeBp: number;
  battleTickCount: number;
  supplyConnected: boolean;
};

type WorldTickSide = {
  freeUnits: bigint;
  paidUnits: bigint;
  modifiers: CombatModifiers;
};

export type WorldCombatContext = {
  supplyConnected: boolean;
  routeCostBp: number;
  controlledFronts: number;
  defenderFortificationBp: number;
  defenderIsHomeland: boolean;
  defenderOccupiedAt: number | null;
  resolvedAt: number;
};

export type SupplyTerritory = {
  code: string;
  ownerFactionId: string;
  supply: number;
};

export type SupplyRoute = {
  fromCode: string;
  toCode: string;
};

export type ResolveWorldTickInput = {
  tickIndex: number;
  resolvedAt: number;
  territory: TerritoryTickState;
  attacker: WorldTickSide;
  defender: WorldTickSide;
};

export type WorldTickResult = {
  engineVersion: typeof ENGINE_VERSION;
  tickIndex: number;
  territoryCode: string;
  battleTickCount: number;
  siegeBp: number;
  captured: boolean;
  nextOwnerFactionId: string;
  combat: BattleTickResult;
};

const madridClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function tickIndexAt(timestamp: number, seasonStart: number): number {
  if (!Number.isFinite(timestamp) || !Number.isFinite(seasonStart)) {
    throw new RangeError('World timestamps must be finite.');
  }
  return Math.max(0, Math.floor((timestamp - seasonStart) / HOUR_MILLISECONDS));
}

export function battleParticipatesInTick(input: {
  startedAt: number;
  resolvedAt: number;
}): boolean {
  if (!Number.isFinite(input.startedAt) || !Number.isFinite(input.resolvedAt)) {
    throw new RangeError('Battle tick timestamps must be finite.');
  }
  return input.startedAt <= input.resolvedAt;
}

export function captureWindowAt(timestamp: number): boolean {
  const parts = madridClock.formatToParts(new Date(timestamp));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return minute === 0 && [9, 14, 19, 23].includes(hour);
}

export function resolveWorldTick(input: ResolveWorldTickInput): WorldTickResult {
  const battleTickCount = input.territory.battleTickCount + 1;
  const combat = resolveBattleTick({
    previousSiegeBp: input.territory.siegeBp,
    attacker: input.attacker,
    defender: input.defender,
  });
  const captured =
    combat.siegeBp === 10_000 &&
    battleTickCount >= 3 &&
    input.territory.supplyConnected &&
    captureWindowAt(input.resolvedAt);

  return {
    engineVersion: ENGINE_VERSION,
    tickIndex: input.tickIndex,
    territoryCode: input.territory.code,
    battleTickCount,
    siegeBp: captured ? 0 : combat.siegeBp,
    captured,
    nextOwnerFactionId: captured
      ? input.territory.attackerFactionId
      : input.territory.ownerFactionId,
    combat,
  };
}

export function occupationEfficiencyBp(hoursSinceCapture: number): number {
  if (!Number.isFinite(hoursSinceCapture) || hoursSinceCapture < 0) {
    throw new RangeError('Occupation duration must be non-negative.');
  }
  if (hoursSinceCapture < 6) return 2_000;
  if (hoursSinceCapture < 24) return 4_000;
  if (hoursSinceCapture < 48) return 6_000;
  if (hoursSinceCapture < 72) return 8_000;
  return 10_000;
}

export function overextensionEfficiencyBp(controlledFronts: number): number {
  if (!Number.isInteger(controlledFronts) || controlledFronts < 1) {
    throw new RangeError('Controlled fronts must be a positive integer.');
  }
  return Math.floor(10_000 / Math.sqrt(controlledFronts));
}

export function worldCombatModifiers(input: WorldCombatContext): {
  attacker: CombatModifiers;
  defender: CombatModifiers;
} {
  if (!Number.isInteger(input.routeCostBp) || input.routeCostBp <= 0) {
    throw new RangeError('Route cost must be a positive basis-point integer.');
  }
  if (!Number.isInteger(input.defenderFortificationBp) || input.defenderFortificationBp < 0) {
    throw new RangeError('Fortification must be a non-negative basis-point integer.');
  }
  if (!Number.isFinite(input.resolvedAt) || input.resolvedAt < 0) {
    throw new RangeError('Resolution time must be a finite non-negative timestamp.');
  }
  if (
    input.defenderOccupiedAt !== null &&
    (!Number.isFinite(input.defenderOccupiedAt) ||
      input.defenderOccupiedAt < 0 ||
      input.defenderOccupiedAt > input.resolvedAt)
  ) {
    throw new RangeError('Occupation time must not be after resolution time.');
  }

  const distanceBp = clamp(
    Math.floor((10_000 * 10_000) / input.routeCostBp),
    5_000,
    10_000,
  );
  const defenderHomelandBp = input.defenderOccupiedAt !== null
    ? occupationEfficiencyBp(
        (input.resolvedAt - input.defenderOccupiedAt) / HOUR_MILLISECONDS,
      )
    : input.defenderIsHomeland
      ? 11_000
      : 10_000;

  return {
    attacker: {
      supplyBp: input.supplyConnected ? 10_000 : 2_500,
      distanceBp,
      overextensionBp: overextensionEfficiencyBp(input.controlledFronts),
      fortificationBp: 10_000,
      homelandBp: 10_000,
    },
    defender: {
      supplyBp: 10_000,
      distanceBp: 10_000,
      overextensionBp: 10_000,
      fortificationBp: clamp(input.defenderFortificationBp, 0, 20_000),
      homelandBp: defenderHomelandBp,
    },
  };
}

export function hasSuppliedRoute(input: {
  factionId: string;
  homeTerritoryCode: string;
  originTerritoryCode: string;
  territories: SupplyTerritory[];
  routes: SupplyRoute[];
}): boolean {
  const supplied = new Set(
    input.territories
      .filter((territory) => territory.ownerFactionId === input.factionId && territory.supply > 0)
      .map((territory) => territory.code),
  );
  if (!supplied.has(input.homeTerritoryCode) || !supplied.has(input.originTerritoryCode)) {
    return false;
  }
  const neighbors = new Map<string, string[]>();
  for (const route of input.routes) {
    if (!supplied.has(route.fromCode) || !supplied.has(route.toCode)) continue;
    const from = neighbors.get(route.fromCode) ?? [];
    from.push(route.toCode);
    neighbors.set(route.fromCode, from);
    const to = neighbors.get(route.toCode) ?? [];
    to.push(route.fromCode);
    neighbors.set(route.toCode, to);
  }
  const visited = new Set([input.homeTerritoryCode]);
  const queue = [input.homeTerritoryCode];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === input.originTerritoryCode) return true;
    for (const neighbor of neighbors.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }
  return false;
}

export function canonicalEvent(value: unknown): string {
  return JSON.stringify(sortForCanonicalJson(value));
}

function sortForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortForCanonicalJson(item)]),
    );
  }
  return value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
