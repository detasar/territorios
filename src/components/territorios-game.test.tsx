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
  release: { version: '0.2.0-beta.1', sha: '0123456789abcdef0123456789abcdef01234567', shortSha: '0123456789ab', channel: 'closed-beta', realMoney: false },
  serverTime: Date.UTC(2026, 7, 25, 3),
  lastUpdatedAt: Date.UTC(2026, 7, 25, 3),
  season: {
    id: 'season-1',
    number: 1,
    name: 'La Primera Corona',
    phase: 'regional-war',
    status: 'active',
    startsAt: Date.UTC(2026, 7, 14, 3),
    endsAt: Date.UTC(2026, 8, 11, 3),
    lastResolvedTick: 263,
    engineVersion: 'combat-2.0.0',
    nextTickAt: Date.UTC(2026, 7, 25, 4),
  },
  previousSeason: null,
  territories: [
    { code: '28', name: 'Madrid', ownerFactionId: 'faction-28', ownerFactionName: 'Casa de Madrid', color: 'coral', siegeBp: 0, attackerFactionId: null, freeGarrison: 7_000, paidGarrison: 0, supply: 1_000, fortificationBp: 10_000, occupiedAt: null },
    { code: '45', name: 'Toledo', ownerFactionId: 'faction-45', ownerFactionName: 'Casa de Toledo', color: 'gold', siegeBp: 4_200, attackerFactionId: 'faction-28', freeGarrison: 3_000, paidGarrison: 0, supply: 1_000, fortificationBp: 12_000, occupiedAt: null },
  ],
  battles: [
    {
      id: 'battle-madrid-toledo', campaignId: 'campaign-1', originTerritoryCode: '28',
      targetTerritoryCode: '45', originName: 'Madrid', targetName: 'Toledo',
      attackerFactionId: 'faction-28', defenderFactionId: 'faction-45', siegeBp: 4_200,
      tickCount: 0, freeAttackPower: 7_000, paidAttackPower: 0,
      startedAt: Date.UTC(2026, 7, 25, 2), engineVersion: 'combat-2.0.0',
      routeKind: 'land', routeCostBp: 10_000, viewerSide: 'attacker', canSupport: true,
      supportDisabledReason: null,
      combatContext: {
        supplyConnected: true,
        attacker: { supplyBp: 10_000, distanceBp: 10_000, overextensionBp: 10_000, fortificationBp: 10_000, homelandBp: 10_000 },
        defender: { supplyBp: 10_000, distanceBp: 10_000, overextensionBp: 10_000, fortificationBp: 12_000, homelandBp: 11_000 },
      },
    },
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
  onboarding: { nextAction: 'support-front', eligibleBattleCount: 1, hasSupportedThisSeason: false },
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
    expect(await screen.findByRole('group', { name: /mapa de territorios/i })).toBeInTheDocument();
    expect(screen.getAllByText('Madrid → Toledo')).toHaveLength(2);
    expect(screen.getByText('42%')).toBeInTheDocument();
    const madrid = screen.getByRole('button', { name: /seleccionar madrid/i });
    const toledo = screen.getByRole('button', { name: /seleccionar toledo/i });
    expect(madrid).toHaveAttribute('data-viewer-owned', 'true');
    expect(madrid).toHaveAttribute('data-front-origin', 'true');
    expect(toledo).toHaveAttribute('data-front-target', 'true');
    expect(toledo).toHaveAttribute('data-contested', 'true');
    expect(toledo).toHaveAttribute('data-selected', 'true');
    expect(screen.getByLabelText('Leyenda del mapa')).toHaveTextContent('Tu facción');
    expect(screen.getByLabelText('Leyenda del mapa')).toHaveTextContent('Origen del frente');
    expect(screen.getByLabelText('Leyenda del mapa')).not.toHaveTextContent('Casa del Mar');
    expect(screen.getByRole('img', { name: /emblema de casa de toledo.*asedio activo/i })).toBeInTheDocument();
  });

  it('selects a province from the geographic map', async () => {
    const user = userEvent.setup();
    render(<TerritoriosGame />);

    const madrid = await screen.findByRole('button', {
      name: /seleccionar madrid/i,
    });
    expect(madrid).toHaveAccessibleName(
      /control: casa de madrid.*estado: bajo tu control.*defensa: 7\.000/i,
    );
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
    expect(screen.getByText(/\+50 refuerzos · bando atacante/i)).toBeInTheDocument();
    expect(screen.getByText('Poder 7.000 → 7.050')).toBeInTheDocument();
    expect(screen.getByText(/tick autoritativo/i)).toBeInTheDocument();
  });

  it('clears stale command feedback when the player changes province or active front', async () => {
    const observerFront = {
      ...gameSnapshot.battles[0],
      id: 'battle-araba-burgos',
      campaignId: 'campaign-2',
      originName: 'Araba/Álava',
      targetName: 'Burgos',
      originTerritoryCode: '01',
      targetTerritoryCode: '09',
      viewerSide: null,
      canSupport: false,
      supportDisabledReason: 'not-party',
    };
    const multiple = { ...gameSnapshot, battles: [gameSnapshot.battles[0], observerFront] };
    const supportedMultiple = {
      ...supportedSnapshot,
      battles: [supportedSnapshot.battles[0], observerFront],
    };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('provinces.geojson')) return { ok: true, json: async () => provinces };
      if (url === '/api/game/support' && init?.method === 'POST') {
        return { ok: true, json: async () => supportedMultiple };
      }
      if (url === '/api/community') throw new Error('unavailable');
      return { ok: true, json: async () => multiple };
    }));

    const user = userEvent.setup();
    render(<TerritoriosGame />);
    await user.click(await screen.findByRole('button', { name: /enviar 50 refuerzos/i }));
    expect(await screen.findByText(/\+50 refuerzos · bando atacante/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Frente activo'), 'battle-araba-burgos');
    expect(screen.queryByText(/\+50 refuerzos · bando atacante/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /seleccionar madrid/i }));
    expect(screen.queryByText(/\+50 refuerzos · bando atacante/i)).not.toBeInTheDocument();
  });

  it('keeps the reinforcement route explicit when the selected province is the battle origin', async () => {
    const user = userEvent.setup();
    render(<TerritoriosGame />);

    await user.click(await screen.findByRole('button', { name: /seleccionar madrid/i }));

    expect(screen.getByText('Madrid → Toledo', { selector: '.support-route strong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar 50 refuerzos.*madrid.*toledo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /seleccionar madrid/i })).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('button', { name: /seleccionar madrid/i })).toHaveAttribute('data-front-origin', 'true');
    expect(screen.getByRole('button', { name: /seleccionar toledo/i })).not.toHaveAttribute('data-selected');
    expect(screen.getByRole('button', { name: /seleccionar toledo/i })).toHaveAttribute('data-front-target', 'true');
  });

  it('exposes deterministic text and time controls for browser verification', async () => {
    render(<TerritoriosGame />);
    await screen.findByRole('group', { name: /mapa de territorios/i });

    expect(window.render_game_to_text).toBeTypeOf('function');
    await waitFor(() => {
      expect(JSON.parse(window.render_game_to_text()).mode).toBe('live-world');
    });
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
        if (String(input) === '/api/game') return { ok: false };
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
    await user.selectOptions(await screen.findByLabelText('Rol de temporada'), 'strategist');
    await user.click(await screen.findByRole('button', { name: /representar toledo/i }));

    expect(await screen.findByText('Ahora representas Toledo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar 50 refuerzos/i })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/game/join',
      expect.objectContaining({ body: expect.stringContaining('"role":"strategist"') }),
    );
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

    expect(madrid).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(madrid, { key: ' ' });
    expect(screen.getByRole('heading', { name: 'Madrid' })).toBeInTheDocument();
    expect(madrid).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(madrid, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: 'Toledo' })).toBeInTheDocument();

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

    const requestFullscreen = vi.fn(async () => undefined);
    Object.defineProperty(document.querySelector('.game-shell'), 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa' }));
    expect(requestFullscreen).toHaveBeenCalledOnce();
  });

  it('uses server capabilities to select an eligible front and never offers support to an observer', async () => {
    const observerFront = {
      ...gameSnapshot.battles[0],
      id: 'battle-observer',
      campaignId: 'campaign-observer',
      originName: 'Barcelona',
      targetName: 'Valencia',
      originTerritoryCode: '08',
      targetTerritoryCode: '46',
      viewerSide: null,
      canSupport: false,
      supportDisabledReason: 'not-party',
    };
    const multiple = { ...gameSnapshot, battles: [observerFront, gameSnapshot.battles[0]] };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('provinces.geojson')) return { ok: true, json: async () => provinces };
      if (String(input) === '/api/community') throw new Error('unavailable');
      return { ok: true, json: async () => multiple };
    }));

    const user = userEvent.setup();
    render(<TerritoriosGame />);
    const selector = await screen.findByLabelText('Frente activo');
    expect(selector).toHaveValue('battle-madrid-toledo');
    expect(screen.getByRole('group', { name: 'Mis frentes' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Otros frentes' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Atacante · Madrid → Toledo/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Observación · Barcelona → Valencia/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar 50 refuerzos/i })).toBeInTheDocument();

    await user.selectOptions(selector, 'battle-observer');
    expect(screen.getByText('Tu facción no participa en este frente.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enviar 50 refuerzos/i })).not.toBeInTheDocument();
  });

  it('keeps the top resource strip scoped to the viewer home province', async () => {
    const homeAndEnemy = {
      ...gameSnapshot,
      territories: gameSnapshot.territories.map((territory) =>
        territory.code === '45' ? { ...territory, supply: 125 } : territory),
    };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('provinces.geojson')) return { ok: true, json: async () => provinces };
      if (String(input) === '/api/community') throw new Error('unavailable');
      return { ok: true, json: async () => homeAndEnemy };
    }));

    render(<TerritoriosGame initialTerritoryCode="45" />);

    const resources = await screen.findByLabelText(/Recursos propios: Madrid/i);
    expect(resources).toHaveTextContent('1.000Suministros de Madrid');
    expect(resources).not.toHaveTextContent('125Suministros de Toledo');
  });

  it('opens working help, profile, and province sharing controls', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: share,
    });
    render(<TerritoriosGame initialTerritoryCode="28" />);

    const helpTrigger = await screen.findByRole('button', { name: 'Mostrar ayuda del mapa' });
    await user.click(helpTrigger);
    expect(screen.getByRole('dialog', { name: 'Cómo usar el mapa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Cómo usar el mapa' })).not.toBeInTheDocument();
    expect(helpTrigger).toHaveFocus();

    const profileTrigger = screen.getByRole('button', { name: 'Abrir perfil' });
    await user.click(profileTrigger);
    expect(screen.getByRole('dialog', { name: 'Perfil de temporada' })).toHaveTextContent('Jugadora de prueba');
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(profileTrigger).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Opciones de provincia' }));
    await user.click(screen.getByRole('button', { name: 'Pedir refuerzos' }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Madrid — Territorios',
      url: expect.stringMatching(/\/province\/28$/),
    }));
    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/province\/28$/));
    expect(screen.getByRole('link', { name: 'Compartir por WhatsApp' })).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/?text='),
    );
    expect(screen.getByRole('link', { name: 'Compartir en X' })).toHaveAttribute(
      'href',
      expect.stringContaining('https://twitter.com/intent/tweet'),
    );
  });

  it('forces a world refresh immediately after the authoritative tick time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(gameSnapshot.serverTime);
    const nearTick = {
      ...gameSnapshot,
      season: { ...gameSnapshot.season, nextTickAt: gameSnapshot.serverTime + 2_000 },
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('provinces.geojson')) return { ok: true, json: async () => provinces };
      if (url === '/api/game') return { ok: true, json: async () => nearTick };
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(<TerritoriosGame />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const initialGameRequests = fetchMock.mock.calls.filter(([url]) => String(url) === '/api/game').length;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_800);
      });

      expect(fetchMock.mock.calls.filter(([url]) => String(url) === '/api/game').length)
        .toBeGreaterThan(initialGameRequests);
    } finally {
      vi.useRealTimers();
    }
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
    const provinceOne = await screen.findByRole('button', { name: /Seleccionar Provincia 01/i });
    fireEvent.keyDown(provinceOne, { key: 'Enter' });
    expect(screen.getByText('Provincia neutral')).toBeInTheDocument();

    const before = window.render_game_to_text();
    act(() => window.advanceTime(Number.NaN));
    act(() => window.advanceTime(-1));
    expect(window.render_game_to_text()).toBe(before);
  });
});
