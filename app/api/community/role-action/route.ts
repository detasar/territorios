import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { executeRoleAction } from '../../../../db/community';
import { GameCommandError, upsertUser } from '../../../../db/game';
import { roleActionSchema } from '../../../../src/contracts/game';
import { validateMutationRequest } from '../../../../src/server/request-guards';

export async function POST(request: Request) {
  const guard = validateMutationRequest(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión para usar tu rol.' }, { status: 401 });
  try {
    await upsertUser(user);
    const command = roleActionSchema.parse(await request.json());
    return NextResponse.json(await executeRoleAction(user, command, guard.idempotencyKey));
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Acción de rol inválida.' }, { status: 400 });
    if (error instanceof GameCommandError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('role_action_failed', { errorType: error instanceof Error ? error.name : 'UnknownError' });
    return NextResponse.json({ error: 'No se pudo completar la acción de rol.' }, { status: 500 });
  }
}
