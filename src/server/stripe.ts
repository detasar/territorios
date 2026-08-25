import { env } from 'cloudflare:workers';
import Stripe from 'stripe';

export class StripeConfigurationError extends Error {}

export type StripePaymentEvent =
  | {
      id: string;
      livemode: boolean;
      type: 'checkout_paid';
      purchaseId: string | null;
      sessionId: string;
      paymentIntentId: string | null;
      amountCents: number | null;
      currency: string | null;
    }
  | {
      id: string;
      livemode: boolean;
      type: 'checkout_expired';
      purchaseId: string | null;
      sessionId: string;
    }
  | {
      id: string;
      livemode: boolean;
      type: 'refund_created';
      paymentIntentId: string | null;
      amountCents: number;
      currency: string;
    }
  | {
      id: string;
      livemode: boolean;
      type: 'dispute_opened' | 'dispute_won' | 'dispute_lost';
      paymentIntentId: string | null;
      amountCents: number;
      currency: string;
    }
  | {
      id: string;
      livemode: boolean;
      type: 'ignored';
      providerType: string;
    };

type StripeEnv = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
};

function paymentEnv(): StripeEnv {
  return env as unknown as StripeEnv;
}

export function isStripeSandboxConfigured(): boolean {
  const current = paymentEnv();
  return Boolean(
    current.STRIPE_SECRET_KEY?.startsWith('sk_test_') &&
    current.STRIPE_WEBHOOK_SECRET,
  );
}

export function getStripeClient(): Stripe {
  const secretKey = paymentEnv().STRIPE_SECRET_KEY;
  if (!secretKey || !secretKey.startsWith('sk_test_')) {
    throw new StripeConfigurationError('A Stripe test-mode secret key is required.');
  }
  return new Stripe(secretKey, {
    appInfo: { name: 'Territorios', version: '0.1.0' },
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    timeout: 10_000,
  });
}

export async function verifyStripeWebhook(
  rawBody: string,
  signature: string,
): Promise<StripePaymentEvent> {
  const webhookSecret = paymentEnv().STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new StripeConfigurationError('A Stripe webhook secret is required.');
  }
  return verifyStripePayload(rawBody, signature, webhookSecret, getStripeClient());
}

export async function verifyStripePayload(
  rawBody: string,
  signature: string,
  webhookSecret: string,
  stripe: Stripe,
): Promise<StripePaymentEvent> {
  const event = await stripe.webhooks.constructEventAsync(
    rawBody,
    signature,
    webhookSecret,
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
  return normalizeStripeEvent(event);
}

export function normalizeStripeEvent(event: Stripe.Event): StripePaymentEvent {
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object;
    if (session.payment_status !== 'paid') {
      return ignored(event);
    }
    return {
      id: event.id,
      livemode: event.livemode,
      type: 'checkout_paid',
      purchaseId: session.metadata?.purchase_id ?? null,
      sessionId: session.id,
      paymentIntentId: objectId(session.payment_intent),
      amountCents: session.amount_total,
      currency: session.currency?.toLowerCase() ?? null,
    };
  }

  if (
    event.type === 'checkout.session.expired' ||
    event.type === 'checkout.session.async_payment_failed'
  ) {
    const session = event.data.object;
    return {
      id: event.id,
      livemode: event.livemode,
      type: 'checkout_expired',
      purchaseId: session.metadata?.purchase_id ?? null,
      sessionId: session.id,
    };
  }

  if (event.type === 'refund.created') {
    const refund = event.data.object;
    return {
      id: event.id,
      livemode: event.livemode,
      type: 'refund_created',
      paymentIntentId: objectId(refund.payment_intent),
      amountCents: refund.amount,
      currency: refund.currency.toLowerCase(),
    };
  }

  if (event.type === 'charge.dispute.created') {
    const dispute = event.data.object;
    return disputeEvent(event, dispute, 'dispute_opened');
  }

  if (event.type === 'charge.dispute.closed') {
    const dispute = event.data.object;
    if (dispute.status === 'won') return disputeEvent(event, dispute, 'dispute_won');
    if (dispute.status === 'lost') return disputeEvent(event, dispute, 'dispute_lost');
  }

  return ignored(event);
}

function disputeEvent(
  event: Stripe.Event,
  dispute: Stripe.Dispute,
  type: 'dispute_opened' | 'dispute_won' | 'dispute_lost',
): StripePaymentEvent {
  return {
    id: event.id,
    livemode: event.livemode,
    type,
    paymentIntentId: objectId(dispute.payment_intent),
    amountCents: dispute.amount,
    currency: dispute.currency.toLowerCase(),
  };
}

function ignored(event: Stripe.Event): StripePaymentEvent {
  return {
    id: event.id,
    livemode: event.livemode,
    type: 'ignored',
    providerType: event.type,
  };
}

function objectId(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}
