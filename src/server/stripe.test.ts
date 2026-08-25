import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getStripeClient,
  isStripeSandboxConfigured,
  normalizeStripeEvent,
  StripeConfigurationError,
  verifyStripePayload,
  verifyStripeWebhook,
} from './stripe';

const cloudflare = vi.hoisted(() => ({
  env: {} as { STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string },
}));
vi.mock('cloudflare:workers', () => ({ env: cloudflare.env }));

const stripe = new Stripe(`sk_${'test'}_unit_only`, {
  httpClient: Stripe.createFetchHttpClient(),
});
const webhookSecret = 'unit_only_webhook_secret';

function eventPayload(type: string, object: Record<string, unknown>) {
  return JSON.stringify({
    id: `evt_${type.replaceAll('.', '_')}`,
    object: 'event',
    api_version: '2025-08-27.basil',
    created: 1_777_000_000,
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
  });
}

describe('Stripe webhook verification', () => {
  beforeEach(() => {
    delete cloudflare.env.STRIPE_SECRET_KEY;
    delete cloudflare.env.STRIPE_WEBHOOK_SECRET;
  });

  it('accepts an SDK-signed raw test payload and normalizes paid checkout', async () => {
    const payload = eventPayload('checkout.session.completed', {
      id: 'cs_test_signed',
      object: 'checkout.session',
      amount_total: 499,
      currency: 'eur',
      livemode: false,
      metadata: { purchase_id: 'purchase-signed' },
      payment_intent: 'pi_test_signed',
      payment_status: 'paid',
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
      timestamp: Math.floor(Date.now() / 1_000),
    });

    await expect(verifyStripePayload(payload, signature, webhookSecret, stripe)).resolves.toEqual({
      id: 'evt_checkout_session_completed',
      livemode: false,
      type: 'checkout_paid',
      purchaseId: 'purchase-signed',
      sessionId: 'cs_test_signed',
      paymentIntentId: 'pi_test_signed',
      amountCents: 499,
      currency: 'eur',
    });
  });

  it('rejects a body changed after signature generation', async () => {
    const payload = eventPayload('checkout.session.expired', {
      id: 'cs_test_expired',
      object: 'checkout.session',
      metadata: { purchase_id: 'purchase-expired' },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
      timestamp: Math.floor(Date.now() / 1_000),
    });

    await expect(
      verifyStripePayload(`${payload} `, signature, webhookSecret, stripe),
    ).rejects.toThrow();
  });

  it('fails closed unless both a test-mode key and webhook secret exist', () => {
    expect(isStripeSandboxConfigured()).toBe(false);
    expect(() => getStripeClient()).toThrow(StripeConfigurationError);

    cloudflare.env.STRIPE_SECRET_KEY = `sk_${'live'}_not_allowed`;
    cloudflare.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    expect(isStripeSandboxConfigured()).toBe(false);
    expect(() => getStripeClient()).toThrow(StripeConfigurationError);

    cloudflare.env.STRIPE_SECRET_KEY = `sk_${'test'}_unit_only`;
    expect(isStripeSandboxConfigured()).toBe(true);
    expect(getStripeClient()).toBeInstanceOf(Stripe);
  });

  it('verifies through the runtime-configured test-mode path', async () => {
    cloudflare.env.STRIPE_SECRET_KEY = `sk_${'test'}_unit_only`;
    cloudflare.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    const payload = eventPayload('checkout.session.expired', {
      id: 'cs_test_expired_runtime',
      object: 'checkout.session',
      metadata: { purchase_id: 'purchase-expired-runtime' },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
      timestamp: Math.floor(Date.now() / 1_000),
    });

    await expect(verifyStripeWebhook(payload, signature)).resolves.toMatchObject({
      type: 'checkout_expired',
      purchaseId: 'purchase-expired-runtime',
    });
  });

  it('requires the runtime webhook secret before signature work', async () => {
    cloudflare.env.STRIPE_SECRET_KEY = `sk_${'test'}_unit_only`;
    await expect(verifyStripeWebhook('{}', 'signature')).rejects.toBeInstanceOf(
      StripeConfigurationError,
    );
  });
});

describe('Stripe event normalization', () => {
  it('normalizes refunds without copying billing or card data', () => {
    const event = JSON.parse(eventPayload('refund.created', {
      id: 're_test',
      object: 'refund',
      amount: 250,
      currency: 'EUR',
      payment_intent: 'pi_test_refund',
    })) as Stripe.Event;

    expect(normalizeStripeEvent(event)).toEqual({
      id: 'evt_refund_created',
      livemode: false,
      type: 'refund_created',
      paymentIntentId: 'pi_test_refund',
      amountCents: 250,
      currency: 'eur',
    });
  });

  it.each([
    ['charge.dispute.created', 'needs_response', 'dispute_opened'],
    ['charge.dispute.closed', 'won', 'dispute_won'],
    ['charge.dispute.closed', 'lost', 'dispute_lost'],
  ])('normalizes %s status %s', (type, status, normalizedType) => {
    const event = JSON.parse(eventPayload(type, {
      id: 'dp_test',
      object: 'dispute',
      amount: 499,
      currency: 'eur',
      payment_intent: 'pi_test_dispute',
      status,
    })) as Stripe.Event;

    expect(normalizeStripeEvent(event)).toMatchObject({
      type: normalizedType,
      paymentIntentId: 'pi_test_dispute',
      amountCents: 499,
    });
  });

  it('marks unrelated provider events ignored', () => {
    const event = JSON.parse(eventPayload('customer.created', {
      id: 'cus_test',
      object: 'customer',
    })) as Stripe.Event;

    expect(normalizeStripeEvent(event)).toMatchObject({
      type: 'ignored',
      providerType: 'customer.created',
    });
  });

  it.each([
    'checkout.session.expired',
    'checkout.session.async_payment_failed',
  ])('closes an unfulfilled purchase on %s', (type) => {
    const event = JSON.parse(eventPayload(type, {
      id: 'cs_test_closed',
      object: 'checkout.session',
      metadata: { purchase_id: 'purchase-closed' },
    })) as Stripe.Event;

    expect(normalizeStripeEvent(event)).toEqual({
      id: `evt_${type.replaceAll('.', '_')}`,
      livemode: false,
      type: 'checkout_expired',
      purchaseId: 'purchase-closed',
      sessionId: 'cs_test_closed',
    });
  });

  it('ignores unpaid checkout and an unresolved closed dispute', () => {
    const unpaid = JSON.parse(eventPayload('checkout.session.completed', {
      id: 'cs_test_unpaid',
      object: 'checkout.session',
      payment_status: 'unpaid',
    })) as Stripe.Event;
    const unresolved = JSON.parse(eventPayload('charge.dispute.closed', {
      id: 'dp_test_unresolved',
      object: 'dispute',
      amount: 499,
      currency: 'eur',
      payment_intent: null,
      status: 'warning_closed',
    })) as Stripe.Event;

    expect(normalizeStripeEvent(unpaid)).toMatchObject({ type: 'ignored' });
    expect(normalizeStripeEvent(unresolved)).toMatchObject({ type: 'ignored' });
  });
});
