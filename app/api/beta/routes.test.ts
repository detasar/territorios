import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BETA_OPERATIONS } from '../../../src/beta/config';

const mocks = vi.hoisted(() => ({
  getChatGPTUser: vi.fn(),
  upsertUser: vi.fn(),
  recordBetaConsent: vi.fn(),
  recordBetaRequest: vi.fn(),
  recordBetaMetric: vi.fn(),
}));

vi.mock('../../chatgpt-auth', () => ({ getChatGPTUser: mocks.getChatGPTUser }));
vi.mock('../../../db/game', () => ({ upsertUser: mocks.upsertUser }));
vi.mock('../../../db/beta', () => ({
  recordBetaConsent: mocks.recordBetaConsent,
  recordBetaRequest: mocks.recordBetaRequest,
  recordBetaMetric: mocks.recordBetaMetric,
}));

import { POST as consent } from './consent/route';
import { POST as metric } from './metric/route';
import { POST as requestHelp } from './request/route';

const identity = { userId: 'user-beta', email: 'beta@example.test', displayName: 'Beta Player' };

function post(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost',
      'idempotency-key': 'beta-route-command',
    },
    body: JSON.stringify(body),
  });
}

describe('closed-beta API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getChatGPTUser.mockResolvedValue(identity);
    mocks.upsertUser.mockResolvedValue(undefined);
    mocks.recordBetaConsent.mockResolvedValue({
      version: BETA_OPERATIONS.consentVersion,
      participantId: 'P-1234ABCD',
      consentedAt: 1,
    });
    mocks.recordBetaRequest.mockResolvedValue({ requestId: 'BR-123', reviewWithinHours: 24 });
    mocks.recordBetaMetric.mockResolvedValue(undefined);
  });

  it('records versioned adult consent before participation', async () => {
    const response = await consent(post('/api/beta/consent', {
      ageConfirmed: true,
      consentAccepted: true,
      consentVersion: BETA_OPERATIONS.consentVersion,
    }));
    expect(response.status).toBe(200);
    expect(mocks.upsertUser).toHaveBeenCalledWith(identity);
    expect(mocks.recordBetaConsent).toHaveBeenCalledWith(identity.userId, 'beta-route-command');
    expect(await response.json()).toMatchObject({ participantId: 'P-1234ABCD' });
  });

  it('rejects missing age confirmation and anonymous requests', async () => {
    const invalid = await consent(post('/api/beta/consent', {
      ageConfirmed: false,
      consentAccepted: true,
      consentVersion: BETA_OPERATIONS.consentVersion,
    }));
    expect(invalid.status).toBe(400);

    mocks.getChatGPTUser.mockResolvedValue(null);
    const anonymous = await requestHelp(post('/api/beta/request', {
      category: 'privacy-access',
      issueCode: 'export-my-data',
    }));
    expect(anonymous.status).toBe(401);
  });

  it('queues a bounded privacy request and content-free metric', async () => {
    const requestResponse = await requestHelp(post('/api/beta/request', {
      category: 'privacy-delete',
      issueCode: 'leave-beta',
    }));
    expect(requestResponse.status).toBe(202);
    expect(mocks.recordBetaRequest).toHaveBeenCalledWith(
      identity.userId,
      { category: 'privacy-delete', issueCode: 'leave-beta' },
      'beta-route-command',
    );

    const metricResponse = await metric(post('/api/beta/metric', { event: 'share-opened' }));
    expect(metricResponse.status).toBe(204);
    expect(mocks.recordBetaMetric).toHaveBeenCalledWith(identity.userId, 'share-opened', 'beta-route-command');
  });
});
