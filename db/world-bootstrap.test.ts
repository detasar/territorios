import { describe, expect, it } from 'vitest';
import { freshSeasonStartAt } from './world-bootstrap';

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
