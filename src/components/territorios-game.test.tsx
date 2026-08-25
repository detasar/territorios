import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TerritoriosGame } from './territorios-game';

const provinces = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: '28',
      properties: { code: '28', name: 'Madrid', nationalCode: '34132800000' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-4, 41], [-3, 41], [-3, 40], [-4, 40], [-4, 41]]],
      },
    },
    {
      type: 'Feature',
      id: '45',
      properties: { code: '45', name: 'Toledo', nationalCode: '34084500000' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-5, 40], [-3, 40], [-3, 39], [-5, 39], [-5, 40]]],
      },
    },
  ],
};

const gameSnapshot = {
  mode: 'live-world',
  serverTime: Date.UTC(2026, 7, 25, 3),
  season: {
    id: 'season-1',
    number: 1,
    name: 'La Primera Corona',
    phase: 'regional-war',
    status: 'active',
    startsAt: Date.UTC(2026, 7, 14, 3),
    endsAt: Date.UTC(2026, 8, 11, 3),
    lastResolvedTick: 263,
    engineVersion: 'combat-1.0.0',
  },
  territories: [
    { code: '28', name: 'Madrid', ownerFactionId: 'faction-28', ownerFactionName: 'Casa de Madrid', color: 'coral', siegeBp: 0, attackerFactionId: null, freeGarrison: 7_000, paidGarrison: 0, supply: 1_000, occupiedAt: null },
    { code: '45', name: 'Toledo', ownerFactionId: 'faction-45', ownerFactionName: 'Casa de Toledo', color: 'gold', siegeBp: 4_200, attackerFactionId: 'faction-28', freeGarrison: 3_000, paidGarrison: 0, supply: 1_000, occupiedAt: null },
  ],
  battles: [
    { id: 'battle-madrid-toledo', originTerritoryCode: '28', targetTerritoryCode: '45', originName: 'Madrid', targetName: 'Toledo', attackerFactionId: 'faction-28', defenderFactionId: 'faction-45', siegeBp: 4_200, tickCount: 0, freeAttackPower: 7_000, paidAttackPower: 0, engineVersion: 'combat-1.0.0' },
  ],
  factionLeaderboard: [],
  playerLeaderboard: [],
  recentEvents: [],
  catalog: [],
  viewer: {
    displayName: 'Jugadora de prueba',
    membership: { factionId: 'faction-28', factionName: 'Casa de Madrid', territoryCode: '28', role: 'strategist', contributionScore: 0 },
    wallet: { freeSupport: 300, paidSupport: 0, supporterPoints: 0 },
    preferences: { locale: 'es', quietHoursStart: 22, quietHoursEnd: 8, maxWarAlertsPerDay: 1, councilAlerts: true },
  },
};

const supportedSnapshot = {
  ...gameSnapshot,
  battles: [{ ...gameSnapshot.battles[0], freeAttackPower: 7_050 }],
  viewer: {
    ...gameSnapshot.viewer,
    membership: { ...gameSnapshot.viewer.membership, contributionScore: 50 },
    wallet: { ...gameSnapshot.viewer.wallet, freeSupport: 250 },
  },
};

