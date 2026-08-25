import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { geoArea, geoBounds } from 'd3-geo';

const endpoint =
  'https://mapas.fomento.gob.es/arcgis/rest/services/SIU/ENTIDADES_TERRITORIALES_EGRN/MapServer/2/query';
const detailPage =
  'https://centrodedescargas.cnig.es/CentroDescargas/detalleArchivo?sec=9000029';
const query = new URL(endpoint);
query.searchParams.set('where', '1=1');
query.searchParams.set('outFields', 'CodINE,NAMEUNIT,NATCODE');
query.searchParams.set('returnGeometry', 'true');
query.searchParams.set('outSR', '4326');
query.searchParams.set('maxAllowableOffset', '0.005');
query.searchParams.set('geometryPrecision', '5');
query.searchParams.set('f', 'geojson');

const response = await fetch(query, {
  headers: { 'user-agent': 'Territorios map data builder/0.1' },
  signal: AbortSignal.timeout(60_000),
});

if (!response.ok) {
  throw new Error(`Province source returned HTTP ${response.status}.`);
}

const sourceBytes = Buffer.from(await response.arrayBuffer());
const source = JSON.parse(sourceBytes.toString('utf8'));

if (source.type !== 'FeatureCollection' || !Array.isArray(source.features)) {
  throw new Error('Province source did not return a GeoJSON FeatureCollection.');
}

const features = source.features
  .filter((feature) => String(feature.properties?.CodINE ?? '') !== '54')
  .map((feature) => {
    const code = String(feature.properties?.CodINE ?? '').padStart(2, '0');
    const name = String(feature.properties?.NAMEUNIT ?? '').trim();
    if (!/^\d{2}$/.test(code) || !name || !feature.geometry) {
      throw new Error(`Invalid province feature received for code ${code || '?'}.`);
    }

    return {
      type: 'Feature',
      id: code,
      properties: {
        code,
        name,
        nationalCode: String(feature.properties?.NATCODE ?? ''),
      },
      geometry: rewindGeometry(feature.geometry),
    };
  })
  .sort((left, right) => left.id.localeCompare(right.id));

const uniqueCodes = new Set(features.map((feature) => feature.id));
if (features.length !== 52 || uniqueCodes.size !== 52) {
  throw new Error(
    `Expected 52 unique playable territories; received ${features.length} features and ${uniqueCodes.size} codes.`,
  );
}

for (const feature of features) {
  const [[west, south], [east, north]] = geoBounds(feature);
  if (
    geoArea(feature) >= 0.1 ||
    west <= -30 ||
    east >= 10 ||
    south <= 25 ||
    north >= 50
  ) {
    throw new Error(`Invalid RFC 7946 ring winding for province ${feature.id}.`);
  }
}

const output = { type: 'FeatureCollection', features };
const outputJson = `${JSON.stringify(output)}\n`;
const seaRoutes = [
  ['03', '07'],
  ['07', '08'],
  ['07', '46'],
  ['11', '51'],
  ['29', '51'],
  ['04', '52'],
  ['29', '52'],
  ['11', '35'],
  ['35', '38'],
];
const landPairs = collectSharedBoundaryPairs(features);
const adjacencies = [
  ...landPairs.map(([from, to]) => ({ from, to, routeKind: 'land', costBp: 10_000 })),
  ...seaRoutes.map(([from, to]) => ({ from, to, routeKind: 'sea', costBp: 12_500 })),
].sort((left, right) => `${left.from}-${left.to}`.localeCompare(`${right.from}-${right.to}`));
const world = {
  territories: features.map((feature) => ({
    code: feature.id,
    name: feature.properties.name,
    nationalCode: feature.properties.nationalCode,
  })),
  adjacencies,
};
const worldJson = `${JSON.stringify(world, null, 2)}\n`;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

await mkdir('public/data', { recursive: true });
await mkdir('data/provenance', { recursive: true });
await mkdir('src/data', { recursive: true });
await writeFile('public/data/provinces.geojson', outputJson);
await writeFile('src/data/world.generated.json', worldJson);
await writeFile(
  'data/provenance/provinces.json',
  `${JSON.stringify(
    {
      title: 'Límites y Unidades Administrativas Actuales — Provincias',
      publisher: 'Instituto Geográfico Nacional / CNIG',
      detailPage,
      queryUrl: query.toString(),
      retrievedAt: new Date().toISOString(),
      license: 'CC-BY 4.0 compatible',
      attribution: 'Obra derivada de BDLJE CC-BY 4.0 ign.es',
      transformations: [
        'Filtered unassigned territory code 54',
        'Rewound polygon exteriors to RFC 7946 right-hand-rule orientation',
        'Simplified by the source service with maxAllowableOffset=0.005',
      ],
      featureCount: features.length,
      landAdjacencyCount: landPairs.length,
      seaRouteCount: seaRoutes.length,
      sourceSha256: sha256(sourceBytes),
      outputSha256: sha256(outputJson),
      worldOutputSha256: sha256(worldJson),
    },
    null,
    2,
  )}\n`,
);

console.info(
  `Wrote ${features.length} provinces and ${adjacencies.length} routes (${Buffer.byteLength(outputJson)} map bytes, sha256 ${sha256(outputJson)}).`,
);

function collectSharedBoundaryPairs(provinceFeatures) {
  const segments = new Map();
  for (const feature of provinceFeatures) {
    const rings =
      feature.geometry.type === 'Polygon'
        ? feature.geometry.coordinates
        : feature.geometry.coordinates.flat();
    for (const ring of rings) {
      for (let index = 1; index < ring.length; index += 1) {
        const left = ring[index - 1].join(',');
        const right = ring[index].join(',');
        const key = left < right ? `${left}|${right}` : `${right}|${left}`;
        const owners = segments.get(key) ?? new Set();
        owners.add(feature.id);
        segments.set(key, owners);
      }
    }
  }

  const pairs = new Set();
  for (const owners of segments.values()) {
    if (owners.size !== 2) continue;
    pairs.add([...owners].sort().join('-'));
  }
  return [...pairs]
    .sort()
    .map((pair) => pair.split('-'));
}

function rewindGeometry(geometry) {
  const rewindPolygon = (polygon) => {
    const polygonFeature = { type: 'Polygon', coordinates: polygon };
    if (geoArea(polygonFeature) <= Math.PI * 2) return polygon;
    return [[...polygon[0]].reverse(), ...polygon.slice(1)];
  };

  if (geometry.type === 'Polygon') {
    return { ...geometry, coordinates: rewindPolygon(geometry.coordinates) };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(rewindPolygon),
    };
  }
  throw new Error(`Unsupported province geometry type ${geometry.type}.`);
}
