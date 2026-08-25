import type { ChatGPTUser } from '../app/chatgpt-auth';
import type {
  CheckoutCommand,
  PaymentControlsCommand,
  PaymentSnapshot,
} from '../src/contracts/payments';
import { canonicalEvent, ENGINE_VERSION } from '../src/domain/world/world';
import {
  calculateGrantAdjustment,
  evaluateSpendPolicy,
  PAYMENT_LEGAL_VERSION,
} from '../src/domain/payments/payments';
import {
  getStripeClient,
  isStripeSandboxConfigured,
  type StripePaymentEvent,
} from '../src/server/stripe';
import { getRawD1 } from './index';
import { upsertUser } from './game';
import { ACTIVE_SEASON_ID, ensureWorld } from './world-bootstrap';

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const SPEND_STATUSES = "'pending','fulfilled','partially_refunded','disputed','dispute_lost'";

export class PaymentCommandError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 429 | 502,
  ) {
    super(message);
  }
}

type ProductRow = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  paid_support: number;
  entitlement_kind: string | null;
};

type PurchaseRow = {
  id: string;
  user_id: string;
  season_id: string;
  territory_code: string | null;
  product_id: string;
  provider_session_id: string | null;
  provider_payment_intent_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  payment_version: number;
  paid_support_granted: number;
  paid_support_revoked: number;
  refunded_cents: number;
  disputed_cents: number;
  product_name: string;
  paid_support: number;
  entitlement_kind: string | null;
  wallet_paid_support: number;
};

type CheckoutPurchaseRow = {
  id: string;
  status: string;
  provider_session_id: string | null;
  amount_cents: number;
  currency: string;
  product_name: string;
  product_description: string;
};

