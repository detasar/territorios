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
  freeUnits: bigint;
  effectivePaidUnits: bigint;
  queuedPaidUnits: bigint;
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

export type CombatLossAllocation = {
  freeUnits: bigint;
  paidUnits: bigint;
  freeLosses: bigint;
  paidLosses: bigint;
  queuedPaidUnits: bigint;
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
        : ((attacker.freeUnits + attacker.effectivePaidUnits) * attackerLossRateBp) /
          BASIS_POINTS,
    defenderLosses:
      totalPower === 0n
        ? 0n
        : ((defender.freeUnits + defender.effectivePaidUnits) * defenderLossRateBp) /
          BASIS_POINTS,
  };
}

function effectiveSide(side: CombatSideInput): EffectiveCombatSide {
  const effectivePaidUnits = min(side.paidUnits, side.freeUnits / PAID_TO_FREE_CAP_DIVISOR);
  const queuedPaidUnits = side.paidUnits - effectivePaidUnits;
  const freePower = applyModifiers(side.freeUnits, side.modifiers);
  const paidPower = min(
    applyModifiers(effectivePaidUnits, side.modifiers),
    freePower / PAID_TO_FREE_CAP_DIVISOR,
  );
  const queuedPaidPower = applyModifiers(side.paidUnits, side.modifiers) - paidPower;
  const totalPower = freePower + paidPower;

  return {
    freeUnits: side.freeUnits,
    effectivePaidUnits,
    queuedPaidUnits,
    freePower,
    paidPower,
    queuedPaidPower,
    totalPower,
    paidShareBp:
      totalPower === 0n
        ? 0
        : Number((paidPower * BASIS_POINTS) / totalPower),
  };
}

export function allocateCombatLosses(input: {
  freeUnits: bigint;
  paidUnits: bigint;
  effectivePaidUnits: bigint;
  losses: bigint;
}): CombatLossAllocation {
  const { freeUnits, paidUnits, effectivePaidUnits, losses } = input;
  if (
    freeUnits < 0n ||
    paidUnits < 0n ||
    effectivePaidUnits < 0n ||
    effectivePaidUnits > paidUnits ||
    losses < 0n
  ) {
    throw new RangeError('Combat loss inputs must describe non-negative participating units.');
  }
  const activeUnits = freeUnits + effectivePaidUnits;
  const queuedPaidUnits = paidUnits - effectivePaidUnits;
  if (activeUnits === 0n || losses === 0n) {
    return {
      freeUnits,
      paidUnits,
      freeLosses: 0n,
      paidLosses: 0n,
      queuedPaidUnits,
    };
  }
  const boundedLosses = min(losses, activeUnits);
  const freeLosses = (boundedLosses * freeUnits) / activeUnits;
  const paidLosses = boundedLosses - freeLosses;
  return {
    freeUnits: freeUnits - freeLosses,
    paidUnits: paidUnits - paidLosses,
    freeLosses,
    paidLosses,
    queuedPaidUnits,
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
