import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { PaymentCommandError, updatePaymentControls } from '../../../../db/payments';
import { paymentControlsSchema } from '../../../../src/contracts/payments';
import { validateMutationRequest } from '../../../../src/server/request-guards';
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
    return NextResponse.json({ error: 'Inicia sesión para cambiar los límites.' }, { status: 401 });
  }

  try {
    const command = paymentControlsSchema.parse(await request.json());
    const snapshot = await updatePaymentControls(user, command, guard.idempotencyKey);
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Límites de gasto inválidos.' }, { status: 400 });
    }
    if (error instanceof PaymentCommandError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('payment_controls_failed', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json({ error: 'No se pudieron guardar los límites.' }, { status: 500 });
  }
}
