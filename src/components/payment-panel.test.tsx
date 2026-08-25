import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentPanel } from './payment-panel';

const catalog = [{
  id: 'local-support',
  name: 'Apoyo Local',
  description: '300 unidades de apoyo común.',
  priceCents: 499,
  currency: 'eur',
  paidSupport: 300,
}];

const snapshot = {
  mode: 'live-payments' as const,
  sandbox: true as const,
  configured: true,
  legalVersion: 'paid-beta-2026-08-25',
  controls: {
    purchasesPaused: false,
    dailySpendLimitCents: 5_000,
    seasonSpendLimitCents: 15_000,
    canResumePurchases: true,
  },
  purchases: [],
};

describe('PaymentPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => snapshot,
    }));
  });

  it('labels the sandbox, real-money price, 20% cap, and non-cash nature', async () => {
    render(<PaymentPanel catalog={catalog} locale="es" hasMembership />);

    expect((await screen.findAllByText(/Stripe Sandbox/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/4,99.*€/)).toBeInTheDocument();
    expect(screen.getAllByText(/20%/).length).toBeGreaterThan(0);
    expect(screen.getByText(/no se puede transferir ni canjear por dinero/i)).toBeInTheDocument();
  });

  it('keeps checkout disabled without both 18+ and legal self-attestations', async () => {
    render(<PaymentPanel catalog={catalog} locale="es" hasMembership />);
    const buy = await screen.findByRole('button', { name: /Abrir pago sandbox/i });

    expect(buy).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/mayor de 18 años/i));
    expect(buy).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Condiciones, Reembolsos/i));
    expect(buy).toBeEnabled();
  });

  it('sends only a product id and attestations, then accepts only the checkout URL callback', async () => {
    const navigate = vi.fn();
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => snapshot } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_panel',
          mode: 'sandbox',
          purchaseId: 'purchase-panel',
        }),
      } as Response);
    render(
      <PaymentPanel
        catalog={catalog}
        locale="es"
        hasMembership
        onCheckoutUrl={navigate}
      />,
    );
    fireEvent.click(await screen.findByLabelText(/mayor de 18 años/i));
    fireEvent.click(screen.getByLabelText(/Condiciones, Reembolsos/i));
    fireEvent.click(screen.getByRole('button', { name: /Abrir pago sandbox/i }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(
      'https://checkout.stripe.com/c/pay/cs_test_panel',
    ));
    const [, request] = fetchMock.mock.calls[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      ageConfirmed: true,
      consentAccepted: true,
      consentVersion: 'paid-beta-2026-08-25',
      productId: 'local-support',
    });
    expect(new Headers(request?.headers).get('idempotency-key')).toMatch(/^payment-/);
  });

  it('fails closed when checkout returns an untrusted redirect origin', async () => {
    const navigate = vi.fn();
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => snapshot } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ checkoutUrl: 'https://evil.example/pay', purchaseId: 'bad' }),
      } as Response);
    render(<PaymentPanel catalog={catalog} locale="es" hasMembership onCheckoutUrl={navigate} />);
    fireEvent.click(await screen.findByLabelText(/mayor de 18 años/i));
    fireEvent.click(screen.getByLabelText(/Condiciones, Reembolsos/i));
    fireEvent.click(screen.getByRole('button', { name: /Abrir pago sandbox/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/no pudo iniciarse/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows a safe unavailable state when private payment data cannot load', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('private network detail'));
    render(<PaymentPanel catalog={catalog} locale="es" hasMembership />);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'No se pudieron cargar los controles privados de pago.',
    );
    expect(screen.getByRole('button', { name: /Abrir pago sandbox/i })).toBeDisabled();
  });

  it('explains missing configuration and membership without exposing checkout', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...snapshot, configured: false }),
    } as Response);
    render(<PaymentPanel catalog={catalog} locale="es" hasMembership={false} />);

    expect(await screen.findByText(/espera las claves test-mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Elige una provincia/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/mayor de 18 años/i));
    fireEvent.click(screen.getByLabelText(/Condiciones, Reembolsos/i));
    expect(screen.getByRole('button', { name: /Abrir pago sandbox/i })).toBeDisabled();
  });

  it('saves reduced spending limits and a voluntary purchase pause', async () => {
    const updated = {
      ...snapshot,
      controls: {
        ...snapshot.controls,
        purchasesPaused: true,
        dailySpendLimitCents: 2_000,
        seasonSpendLimitCents: 7_000,
      },
    };
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => snapshot } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => updated } as Response);
    render(<PaymentPanel catalog={catalog} locale="es" hasMembership />);

    fireEvent.change(await screen.findByLabelText(/Límite diario/i), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText(/Límite de temporada/i), { target: { value: '70' } });
    fireEvent.click(screen.getByLabelText(/Pausar nuevas compras/i));
    fireEvent.click(screen.getByRole('button', { name: /Guardar límites/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/guardados/i);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      purchasesPaused: true,
      dailySpendLimitCents: 2_000,
      seasonSpendLimitCents: 7_000,
    });
  });

  it('renders API policy errors instead of assuming checkout success', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => snapshot } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Esta compra superaría tu límite diario.' }),
      } as Response);
    render(<PaymentPanel catalog={catalog} locale="es" hasMembership />);
    fireEvent.click(await screen.findByLabelText(/mayor de 18 años/i));
    fireEvent.click(screen.getByLabelText(/Condiciones, Reembolsos/i));
    fireEvent.click(screen.getByRole('button', { name: /Abrir pago sandbox/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/límite diario/i);
  });

  it('localizes the paid-beta guardrails in English', async () => {
    render(<PaymentPanel catalog={catalog} locale="en" hasMembership />);

    expect(await screen.findByText(/real cards are not charged/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot be transferred or redeemed for money/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open sandbox checkout/i })).toBeDisabled();
  });
});
