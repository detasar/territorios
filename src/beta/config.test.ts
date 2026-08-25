import { describe, expect, it } from 'vitest';
import { BETA_OPERATIONS, FOCUS_FRONTS, FOCUS_PROVINCES } from './config';

describe('closed-beta operations configuration', () => {
  it('names a controller and provides only authenticated in-app contact channels', () => {
    expect(BETA_OPERATIONS.controllerName).toBe('Davut Emre');
    expect(BETA_OPERATIONS.consentVersion).toMatch(/^closed-beta-/);
    expect(BETA_OPERATIONS.realMoney).toBe(false);
    expect(BETA_OPERATIONS.supportRoute).toBe('/api/beta/request');
  });

  it('concentrates participants into three real opening fronts', () => {
    expect(FOCUS_PROVINCES).toHaveLength(6);
    expect(new Set(FOCUS_PROVINCES.map((province) => province.code))).toHaveLength(6);
    expect(FOCUS_FRONTS).toEqual([
      ['28', '45'],
      ['01', '09'],
      ['11', '29'],
    ]);
  });
});
