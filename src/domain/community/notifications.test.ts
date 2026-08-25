import { describe, expect, it } from 'vitest';
import { canQueueWarAlert, isQuietHour } from './notifications';

describe('bounded notifications', () => {
  it('supports quiet hours that wrap over midnight', () => {
    expect(isQuietHour(23, 22, 8)).toBe(true);
    expect(isQuietHour(7, 22, 8)).toBe(true);
    expect(isQuietHour(12, 22, 8)).toBe(false);
    expect(isQuietHour(12, 8, 8)).toBe(false);
    expect(isQuietHour(10, 9, 17)).toBe(true);
    expect(isQuietHour(18, 9, 17)).toBe(false);
  });

  it('enforces a per-day war-alert cap and honors zero as opt-out', () => {
    const now = Date.UTC(2026, 7, 25, 12);
    expect(canQueueWarAlert([], now, 1)).toBe(true);
    expect(canQueueWarAlert([now - 1_000], now, 1)).toBe(false);
    expect(canQueueWarAlert([now - 25 * 60 * 60 * 1_000], now, 1)).toBe(true);
    expect(canQueueWarAlert([], now, 0)).toBe(false);
  });
});
