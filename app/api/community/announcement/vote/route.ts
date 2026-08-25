import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getChatGPTUser } from '../../../../chatgpt-auth';
import { voteAnnouncement } from '../../../../../db/community';
import { GameCommandError, upsertUser } from '../../../../../db/game';
import { announcementVoteSchema } from '../../../../../src/contracts/game';
import { validateMutationRequest } from '../../../../../src/server/request-guards';

export async function POST(request: Request) {
  const guard = validateMutationRequest(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión para valorar.' }, { status: 401 });
  try {
    await upsertUser(user);
    const command = announcementVoteSchema.parse(await request.json());
    return NextResponse.json(await voteAnnouncement(user, command));
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Valoración inválida.' }, { status: 400 });
    if (error instanceof GameCommandError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('announcement_vote_failed', { errorType: error instanceof Error ? error.name : 'UnknownError' });
    return NextResponse.json({ error: 'No se pudo registrar la valoración.' }, { status: 500 });
  }
}
