import { BETA_OPERATIONS } from '../src/beta/config';
import type { BetaConsent } from '../src/contracts/beta';
import { getRawD1 } from './index';

export class BetaCommandError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 429,
  ) {
    super(message);
  }
}

export async function betaConsentForUser(userId: string): Promise<BetaConsent | null> {
  const row = await getRawD1().prepare(
    `SELECT target_id, metadata_json, created_at
     FROM audit_events
     WHERE actor_user_id = ?1 AND action = 'beta.consent' AND outcome = 'accepted'
     ORDER BY created_at DESC LIMIT 1`,
  ).bind(userId).first<{ target_id: string; metadata_json: string; created_at: number }>();
  if (!row) return null;
  try {
    const metadata = JSON.parse(row.metadata_json) as { consentVersion?: string };
    if (metadata.consentVersion !== BETA_OPERATIONS.consentVersion || !/^P-[A-F0-9]{8}$/.test(row.target_id)) {
      return null;
    }
    return {
      version: BETA_OPERATIONS.consentVersion,
      participantId: row.target_id,
      consentedAt: row.created_at,
    };
  } catch {
    return null;
  }
}

export async function hasCurrentBetaConsent(userId: string): Promise<boolean> {
  return Boolean(await betaConsentForUser(userId));
}

export async function recordBetaConsent(
  userId: string,
  idempotencyKey: string,
  now = Date.now(),
): Promise<BetaConsent> {
  const auditId = `audit-beta-consent-${(await sha256(`${userId}|${BETA_OPERATIONS.consentVersion}`)).slice(0, 24)}`;
  const existing = await betaConsentForUser(userId);
  if (existing) return existing;
  const participantId = `P-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
  await getRawD1().prepare(
    `INSERT OR IGNORE INTO audit_events
     (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
     VALUES (?1, ?2, 'beta.consent', 'participant', ?3, 'accepted', ?4, ?5)`,
  ).bind(
    auditId,
    userId,
    participantId,
    JSON.stringify({
      ageConfirmed: true,
      consentVersion: BETA_OPERATIONS.consentVersion,
      idempotencyHash: (await sha256(idempotencyKey)).slice(0, 16),
      noRealMoneyAcknowledged: true,
    }),
    now,
  ).run();
  const recorded = await betaConsentForUser(userId);
  if (!recorded) throw new BetaCommandError('No se pudo registrar el consentimiento de la beta.', 400);
  return recorded;
}

export async function recordBetaRequest(
  userId: string,
  request: {
    category: 'support' | 'security' | 'moderation-appeal' | 'privacy-access' | 'privacy-delete';
    issueCode: string;
  },
  idempotencyKey: string,
  now = Date.now(),
): Promise<{ requestId: string; reviewWithinHours: number }> {
  const consent = await betaConsentForUser(userId);
  if (!consent) throw new BetaCommandError('Acepta primero las condiciones de la beta cerrada.', 403);
  const recent = await getRawD1().prepare(
    `SELECT COUNT(*) AS count FROM audit_events
     WHERE actor_user_id = ?1 AND action = 'beta.request' AND created_at >= ?2`,
  ).bind(userId, now - 60 * 60 * 1_000).first<{ count: number }>();
  if ((recent?.count ?? 0) >= 6) throw new BetaCommandError('Demasiadas solicitudes; inténtalo más tarde.', 429);

  const auditId = `audit-beta-request-${(await sha256(`${userId}|${idempotencyKey}`)).slice(0, 24)}`;
  const reviewWithinHours = request.issueCode === 'urgent-threat'
    ? BETA_OPERATIONS.urgentReviewHours
    : request.category === 'moderation-appeal'
      ? BETA_OPERATIONS.appealReviewHours
      : BETA_OPERATIONS.normalReviewHours;
  await getRawD1().prepare(
    `INSERT OR IGNORE INTO audit_events
     (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
     VALUES (?1, ?2, 'beta.request', 'participant', ?3, 'queued', ?4, ?5)`,
  ).bind(
    auditId,
    userId,
    consent.participantId,
    JSON.stringify({ category: request.category, issueCode: request.issueCode, reviewWithinHours }),
    now,
  ).run();
  return { requestId: `BR-${auditId.slice(-12).toUpperCase()}`, reviewWithinHours };
}

export async function recordBetaMetric(
  userId: string,
  event: 'beta-notice-viewed' | 'join-screen-viewed' | 'share-opened' | 'client-error',
  idempotencyKey: string,
  now = Date.now(),
): Promise<void> {
  const consent = await betaConsentForUser(userId);
  if (!consent) return;
  const auditId = `audit-beta-metric-${(await sha256(`${userId}|${idempotencyKey}`)).slice(0, 24)}`;
  await getRawD1().prepare(
    `INSERT OR IGNORE INTO audit_events
     (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
     VALUES (?1, ?2, 'beta.metric', 'participant', ?3, 'recorded', ?4, ?5)`,
  ).bind(auditId, userId, consent.participantId, JSON.stringify({ event }), now).run();
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
