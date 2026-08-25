import { z } from 'zod';
import { BETA_OPERATIONS } from '../beta/config';

export const betaConsentSchema = z.object({
  ageConfirmed: z.literal(true),
  consentAccepted: z.literal(true),
  consentVersion: z.literal(BETA_OPERATIONS.consentVersion),
}).strict();

export const betaRequestSchema = z.object({
  category: z.enum([
    'support',
    'security',
    'moderation-appeal',
    'privacy-access',
    'privacy-delete',
  ]),
  issueCode: z.enum([
    'cannot-play',
    'unexpected-state',
    'account-safety',
    'urgent-threat',
    'personal-information',
    'appeal-decision',
    'export-my-data',
    'leave-beta',
  ]),
}).strict();

export const betaMetricSchema = z.object({
  event: z.enum([
    'beta-notice-viewed',
    'join-screen-viewed',
    'share-opened',
    'client-error',
  ]),
}).strict();

export type BetaConsent = {
  version: typeof BETA_OPERATIONS.consentVersion;
  participantId: string;
  consentedAt: number;
};
