import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class PaymentCommandError extends Error {
    constructor(
      message: string,
      readonly status: 400 | 403 | 404 | 409 | 429,
    ) {
      super(message);
    }
  }
  class StripeConfigurationError extends Error {}

  return {
    PaymentCommandError,
    StripeConfigurationError,
    createPaymentCheckout: vi.fn(),
    getChatGPTUser: vi.fn(),
    getPaymentSnapshot: vi.fn(),
    processStripeEvent: vi.fn(),
    updatePaymentControls: vi.fn(),
    verifyStripeWebhook: vi.fn(),
  };
});

vi.mock('../../chatgpt-auth', () => ({ getChatGPTUser: mocks.getChatGPTUser }));
vi.mock('../../../db/payments', () => ({
  PaymentCommandError: mocks.PaymentCommandError,
  createPaymentCheckout: mocks.createPaymentCheckout,
  getPaymentSnapshot: mocks.getPaymentSnapshot,
  processStripeEvent: mocks.processStripeEvent,
  updatePaymentControls: mocks.updatePaymentControls,
}));
vi.mock('../../../src/server/stripe', () => ({
  StripeConfigurationError: mocks.StripeConfigurationError,
  verifyStripeWebhook: mocks.verifyStripeWebhook,
}));

import { GET } from './route';
import { POST as checkout } from './checkout/route';
import { POST as controls } from './controls/route';
import { POST as webhook } from './webhook/route';

const identity = {
  userId: 'user-payment-route',
  email: 'payment@example.test',
  displayName: 'Payment Test',
};

