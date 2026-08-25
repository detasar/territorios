import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { allocateCombatLosses, resolveBattleTick } from './combat';

const neutralModifiers = {
  supplyBp: 10_000,
  distanceBp: 10_000,
  overextensionBp: 10_000,
  fortificationBp: 10_000,
  homelandBp: 10_000,
};

describe('resolveBattleTick', () => {
  it('keeps siege unchanged when effective powers are equal', () => {
    const result = resolveBattleTick({
      previousSiegeBp: 2_500,
      attacker: { freeUnits: 5_000n, paidUnits: 0n, modifiers: neutralModifiers },
      defender: { freeUnits: 5_000n, paidUnits: 0n, modifiers: neutralModifiers },
    });

    expect(result.attackShareBp).toBe(5_000);
    expect(result.siegeDeltaBp).toBe(0);
    expect(result.siegeBp).toBe(2_500);
  });

  it('moves siege by eight percentage points for a 70/30 power split', () => {
    const result = resolveBattleTick({
      previousSiegeBp: 0,
      attacker: { freeUnits: 7_000n, paidUnits: 0n, modifiers: neutralModifiers },
      defender: { freeUnits: 3_000n, paidUnits: 0n, modifiers: neutralModifiers },
    });

    expect(result.attackShareBp).toBe(7_000);
    expect(result.siegeDeltaBp).toBe(800);
    expect(result.siegeBp).toBe(800);
    expect(result.attackerLosses).toBe(168n);
    expect(result.defenderLosses).toBe(168n);
  });

  it('caps paid power at one quarter of free power', () => {
    const result = resolveBattleTick({
      previousSiegeBp: 0,
      attacker: { freeUnits: 8_000n, paidUnits: 1_000_000n, modifiers: neutralModifiers },
      defender: { freeUnits: 10_000n, paidUnits: 0n, modifiers: neutralModifiers },
    });

    expect(result.attacker.freePower).toBe(8_000n);
    expect(result.attacker.paidPower).toBe(2_000n);
    expect(result.attacker.queuedPaidPower).toBe(998_000n);
    expect(result.attacker.effectivePaidUnits).toBe(2_000n);
    expect(result.attacker.queuedPaidUnits).toBe(998_000n);
    expect(result.attacker.paidShareBp).toBe(2_000);
  });

  it('allocates casualties only across units admitted to the tick', () => {
    const result = allocateCombatLosses({
      freeUnits: 100n,
      paidUnits: 1_000n,
      effectivePaidUnits: 25n,
      losses: 4n,
    });

    expect(result).toEqual({
      freeUnits: 97n,
      paidUnits: 999n,
      freeLosses: 3n,
      paidLosses: 1n,
      queuedPaidUnits: 975n,
    });
  });

  it('bases casualties on participating units instead of modified power', () => {
    const result = resolveBattleTick({
      previousSiegeBp: 0,
      attacker: {
        freeUnits: 100n,
        paidUnits: 1_000n,
        modifiers: { ...neutralModifiers, homelandBp: 15_000 },
      },
      defender: { freeUnits: 100n, paidUnits: 0n, modifiers: neutralModifiers },
    });

    expect(result.attacker.effectivePaidUnits).toBe(25n);
    expect(result.attacker.queuedPaidUnits).toBe(975n);
    expect(result.attackerLosses).toBeLessThanOrEqual(125n);
  });

  it('is deterministic for arbitrary valid unit counts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        (attack, defense, paid, siege) => {
          const input = {
            previousSiegeBp: siege,
            attacker: {
              freeUnits: BigInt(attack),
              paidUnits: BigInt(paid),
              modifiers: neutralModifiers,
            },
            defender: {
              freeUnits: BigInt(defense),
              paidUnits: 0n,
              modifiers: neutralModifiers,
            },
          };

          expect(resolveBattleTick(input)).toEqual(resolveBattleTick(input));
        },
      ),
      { numRuns: 1_000 },
    );
  });
});
