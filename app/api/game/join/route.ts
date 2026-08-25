import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { joinFactionSchema } from '../../../../src/contracts/game';
import { GameCommandError, joinFaction } from '../../../../db/game';
import { validateMutationRequest } from '../../../../src/server/request-guards';

export async function POST(request: Request) {
  const guard = validateMutationRequest(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json({ error: 'Inicia sesión para elegir una facción.' }, { status: 401 });
  }

  try {
    const command = joinFactionSchema.parse(await request.json());
    const snapshot = await joinFaction(
      user,
      command.territoryCode,
      command.role,
      guard.idempotencyKey,
    );
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos de facción inválidos.' }, { status: 400 });
    }
    if (error instanceof GameCommandError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('join_faction_failed', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json({ error: 'No se pudo completar la orden.' }, { status: 500 });
  }
}
