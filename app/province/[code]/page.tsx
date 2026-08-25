import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import world from '../../../src/data/world.generated.json';
import { TerritoriosGame } from '../../../src/components/territorios-game';

function province(code: string) {
  return world.territories.find((territory) => territory.code === code);
}

export function generateStaticParams() {
  return world.territories.map((territory) => ({ code: territory.code }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const selected = province((await params).code);
  if (!selected) return { title: 'Territorios' };
  const title = `${selected.name} — Territorios`;
  const description = `Abre ${selected.name} en el mapa persistente de Territorios y sigue sus frentes, suministro y consejo.`;
  return {
    title,
    description,
    alternates: { canonical: `/province/${selected.code}` },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/province/${selected.code}`,
    },
  };
}

export default async function ProvincePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const selected = province((await params).code);
  if (!selected) notFound();
  return <TerritoriosGame initialTerritoryCode={selected.code} />;
}
