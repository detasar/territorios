import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is required.');

const baseUrl = process.env.TERRITORIOS_BASE_URL ?? 'http://localhost:3000';
const stripe = new Stripe(`sk_${'test'}_local_verification`, {
  httpClient: Stripe.createFetchHttpClient(),
});

function payload(id, type, object) {
  return JSON.stringify({
    id,
    object: 'event',
    api_version: '2025-08-27.basil',
    created: Math.floor(Date.now() / 1_000),
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
  });
}

async function send(id, type, object) {
  const rawBody = payload(id, type, object);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: rawBody,
    secret: webhookSecret,
    timestamp: Math.floor(Date.now() / 1_000),
  });
  const response = await fetch(`${baseUrl}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: rawBody,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Webhook ${type} failed with ${response.status}.`);
  return { duplicate: Boolean(result.duplicate), status: result.status, type };
}

const checkout = {
  id: 'cs_test_local_signed',
  object: 'checkout.session',
  amount_total: 499,
  currency: 'eur',
  metadata: { purchase_id: 'purchase-local-signed' },
  payment_intent: 'pi_test_local_signed',
  payment_status: 'paid',
};
const results = [];
results.push(await send('evt_local_checkout_001', 'checkout.session.completed', checkout));
results.push(await send('evt_local_checkout_001', 'checkout.session.completed', checkout));
results.push(await send('evt_local_refund_001', 'refund.created', {
  id: 're_test_local_partial',
  object: 'refund',
  amount: 250,
  currency: 'eur',
  payment_intent: 'pi_test_local_signed',
}));
results.push(await send('evt_local_dispute_001', 'charge.dispute.created', {
  id: 'dp_test_local',
  object: 'dispute',
  amount: 499,
  currency: 'eur',
  payment_intent: 'pi_test_local_signed',
  status: 'needs_response',
}));
results.push(await send('evt_local_dispute_won_001', 'charge.dispute.closed', {
  id: 'dp_test_local',
  object: 'dispute',
  amount: 499,
  currency: 'eur',
  payment_intent: 'pi_test_local_signed',
  status: 'won',
}));

console.log(JSON.stringify(results));
