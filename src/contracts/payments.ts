import { z } from 'zod';
import { PAYMENT_LEGAL_VERSION } from '../domain/payments/payments';

export const checkoutCommandSchema = z.object({
  productId: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/),
  ageConfirmed: z.literal(true),
  consentAccepted: z.literal(true),
  consentVersion: z.literal(PAYMENT_LEGAL_VERSION),
});

export const paymentControlsSchema = z.object({
  purchasesPaused: z.boolean(),
  dailySpendLimitCents: z.number().int().min(0).max(5_000),
  seasonSpendLimitCents: z.number().int().min(0).max(15_000),
}).refine(
  (value) => value.seasonSpendLimitCents >= value.dailySpendLimitCents,
  { message: 'Season limit must be at least the daily limit.' },
);

export type CheckoutCommand = z.infer<typeof checkoutCommandSchema>;
export type PaymentControlsCommand = z.infer<typeof paymentControlsSchema>;

export type PaymentSnapshot = {
  mode: 'live-payments';
  sandbox: true;
  configured: boolean;
  legalVersion: string;
  controls: {
    purchasesPaused: boolean;
    dailySpendLimitCents: number;
    seasonSpendLimitCents: number;
    canResumePurchases: boolean;
  };
  purchases: Array<{
    id: string;
    productName: string;
    amountCents: number;
    currency: string;
    status: string;
    paidSupportGranted: number;
    paidSupportRevoked: number;
    createdAt: number;
    updatedAt: number;
  }>;
};
