import { describe, expect, it } from 'vitest';
import {
  activeCouncilSeats,
  buildCouncilRoster,
  resolveRankedChoice,
  validSupplyTargets,
} from './governance';

describe('council term boundaries', () => {
  it('returns only seats from the active term window', () => {
    const now = Date.UTC(2026, 7, 25, 12);
    expect(activeCouncilSeats([
      { seatKind: 'public-1', userId: 'expired', termStartsAt: now - 10_000, termEndsAt: now - 1 },
      { seatKind: 'public-2', userId: 'active', termStartsAt: now - 10_000, termEndsAt: now + 10_000 },
      { seatKind: 'defense', userId: 'future', termStartsAt: now + 1, termEndsAt: now + 20_000 },
    ], now)).toEqual([
      { seatKind: 'public-2', userId: 'active', termStartsAt: now - 10_000, termEndsAt: now + 10_000 },
    ]);
  });
});

describe('ranked governance', () => {
  it('elects the first candidate with a strict majority of active ballots', () => {
    const result = resolveRankedChoice(
      ['ana', 'bea', 'carlos'],
      [
        { voterId: 'v1', choices: ['ana', 'bea', 'carlos'] },
        { voterId: 'v2', choices: ['ana', 'carlos', 'bea'] },
        { voterId: 'v3', choices: ['bea', 'ana', 'carlos'] },
      ],
      2,
    );

    expect(result.status).toBe('winner');
    expect(result.winner).toBe('ana');
    expect(result.rounds[0].counts).toEqual({ ana: 2, bea: 1, carlos: 0 });
  });

  it('transfers ranked ballots after eliminating the weakest candidate', () => {
    const result = resolveRankedChoice(
      ['ana', 'bea', 'carlos'],
      [
        { voterId: 'v1', choices: ['ana', 'bea'] },
        { voterId: 'v2', choices: ['bea', 'ana'] },
        { voterId: 'v3', choices: ['carlos', 'bea'] },
      ],
      1,
    );

    expect(result.status).toBe('winner');
    expect(result.winner).toBe('bea');
    expect(result.rounds).toHaveLength(2);
  });

  it('opens a runoff on a final tie and fails closed below quorum', () => {
    expect(
      resolveRankedChoice(
        ['ana', 'bea'],
        [
          { voterId: 'v1', choices: ['ana'] },
          { voterId: 'v2', choices: ['bea'] },
        ],
        1,
      ),
    ).toMatchObject({ status: 'tie', winner: null, finalists: ['ana', 'bea'] });

    expect(
      resolveRankedChoice(
        ['ana', 'bea'],
        [{ voterId: 'v1', choices: ['ana'] }],
        2,
      ),
    ).toMatchObject({ status: 'no-quorum', winner: null });
  });

  it('ignores duplicate voters, duplicate preferences, and unknown candidates', () => {
    const result = resolveRankedChoice(
      ['ana', 'bea'],
      [
        { voterId: 'v1', choices: ['ana', 'ana', 'unknown'] },
        { voterId: 'v1', choices: ['bea'] },
        { voterId: 'v2', choices: ['unknown'] },
      ],
      1,
    );
    expect(result).toMatchObject({ status: 'winner', winner: 'ana' });
    expect(resolveRankedChoice([], [], 0)).toMatchObject({ status: 'no-quorum' });
  });

  it('builds five mixed seats without allowing one user to hold two', () => {
    const roster = buildCouncilRoster(
      [
        { id: 'ana', role: 'defender', contributionScore: 900, supporterPoints: 4_000 },
        { id: 'bea', role: 'strategist', contributionScore: 850, supporterPoints: 10 },
        { id: 'carlos', role: 'defender', contributionScore: 700, supporterPoints: 5_000 },
        { id: 'dani', role: 'strategist', contributionScore: 650, supporterPoints: 0 },
        { id: 'elena', role: 'herald', contributionScore: 500, supporterPoints: 2_000 },
      ],
      [
        { voterId: 'ana', choices: ['bea', 'carlos'] },
        { voterId: 'bea', choices: ['bea', 'ana'] },
        { voterId: 'carlos', choices: ['carlos', 'bea'] },
        { voterId: 'dani', choices: ['carlos', 'bea'] },
        { voterId: 'elena', choices: ['bea', 'carlos'] },
      ],
    );

    expect(roster).toHaveLength(5);
    expect(new Set(roster.map((seat) => seat.userId).filter(Boolean)).size).toBe(
      roster.filter((seat) => seat.userId).length,
    );
    expect(roster.map((seat) => seat.seatKind)).toEqual([
      'public-1',
      'public-2',
      'defense',
      'strategy',
      'supporter',
    ]);
    expect(roster.find((seat) => seat.seatKind === 'supporter')?.supporterScore).toBeLessThanOrEqual(1_000);
  });

  it('offers only adjacent supplied targets', () => {
    expect(
      validSupplyTargets(
        '28',
        [
          { from: '28', to: '45', enabled: true },
          { from: '28', to: '19', enabled: false },
          { from: '08', to: '28', enabled: true },
          { from: '41', to: '29', enabled: true },
        ],
        new Set(['45', '08']),
      ),
    ).toEqual(['08', '45']);
  });

  it('keeps every mixed seat vacant when no eligible members exist', () => {
    expect(buildCouncilRoster([], [])).toEqual([
      { seatKind: 'public-1', userId: null, supporterScore: 0 },
      { seatKind: 'public-2', userId: null, supporterScore: 0 },
      { seatKind: 'defense', userId: null, supporterScore: 0 },
      { seatKind: 'strategy', userId: null, supporterScore: 0 },
      { seatKind: 'supporter', userId: null, supporterScore: 0 },
    ]);
  });
});
