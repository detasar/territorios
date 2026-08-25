import { describe, expect, it } from 'vitest';
import {
  calculateGrantAdjustment,
  evaluateSpendPolicy,
  nextPurchaseStatus,
  type PurchaseStatus,
} from './payments';

describe('payment policy', () => {
  const basePolicy = {
    accountCreatedAt: Date.UTC(2026, 7, 20),
    ageConfirmed: true,
    consentAccepted: true,
    dailyLimitCents: 5_000,
    dailySpentCents: 0,
    now: Date.UTC(2026, 7, 25),
    priceCents: 499,
    purchasesPaused: false,
    seasonLimitCents: 15_000,
    seasonSpentCents: 0,
  };

  it('allows a server-priced test purchase inside every limit', () => {
    expect(evaluateSpendPolicy(basePolicy)).toEqual({ ok: true });
  });

  it.each([
    [{ ageConfirmed: false }, 'AGE_CONFIRMATION_REQUIRED'],
    [{ consentAccepted: false }, 'LEGAL_CONSENT_REQUIRED'],
    [{ purchasesPaused: true }, 'PURCHASES_PAUSED'],
    [{ dailySpentCents: 4_800 }, 'DAILY_LIMIT_EXCEEDED'],
    [{ seasonSpentCents: 14_800 }, 'SEASON_LIMIT_EXCEEDED'],
  ])('fails closed for policy breach %s', (override, code) => {
    expect(evaluateSpendPolicy({ ...basePolicy, ...override })).toEqual({ ok: false, code });
  });

  it('caps the first 24 hours of an account at 20 EUR', () => {
    expect(evaluateSpendPolicy({
      ...basePolicy,
      accountCreatedAt: basePolicy.now - 60_000,
      dailySpentCents: 1_800,
    })).toEqual({ ok: false, code: 'NEW_ACCOUNT_LIMIT_EXCEEDED' });
  });
});

describe('payment state machine', () => {
  it.each<[PurchaseStatus, Parameters<typeof nextPurchaseStatus>[1], PurchaseStatus]>([
    ['pending', 'checkout_paid', 'fulfilled'],
    ['pending', 'checkout_expired', 'expired'],
    ['fulfilled', 'partial_refund', 'partially_refunded'],
    ['fulfilled', 'full_refund', 'refunded'],
    ['fulfilled', 'dispute_opened', 'disputed'],
    ['partially_refunded', 'dispute_opened', 'disputed'],
    ['disputed', 'dispute_won', 'fulfilled'],
    ['disputed', 'dispute_lost', 'dispute_lost'],
  ])('moves %s through %s to %s', (current, event, expected) => {
    expect(nextPurchaseStatus(current, event)).toBe(expected);
  });

  it('retains a partial-refund state after a won dispute', () => {
    expect(nextPurchaseStatus('disputed', 'dispute_won', 'partial')).toBe('partially_refunded');
  });

  it('rejects impossible fulfillment after an expired checkout', () => {
    expect(() => nextPurchaseStatus('expired', 'checkout_paid')).toThrow(
      'Invalid purchase transition',
    );
  });
});

describe('paid-support compensation', () => {
  it('revokes only the proportional unspent support for a partial refund', () => {
    expect(calculateGrantAdjustment({
      currentRevokedSupport: 0,
      effectiveReversedCents: 250,
      grantedSupport: 300,
      purchaseAmountCents: 500,
      walletPaidSupport: 300,
    })).toEqual({
      adjustment: -150,
      nextRevokedSupport: 150,
      reviewRequired: false,
      targetRevokedSupport: 150,
    });
  });

  it('never makes the wallet negative and flags consumed value for review', () => {
    expect(calculateGrantAdjustment({
      currentRevokedSupport: 0,
      effectiveReversedCents: 500,
      grantedSupport: 300,
      purchaseAmountCents: 500,
      walletPaidSupport: 40,
    })).toEqual({
      adjustment: -40,
      nextRevokedSupport: 40,
      reviewRequired: true,
      targetRevokedSupport: 300,
    });
  });

  it('restores only support that was actually revoked after a won dispute', () => {
    expect(calculateGrantAdjustment({
      currentRevokedSupport: 220,
      effectiveReversedCents: 0,
      grantedSupport: 300,
      purchaseAmountCents: 500,
      walletPaidSupport: 0,
    })).toEqual({
      adjustment: 220,
      nextRevokedSupport: 0,
      reviewRequired: false,
      targetRevokedSupport: 0,
    });
  });
});
