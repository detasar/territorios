import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class GameCommandError extends Error {
    constructor(
      message: string,
      readonly status: 400 | 401 | 403 | 404 | 409 | 429,
    ) {
      super(message);
    }
  }

  return {
    ensureWorld: vi.fn(),
    getChatGPTUser: vi.fn(),
    getWorldSnapshot: vi.fn(),
    upsertUser: vi.fn(),
    joinFaction: vi.fn(),
    commitSupport: vi.fn(),
    GameCommandError,
  };
});

vi.mock('../../chatgpt-auth', () => ({ getChatGPTUser: mocks.getChatGPTUser }));
vi.mock('../../../db/world-bootstrap', () => ({ ensureWorld: mocks.ensureWorld }));
vi.mock('../../../db/game', () => ({
  GameCommandError: mocks.GameCommandError,
  commitSupport: mocks.commitSupport,
  getWorldSnapshot: mocks.getWorldSnapshot,
  joinFaction: mocks.joinFaction,
  upsertUser: mocks.upsertUser,
}));

import { GET } from './route';
import { POST as join } from './join/route';
import { POST as support } from './support/route';

const identity = {
  userId: 'user-route-test',
  email: 'route@example.test',
  displayName: 'Route Test',
};

function commandRequest(path: string, body: unknown, headers: HeadersInit = {}) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost',
      'idempotency-key': 'command-route-test',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('game API routes', () => {
  beforeEach(() => {
    mocks.ensureWorld.mockResolvedValue(undefined);
    mocks.getChatGPTUser.mockResolvedValue(identity);
    mocks.getWorldSnapshot.mockResolvedValue({ mode: 'live-world' });
    mocks.upsertUser.mockResolvedValue(undefined);
    mocks.joinFaction.mockResolvedValue({ viewer: { displayName: 'Route Test' } });
    mocks.commitSupport.mockResolvedValue({ viewer: { wallet: { freeSupport: 250 } } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('returns a private authenticated world snapshot', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toEqual({ mode: 'live-world' });
    expect(mocks.upsertUser).toHaveBeenCalledWith(identity, expect.any(Number));
    expect(mocks.getWorldSnapshot).toHaveBeenCalledWith(identity.userId, expect.any(Number));
  });

  it('supports an anonymous world snapshot without creating a user', async () => {
    mocks.getChatGPTUser.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.upsertUser).not.toHaveBeenCalled();
    expect(mocks.getWorldSnapshot).toHaveBeenCalledWith(null, expect.any(Number));
  });

  it('fails closed when the world snapshot cannot be built', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.ensureWorld.mockRejectedValue(new TypeError('private detail'));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'No se pudo cargar el mundo de juego.' });
  });

  it('rejects mutation requests before authentication when the guard fails', async () => {
    const response = await join(
      commandRequest('/api/game/join', { territoryCode: '28' }, { 'content-type': 'text/plain' }),
    );

    expect(response.status).toBe(415);
    expect(mocks.getChatGPTUser).not.toHaveBeenCalled();
  });

  it('requires authentication for faction joins and support', async () => {
    mocks.getChatGPTUser.mockResolvedValue(null);

    const [joinResponse, supportResponse] = await Promise.all([
      join(commandRequest('/api/game/join', { territoryCode: '28' })),
      support(
        commandRequest('/api/game/support', {
          battleId: 'battle-madrid-toledo',
          amount: 50,
          assetKind: 'free_support',
        }),
      ),
    ]);

    expect(joinResponse.status).toBe(401);
    expect(supportResponse.status).toBe(401);
  });

  it('validates and forwards a faction join with its idempotency key', async () => {
    const response = await join(
      commandRequest('/api/game/join', { territoryCode: '28', role: 'strategist' }),
    );

    expect(response.status).toBe(200);
    expect(mocks.joinFaction).toHaveBeenCalledWith(
      identity,
      '28',
      'strategist',
      'command-route-test',
    );
  });

  it('validates and forwards a support command with its idempotency key', async () => {
    const command = {
      battleId: 'battle-madrid-toledo',
      amount: 50,
      assetKind: 'free_support',
    };
    const response = await support(commandRequest('/api/game/support', command));

    expect(response.status).toBe(200);
    expect(mocks.commitSupport).toHaveBeenCalledWith(identity, command, 'command-route-test');
  });

  it('returns narrow validation errors for malformed commands', async () => {
    const [joinResponse, supportResponse] = await Promise.all([
      join(commandRequest('/api/game/join', { territoryCode: 'Madrid' })),
      support(commandRequest('/api/game/support', { amount: -1 })),
    ]);

    expect(joinResponse.status).toBe(400);
    expect(await joinResponse.json()).toEqual({ error: 'Datos de facción inválidos.' });
    expect(supportResponse.status).toBe(400);
    expect(await supportResponse.json()).toEqual({ error: 'Orden de refuerzo inválida.' });
  });

  it('preserves intentional game command errors', async () => {
    mocks.joinFaction.mockRejectedValue(new mocks.GameCommandError('Cambio bloqueado.', 409));
    mocks.commitSupport.mockRejectedValue(new mocks.GameCommandError('Demasiadas órdenes.', 429));

    const [joinResponse, supportResponse] = await Promise.all([
      join(commandRequest('/api/game/join', { territoryCode: '28' })),
      support(
        commandRequest('/api/game/support', {
          battleId: 'battle-madrid-toledo',
          amount: 50,
          assetKind: 'free_support',
        }),
      ),
    ]);

    expect(joinResponse.status).toBe(409);
    expect(await joinResponse.json()).toEqual({ error: 'Cambio bloqueado.' });
    expect(supportResponse.status).toBe(429);
    expect(await supportResponse.json()).toEqual({ error: 'Demasiadas órdenes.' });
  });

  it('does not leak unexpected command failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.joinFaction.mockRejectedValue(new Error('database topology'));
    mocks.commitSupport.mockRejectedValue('unknown private failure');

    const [joinResponse, supportResponse] = await Promise.all([
      join(commandRequest('/api/game/join', { territoryCode: '28' })),
      support(
        commandRequest('/api/game/support', {
          battleId: 'battle-madrid-toledo',
          amount: 50,
          assetKind: 'free_support',
        }),
      ),
    ]);

    expect(joinResponse.status).toBe(500);
    expect(supportResponse.status).toBe(500);
    expect(JSON.stringify(await joinResponse.json())).not.toContain('topology');
    expect(JSON.stringify(await supportResponse.json())).not.toContain('private');
  });
});
