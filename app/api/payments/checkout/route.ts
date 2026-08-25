import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { createPaymentCheckout, PaymentCommandError } from '../../../../db/payments';
import { checkoutCommandSchema } from '../../../../src/contracts/payments';
import { validateMutationRequest } from '../../../../src/server/request-guards';
import { StripeConfigurationError } from '../../../../src/server/stripe';
import { paymentsEnabledForRelease, PAYMENTS_DISABLED_MESSAGE } from '../../../../src/server/payment-availability';

export async function POST(request: Request) {
  if (!paymentsEnabledForRelease()) {
    return NextResponse.json({ error: PAYMENTS_DISABLED_MESSAGE }, { status: 404, headers: { 'cache-control': 'no-store' } });
  }
  const guard = validateMutationRequest(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json({ error: 'Inicia sesión para comprar refuerzos.' }, { status: 401 });
  }

  try {
    const command = checkoutCommandSchema.parse(await request.json());
    const result = await createPaymentCheckout(
      user,
      command,
      guard.idempotencyKey,
      new URL(request.url).origin,
    );
    return NextResponse.json({ ...result, mode: 'sandbox' }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos o consentimientos de compra inválidos.' }, { status: 400 });
    }
    if (error instanceof StripeConfigurationError) {
      return NextResponse.json(
        { error: 'Stripe sandbox todavía no está configurado.' },
        { status: 503 },
      );
    }
    if (error instanceof PaymentCommandError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('payment_checkout_failed', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json({ error: 'No se pudo iniciar el pago.' }, { status: 500 });
  }
}
