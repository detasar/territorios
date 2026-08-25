'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PaymentSnapshot } from '../../../src/contracts/payments';

export default function CheckoutSuccessPage() {
  const [status, setStatus] = useState('Verificando el webhook firmado…');

  useEffect(() => {
    const purchaseId = new URLSearchParams(window.location.search).get('purchase');
    if (!purchaseId || !/^[a-zA-Z0-9-]{8,80}$/.test(purchaseId)) {
      const timer = window.setTimeout(
        () => setStatus('No se encontró una referencia de compra válida.'),
        0,
      );
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const response = await fetch('/api/payments', { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error('snapshot unavailable');
        const snapshot = await response.json() as PaymentSnapshot;
        const purchase = snapshot.purchases.find((entry) => entry.id === purchaseId);
        if (!cancelled && purchase?.status === 'fulfilled') {
          setStatus('Pago sandbox confirmado por webhook. Los refuerzos ya están en tu cartera.');
          return;
        }
        if (!cancelled && purchase && purchase.status !== 'pending') {
          setStatus(`La compra terminó con estado: ${purchase.status.replaceAll('_', ' ')}.`);
          return;
        }
      } catch {
        if (!cancelled) setStatus('La verificación sigue pendiente; vuelve al juego para consultar el historial.');
      }
      if (!cancelled && attempts < 6) window.setTimeout(poll, 1_500);
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="checkout-result">
      <span className="sandbox-badge">SANDBOX</span>
      <h1>Pago recibido por Stripe</h1>
      <p>{status}</p>
      <p className="privacy-note">Esta página nunca concede refuerzos por sí sola. D1 solo cambia después de verificar la firma del webhook.</p>
      <Link className="primary-action" href="/#community-hub">Volver a Territorios</Link>
    </main>
  );
}
