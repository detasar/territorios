import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getPaymentSnapshot } from '../../../db/payments';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Inicia sesión para consultar tus compras.' },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }
  try {
    const snapshot = await getPaymentSnapshot(user);
    return NextResponse.json(snapshot, {
      status: 200,
      headers: { 'cache-control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('payment_snapshot_failed', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { error: 'No se pudo cargar el historial de pagos.' },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
}