function jsonRequest(path: string, body: unknown, headers: HeadersInit = {}) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': 'payment-route-test',
      origin: 'http://localhost',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('payment API routes', () => {
  beforeEach(() => {
    mocks.getChatGPTUser.mockResolvedValue(identity);
    mocks.getPaymentSnapshot.mockResolvedValue({ mode: 'live-payments', sandbox: true });
    mocks.createPaymentCheckout.mockResolvedValue({
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_example',
      purchaseId: 'purchase-test',
    });
    mocks.updatePaymentControls.mockResolvedValue({ mode: 'live-payments', sandbox: true });
    mocks.verifyStripeWebhook.mockResolvedValue({
      id: 'evt_test_paid',
      livemode: false,
      type: 'checkout_paid',
    });
    mocks.processStripeEvent.mockResolvedValue({ duplicate: false, status: 'processed' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('returns an authenticated no-store sandbox snapshot', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toEqual({ mode: 'live-payments', sandbox: true });
    expect(mocks.getPaymentSnapshot).toHaveBeenCalledWith(identity);
  });

  it('keeps private purchase data behind ChatGPT authentication', async () => {
    mocks.getChatGPTUser.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.getPaymentSnapshot).not.toHaveBeenCalled();
  });

  it('does not leak private snapshot failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.getPaymentSnapshot.mockRejectedValue(new Error('private D1 layout'));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('layout');
  });

  it('creates checkout only after origin, JSON, idempotency, auth, and consent checks', async () => {
    const response = await checkout(jsonRequest('/api/payments/checkout', {
      ageConfirmed: true,
      consentAccepted: true,
      consentVersion: 'paid-beta-2026-08-25',
      productId: 'local-support',
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_example',
      mode: 'sandbox',
      purchaseId: 'purchase-test',
    });
    expect(mocks.createPaymentCheckout).toHaveBeenCalledWith(
      identity,
      {
        ageConfirmed: true,
        consentAccepted: true,
        consentVersion: 'paid-beta-2026-08-25',
        productId: 'local-support',
      },
      'payment-route-test',
      'http://localhost',
    );
  });

  it('does not accept malformed or cross-origin checkout commands', async () => {
    const malformed = await checkout(jsonRequest('/api/payments/checkout', {
      ageConfirmed: false,
      consentAccepted: true,
      consentVersion: 'wrong',
      productId: '../price',
    }));
    const crossOrigin = await checkout(jsonRequest(
      '/api/payments/checkout',
      { ageConfirmed: true, consentAccepted: true, consentVersion: 'paid-beta-2026-08-25', productId: 'local-support' },
      { origin: 'https://evil.example' },
    ));

    expect(malformed.status).toBe(400);
    expect(crossOrigin.status).toBe(403);
    expect(mocks.createPaymentCheckout).not.toHaveBeenCalled();
  });

  it('reports unavailable sandbox configuration without leaking environment details', async () => {
    mocks.createPaymentCheckout.mockRejectedValue(new mocks.StripeConfigurationError('secret missing'));

    const response = await checkout(jsonRequest('/api/payments/checkout', {
      ageConfirmed: true,
      consentAccepted: true,
      consentVersion: 'paid-beta-2026-08-25',
      productId: 'local-support',
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Stripe sandbox todavía no está configurado.' });
  });

  it('requires authentication for checkout and preserves bounded payment policy errors', async () => {
    mocks.getChatGPTUser.mockResolvedValueOnce(null);
    const unauthenticated = await checkout(jsonRequest('/api/payments/checkout', {
      ageConfirmed: true,
      consentAccepted: true,
      consentVersion: 'paid-beta-2026-08-25',
      productId: 'local-support',
    }));
    mocks.getChatGPTUser.mockResolvedValueOnce(identity);
    mocks.createPaymentCheckout.mockRejectedValueOnce(
      new mocks.PaymentCommandError('Límite diario alcanzado.', 409),
    );
    const policy = await checkout(jsonRequest('/api/payments/checkout', {
      ageConfirmed: true,
      consentAccepted: true,
      consentVersion: 'paid-beta-2026-08-25',
      productId: 'local-support',
    }));

    expect(unauthenticated.status).toBe(401);
    expect(policy.status).toBe(409);
    expect(await policy.json()).toEqual({ error: 'Límite diario alcanzado.' });
  });

  it('returns a generic checkout error for unexpected provider or database failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.createPaymentCheckout.mockRejectedValue(new Error('provider topology'));

    const response = await checkout(jsonRequest('/api/payments/checkout', {
      ageConfirmed: true,
      consentAccepted: true,
      consentVersion: 'paid-beta-2026-08-25',
      productId: 'local-support',
    }));

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('topology');
  });

  it('lets a user pause or lower spending limits but delegates policy enforcement to D1', async () => {
    const command = {
      purchasesPaused: true,
      dailySpendLimitCents: 2_500,
      seasonSpendLimitCents: 8_000,
    };
    const response = await controls(jsonRequest('/api/payments/controls', command));

    expect(response.status).toBe(200);
    expect(mocks.updatePaymentControls).toHaveBeenCalledWith(
      identity,
      command,
      'payment-route-test',
    );
  });

  it('validates, authenticates, and safely reports control update failures', async () => {
    const malformed = await controls(jsonRequest('/api/payments/controls', {
      purchasesPaused: false,
      dailySpendLimitCents: 8_000,
      seasonSpendLimitCents: 1_000,
    }));
    mocks.getChatGPTUser.mockResolvedValueOnce(null);
    const unauthenticated = await controls(jsonRequest('/api/payments/controls', {
      purchasesPaused: true,
      dailySpendLimitCents: 2_000,
      seasonSpendLimitCents: 5_000,
    }));
    mocks.getChatGPTUser.mockResolvedValueOnce(identity);
    mocks.updatePaymentControls.mockRejectedValueOnce(
      new mocks.PaymentCommandError('Cuenta en revisión.', 403),
    );
    const reviewed = await controls(jsonRequest('/api/payments/controls', {
      purchasesPaused: false,
      dailySpendLimitCents: 2_000,
      seasonSpendLimitCents: 5_000,
    }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.getChatGPTUser.mockResolvedValueOnce(identity);
    mocks.updatePaymentControls.mockRejectedValueOnce(new Error('private control failure'));
    const unexpected = await controls(jsonRequest('/api/payments/controls', {
      purchasesPaused: true,
      dailySpendLimitCents: 2_000,
      seasonSpendLimitCents: 5_000,
    }));

    expect(malformed.status).toBe(400);
    expect(unauthenticated.status).toBe(401);
    expect(reviewed.status).toBe(403);
    expect(unexpected.status).toBe(500);
    expect(JSON.stringify(await unexpected.json())).not.toContain('private');
  });

  it('verifies the raw webhook body and never requires browser mutation headers', async () => {
    const body = JSON.stringify({ id: 'evt_test_paid', type: 'checkout.session.completed' });
    const request = new Request('http://localhost/api/payments/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=test' },
      body,
    });

    const response = await webhook(request);

    expect(response.status).toBe(200);
    expect(mocks.verifyStripeWebhook).toHaveBeenCalledWith(body, 't=1,v1=test');
    expect(mocks.processStripeEvent).toHaveBeenCalledWith(
      { id: 'evt_test_paid', livemode: false, type: 'checkout_paid' },
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });

  it('rejects missing signatures, invalid signatures, and live-mode events', async () => {
    const noSignature = await webhook(new Request('http://localhost/api/payments/webhook', {
      method: 'POST',
      body: '{}',
    }));
    mocks.verifyStripeWebhook.mockRejectedValueOnce(new Error('signature details'));
    const badSignature = await webhook(new Request('http://localhost/api/payments/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'bad' },
      body: '{}',
    }));
    mocks.verifyStripeWebhook.mockResolvedValueOnce({ id: 'evt_live', livemode: true, type: 'ignored' });
    const liveMode = await webhook(new Request('http://localhost/api/payments/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid' },
      body: '{}',
    }));

    expect(noSignature.status).toBe(400);
    expect(badSignature.status).toBe(400);
    expect(liveMode.status).toBe(400);
    expect(JSON.stringify(await badSignature.json())).not.toContain('signature details');
  });

  it('signals missing webhook configuration and retries processing failures safely', async () => {
    mocks.verifyStripeWebhook.mockRejectedValueOnce(
      new mocks.StripeConfigurationError('missing private secret'),
    );
    const unconfigured = await webhook(new Request('http://localhost/api/payments/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid' },
      body: '{}',
    }));

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.verifyStripeWebhook.mockResolvedValueOnce({
      id: 'evt_retry',
      livemode: false,
      type: 'refund_created',
    });
    mocks.processStripeEvent.mockRejectedValueOnce(new Error('private transactional detail'));
    const retry = await webhook(new Request('http://localhost/api/payments/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid' },
      body: '{}',
    }));

    expect(unconfigured.status).toBe(503);
    expect(retry.status).toBe(500);
    expect(JSON.stringify(await retry.json())).not.toContain('transactional');
  });
});
