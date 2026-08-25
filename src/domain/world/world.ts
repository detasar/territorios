import {
  resolveBattleTick,
  type BattleTickResult,
  type CombatSideInput,
} from '../combat/combat';

export const ENGINE_VERSION = 'combat-1.0.0';
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
    attacker: worldSide(input.attacker),
    defender: worldSide(input.defender),
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

export function canonicalEvent(value: unknown): string {
  return JSON.stringify(sortForCanonicalJson(value));
}

function worldSide(side: WorldTickSide): CombatSideInput {
  return {
    freeUnits: side.freeUnits,
    paidUnits: side.paidUnits,
    modifiers: {
      supplyBp: 10_000,
      distanceBp: 10_000,
      overextensionBp: 10_000,
      fortificationBp: 10_000,
      homelandBp: 10_000,
    },
  };
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