export async function getPaymentSnapshot(
  user: ChatGPTUser,
  now = Date.now(),
): Promise<PaymentSnapshot> {
  await ensureWorld(now);
  await upsertUser(user, now);
  const d1 = getRawD1();
  const [controls, purchaseRows] = await Promise.all([
    d1.prepare(
      `SELECT purchases_paused, daily_spend_limit_cents, season_spend_limit_cents, account_status
       FROM users WHERE id = ?1`,
    ).bind(user.userId).first<{
      purchases_paused: number;
      daily_spend_limit_cents: number;
      season_spend_limit_cents: number;
      account_status: string;
    }>(),
    all<{
      id: string;
      product_name: string;
      amount_cents: number;
      currency: string;
      status: string;
      paid_support_granted: number;
      paid_support_revoked: number;
      created_at: number;
      updated_at: number;
    }>(d1.prepare(
      `SELECT purchase.id, product.name AS product_name, purchase.amount_cents,
              purchase.currency, purchase.status, purchase.paid_support_granted,
              purchase.paid_support_revoked, purchase.created_at, purchase.updated_at
       FROM purchases purchase
       JOIN catalog_products product ON product.id = purchase.product_id
       WHERE purchase.user_id = ?1
       ORDER BY purchase.created_at DESC LIMIT 30`,
    ).bind(user.userId)),
  ]);
  if (!controls) throw new Error('Payment controls were not initialized.');

  return {
    mode: 'live-payments',
    sandbox: true,
    configured: isStripeSandboxConfigured(),
    legalVersion: PAYMENT_LEGAL_VERSION,
    controls: {
      purchasesPaused: Boolean(controls.purchases_paused),
      dailySpendLimitCents: controls.daily_spend_limit_cents,
      seasonSpendLimitCents: controls.season_spend_limit_cents,
      canResumePurchases: controls.account_status === 'active',
    },
    purchases: purchaseRows.map((row) => ({
      id: row.id,
      productName: row.product_name,
      amountCents: row.amount_cents,
      currency: row.currency,
      status: row.status,
      paidSupportGranted: row.paid_support_granted,
      paidSupportRevoked: row.paid_support_revoked,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

export async function createPaymentCheckout(
  user: ChatGPTUser,
  command: CheckoutCommand,
  idempotencyKey: string,
  origin: string,
  now = Date.now(),
): Promise<{ checkoutUrl: string; purchaseId: string }> {
  const checkoutOrigin = validatedOrigin(origin);
  const stripe = getStripeClient();
  await ensureWorld(now);
  await upsertUser(user, now);
  const d1 = getRawD1();

  const existing = await findPurchaseByIdempotency(user.userId, idempotencyKey);
  if (existing) return resumePendingCheckout(existing, stripe, checkoutOrigin, now);
  await assertCheckoutRateLimit(user.userId, now);

  const [product, account, membership, dailySpend, seasonSpend] = await Promise.all([
    d1.prepare(
      `SELECT id, name, description, price_cents, currency, paid_support, entitlement_kind
       FROM catalog_products WHERE id = ?1 AND active = 1`,
    ).bind(command.productId).first<ProductRow>(),
    d1.prepare(
      `SELECT created_at, purchases_paused, daily_spend_limit_cents,
              season_spend_limit_cents, account_status
       FROM users WHERE id = ?1`,
    ).bind(user.userId).first<{
      created_at: number;
      purchases_paused: number;
      daily_spend_limit_cents: number;
      season_spend_limit_cents: number;
      account_status: string;
    }>(),
    d1.prepare(
      `SELECT home_territory_code FROM faction_memberships
       WHERE season_id = ?1 AND user_id = ?2`,
    ).bind(ACTIVE_SEASON_ID, user.userId).first<{ home_territory_code: string }>(),
    d1.prepare(
      `SELECT COALESCE(SUM(amount_cents - refunded_cents), 0) AS cents
       FROM purchases WHERE user_id = ?1 AND created_at >= ?2 AND status IN (${SPEND_STATUSES})`,
    ).bind(user.userId, now - DAY_MILLISECONDS).first<{ cents: number }>(),
    d1.prepare(
      `SELECT COALESCE(SUM(amount_cents - refunded_cents), 0) AS cents
       FROM purchases WHERE user_id = ?1 AND season_id = ?2 AND status IN (${SPEND_STATUSES})`,
    ).bind(user.userId, ACTIVE_SEASON_ID).first<{ cents: number }>(),
  ]);

  if (!product) throw new PaymentCommandError('El paquete no está disponible.', 404);
  if (!account) throw new Error('Payment account was not initialized.');
  if (!membership) {
    throw new PaymentCommandError('Elige una provincia antes de comprar refuerzos.', 409);
  }

  const policy = evaluateSpendPolicy({
    accountCreatedAt: account.created_at,
    ageConfirmed: command.ageConfirmed,
    consentAccepted: command.consentAccepted && command.consentVersion === PAYMENT_LEGAL_VERSION,
    dailyLimitCents: account.daily_spend_limit_cents,
    dailySpentCents: Number(dailySpend?.cents ?? 0),
    now,
    priceCents: product.price_cents,
    purchasesPaused: Boolean(account.purchases_paused) || account.account_status !== 'active',
    seasonLimitCents: account.season_spend_limit_cents,
    seasonSpentCents: Number(seasonSpend?.cents ?? 0),
  });
  if (!policy.ok) throw spendPolicyError(policy.code);

  const purchaseId = crypto.randomUUID();
  try {
    await d1.batch([
      d1.prepare(
        `INSERT INTO purchases
         (id, user_id, season_id, territory_code, product_id, provider, amount_cents,
          currency, status, consent_version, age_confirmed_at, idempotency_key, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'stripe', ?6, ?7, 'pending', ?8, ?9, ?10, ?9, ?9)`,
      ).bind(
        purchaseId,
        user.userId,
        ACTIVE_SEASON_ID,
        membership.home_territory_code,
        product.id,
        product.price_cents,
        product.currency.toLowerCase(),
        command.consentVersion,
        now,
        idempotencyKey,
      ),
      d1.prepare(
        `INSERT INTO audit_events
         (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
         VALUES (?1, ?2, 'payment.checkout.requested', 'purchase', ?3, 'allowed', ?4, ?5)`,
      ).bind(
        crypto.randomUUID(),
        user.userId,
        purchaseId,
        canonicalEvent({ productId: product.id, consentVersion: command.consentVersion }),
        now,
      ),
    ]);
  } catch (error) {
    if (isUniqueError(error)) {
      const duplicate = await findPurchaseByIdempotency(user.userId, idempotencyKey);
      if (duplicate) return resumePendingCheckout(duplicate, stripe, checkoutOrigin, now);
    }
    throw error;
  }
  const pendingPurchase = await loadCheckoutPurchase(purchaseId);
  if (!pendingPurchase) throw new Error('Pending checkout was not persisted.');
  return startPendingCheckout(pendingPurchase, stripe, checkoutOrigin, now);
}

export async function updatePaymentControls(
  user: ChatGPTUser,
  command: PaymentControlsCommand,
  idempotencyKey: string,
  now = Date.now(),
): Promise<PaymentSnapshot> {
  await ensureWorld(now);
  await upsertUser(user, now);
  const d1 = getRawD1();
  const auditId = `payment-controls-${await sha256(`${user.userId}:${idempotencyKey}`)}`;
  const duplicate = await d1.prepare('SELECT id FROM audit_events WHERE id = ?1')
    .bind(auditId).first<{ id: string }>();
  if (duplicate) return getPaymentSnapshot(user, now);

  const current = await d1.prepare(
    `SELECT daily_spend_limit_cents, season_spend_limit_cents, account_status
     FROM users WHERE id = ?1`,
  ).bind(user.userId).first<{
    daily_spend_limit_cents: number;
    season_spend_limit_cents: number;
    account_status: string;
  }>();
  if (!current) throw new Error('Payment controls were not initialized.');
  if (
    command.dailySpendLimitCents > current.daily_spend_limit_cents ||
    command.seasonSpendLimitCents > current.season_spend_limit_cents
  ) {
    throw new PaymentCommandError(
      'Durante la beta los límites solo pueden reducirse; nunca aumentarse desde el juego.',
      409,
    );
  }
  if (!command.purchasesPaused && current.account_status !== 'active') {
    throw new PaymentCommandError('La cuenta está en revisión de pagos.', 403);
  }

  try {
    await d1.batch([
      d1.prepare(
        `UPDATE users SET purchases_paused = ?1, daily_spend_limit_cents = ?2,
                season_spend_limit_cents = ?3, updated_at = ?4 WHERE id = ?5`,
      ).bind(
        command.purchasesPaused ? 1 : 0,
        command.dailySpendLimitCents,
        command.seasonSpendLimitCents,
        now,
        user.userId,
      ),
      d1.prepare(
        `INSERT INTO audit_events
         (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
         VALUES (?1, ?2, 'payment.controls.updated', 'user', ?2, 'allowed', ?3, ?4)`,
      ).bind(auditId, user.userId, canonicalEvent(command), now),
    ]);
  } catch (error) {
    if (!isUniqueError(error)) throw error;
  }
  return getPaymentSnapshot(user, now);
}

export async function processStripeEvent(
  event: StripePaymentEvent,
  payloadHash: string,
  now = Date.now(),
): Promise<{ duplicate: boolean; status: string }> {
  if (event.livemode) throw new Error('Live-mode Stripe events are disabled.');
  if (!/^[a-f0-9]{64}$/.test(payloadHash)) throw new Error('Invalid payment payload hash.');
  const d1 = getRawD1();
  const duplicate = await d1.prepare(
    'SELECT status FROM payment_events WHERE provider_event_id = ?1',
  ).bind(event.id).first<{ status: string }>();
  if (duplicate) return { duplicate: true, status: duplicate.status };

  if (event.type === 'ignored') {
    try {
      await d1.prepare(
        `INSERT INTO payment_events
         (id, provider_event_id, purchase_id, event_type, payload_hash, status, received_at)
         VALUES (?1, ?2, NULL, ?3, ?4, 'ignored', ?5)`,
      ).bind(`payment-${event.id}`, event.id, event.providerType, payloadHash, now).run();
      return { duplicate: false, status: 'ignored' };
    } catch (error) {
      if (isUniqueError(error)) return { duplicate: true, status: 'ignored' };
      throw error;
    }
  }

  if (event.type === 'checkout_paid' || event.type === 'checkout_expired') {
    return processCheckoutEvent(event, payloadHash, now);
  }
  return processReversalEvent(event, payloadHash, now);
}

async function processCheckoutEvent(
  event: Extract<StripePaymentEvent, { type: 'checkout_paid' | 'checkout_expired' }>,
  payloadHash: string,
  now: number,
): Promise<{ duplicate: boolean; status: string }> {
  const d1 = getRawD1();
  if (!event.purchaseId) throw new Error('Stripe checkout event is missing purchase metadata.');
  const purchase = await loadPurchase('purchase.id = ?1', event.purchaseId);
  if (!purchase) throw new Error('Stripe checkout references an unknown purchase.');
  if (purchase.provider_session_id && purchase.provider_session_id !== event.sessionId) {
    throw new Error('Stripe checkout session mismatch.');
  }

  if (event.type === 'checkout_expired') {
    try {
      await d1.batch([
        paymentEventInsert(event, purchase.id, payloadHash, 'processed', now),
        d1.prepare(
          `UPDATE purchases SET status = 'expired', payment_version = payment_version + 1, updated_at = ?1
           WHERE id = ?2 AND status = 'pending' AND payment_version = ?3`,
        ).bind(now, purchase.id, purchase.payment_version),
      ]);
      return { duplicate: false, status: 'processed' };
    } catch (error) {
      if (isUniqueError(error)) return { duplicate: true, status: 'processed' };
      throw error;
    }
  }

  if (
    event.amountCents !== purchase.amount_cents ||
    event.currency !== purchase.currency ||
    !event.paymentIntentId
  ) {
    throw new Error('Stripe checkout amount, currency, or payment intent mismatch.');
  }

  if (purchase.status !== 'pending') {
    await recordSemanticDuplicate(event, purchase.id, payloadHash, now);
    return { duplicate: false, status: 'duplicate_semantics' };
  }

  const payload = canonicalEvent({
    purchaseId: purchase.id,
    productId: purchase.product_id,
    amountCents: purchase.amount_cents,
    currency: purchase.currency,
    paidSupport: purchase.paid_support,
  });
  const eventHash = await sha256(payload);
  const providerEventGate =
    'EXISTS (SELECT 1 FROM payment_events WHERE provider_event_id = ?)';
  const statements: D1PreparedStatement[] = [
    d1.prepare(
      `INSERT INTO payment_events
       (id, provider_event_id, purchase_id, event_type, payload_hash, status, received_at)
       SELECT ?, ?, ?, ?, ?, 'processed', ?
       FROM purchases
       WHERE id = ? AND status = 'pending' AND payment_version = ?`,
    ).bind(
      `payment-${event.id}`,
      event.id,
      purchase.id,
      event.type,
      payloadHash,
      now,
      purchase.id,
      purchase.payment_version,
    ),
    d1.prepare(
      `UPDATE wallets SET paid_support = paid_support + ?,
              supporter_points = supporter_points + ?, updated_at = ?
       WHERE season_id = ? AND user_id = ? AND ${providerEventGate}`,
    ).bind(
      purchase.paid_support,
      purchase.paid_support,
      now,
      purchase.season_id,
      purchase.user_id,
      event.id,
    ),
    d1.prepare(
      `INSERT INTO ledger_entries
       (id, season_id, user_id, territory_code, asset_kind, amount, reason, event_id, idempotency_key, created_at)
       SELECT ?, ?, ?, ?, 'paid_support', ?, 'PAID_SUPPORT_PURCHASED', ?, ?, ?
       WHERE ${providerEventGate}`,
    ).bind(
      `ledger-${event.id}`,
      purchase.season_id,
      purchase.user_id,
      purchase.territory_code,
      purchase.paid_support,
      `game-${event.id}`,
      `purchase-credit-${purchase.id}`,
      now,
      event.id,
    ),
    d1.prepare(
      `INSERT INTO game_events
       (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id,
        payload_json, payload_hash, engine_version, created_at)
       SELECT ?, ?, 'PAID_SUPPORT_PURCHASED', ?, 'purchase', ?, ?, ?, ?, ?
       WHERE ${providerEventGate}`,
    ).bind(
      `game-${event.id}`,
      purchase.season_id,
      purchase.user_id,
      purchase.id,
      payload,
      eventHash,
      ENGINE_VERSION,
      now,
      event.id,
    ),
    d1.prepare(
      `INSERT INTO audit_events
       (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
       SELECT ?, ?, 'payment.checkout.fulfilled', 'purchase', ?, 'allowed', ?, ?
       WHERE ${providerEventGate}`,
    ).bind(
      `audit-${event.id}`,
      purchase.user_id,
      purchase.id,
      canonicalEvent({ providerEventId: event.id, payloadHash }),
      now,
      event.id,
    ),
  ];
  if (purchase.entitlement_kind) {
    statements.push(d1.prepare(
      `INSERT INTO entitlements
       (id, user_id, purchase_id, entitlement_kind, entitlement_key, status, granted_at, revoked_at)
       SELECT ?, ?, ?, ?, ?, 'active', ?, NULL
       WHERE ${providerEventGate}`,
    ).bind(
      `entitlement-${purchase.id}`,
      purchase.user_id,
      purchase.id,
      purchase.entitlement_kind,
      purchase.entitlement_kind,
      now,
      event.id,
    ));
  }
  statements.push(d1.prepare(
    `UPDATE purchases SET status = 'fulfilled', provider_session_id = ?,
            provider_payment_intent_id = ?, paid_support_granted = ?,
            payment_version = payment_version + 1, updated_at = ?
     WHERE id = ? AND status = 'pending' AND payment_version = ?
       AND ${providerEventGate}`,
  ).bind(
    event.sessionId,
    event.paymentIntentId,
    purchase.paid_support,
    now,
    purchase.id,
    purchase.payment_version,
    event.id,
  ));

  try {
    await d1.batch(statements);
    const recorded = await d1.prepare(
      'SELECT status FROM payment_events WHERE provider_event_id = ?1',
    ).bind(event.id).first<{ status: string }>();
    if (recorded) return { duplicate: false, status: recorded.status };
    const current = await loadPurchase('purchase.id = ?1', purchase.id);
    if (current && current.status !== 'pending') {
      await recordSemanticDuplicate(event, purchase.id, payloadHash, now);
      return { duplicate: false, status: 'duplicate_semantics' };
    }
    throw new Error('Concurrent checkout fulfillment did not converge.');
  } catch (error) {
    if (isUniqueError(error)) {
      const recorded = await d1.prepare(
        'SELECT status FROM payment_events WHERE provider_event_id = ?1',
      ).bind(event.id).first<{ status: string }>();
      if (recorded) return { duplicate: true, status: recorded.status };
    }
    throw error;
  }
}

async function processReversalEvent(
  event: Extract<StripePaymentEvent, {
    type: 'refund_created' | 'dispute_opened' | 'dispute_won' | 'dispute_lost';
  }>,
  payloadHash: string,
  now: number,
): Promise<{ duplicate: boolean; status: string }> {
  if (!event.paymentIntentId) throw new Error('Stripe reversal is missing a payment intent.');
  const d1 = getRawD1();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const priorEvent = await d1.prepare(
      'SELECT status FROM payment_events WHERE provider_event_id = ?1',
    ).bind(event.id).first<{ status: string }>();
    if (priorEvent) return { duplicate: true, status: priorEvent.status };

    const purchase = await loadPurchase(
      'purchase.provider_payment_intent_id = ?1',
      event.paymentIntentId,
    );
    if (!purchase) throw new Error('Stripe reversal references an unknown payment intent.');
    if (
      event.currency !== purchase.currency ||
      event.amountCents <= 0 ||
      event.amountCents > purchase.amount_cents
    ) {
      throw new Error('Stripe reversal amount or currency mismatch.');
    }

    let nextRefunded = purchase.refunded_cents;
    let nextDisputed = purchase.disputed_cents;
    let nextStatus = purchase.status;
    if (event.type === 'refund_created') {
      nextRefunded = Math.min(purchase.amount_cents, nextRefunded + event.amountCents);
      if (nextDisputed === 0) {
        nextStatus = nextRefunded === purchase.amount_cents ? 'refunded' : 'partially_refunded';
      }
    } else if (event.type === 'dispute_opened') {
      nextDisputed = Math.max(nextDisputed, event.amountCents);
      nextStatus = 'disputed';
    } else if (event.type === 'dispute_won') {
      nextDisputed = 0;
      nextStatus = nextRefunded === purchase.amount_cents
        ? 'refunded'
        : nextRefunded > 0 ? 'partially_refunded' : 'fulfilled';
    } else {
      nextDisputed = Math.max(nextDisputed, event.amountCents);
      nextStatus = 'dispute_lost';
    }
    const afterExposure = Math.max(nextRefunded, nextDisputed);
    const adjustment = calculateGrantAdjustment({
      currentRevokedSupport: purchase.paid_support_revoked,
      effectiveReversedCents: afterExposure,
      grantedSupport: purchase.paid_support_granted,
      purchaseAmountCents: purchase.amount_cents,
      walletPaidSupport: purchase.wallet_paid_support,
    });
    const debit = Math.max(0, -adjustment.adjustment);
    const providerEventGate =
      'EXISTS (SELECT 1 FROM payment_events WHERE provider_event_id = ?)';
    const reason = reversalReason(event.type, adjustment.adjustment);
    const gameEventType = reversalGameEvent(event.type);
    const domainPayload = canonicalEvent({
      purchaseId: purchase.id,
      providerEventId: event.id,
      amountCents: event.amountCents,
      effectiveReversedCents: afterExposure,
      supportAdjustment: adjustment.adjustment,
      historicalBattlesChanged: false,
    });
    const statements: D1PreparedStatement[] = [
      d1.prepare(
        `INSERT INTO payment_events
         (id, provider_event_id, purchase_id, event_type, payload_hash, status, received_at)
         SELECT ?, ?, ?, ?, ?, 'processed', ?
         FROM purchases purchase
         JOIN wallets wallet ON wallet.season_id = purchase.season_id AND wallet.user_id = purchase.user_id
         WHERE purchase.id = ? AND purchase.payment_version = ?
           AND (? = 0 OR wallet.paid_support >= ?)`,
      ).bind(
        `payment-${event.id}`,
        event.id,
        purchase.id,
        event.type,
        payloadHash,
        now,
        purchase.id,
        purchase.payment_version,
        debit,
        debit,
      ),
      d1.prepare(
        `UPDATE wallets SET paid_support = paid_support + ?,
                supporter_points = MAX(0, supporter_points + ?), updated_at = ?
         WHERE season_id = ? AND user_id = ? AND ${providerEventGate}`,
      ).bind(
        adjustment.adjustment,
        adjustment.adjustment,
        now,
        purchase.season_id,
        purchase.user_id,
        event.id,
      ),
    ];
    if (adjustment.adjustment !== 0) {
      statements.push(d1.prepare(
        `INSERT INTO ledger_entries
         (id, season_id, user_id, territory_code, asset_kind, amount, reason, event_id, idempotency_key, created_at)
         SELECT ?, purchase.season_id, purchase.user_id, purchase.territory_code,
                'paid_support', ?, ?, ?, ?, ?
         FROM purchases purchase
         WHERE purchase.id = ? AND ${providerEventGate}`,
      ).bind(
        `ledger-${event.id}`,
        adjustment.adjustment,
        reason,
        `game-${event.id}`,
        `payment-reversal-${event.id}`,
        now,
        purchase.id,
        event.id,
      ));
    }
    statements.push(
      d1.prepare(
        `INSERT INTO game_events
         (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id,
          payload_json, payload_hash, engine_version, created_at)
         SELECT ?, purchase.season_id, ?, purchase.user_id, 'purchase', purchase.id,
                ?, ?, ?, ?
         FROM purchases purchase
         WHERE purchase.id = ? AND ${providerEventGate}`,
      ).bind(
        `game-${event.id}`,
        gameEventType,
        domainPayload,
        await sha256(domainPayload),
        ENGINE_VERSION,
        now,
        purchase.id,
        event.id,
      ),
      d1.prepare(
        `INSERT INTO audit_events
         (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
         SELECT ?, purchase.user_id, ?, 'purchase', purchase.id, ?, ?, ?
         FROM purchases purchase
         WHERE purchase.id = ? AND ${providerEventGate}`,
      ).bind(
        `audit-${event.id}`,
        `payment.${event.type}`,
        adjustment.reviewRequired ? 'review' : 'allowed',
        canonicalEvent({ payloadHash, reviewRequired: adjustment.reviewRequired }),
        now,
        purchase.id,
        event.id,
      ),
    );
    if (purchase.entitlement_kind) {
      statements.push(d1.prepare(
        `UPDATE entitlements SET status = ?, revoked_at = ?
         WHERE purchase_id = ? AND ${providerEventGate}`,
      ).bind(
        afterExposure >= purchase.amount_cents ? 'revoked' : 'active',
        afterExposure >= purchase.amount_cents ? now : null,
        purchase.id,
        event.id,
      ));
    }
    statements.push(d1.prepare(
      `UPDATE purchases AS purchase
       SET status = ?, refunded_cents = ?, disputed_cents = ?,
           paid_support_revoked = ?, payment_version = payment_version + 1, updated_at = ?
       WHERE purchase.id = ? AND purchase.payment_version = ? AND ${providerEventGate}`,
    ).bind(
      nextStatus,
      nextRefunded,
      nextDisputed,
      adjustment.nextRevokedSupport,
      now,
      purchase.id,
      purchase.payment_version,
      event.id,
    ));
    if (
      event.type === 'dispute_opened' ||
      event.type === 'dispute_lost' ||
      adjustment.reviewRequired
    ) {
      statements.push(d1.prepare(
        `UPDATE users SET purchases_paused = 1, account_status = 'payment_review', updated_at = ?
         WHERE id = ? AND ${providerEventGate}`,
      ).bind(now, purchase.user_id, event.id));
    } else if (event.type === 'dispute_won') {
      statements.push(d1.prepare(
        `UPDATE users SET account_status = CASE WHEN EXISTS (
           SELECT 1 FROM purchases WHERE user_id = ? AND status IN ('disputed','dispute_lost')
         ) THEN 'payment_review' ELSE 'active' END, updated_at = ?
         WHERE id = ? AND ${providerEventGate}`,
      ).bind(purchase.user_id, now, purchase.user_id, event.id));
    }

    try {
      await d1.batch(statements);
    } catch (error) {
      if (isUniqueError(error)) {
        const recorded = await d1.prepare(
          'SELECT status FROM payment_events WHERE provider_event_id = ?1',
        ).bind(event.id).first<{ status: string }>();
        if (recorded) return { duplicate: true, status: recorded.status };
      }
      throw error;
    }
    const recorded = await d1.prepare(
      'SELECT status FROM payment_events WHERE provider_event_id = ?1',
    ).bind(event.id).first<{ status: string }>();
    if (recorded) return { duplicate: false, status: recorded.status };
  }
  throw new Error('Concurrent payment updates did not converge.');
}

async function loadPurchase(where: string, value: string): Promise<PurchaseRow | null> {
  return getRawD1().prepare(
    `SELECT purchase.id, purchase.user_id, purchase.season_id, purchase.territory_code,
            purchase.product_id, purchase.provider_session_id, purchase.provider_payment_intent_id,
            purchase.amount_cents, purchase.currency, purchase.status, purchase.payment_version,
            purchase.paid_support_granted, purchase.paid_support_revoked,
            purchase.refunded_cents, purchase.disputed_cents, product.name AS product_name,
            product.paid_support, product.entitlement_kind,
            wallet.paid_support AS wallet_paid_support
     FROM purchases purchase
     JOIN catalog_products product ON product.id = purchase.product_id
     JOIN wallets wallet ON wallet.season_id = purchase.season_id AND wallet.user_id = purchase.user_id
     WHERE ${where}`,
  ).bind(value).first<PurchaseRow>();
}

async function findPurchaseByIdempotency(
  userId: string,
  idempotencyKey: string,
): Promise<Pick<PurchaseRow, 'id' | 'provider_session_id' | 'status'> | null> {
  return getRawD1().prepare(
    `SELECT id, provider_session_id, status FROM purchases
     WHERE user_id = ?1 AND idempotency_key = ?2`,
  ).bind(userId, idempotencyKey).first<Pick<
    PurchaseRow,
    'id' | 'provider_session_id' | 'status'
  >>();
}

async function resumePendingCheckout(
  purchase: Pick<PurchaseRow, 'id' | 'provider_session_id' | 'status'>,
  stripe: ReturnType<typeof getStripeClient>,
  origin: string,
  now: number,
): Promise<{ checkoutUrl: string; purchaseId: string }> {
  if (purchase.status !== 'pending') {
    throw new PaymentCommandError('Esta solicitud de compra ya fue cerrada.', 409);
  }
  if (purchase.provider_session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(purchase.provider_session_id);
      return { checkoutUrl: validatedCheckoutUrl(session.url), purchaseId: purchase.id };
    } catch {
      throw new PaymentCommandError('Stripe sandbox no pudo recuperar el pago.', 502);
    }
  }
  const pendingPurchase = await loadCheckoutPurchase(purchase.id);
  if (!pendingPurchase) throw new Error('Pending checkout was not found.');
  return startPendingCheckout(pendingPurchase, stripe, origin, now);
}

async function loadCheckoutPurchase(purchaseId: string): Promise<CheckoutPurchaseRow | null> {
  return getRawD1().prepare(
    `SELECT purchase.id, purchase.status, purchase.provider_session_id,
            purchase.amount_cents, purchase.currency, product.name AS product_name,
            product.description AS product_description
     FROM purchases purchase
     JOIN catalog_products product ON product.id = purchase.product_id
     WHERE purchase.id = ?1`,
  ).bind(purchaseId).first<CheckoutPurchaseRow>();
}

async function startPendingCheckout(
  purchase: CheckoutPurchaseRow,
  stripe: ReturnType<typeof getStripeClient>,
  origin: string,
  now: number,
): Promise<{ checkoutUrl: string; purchaseId: string }> {
  if (purchase.status !== 'pending') {
    throw new PaymentCommandError('Esta solicitud de compra ya fue cerrada.', 409);
  }
  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: purchase.currency,
          product_data: {
            name: purchase.product_name,
            description: purchase.product_description,
          },
          unit_amount: purchase.amount_cents,
        },
        quantity: 1,
      }],
      client_reference_id: purchase.id,
      metadata: { purchase_id: purchase.id },
      payment_intent_data: { metadata: { purchase_id: purchase.id } },
      success_url: `${origin}/checkout/success?purchase=${encodeURIComponent(purchase.id)}`,
      cancel_url: `${origin}/checkout/cancel`,
    }, { idempotencyKey: `territorios-${purchase.id}` });
  } catch {
    throw new PaymentCommandError('Stripe sandbox no pudo iniciar el pago.', 502);
  }

  const checkoutUrl = validatedCheckoutUrl(session.url);
  await getRawD1().prepare(
    `UPDATE purchases SET provider_session_id = ?1, payment_version = payment_version + 1, updated_at = ?2
     WHERE id = ?3 AND status = 'pending' AND provider_session_id IS NULL`,
  ).bind(session.id, now, purchase.id).run();
  return { checkoutUrl, purchaseId: purchase.id };
}

