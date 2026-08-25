import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { geoArea, geoBounds } from 'd3-geo';
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

  it('uses RFC 7946 ring winding so every feature renders as a local shape', () => {
    for (const feature of data.features) {
      const area = geoArea(feature as never);
      const [[west, south], [east, north]] = geoBounds(feature as never);

      expect(area, feature.properties.name).toBeLessThan(0.1);
      expect(west, feature.properties.name).toBeGreaterThan(-30);
      expect(east, feature.properties.name).toBeLessThan(10);
      expect(south, feature.properties.name).toBeGreaterThan(25);
      expect(north, feature.properties.name).toBeLessThan(50);
    }
  });

  it('ships a connected and reproducible movement graph', () => {
    const world = JSON.parse(
      readFileSync(resolve(process.cwd(), 'src/data/world.generated.json'), 'utf8'),
    ) as {
      territories: Array<{ code: string }>;
      adjacencies: Array<{ from: string; to: string; routeKind: string }>;
    };
    const neighbors = new Map<string, Set<string>>();
    for (const territory of world.territories) neighbors.set(territory.code, new Set());
    for (const edge of world.adjacencies) {
      neighbors.get(edge.from)?.add(edge.to);
      neighbors.get(edge.to)?.add(edge.from);
    }

    const visited = new Set<string>();
    const pending = [world.territories[0].code];
    while (pending.length > 0) {
      const code = pending.pop();
      if (!code || visited.has(code)) continue;
      visited.add(code);
      pending.push(...(neighbors.get(code) ?? []));
    }

    expect(world.territories).toHaveLength(52);
    expect(world.adjacencies.length).toBeGreaterThan(100);
    expect(visited.size).toBe(52);
    expect(world.adjacencies.some((edge) => edge.routeKind === 'sea')).toBe(true);
  });
});
