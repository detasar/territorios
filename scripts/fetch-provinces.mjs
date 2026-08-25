import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

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
      geometry: feature.geometry,
    };
  })
  .sort((left, right) => left.id.localeCompare(right.id));

const uniqueCodes = new Set(features.map((feature) => feature.id));
if (features.length !== 52 || uniqueCodes.size !== 52) {
  throw new Error(
    `Expected 52 unique playable territories; received ${features.length} features and ${uniqueCodes.size} codes.`,
  );
}

const output = { type: 'FeatureCollection', features };
const outputJson = `${JSON.stringify(output)}\n`;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

await mkdir('public/data', { recursive: true });
await mkdir('data/provenance', { recursive: true });
await writeFile('public/data/provinces.geojson', outputJson);
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
      featureCount: features.length,
      sourceSha256: sha256(sourceBytes),
      outputSha256: sha256(outputJson),
    },
    null,
    2,
  )}\n`,
);

console.info(
  `Wrote ${features.length} provinces (${Buffer.byteLength(outputJson)} bytes, sha256 ${sha256(outputJson)}).`,
);
