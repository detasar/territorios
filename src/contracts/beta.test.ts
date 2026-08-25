import { describe, expect, it } from 'vitest';
import {
  betaConsentSchema,
  betaMetricSchema,
  betaRequestSchema,
} from './beta';
import { BETA_OPERATIONS } from '../beta/config';

describe('closed-beta input contracts', () => {
  it('requires explicit adult participation and the exact consent version', () => {
    expect(betaConsentSchema.safeParse({
      ageConfirmed: true,
      consentAccepted: true,
      consentVersion: BETA_OPERATIONS.consentVersion,
    }).success).toBe(true);
    expect(betaConsentSchema.safeParse({
      ageConfirmed: false,
      consentAccepted: true,
      consentVersion: BETA_OPERATIONS.consentVersion,
    }).success).toBe(false);
  });

  it('accepts only bounded request categories without free-form PII', () => {
    expect(betaRequestSchema.parse({ category: 'privacy-delete', issueCode: 'leave-beta' }))
      .toEqual({ category: 'privacy-delete', issueCode: 'leave-beta' });
    expect(betaRequestSchema.safeParse({ category: 'support', issueCode: 'x', details: 'email me' }).success)
      .toBe(false);
  });

  it('uses a frozen, content-free telemetry vocabulary', () => {
    expect(betaMetricSchema.parse({ event: 'share-opened' })).toEqual({ event: 'share-opened' });
    expect(betaMetricSchema.safeParse({ event: 'custom-event', value: 'private' }).success).toBe(false);
  });
});
