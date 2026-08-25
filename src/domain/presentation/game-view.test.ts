import { describe, expect, it } from 'vitest';
import type { WorldSnapshot } from '../../contracts/game';
import { deriveSupportImpact, groupFronts, viewerHomeSupply } from './game-view';

type Battle = WorldSnapshot['battles'][number];

const attackerFront = {
  id: 'front-a',
  viewerSide: 'attacker',
  canSupport: true,
} as Battle;
const defenderFront = {
  id: 'front-b',
  viewerSide: 'defender',
  canSupport: true,
} as Battle;
const observedFront = {
  id: 'front-c',
  viewerSide: null,
  canSupport: false,
} as Battle;

describe('groupFronts', () => {
  it('puts every actionable player front before observed fronts', () => {
    expect(groupFronts([observedFront, defenderFront, attackerFront])).toEqual({
      mine: [defenderFront, attackerFront],
      others: [observedFront],
    });
  });
});

describe('viewerHomeSupply', () => {
  it('returns home supply independently from the selected province', () => {
    const world = {
      viewer: { membership: { territoryCode: '28' } },
      territories: [
        { code: '28', name: 'Madrid', supply: 900 },
        { code: '45', name: 'Toledo', supply: 125 },
      ],
    } as WorldSnapshot;
    expect(viewerHomeSupply(world)).toEqual({ code: '28', name: 'Madrid', supply: 900 });
  });

  it('does not project another faction supply for an anonymous viewer', () => {
    expect(viewerHomeSupply({ viewer: null, territories: [] } as unknown as WorldSnapshot)).toBeNull();
  });
});

describe('deriveSupportImpact', () => {
  it('reports an authoritative attacker delta and next tick', () => {
    const before = snapshot('attacker', 7_000, 3_000, 300);
    const after = snapshot('attacker', 7_050, 3_000, 250);
    expect(deriveSupportImpact(before, after, 'front-a')).toEqual({
      battleId: 'front-a',
      route: 'Madrid → Toledo',
      side: 'attacker',
      amount: 50,
      beforePower: 7_000,
      afterPower: 7_050,
      nextTickAt: 20_000,
    });
  });

  it('reports defender power from the target territory', () => {
    const before = snapshot('defender', 7_000, 3_000, 300);
    const after = snapshot('defender', 7_000, 3_050, 250);
    expect(deriveSupportImpact(before, after, 'front-a')).toMatchObject({
      side: 'defender',
      beforePower: 3_000,
      afterPower: 3_050,
      amount: 50,
    });
  });

  it('refuses to invent feedback when the authoritative balances do not change', () => {
    const world = snapshot('attacker', 7_000, 3_000, 300);
    expect(deriveSupportImpact(world, world, 'front-a')).toBeNull();
  });
});

function snapshot(
  side: 'attacker' | 'defender',
  attackPower: number,
  defensePower: number,
  wallet: number,
): WorldSnapshot {
  return {
    season: { nextTickAt: 20_000 },
    viewer: { wallet: { freeSupport: wallet } },
    battles: [{
      id: 'front-a',
      originName: 'Madrid',
      targetName: 'Toledo',
      targetTerritoryCode: '45',
      viewerSide: side,
      freeAttackPower: attackPower,
    }],
    territories: [{ code: '45', freeGarrison: defensePower }],
  } as WorldSnapshot;
}
