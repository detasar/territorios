import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunitySnapshot, WorldSnapshot } from '../contracts/game';
import { CommunityHub } from './community-hub';

const community: CommunitySnapshot = {
  mode: 'live-community',
  serverTime: Date.UTC(2026, 7, 25, 12),
  territory: { code: '28', name: 'Madrid', factionName: 'Casa de Madrid' },
  council: {
    term: {
      id: 'council-term-season-1-28-1',
      number: 1,
      startsAt: Date.UTC(2026, 7, 25),
      endsAt: Date.UTC(2026, 8, 1),
    },
    campaign: {
      id: 'campaign-season-1-28-1',
      cycleNumber: 1,
      phase: 'planning',
      originTerritoryCode: '28',
      targetTerritoryCode: null,
      targetTerritoryName: null,
      battleId: null,
      ballotClosesAt: Date.UTC(2026, 7, 25, 18),
      mobilizesAt: null,
      cooldownEndsAt: null,
    },
    seats: [
      { seatKind: 'public-1', memberRef: 'abcdef0123456789', label: 'Estratega 6789', role: 'strategist', termEndsAt: Date.UTC(2026, 8, 1) },
      { seatKind: 'public-2', memberRef: null, label: null, role: null, termEndsAt: null },
      { seatKind: 'defense', memberRef: null, label: null, role: null, termEndsAt: null },
      { seatKind: 'strategy', memberRef: null, label: null, role: null, termEndsAt: null },
      { seatKind: 'supporter', memberRef: null, label: null, role: null, termEndsAt: null },
    ],
    candidates: [
      { candidateRef: 'abcdef0123456789', label: 'Estratega 6789', role: 'strategist', contributionScore: 100 },
    ],
    validTargets: [{ code: '45', name: 'Toledo', routeKind: 'land' }],
    representativeBallotCast: false,
    targetBallotCast: false,
    canVoteTarget: true,
    targetResult: { status: 'winner', winner: '45', finalists: ['45'] },
  },
  announcements: [
    {
      id: 'announcement-route-test',
      territoryCode: '28',
      territoryName: 'Madrid',
      authorRef: '0123456789abcdef',
      authorLabel: 'Estratega CDEF',
      messageKey: 'TARGET_CONFIRMED',
      status: 'published',
      upvotes: 2,
      downvotes: 0,
      viewerVote: null,
      createdAt: Date.UTC(2026, 7, 25, 11),
    },
  ],
  notifications: [
    {
      id: 'notification-test',
      kind: 'council-announcement',
      payload: { messageKey: 'TARGET_CONFIRMED' },
      readAt: null,
      createdAt: Date.UTC(2026, 7, 25, 11),
    },
  ],
  viewer: {
    userRef: 'abcdef0123456789',
    role: 'strategist',
    roleActionAvailable: true,
    nextRoleActionAt: null,
    isCouncilMember: true,
    canPublish: true,
    blockedRefs: [],
    mutedRefs: [],
  },
};

const world = {
  factionLeaderboard: [
    { factionId: 'faction-28', name: 'Casa de Madrid', color: 'coral', territories: 2, score: 150 },
  ],
  playerLeaderboard: [
    { player: 'Estratega 6789', role: 'strategist', contributionScore: 100, factionName: 'Casa de Madrid' },
  ],
  recentEvents: [
    { sequence: 8, eventType: 'COUNCIL_VOTE_CAST', summaryKey: 'councilVoteCast', summaryArgs: {}, payloadHash: 'a'.repeat(64), createdAt: Date.UTC(2026, 7, 25, 11) },
  ],
  viewer: {
    preferences: { locale: 'es', quietHoursStart: 22, quietHoursEnd: 8, maxWarAlertsPerDay: 1, councilAlerts: true },
  },
} as unknown as WorldSnapshot;

