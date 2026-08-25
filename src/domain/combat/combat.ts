const BASIS_POINTS = 10_000n;
const PAID_TO_FREE_CAP_DIVISOR = 4n;
const SIEGE_FACTOR_BP = 2_000n;
const BASE_CASUALTY_BP = 800n;

export type CombatModifiers = {
  supplyBp: number;
  distanceBp: number;
  overextensionBp: number;
  fortificationBp: number;
  homelandBp: number;
};

export type CombatSideInput = {
  freeUnits: bigint;
  paidUnits: bigint;
  modifiers: CombatModifiers;
};

export type BattleTickInput = {
  previousSiegeBp: number;
  attacker: CombatSideInput;
  defender: CombatSideInput;
};

export type EffectiveCombatSide = {
  freePower: bigint;
  paidPower: bigint;
  queuedPaidPower: bigint;
  totalPower: bigint;
  paidShareBp: number;
};

export type BattleTickResult = {
  attacker: EffectiveCombatSide;
  defender: EffectiveCombatSide;
  attackShareBp: number;
  siegeDeltaBp: number;
  siegeBp: number;
  attackerLosses: bigint;
  defenderLosses: bigint;
};

export function resolveBattleTick(input: BattleTickInput): BattleTickResult {
  assertSide(input.attacker);
  assertSide(input.defender);

  const attacker = effectiveSide(input.attacker);
  const defender = effectiveSide(input.defender);
  const totalPower = attacker.totalPower + defender.totalPower;
  const attackShareBp =
    totalPower === 0n
      ? 5_000
      : Number((attacker.totalPower * BASIS_POINTS) / totalPower);

  const siegeDeltaBp = Number(
    (BigInt(2 * attackShareBp - 10_000) * SIEGE_FACTOR_BP) / BASIS_POINTS,
  );
  const siegeBp = clamp(
    input.previousSiegeBp + siegeDeltaBp,
    0,
    Number(BASIS_POINTS),
  );

  const attackerLossRateBp =
    (BASE_CASUALTY_BP * BigInt(10_000 - attackShareBp)) / BASIS_POINTS;
  const defenderLossRateBp =
    (BASE_CASUALTY_BP * BigInt(attackShareBp)) / BASIS_POINTS;

  return {
    attacker,
    defender,
    attackShareBp,
    siegeDeltaBp,
    siegeBp,
    attackerLosses:
      totalPower === 0n
        ? 0n
        : (attacker.totalPower * attackerLossRateBp) / BASIS_POINTS,
    defenderLosses:
      totalPower === 0n
        ? 0n
        : (defender.totalPower * defenderLossRateBp) / BASIS_POINTS,
  };
}

function effectiveSide(side: CombatSideInput): EffectiveCombatSide {
  const freePower = applyModifiers(side.freeUnits, side.modifiers);
  const rawPaidPower = applyModifiers(side.paidUnits, side.modifiers);
  const paidPower = min(rawPaidPower, freePower / PAID_TO_FREE_CAP_DIVISOR);
  const totalPower = freePower + paidPower;

  return {
    freePower,
    paidPower,
    queuedPaidPower: rawPaidPower - paidPower,
    totalPower,
    paidShareBp:
      totalPower === 0n
        ? 0
        : Number((paidPower * BASIS_POINTS) / totalPower),
  };
}

function applyModifiers(units: bigint, modifiers: CombatModifiers): bigint {
  return [
    modifiers.supplyBp,
    modifiers.distanceBp,
    modifiers.overextensionBp,
    modifiers.fortificationBp,
    modifiers.homelandBp,
  ].reduce((power, modifier) => multiplyBasisPoints(power, modifier), units);
}

function multiplyBasisPoints(value: bigint, modifierBp: number): bigint {
  if (!Number.isInteger(modifierBp) || modifierBp < 0) {
    throw new RangeError('Combat modifiers must be non-negative integers.');
  }
  return (value * BigInt(modifierBp)) / BASIS_POINTS;
}

function assertSide(side: CombatSideInput): void {
  if (side.freeUnits < 0n || side.paidUnits < 0n) {
    throw new RangeError('Combat units cannot be negative.');
  }
}

function min(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
