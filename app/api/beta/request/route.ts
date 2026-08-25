import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { BetaCommandError, recordBetaRequest } from '../../../../db/beta';
import { upsertUser } from '../../../../db/game';
import { betaRequestSchema } from '../../../../src/contracts/beta';
import { validateMutationRequest } from '../../../../src/server/request-guards';

export async function POST(request: Request) {
  const guard = validateMutationRequest(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión para contactar con el equipo de beta.' }, { status: 401 });
  try {
    const command = betaRequestSchema.parse(await request.json());
    await upsertUser(user);
    return NextResponse.json(
      await recordBetaRequest(user.userId, command, guard.idempotencyKey),
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Solicitud de beta inválida.' }, { status: 400 });
    if (error instanceof BetaCommandError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('beta_request_failed', { errorType: error instanceof Error ? error.name : 'UnknownError' });
    return NextResponse.json({ error: 'No se pudo registrar la solicitud.' }, { status: 500 });
  }
}
