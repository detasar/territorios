import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BetaOperations } from './beta-operations';

describe('BetaOperations', () => {
  it('shows the no-money privacy layer before sign-in', () => {
    render(<BetaOperations authenticated={false} consent={null} locale="es" />);
    expect(screen.getByText(/18\+ · sin dinero real/i)).toBeInTheDocument();
    expect(screen.getByText(/Davut Emre/)).toBeInTheDocument();
    expect(screen.getByText(/no conceden propiedad.*autoridad política/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacidad/i })).toHaveAttribute('href', '/legal/privacy?lang=es');
  });

  it('submits a fixed-vocabulary privacy request without free text', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ requestId: 'BR-ABC123', reviewWithinHours: 24 }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<BetaOperations
      authenticated
      consent={{ version: 'closed-beta-2026-08-25-v1', participantId: 'P-1234ABCD', consentedAt: 1 }}
      locale="es"
    />);

    await user.click(screen.getByText(/contacto y derechos/i));
    await user.selectOptions(screen.getByLabelText(/tipo de solicitud/i), 'privacy-delete');
    await user.click(screen.getByRole('button', { name: /registrar solicitud/i }));

    expect(fetchMock).toHaveBeenCalledWith('/api/beta/request', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ category: 'privacy-delete', issueCode: 'leave-beta' }),
    }));
    expect(await screen.findByText(/BR-ABC123.*24 horas/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