function paymentEventInsert(
  event: StripePaymentEvent,
  purchaseId: string,
  payloadHash: string,
  status: string,
  now: number,
): D1PreparedStatement {
  return getRawD1().prepare(
    `INSERT INTO payment_events
     (id, provider_event_id, purchase_id, event_type, payload_hash, status, received_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  ).bind(`payment-${event.id}`, event.id, purchaseId, event.type, payloadHash, status, now);
}

async function recordSemanticDuplicate(
  event: StripePaymentEvent,
  purchaseId: string,
  payloadHash: string,
  now: number,
): Promise<void> {
  try {
    await paymentEventInsert(event, purchaseId, payloadHash, 'duplicate_semantics', now).run();
  } catch (error) {
    if (!isUniqueError(error)) throw error;
  }
}

function reversalReason(type: string, adjustment: number): string {
  if (adjustment > 0) return 'DISPUTE_WON_RESTORE';
  if (type === 'refund_created') return 'PAYMENT_REFUNDED';
  return 'CHARGEBACK_RECEIVED';
}

function reversalGameEvent(type: string): string {
  if (type === 'refund_created') return 'PAYMENT_REFUNDED';
  if (type === 'dispute_won') return 'PAYMENT_DISPUTE_WON';
  if (type === 'dispute_lost') return 'PAYMENT_DISPUTE_LOST';
  return 'CHARGEBACK_RECEIVED';
}

function spendPolicyError(code: string): PaymentCommandError {
  const messages: Record<string, string> = {
    AGE_CONFIRMATION_REQUIRED: 'La beta de pago está limitada a mayores de 18 años.',
    LEGAL_CONSENT_REQUIRED: 'Acepta las condiciones de la beta de pago.',
    PURCHASES_PAUSED: 'Las compras están pausadas para esta cuenta.',
    NEW_ACCOUNT_LIMIT_EXCEEDED: 'Las cuentas nuevas tienen un límite de 20 € durante 24 horas.',
    DAILY_LIMIT_EXCEEDED: 'Esta compra superaría tu límite diario.',
    SEASON_LIMIT_EXCEEDED: 'Esta compra superaría tu límite de temporada.',
  };
  return new PaymentCommandError(messages[code] ?? 'La compra no cumple la política de gasto.', 409);
}

async function assertCheckoutRateLimit(userId: string, now: number): Promise<void> {
  const row = await getRawD1().prepare(
    `SELECT COUNT(*) AS count FROM audit_events
     WHERE actor_user_id = ?1 AND action = 'payment.checkout.requested' AND created_at >= ?2`,
  ).bind(userId, now - 60 * 60 * 1_000).first<{ count: number }>();
  if (Number(row?.count ?? 0) >= 6) {
    throw new PaymentCommandError(
      'Demasiados intentos de checkout. Inténtalo de nuevo más tarde.',
      429,
    );
  }
}

function validatedOrigin(origin: string): string {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new PaymentCommandError('Origen de pago inválido.', 400);
  }
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.origin !== origin || (url.protocol !== 'https:' && !local)) {
    throw new PaymentCommandError('Origen de pago inválido.', 400);
  }
  return url.origin;
}

function validatedCheckoutUrl(value: string | null): string {
  if (!value) throw new PaymentCommandError('La sesión de pago ya no está disponible.', 409);
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') {
    throw new Error('Stripe returned an unexpected checkout origin.');
  }
  return url.toString();
}

function isUniqueError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique|constraint/i.test(message);
}

async function all<T>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>();
  return result.results ?? [];
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
