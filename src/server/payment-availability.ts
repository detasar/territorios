import { RELEASE_METADATA } from '../release';

export function paymentsEnabledForRelease(): boolean {
  return RELEASE_METADATA.realMoney;
}

export const PAYMENTS_DISABLED_MESSAGE = 'Payments are disabled for this closed beta.';
