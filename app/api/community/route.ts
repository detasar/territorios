import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getCommunitySnapshot } from '../../../db/community';
import { upsertUser } from '../../../db/game';

export async function GET() {
  try {
    const now = Date.now();
    const user = await getChatGPTUser();
    if (user) await upsertUser(user, now);
    const snapshot = await getCommunitySnapshot(user?.userId ?? null, now);
    return NextResponse.json(snapshot, {
      headers: { 'cache-control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('community_snapshot_failed', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { error: 'No se pudo cargar la comunidad.' },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
}
