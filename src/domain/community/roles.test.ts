import { describe, expect, it } from 'vitest';
import { roleActionFor } from './roles';

describe('free role actions', () => {
  it('maps every seasonal role to a bounded deterministic effect', () => {
    expect(roleActionFor('scout')).toEqual({ effect: 'intel', assetKind: null, amount: 0 });
    expect(roleActionFor('defender')).toEqual({ effect: 'free-garrison', assetKind: 'free_garrison', amount: 50 });
    expect(roleActionFor('quartermaster')).toEqual({ effect: 'supply', assetKind: 'supply', amount: 25 });
    expect(roleActionFor('builder')).toEqual({ effect: 'fortification', assetKind: 'fortification_bp', amount: 100 });
    expect(roleActionFor('diplomat')).toEqual({ effect: 'faction-score', assetKind: 'faction_score', amount: 10 });
    expect(roleActionFor('strategist')).toEqual({ effect: 'free-support', assetKind: 'free_support', amount: 25 });
    expect(roleActionFor('herald')).toEqual({ effect: 'morale', assetKind: 'faction_score', amount: 5 });
  });

  it('fails closed for a role outside the published vocabulary', () => {
    expect(() => roleActionFor('king')).toThrow('Unsupported player role');
  });
});
