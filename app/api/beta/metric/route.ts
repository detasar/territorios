import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { recordBetaMetric } from '../../../../db/beta';
import { upsertUser } from '../../../../db/game';
import { betaMetricSchema } from '../../../../src/contracts/beta';
import { validateMutationRequest } from '../../../../src/server/request-guards';

export async function POST(request: Request) {
  const guard = validateMutationRequest(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const user = await getChatGPTUser();
  if (!user) return new Response(null, { status: 204 });
  try {
    const command = betaMetricSchema.parse(await request.json());
    await upsertUser(user);
    await recordBetaMetric(user.userId, command.event, guard.idempotencyKey);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Métrica de beta inválida.' }, { status: 400 });
    console.error('beta_metric_failed', { errorType: error instanceof Error ? error.name : 'UnknownError' });
    return new Response(null, { status: 204 });
  }
}
