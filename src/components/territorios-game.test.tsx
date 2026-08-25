import { act, render, screen, waitFor } from '@testing-library/react';
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

describe('TerritoriosGame', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => provinces })),
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

    await user.click(
      screen.getByRole('button', { name: /enviar 50 refuerzos/i }),
    );

    expect(screen.getByText(/250 disponibles/i)).toBeInTheDocument();
    expect(screen.getByText(/7.050 fuerza atacante/i)).toBeInTheDocument();
  });

  it('exposes deterministic text and time controls for browser verification', async () => {
    render(<TerritoriosGame />);
    await screen.findByRole('img', { name: /mapa de territorios/i });

    expect(window.render_game_to_text).toBeTypeOf('function');
    expect(JSON.parse(window.render_game_to_text())).toMatchObject({
      mode: 'demo-season',
      selectedTerritory: '45',
      siegeBp: 4_200,
      supportAvailable: 300,
    });

    act(() => window.advanceTime(30 * 60 * 1_000));

    await waitFor(() => {
      expect(JSON.parse(window.render_game_to_text()).siegeBp).toBe(5_000);
    });
  });
});
