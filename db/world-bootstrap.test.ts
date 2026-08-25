import { describe, expect, it } from 'vitest';
import { freshSeasonStartAt, nextSeasonCandidate } from './world-bootstrap';

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;

describe('freshSeasonStartAt', () => {
  it('starts a production world at the actual creation time', () => {
    const now = Date.UTC(2026, 7, 25, 16, 0, 0);

    expect(freshSeasonStartAt(now)).toBe(now);
  });

  it('allows an explicit fixture day without changing the production default', () => {
    const now = Date.UTC(2026, 7, 25, 16, 0, 0);

    expect(freshSeasonStartAt(now, 12)).toBe(now - 11 * DAY_MILLISECONDS);
    expect(() => freshSeasonStartAt(now, 0)).toThrow('Fixture season day');
    expect(() => freshSeasonStartAt(now, 29)).toThrow('Fixture season day');
  });
});

describe('nextSeasonCandidate', () => {
  const now = Date.UTC(2026, 7, 25, 16, 0, 0);

  it('does not schedule another season when the latest row is already active', () => {
    expect(nextSeasonCandidate({
      number: 1,
      ends_at: now + 28 * DAY_MILLISECONDS,
      status: 'active',
    }, now)).toBeNull();
  });

  it('continues after the latest completed season without overlapping its window', () => {
    const endsAt = now + DAY_MILLISECONDS;

    expect(nextSeasonCandidate({ number: 4, ends_at: endsAt, status: 'completed' }, now)).toEqual({
      number: 5,
      startsAt: endsAt,
    });
  });

  it('starts the first season immediately', () => {
    expect(nextSeasonCandidate(null, now)).toEqual({ number: 1, startsAt: now });
  });
});
