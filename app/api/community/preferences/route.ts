import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { updateNotificationPreferences } from '../../../../db/community';
import { GameCommandError, upsertUser } from '../../../../db/game';
import { notificationPreferenceSchema } from '../../../../src/contracts/game';
import { validateMutationRequest } from '../../../../src/server/request-guards';

export async function POST(request: Request) {
  const guard = validateMutationRequest(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión para guardar ajustes.' }, { status: 401 });
  try {
    await upsertUser(user);
    const command = notificationPreferenceSchema.parse(await request.json());
    return NextResponse.json(await updateNotificationPreferences(user, command, guard.idempotencyKey));
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Preferencias inválidas.' }, { status: 400 });
    if (error instanceof GameCommandError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('notification_preferences_failed', { errorType: error instanceof Error ? error.name : 'UnknownError' });
    return NextResponse.json({ error: 'No se pudieron guardar los ajustes.' }, { status: 500 });
  }
}
