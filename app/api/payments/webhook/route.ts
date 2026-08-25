import { NextResponse } from 'next/server';
import { processStripeEvent } from '../../../../db/payments';
import { StripeConfigurationError, verifyStripeWebhook } from '../../../../src/server/stripe';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Firma de webhook ausente.' }, { status: 400 });
  }
  const rawBody = await request.text();

  let event;
  try {
    event = await verifyStripeWebhook(rawBody, signature);
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      return NextResponse.json({ error: 'Webhook sandbox no configurado.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Firma de webhook inválida.' }, { status: 400 });
  }
  if (event.livemode) {
    return NextResponse.json({ error: 'Los eventos live-mode están desactivados.' }, { status: 400 });
  }

  try {
    const payloadHash = await sha256(rawBody);
    const result = await processStripeEvent(event, payloadHash);
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (error) {
    console.error('stripe_webhook_processing_failed', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
      providerEventId: event.id,
      providerEventType: event.type,
    });
    return NextResponse.json({ error: 'El evento no pudo procesarse.' }, { status: 500 });
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