describe('TerritoriosGame', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('provinces.geojson')) {
          return { ok: true, json: async () => provinces };
        }
        if (url === '/api/game' && !init?.method) {
          return { ok: true, json: async () => gameSnapshot };
        }
        if (url === '/api/game/support' && init?.method === 'POST') {
          return { ok: true, json: async () => supportedSnapshot };
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );
  });

  it('renders the map-first season view and current siege', async () => {
    render(<TerritoriosGame />);

    expect(
      screen.getByRole('heading', { name: /la corona se decide/i }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /mapa de territorios/i })).toBeInTheDocument();
    expect(screen.getByText('Madrid → Toledo')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('selects a province from the geographic map', async () => {
    const user = userEvent.setup();
    render(<TerritoriosGame />);

    const madrid = await screen.findByRole('button', {
      name: /seleccionar madrid/i,
    });
    await user.click(madrid);

    expect(screen.getByRole('heading', { name: 'Madrid' })).toBeInTheDocument();
    expect(screen.getByText(/capital de tu facción/i)).toBeInTheDocument();
  });

  it('commits free support without allowing a negative balance', async () => {
    const user = userEvent.setup();
    render(<TerritoriosGame />);

    await user.click(await screen.findByRole('button', { name: /enviar 50 refuerzos/i }));

    expect(await screen.findByText(/250 disponibles/i)).toBeInTheDocument();
    expect(await screen.findByText(/7.050 fuerza atacante/i)).toBeInTheDocument();
  });

  it('exposes deterministic text and time controls for browser verification', async () => {
    render(<TerritoriosGame />);
    await screen.findByRole('img', { name: /mapa de territorios/i });

    expect(window.render_game_to_text).toBeTypeOf('function');
    expect(JSON.parse(window.render_game_to_text())).toMatchObject({
      mode: 'live-world',
      selectedTerritory: '45',
      siegeBp: 4_200,
      supportAvailable: 300,
    });

    act(() => window.advanceTime(60 * 60 * 1_000));

    await waitFor(() => {
      expect(JSON.parse(window.render_game_to_text()).siegeBp).toBe(5_000);
    });
  });

  it('fails closed with explicit map and world alerts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('provinces.geojson')) return { ok: false };
        return { ok: true, json: async () => gameSnapshot };
      }),
    );

    render(<TerritoriosGame />);

    expect(await screen.findByText('No se pudo cargar el mapa oficial.')).toBeInTheDocument();
    expect(screen.getByText('El mundo persistente no está disponible.')).toBeInTheDocument();
    expect(JSON.parse(window.render_game_to_text()).mapStatus).toBe('error');
  });

  it('offers ChatGPT sign-in without exposing a mutation to anonymous players', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('provinces.geojson')) return { ok: true, json: async () => provinces };
        return { ok: true, json: async () => ({ ...gameSnapshot, viewer: null }) };
      }),
    );

    render(<TerritoriosGame />);

    const signIn = await screen.findByRole('link', { name: /iniciar sesión con chatgpt/i });
    expect(signIn).toHaveAttribute('href', '/signin-with-chatgpt?return_to=%2F');
    expect(screen.queryByRole('button', { name: /enviar 50 refuerzos/i })).not.toBeInTheDocument();
  });

  it('lets an authenticated newcomer join the selected faction', async () => {
    const newcomer = {
      ...gameSnapshot,
      viewer: { ...gameSnapshot.viewer, membership: null },
    };
    const joined = {
      ...gameSnapshot,
      viewer: {
        ...gameSnapshot.viewer,
        membership: {
          factionId: 'faction-45',
          factionName: 'Casa de Toledo',
          territoryCode: '45',
          role: 'defender',
          contributionScore: 0,
        },
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('provinces.geojson')) return { ok: true, json: async () => provinces };
        if (url === '/api/game' && !init?.method) return { ok: true, json: async () => newcomer };
        if (url === '/api/game/join') return { ok: true, json: async () => joined };
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const user = userEvent.setup();
    render(<TerritoriosGame />);
    await user.click(await screen.findByRole('button', { name: /representar toledo/i }));

    expect(await screen.findByText('Ahora representas Toledo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar 50 refuerzos/i })).toBeInTheDocument();
  });

  it('surfaces narrow join and support errors and clears pending state', async () => {
    const newcomer = {
      ...gameSnapshot,
      viewer: { ...gameSnapshot.viewer, membership: null },
    };
    let mode: 'join' | 'support' = 'join';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('provinces.geojson')) return { ok: true, json: async () => provinces };
        if (url === '/api/game' && !init?.method) {
          return { ok: true, json: async () => (mode === 'join' ? newcomer : gameSnapshot) };
        }
        if (url === '/api/game/join') {
          return { ok: false, json: async () => ({ error: 'Cambio de facción bloqueado.' }) };
        }
        if (url === '/api/game/support') throw 'network unavailable';
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const user = userEvent.setup();
    const first = render(<TerritoriosGame />);
    await user.click(await screen.findByRole('button', { name: /representar toledo/i }));
    expect(await screen.findByText('Cambio de facción bloqueado.')).toBeInTheDocument();

    first.unmount();
    mode = 'support';
    render(<TerritoriosGame />);
    await user.click(await screen.findByRole('button', { name: /enviar 50 refuerzos/i }));
    expect(await screen.findByText('No se pudo completar la orden.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar 50 refuerzos/i })).toBeEnabled();
  });

  it('supports keyboard province selection and guarded fullscreen controls', async () => {
    render(<TerritoriosGame />);
    const madrid = await screen.findByRole('button', { name: /seleccionar madrid/i });

    fireEvent.keyDown(madrid, { key: ' ' });
    expect(screen.getByRole('heading', { name: 'Madrid' })).toBeInTheDocument();

    const exitFullscreen = vi.fn(async () => undefined);
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.body,
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen,
    });
    fireEvent.keyDown(window, { key: 'f' });
    expect(exitFullscreen).toHaveBeenCalledOnce();

    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    expect(exitFullscreen).toHaveBeenCalledOnce();
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
  });

  it('covers fallback faction colors and ignores invalid time travel', async () => {
    const fallbackProvinces = {
      ...provinces,
      features: [
        ...provinces.features,
        ...['05', '03', '02', '01'].map((code, index) => ({
          ...provinces.features[0],
          id: code,
          properties: { code, name: `Provincia ${code}`, nationalCode: `${index}` },
        })),
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('provinces.geojson')) {
          return { ok: true, json: async () => fallbackProvinces };
        }
        return { ok: true, json: async () => gameSnapshot };
      }),
    );

    render(<TerritoriosGame />);
    const provinceOne = await screen.findByRole('button', { name: 'Seleccionar Provincia 01' });
    fireEvent.keyDown(provinceOne, { key: 'Enter' });
    expect(screen.getByText('Provincia neutral')).toBeInTheDocument();

    const before = window.render_game_to_text();
    act(() => window.advanceTime(Number.NaN));
    act(() => window.advanceTime(-1));
    expect(window.render_game_to_text()).toBe(before);
  });
});
