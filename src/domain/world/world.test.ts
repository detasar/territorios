import { describe, expect, it } from 'vitest';
import {
  battleParticipatesInTick,
  canonicalEvent,
  captureWindowAt,
  hasSuppliedRoute,
  occupationEfficiencyBp,
  overextensionEfficiencyBp,
  resolveWorldTick,
  tickIndexAt,
  worldCombatModifiers,
} from './world';

const seasonStart = Date.UTC(2026, 7, 24, 7, 0, 0);
const neutralModifiers = {
  supplyBp: 10_000,
  distanceBp: 10_000,
  overextensionBp: 10_000,
  fortificationBp: 10_000,
  homelandBp: 10_000,
};

describe('world clock', () => {
  it('maps elapsed time to stable hourly tick indices', () => {
    expect(tickIndexAt(seasonStart, seasonStart)).toBe(0);
    expect(tickIndexAt(seasonStart + 3_599_999, seasonStart)).toBe(0);
    expect(tickIndexAt(seasonStart + 3_600_000, seasonStart)).toBe(1);
  });

  it('never resolves a battle in a tick before its scheduled start', () => {
    expect(battleParticipatesInTick({
      startedAt: seasonStart + 2 * 60 * 60 * 1_000,
      resolvedAt: seasonStart + 60 * 60 * 1_000,
    })).toBe(false);
    expect(battleParticipatesInTick({
      startedAt: seasonStart + 2 * 60 * 60 * 1_000,
      resolvedAt: seasonStart + 2 * 60 * 60 * 1_000,
    })).toBe(true);
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
      attacker: { freeUnits: 9_000n, paidUnits: 20_000n, modifiers: neutralModifiers },
      defender: { freeUnits: 1_000n, paidUnits: 0n, modifiers: neutralModifiers },
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
      attacker: { freeUnits: 9_000n, paidUnits: 0n, modifiers: neutralModifiers },
      defender: { freeUnits: 1_000n, paidUnits: 0n, modifiers: neutralModifiers },
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
      attacker: { freeUnits: 9_000n, paidUnits: 0n, modifiers: neutralModifiers },
      defender: { freeUnits: 1_000n, paidUnits: 0n, modifiers: neutralModifiers },
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

  it('turns supply, route, overextension, fortification, and occupation into explicit modifiers', () => {
    const modifiers = worldCombatModifiers({
      supplyConnected: false,
      routeCostBp: 12_500,
      controlledFronts: 4,
      defenderFortificationBp: 12_000,
      defenderIsHomeland: false,
      defenderOccupiedAt: seasonStart,
      resolvedAt: seasonStart + 12 * 60 * 60 * 1_000,
    });

    expect(modifiers.attacker).toEqual({
      supplyBp: 2_500,
      distanceBp: 8_000,
      overextensionBp: 5_000,
      fortificationBp: 10_000,
      homelandBp: 10_000,
    });
    expect(modifiers.defender).toEqual({
      supplyBp: 10_000,
      distanceBp: 10_000,
      overextensionBp: 10_000,
      fortificationBp: 12_000,
      homelandBp: 4_000,
    });
    expect(overextensionEfficiencyBp(4)).toBe(5_000);
  });

  it('gives an unoccupied homeland a defensive advantage', () => {
    const modifiers = worldCombatModifiers({
      supplyConnected: true,
      routeCostBp: 10_000,
      controlledFronts: 1,
      defenderFortificationBp: 10_000,
      defenderIsHomeland: true,
      defenderOccupiedAt: null,
      resolvedAt: seasonStart,
    });

    expect(modifiers.defender.homelandBp).toBe(11_000);
  });

  it('requires an owned supplied path from faction home to attack origin', () => {
    const territories = [
      { code: '28', ownerFactionId: 'madrid', supply: 1_000 },
      { code: '45', ownerFactionId: 'madrid', supply: 1_000 },
      { code: '13', ownerFactionId: 'madrid', supply: 1_000 },
      { code: '16', ownerFactionId: 'cuenca', supply: 1_000 },
    ];
    const routes = [
      { fromCode: '28', toCode: '45' },
      { fromCode: '45', toCode: '13' },
      { fromCode: '13', toCode: '16' },
    ];

    expect(hasSuppliedRoute({
      factionId: 'madrid',
      homeTerritoryCode: '28',
      originTerritoryCode: '13',
      territories,
      routes,
    })).toBe(true);
    expect(hasSuppliedRoute({
      factionId: 'madrid',
      homeTerritoryCode: '28',
      originTerritoryCode: '16',
      territories,
      routes,
    })).toBe(false);
    expect(hasSuppliedRoute({
      factionId: 'madrid',
      homeTerritoryCode: '28',
      originTerritoryCode: '13',
      territories: territories.map((territory) =>
        territory.code === '45' ? { ...territory, supply: 0 } : territory),
      routes,
    })).toBe(false);
  });

  it('canonicalizes event payload keys for replay hashing', () => {
    expect(canonicalEvent({ z: 1, a: { y: 2, b: 3 } })).toBe(
      '{"a":{"b":3,"y":2},"z":1}',
    );
  });
});
