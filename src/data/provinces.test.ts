import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type ProvinceFeature = {
  id: string;
  type: 'Feature';
  properties: { code: string; name: string };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown[] };
};

describe('Spain province map dataset', () => {
  const data = JSON.parse(
    readFileSync(resolve(process.cwd(), 'public/data/provinces.geojson'), 'utf8'),
  ) as { type: string; features: ProvinceFeature[] };

  it('contains exactly the 52 playable territories', () => {
    expect(data.type).toBe('FeatureCollection');
    expect(data.features).toHaveLength(52);
    expect(new Set(data.features.map((feature) => feature.id)).size).toBe(52);
  });

  it('uses two-digit official codes and non-empty names', () => {
    for (const feature of data.features) {
      expect(feature.id).toMatch(/^\d{2}$/);
      expect(feature.properties.code).toBe(feature.id);
      expect(feature.properties.name.trim().length).toBeGreaterThan(1);
      expect(['Polygon', 'MultiPolygon']).toContain(feature.geometry.type);
    }
  });

  it('includes Ceuta and Melilla and excludes unassigned territory code 54', () => {
    const codes = new Set(data.features.map((feature) => feature.id));
    expect(codes).toContain('51');
    expect(codes).toContain('52');
    expect(codes).not.toContain('54');
  });
});
