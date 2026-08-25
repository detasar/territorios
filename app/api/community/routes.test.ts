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
    GameCommandError,
    getChatGPTUser: vi.fn(),
    getCommunitySnapshot: vi.fn(),
    castCouncilBallot: vi.fn(),
    executeRoleAction: vi.fn(),
    publishAnnouncement: vi.fn(),
    voteAnnouncement: vi.fn(),
    submitReport: vi.fn(),
    setSafetyAction: vi.fn(),
    updateNotificationPreferences: vi.fn(),
    upsertUser: vi.fn(),
  };
});

vi.mock('../../chatgpt-auth', () => ({ getChatGPTUser: mocks.getChatGPTUser }));
vi.mock('../../../db/community', () => ({
  castCouncilBallot: mocks.castCouncilBallot,
  executeRoleAction: mocks.executeRoleAction,
  getCommunitySnapshot: mocks.getCommunitySnapshot,
  publishAnnouncement: mocks.publishAnnouncement,
  setSafetyAction: mocks.setSafetyAction,
  submitReport: mocks.submitReport,
  updateNotificationPreferences: mocks.updateNotificationPreferences,
  voteAnnouncement: mocks.voteAnnouncement,
}));
vi.mock('../../../db/game', () => ({
  GameCommandError: mocks.GameCommandError,
  upsertUser: mocks.upsertUser,
}));

import { GET } from './route';
import { POST as ballot } from './ballot/route';
import { POST as announcement } from './announcement/route';
import { POST as announcementVote } from './announcement/vote/route';
import { POST as preferences } from './preferences/route';
import { POST as report } from './report/route';
import { POST as roleAction } from './role-action/route';
import { POST as safety } from './safety/route';

const identity = {
  userId: 'user-community-test',
  email: 'community@example.test',
  displayName: 'Community Test',
};
const snapshot = { mode: 'live-community', council: { seats: [] } };

function request(path: string, body: unknown, headers: HeadersInit = {}) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost',
      'idempotency-key': 'community-route-test',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const validCases = [
  {
    path: '/api/community/ballot',
    handler: ballot,
    command: { territoryCode: '28', electionKind: 'representative', rankedChoices: ['abcdef0123456789'] },
    mock: mocks.castCouncilBallot,
  },
  {
    path: '/api/community/announcement',
    handler: announcement,
    command: { territoryCode: '28', messageKey: 'DEFEND_HERE' },
    mock: mocks.publishAnnouncement,
  },
  {
    path: '/api/community/announcement/vote',
    handler: announcementVote,
    command: { announcementId: 'announcement-test', direction: 'up' },
    mock: mocks.voteAnnouncement,
  },
  {
    path: '/api/community/report',
    handler: report,
    command: { targetType: 'announcement', targetId: 'announcement-test', reason: 'other' },
    mock: mocks.submitReport,
  },
  {
    path: '/api/community/role-action',
    handler: roleAction,
    command: { territoryCode: '28' },
    mock: mocks.executeRoleAction,
  },
  {
    path: '/api/community/safety',
    handler: safety,
    command: { targetRef: 'abcdef0123456789', action: 'mute' },
    mock: mocks.setSafetyAction,
  },
  {
    path: '/api/community/preferences',
    handler: preferences,
    command: { locale: 'es', quietHoursStart: 22, quietHoursEnd: 8, maxWarAlertsPerDay: 1, councilAlerts: true },
    mock: mocks.updateNotificationPreferences,
  },
] as const;

describe('community API routes', () => {
  beforeEach(() => {
    mocks.getChatGPTUser.mockResolvedValue(identity);
    mocks.getCommunitySnapshot.mockResolvedValue(snapshot);
    mocks.upsertUser.mockResolvedValue(undefined);
    mocks.castCouncilBallot.mockResolvedValue(snapshot);
    mocks.executeRoleAction.mockResolvedValue(snapshot);
    mocks.publishAnnouncement.mockResolvedValue(snapshot);
    mocks.voteAnnouncement.mockResolvedValue(snapshot);
    mocks.submitReport.mockResolvedValue({ reportId: 'report-test', status: 'queued-for-human-review' });
    mocks.setSafetyAction.mockResolvedValue(snapshot);
    mocks.updateNotificationPreferences.mockResolvedValue(snapshot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('returns private authenticated and anonymous community snapshots', async () => {
    const authenticated = await GET();
    expect(authenticated.status).toBe(200);
    expect(authenticated.headers.get('cache-control')).toContain('no-store');
    expect(mocks.upsertUser).toHaveBeenCalledWith(identity, expect.any(Number));

    mocks.getChatGPTUser.mockResolvedValue(null);
    const anonymous = await GET();
    expect(anonymous.status).toBe(200);
    expect(mocks.getCommunitySnapshot).toHaveBeenLastCalledWith(null, expect.any(Number));
  });

  it('fails closed without leaking snapshot failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.getCommunitySnapshot.mockRejectedValue(new Error('private database detail'));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'No se pudo cargar la comunidad.' });
  });

  it('rejects invalid content types before looking up identity', async () => {
    const response = await ballot(
      request('/api/community/ballot', {}, { 'content-type': 'text/plain' }),
    );
    expect(response.status).toBe(415);
    expect(mocks.getChatGPTUser).not.toHaveBeenCalled();
  });

  it('requires authentication on every community mutation', async () => {
    mocks.getChatGPTUser.mockResolvedValue(null);
    for (const entry of validCases) {
      const response = await entry.handler(request(entry.path, entry.command));
      expect(response.status, entry.path).toBe(401);
    }
  });

  it('validates and forwards every community command', async () => {
    for (const entry of validCases) {
      const response = await entry.handler(request(entry.path, entry.command));
      expect(response.status, entry.path).toBe(entry.path.endsWith('/report') ? 202 : 200);
      expect(entry.mock, entry.path).toHaveBeenCalled();
    }
    expect(mocks.castCouncilBallot).toHaveBeenCalledWith(identity, validCases[0].command, 'community-route-test');
    expect(mocks.publishAnnouncement).toHaveBeenCalledWith(identity, validCases[1].command, 'community-route-test');
    expect(mocks.submitReport).toHaveBeenCalledWith(identity, validCases[3].command, 'community-route-test');
  });

  it('returns narrow validation failures for every malformed command', async () => {
    for (const entry of validCases) {
      const response = await entry.handler(request(entry.path, {}));
      expect(response.status, entry.path).toBe(400);
    }
  });

  it('preserves intentional game errors on every command', async () => {
    for (const entry of validCases) {
      entry.mock.mockRejectedValueOnce(new mocks.GameCommandError('Acción bloqueada.', 409));
      const response = await entry.handler(request(entry.path, entry.command));
      expect(response.status, entry.path).toBe(409);
      expect(await response.json()).toEqual({ error: 'Acción bloqueada.' });
    }
  });

  it('does not expose unexpected command errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const entry of validCases) {
      entry.mock.mockRejectedValueOnce(new Error('private implementation detail'));
      const response = await entry.handler(request(entry.path, entry.command));
      expect(response.status, entry.path).toBe(500);
      expect(JSON.stringify(await response.json()), entry.path).not.toContain('implementation');
    }
  });
});
