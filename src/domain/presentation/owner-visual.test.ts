import { describe, expect, it } from 'vitest';
import { ownerColorForTerritory, provinceVisualState } from './owner-visual';

describe('ownerColorForTerritory', () => {
  it('produces a stable unique owner color for every beta territory', () => {
    const colors = Array.from({ length: 52 }, (_, index) =>
      ownerColorForTerritory(String(index + 1).padStart(2, '0')));
    expect(new Set(colors)).toHaveLength(52);
    expect(colors.every((color) => /^hsl\(\d+ \d+% \d+%\)$/.test(color))).toBe(true);
    expect(ownerColorForTerritory('28')).toBe(ownerColorForTerritory('28'));
  });

  it('rejects identifiers outside the canonical territory set', () => {
    expect(() => ownerColorForTerritory('00')).toThrow('territory code');
    expect(() => ownerColorForTerritory('53')).toThrow('territory code');
  });
});

describe('provinceVisualState', () => {
  it('keeps ownership, front, contested, and selection as independent channels', () => {
    expect(provinceVisualState({
      territoryCode: '45',
      ownerFactionId: 'toledo',
      viewerFactionId: 'madrid',
      selectedTerritoryCode: '45',
      activeOriginCode: '28',
      activeTargetCode: '45',
      siegeBp: 4_200,
    })).toEqual({
      viewerOwned: false,
      frontOrigin: false,
      frontTarget: true,
      contested: true,
      selected: true,
    });
  });

  it('marks the viewer origin without conflating it with selection', () => {
    expect(provinceVisualState({
      territoryCode: '28',
      ownerFactionId: 'madrid',
      viewerFactionId: 'madrid',
      selectedTerritoryCode: '45',
      activeOriginCode: '28',
      activeTargetCode: '45',
      siegeBp: 0,
    })).toMatchObject({ viewerOwned: true, frontOrigin: true, frontTarget: false, selected: false });
  });
});
