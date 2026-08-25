import Link from 'next/link';

export default function CheckoutCancelPage() {
  return (
    <main className="checkout-result">
      <span className="sandbox-badge">SANDBOX</span>
      <h1>Pago cancelado</h1>
      <p>No se concedió ni retiró ningún refuerzo.</p>
      <Link className="primary-action" href="/#community-hub">Volver a Territorios</Link>
    </main>
  );
}
