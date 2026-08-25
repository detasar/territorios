import { describe, expect, it, vi } from 'vitest';

vi.mock('../../chatgpt-auth', () => ({ getChatGPTUser: vi.fn() }));
vi.mock('../../../db/payments', () => ({
  getPaymentSnapshot: vi.fn(),
  createPaymentCheckout: vi.fn(),
  updatePaymentControls: vi.fn(),
  processStripeEvent: vi.fn(),
  PaymentCommandError: class PaymentCommandError extends Error {},
}));
vi.mock('../../../src/server/stripe', () => ({
  verifyStripeWebhook: vi.fn(),
  StripeConfigurationError: class StripeConfigurationError extends Error {},
}));

import { GET } from './route';
import { POST as checkout } from './checkout/route';
import { POST as webhook } from './webhook/route';

describe('closed-beta payment boundary', () => {
  it('does not expose payment snapshots, checkout, or webhooks', async () => {
    const [snapshot, checkoutResponse, webhookResponse] = await Promise.all([
      GET(),
      checkout(new Request('http://localhost/api/payments/checkout', { method: 'POST' })),
      webhook(new Request('http://localhost/api/payments/webhook', { method: 'POST' })),
    ]);
    expect([snapshot.status, checkoutResponse.status, webhookResponse.status]).toEqual([404, 404, 404]);
    expect(await snapshot.json()).toEqual({ error: 'Payments are disabled for this closed beta.' });
  });
});
