import { describe, expect, it } from 'vitest';
import {
  canonicalEvent,
  captureWindowAt,
  occupationEfficiencyBp,
  resolveWorldTick,
  tickIndexAt,
} from './world';

const seasonStart = Date.UTC(2026, 7, 24, 7, 0, 0);

describe('world clock', () => {
  it('maps elapsed time to stable hourly tick indices', () => {
    expect(tickIndexAt(seasonStart, seasonStart)).toBe(0);
    expect(tickIndexAt(seasonStart + 3_599_999, seasonStart)).toBe(0);
    expect(tickIndexAt(seasonStart + 3_600_000, seasonStart)).toBe(1);
  });

  it('recognizes only the four Madrid capture windows', () => {
    expect(captureWindowAt(Date.UTC(2026, 7, 25, 7))).toBe(true);
    expect(captureWindowAt(Date.UTC(2026, 7, 25, 12))).toBe(true);
    expect(captureWindowAt(Date.UTC(2026, 7, 25, 17))).toBe(true);
    expect(captureWindowAt(Date.UTC(2026, 7, 25, 21))).toBe(true);
    expect(captureWindowAt(Date.UTC(2026, 7, 25, 18))).toBe(false);
  });
});

describe('territory tick resolution', () => {
  it('does not capture before three resolved battle ticks', () => {
    const result = resolveWorldTick({
      tickIndex: 2,
      resolvedAt: Date.UTC(2026, 7, 25, 7),
      territory: {
        code: '45',
        ownerFactionId: 'toledo',
        attackerFactionId: 'madrid',
        siegeBp: 9_900,
        battleTickCount: 1,
        supplyConnected: true,
      },
      attacker: { freeUnits: 9_000n, paidUnits: 20_000n },
      defender: { freeUnits: 1_000n, paidUnits: 0n },
    });

    expect(result.siegeBp).toBe(10_000);
    expect(result.captured).toBe(false);
    expect(result.battleTickCount).toBe(2);
    expect(result.combat.attacker.paidShareBp).toBeLessThanOrEqual(2_000);
  });

  it('captures only in a Madrid window after three ticks with supply', () => {
    const result = resolveWorldTick({
      tickIndex: 3,
      resolvedAt: Date.UTC(2026, 7, 25, 7),
      territory: {
        code: '45',
        ownerFactionId: 'toledo',
        attackerFactionId: 'madrid',
        siegeBp: 10_000,
        battleTickCount: 2,
        supplyConnected: true,
      },
      attacker: { freeUnits: 9_000n, paidUnits: 0n },
      defender: { freeUnits: 1_000n, paidUnits: 0n },
    });

    expect(result.captured).toBe(true);
    expect(result.nextOwnerFactionId).toBe('madrid');
    expect(result.siegeBp).toBe(0);
  });

  it('holds a completed siege outside capture windows', () => {
    const result = resolveWorldTick({
      tickIndex: 3,
      resolvedAt: Date.UTC(2026, 7, 25, 18),
      territory: {
        code: '45',
        ownerFactionId: 'toledo',
        attackerFactionId: 'madrid',
        siegeBp: 10_000,
        battleTickCount: 2,
        supplyConnected: true,
      },
      attacker: { freeUnits: 9_000n, paidUnits: 0n },
      defender: { freeUnits: 1_000n, paidUnits: 0n },
    });

    expect(result.captured).toBe(false);
    expect(result.siegeBp).toBe(10_000);
  });
});

describe('world projections', () => {
  it.each([
    [0, 2_000],
    [6, 4_000],
    [24, 6_000],
    [48, 8_000],
    [72, 10_000],
  ])('applies occupation ramp at %i hours', (hours, expected) => {
    expect(occupationEfficiencyBp(hours)).toBe(expected);
  });

  it('canonicalizes event payload keys for replay hashing', () => {
    expect(canonicalEvent({ z: 1, a: { y: 2, b: 3 } })).toBe(
      '{"a":{"b":3,"y":2},"z":1}',
    );
  });
});
