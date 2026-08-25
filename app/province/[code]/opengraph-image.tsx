import { ImageResponse } from 'next/og';
import world from '../../../src/data/world.generated.json';

export const alt = 'Territorios province campaign card';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function ProvinceOpenGraphImage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const code = (await params).code;
  const selected = world.territories.find((territory) => territory.code === code);
  const name = selected?.name ?? 'España';
  return new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: 'linear-gradient(135deg, #0b2538 0%, #173f50 62%, #df5b50 100%)',
        color: '#fffdf8',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'center',
        letterSpacing: '-0.03em',
        padding: '72px',
        textAlign: 'center',
        width: '100%',
      }}
    >
      <div style={{ color: '#f3c46c', display: 'flex', fontSize: 28, letterSpacing: '0.18em' }}>
        TERRITORIOS · PROVINCIA {code}
      </div>
      <div style={{ display: 'flex', fontSize: 88, fontWeight: 700, marginTop: 34 }}>
        {name}
      </div>
      <div style={{ color: '#dbe7e8', display: 'flex', fontSize: 34, marginTop: 28 }}>
        Un mundo persistente · cada frente deja un replay verificable
      </div>
    </div>,
    size,
  );
}
