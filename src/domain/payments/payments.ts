export const PAYMENT_LEGAL_VERSION = 'paid-beta-2026-08-25';
export const NEW_ACCOUNT_LIMIT_CENTS = 2_000;
export const NEW_ACCOUNT_WINDOW_MILLISECONDS = 24 * 60 * 60 * 1_000;

export type SpendPolicyCode =
  | 'AGE_CONFIRMATION_REQUIRED'
  | 'LEGAL_CONSENT_REQUIRED'
  | 'PURCHASES_PAUSED'
  | 'NEW_ACCOUNT_LIMIT_EXCEEDED'
  | 'DAILY_LIMIT_EXCEEDED'
  | 'SEASON_LIMIT_EXCEEDED';

export type SpendPolicyInput = {
  accountCreatedAt: number;
  ageConfirmed: boolean;
  consentAccepted: boolean;
  dailyLimitCents: number;
  dailySpentCents: number;
  now: number;
  priceCents: number;
  purchasesPaused: boolean;
  seasonLimitCents: number;
  seasonSpentCents: number;
};

export function evaluateSpendPolicy(
  input: SpendPolicyInput,
): { ok: true } | { ok: false; code: SpendPolicyCode } {
  if (!input.ageConfirmed) return { ok: false, code: 'AGE_CONFIRMATION_REQUIRED' };
  if (!input.consentAccepted) return { ok: false, code: 'LEGAL_CONSENT_REQUIRED' };
  if (input.purchasesPaused) return { ok: false, code: 'PURCHASES_PAUSED' };
  if (
    input.now - input.accountCreatedAt < NEW_ACCOUNT_WINDOW_MILLISECONDS &&
    input.dailySpentCents + input.priceCents > NEW_ACCOUNT_LIMIT_CENTS
  ) {
    return { ok: false, code: 'NEW_ACCOUNT_LIMIT_EXCEEDED' };
  }
  if (input.dailySpentCents + input.priceCents > input.dailyLimitCents) {
    return { ok: false, code: 'DAILY_LIMIT_EXCEEDED' };
  }
  if (input.seasonSpentCents + input.priceCents > input.seasonLimitCents) {
    return { ok: false, code: 'SEASON_LIMIT_EXCEEDED' };
  }
  return { ok: true };
}

export type PurchaseStatus =
  | 'pending'
  | 'fulfilled'
  | 'partially_refunded'
  | 'refunded'
  | 'disputed'
  | 'dispute_lost'
  | 'expired'
  | 'failed';

export type PaymentTransition =
  | 'checkout_paid'
  | 'checkout_expired'
  | 'partial_refund'
  | 'full_refund'
  | 'dispute_opened'
  | 'dispute_won'
  | 'dispute_lost';

export type RefundState = 'none' | 'partial' | 'full';

const VALID_TRANSITIONS: Partial<Record<PurchaseStatus, Partial<Record<PaymentTransition, PurchaseStatus>>>> = {
  pending: {
    checkout_paid: 'fulfilled',
    checkout_expired: 'expired',
  },
  fulfilled: {
    checkout_paid: 'fulfilled',
    partial_refund: 'partially_refunded',
    full_refund: 'refunded',
    dispute_opened: 'disputed',
  },
  partially_refunded: {
    partial_refund: 'partially_refunded',
    full_refund: 'refunded',
    dispute_opened: 'disputed',
  },
  refunded: {
    full_refund: 'refunded',
    dispute_opened: 'disputed',
  },
  disputed: {
    dispute_opened: 'disputed',
    dispute_lost: 'dispute_lost',
  },
  dispute_lost: {
    dispute_lost: 'dispute_lost',
  },
};

export function nextPurchaseStatus(
  current: PurchaseStatus,
  event: PaymentTransition,
  refundState: RefundState = 'none',
): PurchaseStatus {
  if (current === 'disputed' && event === 'dispute_won') {
    if (refundState === 'full') return 'refunded';
    if (refundState === 'partial') return 'partially_refunded';
    return 'fulfilled';
  }
  const next = VALID_TRANSITIONS[current]?.[event];
  if (!next) throw new Error(`Invalid purchase transition: ${current} -> ${event}`);
  return next;
}

export type GrantAdjustmentInput = {
  currentRevokedSupport: number;
  effectiveReversedCents: number;
  grantedSupport: number;
  purchaseAmountCents: number;
  walletPaidSupport: number;
};

export type GrantAdjustment = {
  adjustment: number;
  nextRevokedSupport: number;
  reviewRequired: boolean;
  targetRevokedSupport: number;
};

export function calculateGrantAdjustment(input: GrantAdjustmentInput): GrantAdjustment {
  if (
    !Number.isInteger(input.currentRevokedSupport) || input.currentRevokedSupport < 0 ||
    !Number.isInteger(input.effectiveReversedCents) || input.effectiveReversedCents < 0 ||
    !Number.isInteger(input.grantedSupport) || input.grantedSupport < 0 ||
    !Number.isInteger(input.purchaseAmountCents) || input.purchaseAmountCents <= 0 ||
    !Number.isInteger(input.walletPaidSupport) || input.walletPaidSupport < 0
  ) {
    throw new Error('Invalid paid-support compensation input.');
  }

  const boundedCents = Math.min(input.purchaseAmountCents, input.effectiveReversedCents);
  const targetRevokedSupport = Math.floor(
    (input.grantedSupport * boundedCents) / input.purchaseAmountCents,
  );
  const desiredAdjustment = input.currentRevokedSupport - targetRevokedSupport;

  if (desiredAdjustment > 0) {
    return {
      adjustment: desiredAdjustment,
      nextRevokedSupport: targetRevokedSupport,
      reviewRequired: false,
      targetRevokedSupport,
    };
  }

  const requestedDebit = Math.abs(desiredAdjustment);
  const actualDebit = Math.min(input.walletPaidSupport, requestedDebit);
  return {
    adjustment: -actualDebit,
    nextRevokedSupport: input.currentRevokedSupport + actualDebit,
    reviewRequired: actualDebit < requestedDebit,
    targetRevokedSupport,
  };
}
