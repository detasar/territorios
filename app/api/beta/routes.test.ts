import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BETA_OPERATIONS } from '../../../src/beta/config';

const mocks = vi.hoisted(() => ({
  getChatGPTUser: vi.fn(),
  upsertUser: vi.fn(),
  recordBetaConsent: vi.fn(),
  recordBetaRequest: vi.fn(),
  recordBetaMetric: vi.fn(),
  BetaCommandError: class BetaCommandError extends Error {
    constructor(
      message: string,
      readonly status: 400 | 403 | 429,
    ) {
      super(message);
    }
  },
}));

vi.mock('../../chatgpt-auth', () => ({ getChatGPTUser: mocks.getChatGPTUser }));
vi.mock('../../../db/game', () => ({ upsertUser: mocks.upsertUser }));
vi.mock('../../../db/beta', () => ({
  recordBetaConsent: mocks.recordBetaConsent,
  recordBetaRequest: mocks.recordBetaRequest,
  recordBetaMetric: mocks.recordBetaMetric,
  BetaCommandError: mocks.BetaCommandError,
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

  it('applies mutation guards before authentication or storage', async () => {
    const guarded = new Request('http://localhost/api/beta/consent', {
      method: 'POST',
      headers: { 'content-type': 'text/plain', origin: 'http://localhost' },
      body: '{}',
    });

    const response = await consent(guarded);

    expect(response.status).toBe(415);
    expect(mocks.getChatGPTUser).not.toHaveBeenCalled();
    expect(mocks.recordBetaConsent).not.toHaveBeenCalled();
  });

  it('keeps anonymous metrics content-free and non-identifying', async () => {
    mocks.getChatGPTUser.mockResolvedValue(null);

    const response = await metric(post('/api/beta/metric', { event: 'share-opened' }));

    expect(response.status).toBe(204);
    expect(mocks.upsertUser).not.toHaveBeenCalled();
    expect(mocks.recordBetaMetric).not.toHaveBeenCalled();
  });

  it('rejects invalid request and metric vocabularies', async () => {
    const requestResponse = await requestHelp(post('/api/beta/request', {
      category: 'privacy-delete',
      issueCode: 'free-form-message',
    }));
    const metricResponse = await metric(post('/api/beta/metric', { event: 'email-address' }));

    expect(requestResponse.status).toBe(400);
    expect(metricResponse.status).toBe(400);
    expect(mocks.recordBetaRequest).not.toHaveBeenCalled();
    expect(mocks.recordBetaMetric).not.toHaveBeenCalled();
  });

  it('returns bounded command errors without losing their status', async () => {
    mocks.recordBetaConsent.mockRejectedValueOnce(
      new mocks.BetaCommandError('Consentimiento duplicado.', 429),
    );
    mocks.recordBetaRequest.mockRejectedValueOnce(
      new mocks.BetaCommandError('Acepta primero la beta.', 403),
    );

    const consentResponse = await consent(post('/api/beta/consent', {
      ageConfirmed: true,
      consentAccepted: true,
      consentVersion: BETA_OPERATIONS.consentVersion,
    }));
    const requestResponse = await requestHelp(post('/api/beta/request', {
      category: 'privacy-access',
      issueCode: 'export-my-data',
    }));

    expect(consentResponse.status).toBe(429);
    expect(await consentResponse.json()).toEqual({ error: 'Consentimiento duplicado.' });
    expect(requestResponse.status).toBe(403);
    expect(await requestResponse.json()).toEqual({ error: 'Acepta primero la beta.' });
  });

  it('fails closed for consent and requests while metrics stay non-blocking', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.recordBetaConsent.mockRejectedValueOnce(new Error('database unavailable'));
    mocks.recordBetaRequest.mockRejectedValueOnce(new Error('database unavailable'));
    mocks.recordBetaMetric.mockRejectedValueOnce(new Error('database unavailable'));

    const consentResponse = await consent(post('/api/beta/consent', {
      ageConfirmed: true,
      consentAccepted: true,
      consentVersion: BETA_OPERATIONS.consentVersion,
    }));
    const requestResponse = await requestHelp(post('/api/beta/request', {
      category: 'security',
      issueCode: 'account-safety',
    }));
    const metricResponse = await metric(post('/api/beta/metric', { event: 'client-error' }));

    expect(consentResponse.status).toBe(500);
    expect(requestResponse.status).toBe(500);
    expect(metricResponse.status).toBe(204);
    expect(errorSpy).toHaveBeenCalledTimes(3);
    errorSpy.mockRestore();
  });
});
