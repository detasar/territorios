import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { supportCommandSchema } from '../../../../src/contracts/game';
import { commitSupport, GameCommandError } from '../../../../db/game';
import { validateMutationRequest } from '../../../../src/server/request-guards';

export async function POST(request: Request) {
  const guard = validateMutationRequest(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json({ error: 'Inicia sesión para enviar refuerzos.' }, { status: 401 });
  }

  try {
    const command = supportCommandSchema.parse(await request.json());
    const snapshot = await commitSupport(user, command, guard.idempotencyKey);
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Orden de refuerzo inválida.' }, { status: 400 });
    }
    if (error instanceof GameCommandError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('commit_support_failed', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json({ error: 'No se pudo completar la orden.' }, { status: 500 });
  }
}