describe('CommunityHub', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => community })),
    );
  });

  it('renders only live faction and player ranking data', () => {
    render(
      <CommunityHub community={community} communityError={false} locale="es" onCommunity={vi.fn()} onLocale={vi.fn()} world={world} />,
    );

    expect(screen.getByText('Casa de Madrid')).toBeInTheDocument();
    expect(screen.getByText('Estratega 6789')).toBeInTheDocument();
    expect(screen.queryByText('Ana R.')).not.toBeInTheDocument();
  });

  it('casts equal-weight representative and supplied-target ballots', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    render(
      <CommunityHub community={community} communityError={false} locale="es" onCommunity={vi.fn()} onLocale={vi.fn()} world={world} />,
    );

    await user.click(screen.getByRole('tab', { name: 'Consejo' }));
    expect(screen.getByText(/\+25 refuerzos gratuitos/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ejecutar acción diaria' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Acción diaria de rol completada.');
    await user.click(screen.getByRole('button', { name: 'Emitir voto igualitario' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Voto registrado');
    await user.click(screen.getByRole('button', { name: 'Votar objetivo' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Voto registrado');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/community/role-action',
      expect.objectContaining({ body: expect.stringContaining('"28"') }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/community/ballot',
      expect.objectContaining({ body: expect.stringContaining('representative') }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/community/ballot',
      expect.objectContaining({ body: expect.stringContaining('"45"') }),
    );
  });

  it('does not offer a target ballot after the campaign target is locked', async () => {
    const user = userEvent.setup();
    const lockedCommunity: CommunitySnapshot = {
      ...community,
      council: {
        ...community.council,
        campaign: {
          ...community.council.campaign!,
          phase: 'active',
          targetTerritoryCode: '45',
          targetTerritoryName: 'Toledo',
          battleId: 'battle-season-1-28-45',
        },
        targetBallotCast: false,
        canVoteTarget: false,
      },
    };
    render(
      <CommunityHub community={lockedCommunity} communityError={false} locale="es" onCommunity={vi.fn()} onLocale={vi.fn()} world={world} />,
    );

    await user.click(screen.getByRole('tab', { name: 'Consejo' }));

    expect(screen.queryByLabelText('Objetivo con suministro')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Votar objetivo' })).not.toBeInTheDocument();
    expect(screen.getByText('Objetivo elegido: Toledo')).toBeInTheDocument();
  });

  it('publishes fixed messages and exposes vote, report, mute, and block controls', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    render(
      <CommunityHub community={community} communityError={false} locale="es" onCommunity={vi.fn()} onLocale={vi.fn()} world={world} />,
    );
    await user.click(screen.getByRole('tab', { name: 'Consejo' }));

    await user.click(screen.getByRole('button', { name: 'Publicar mensaje predefinido' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Anuncio publicado.');
    await user.click(screen.getByRole('button', { name: /útil 2/i }));
    expect(await screen.findByRole('status')).toHaveTextContent('Valoración del anuncio registrada.');
    await user.click(screen.getByText('Denunciar'));
    await user.click(screen.getByRole('button', { name: 'Enviar a revisión humana' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Denuncia enviada a revisión humana.');
    await user.click(screen.getByRole('button', { name: 'Silenciar autor' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Autor silenciado.');
    await user.click(screen.getByRole('button', { name: 'Bloquear autor' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Autor bloqueado.');

    expect(fetchMock).toHaveBeenCalledWith('/api/community/announcement', expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith('/api/community/announcement/vote', expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith('/api/community/report', expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith('/api/community/safety', expect.any(Object));
  });

  it('keeps the moderation drawer open after reporting and recreating the council panel', async () => {
    const user = userEvent.setup();
    render(
      <CommunityHub community={community} communityError={false} locale="es" onCommunity={vi.fn()} onLocale={vi.fn()} world={world} />,
    );
    await user.click(screen.getByRole('tab', { name: 'Consejo' }));

    await user.click(screen.getByText('Denunciar'));
    await user.click(screen.getByRole('button', { name: 'Enviar a revisión humana' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Denuncia enviada a revisión humana.');

    await user.click(screen.getByRole('tab', { name: 'Clasificación' }));
    await user.click(screen.getByRole('tab', { name: 'Consejo' }));

    expect(screen.getByText('Denunciar').closest('details')).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Silenciar autor' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Bloquear autor' })).toBeVisible();
  });

  it('switches replay/settings accessibly and saves bounded preferences', async () => {
    const user = userEvent.setup();
    const onLocale = vi.fn();
    render(
      <CommunityHub community={community} communityError={false} locale="es" onCommunity={vi.fn()} onLocale={onLocale} world={world} />,
    );

    fireEvent(window, new CustomEvent('territorios:tab', { detail: 'activity' }));
    expect(await screen.findByText('Se registró un voto igualitario del consejo.')).toBeInTheDocument();
    expect(screen.getByText(/Cada entrada cuenta qué cambió/i)).toBeInTheDocument();
    expect(screen.getByText('Verificar integridad')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Ajustes' }));
    await user.selectOptions(screen.getByLabelText('Idioma de la interfaz'), 'en');
    expect(onLocale).toHaveBeenCalledWith('en');
    await user.clear(screen.getByLabelText('Máximo de alertas de guerra al día'));
    await user.type(screen.getByLabelText('Máximo de alertas de guerra al día'), '0');
    await user.click(screen.getByRole('button', { name: 'Guardar preferencias' }));

    expect(fetch).toHaveBeenCalledWith(
      '/api/community/preferences',
      expect.objectContaining({ body: expect.stringContaining('"maxWarAlertsPerDay":0') }),
    );
    expect(screen.getByText('Anuncio del consejo')).toBeInTheDocument();
  });

  it('clears action feedback when the interface locale changes', async () => {
    const user = userEvent.setup();
    const view = render(
      <CommunityHub community={community} communityError={false} locale="es" onCommunity={vi.fn()} onLocale={vi.fn()} world={world} />,
    );
    await user.click(screen.getByRole('tab', { name: 'Consejo' }));
    await user.click(screen.getByRole('button', { name: 'Ejecutar acción diaria' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Acción diaria de rol completada.');

    view.rerender(
      <CommunityHub community={community} communityError={false} locale="en" onCommunity={vi.fn()} onLocale={vi.fn()} world={world} />,
    );
    expect(screen.queryByText('Acción diaria de rol completada.')).not.toBeInTheDocument();
  });

  it('shows explicit empty and unavailable states without inventing data', async () => {
    const user = userEvent.setup();
    render(
      <CommunityHub community={null} communityError locale="en" onCommunity={vi.fn()} onLocale={vi.fn()} world={null} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('community layer is unavailable');
    expect(screen.getAllByText(/leaderboard will appear/i)).toHaveLength(2);
    await user.click(screen.getByRole('tab', { name: 'Council' }));
    expect(screen.getByText(/sign in and represent/i)).toBeInTheDocument();
  });
});
