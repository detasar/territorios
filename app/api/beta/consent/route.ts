import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { recordBetaConsent, BetaCommandError } from '../../../../db/beta';
import { upsertUser } from '../../../../db/game';
import { betaConsentSchema } from '../../../../src/contracts/beta';
import { validateMutationRequest } from '../../../../src/server/request-guards';

export async function POST(request: Request) {
  const guard = validateMutationRequest(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión para aceptar la beta.' }, { status: 401 });
  try {
    betaConsentSchema.parse(await request.json());
    await upsertUser(user);
    return NextResponse.json(await recordBetaConsent(user.userId, guard.idempotencyKey));
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Consentimiento de beta inválido.' }, { status: 400 });
    if (error instanceof BetaCommandError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('beta_consent_failed', { errorType: error instanceof Error ? error.name : 'UnknownError' });
    return NextResponse.json({ error: 'No se pudo registrar el consentimiento.' }, { status: 500 });
  }
}
