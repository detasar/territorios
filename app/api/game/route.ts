import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { ensureWorld } from '../../../db/world-bootstrap';
import { getWorldSnapshot, upsertUser } from '../../../db/game';

export async function GET() {
  try {
    const now = Date.now();
    await ensureWorld(now);
    const authenticated = await getChatGPTUser();
    if (authenticated) {
      await upsertUser(authenticated, now);
    }
    const snapshot = await getWorldSnapshot(authenticated?.userId ?? null, now);
    return NextResponse.json(snapshot, {
      headers: { 'cache-control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('game_snapshot_failed', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { error: 'No se pudo cargar el mundo de juego.' },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
}
