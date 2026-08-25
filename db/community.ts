import type { CommunitySnapshot } from '../src/contracts/game';
import type { AnnouncementKey, ReportReason } from '../src/domain/community/moderation';
import { classifyReport, sanitizeReportDetails } from '../src/domain/community/moderation';
import { roleActionFor } from '../src/domain/community/roles';
import {
  buildCouncilRoster,
  resolveRankedChoice,
  type RankedBallot,
} from '../src/domain/governance/governance';
import { canonicalEvent, ENGINE_VERSION } from '../src/domain/world/world';
import { GameCommandError, type IdentityUser } from './game';
import { getRawD1 } from './index';
import { ACTIVE_SEASON_ID, ensureWorld } from './world-bootstrap';

const HOUR_MILLISECONDS = 60 * 60 * 1_000;
const DAY_MILLISECONDS = 24 * HOUR_MILLISECONDS;
const COUNCIL_TERM_MILLISECONDS = 7 * DAY_MILLISECONDS;
const SEAT_KINDS = ['public-1', 'public-2', 'defense', 'strategy', 'supporter'] as const;

type MembershipRow = {
  faction_id: string;
  faction_name: string;
  home_territory_code: string;
  territory_name: string;
  role: string;
  contribution_score: number;
};

type CandidateRow = {
  user_id: string;
  role: string;
  contribution_score: number;
  supporter_points: number;
};

type BallotRow = {
  election_kind: string;
  voter_user_id: string;
  ranked_choices_json: string;
};

type SeatRow = {
  seat_kind: (typeof SEAT_KINDS)[number];
  user_id: string | null;
  role: string | null;
  term_ends_at: number;
};

type AnnouncementRow = {
  id: string;
  territory_code: string;
  territory_name: string;
  author_user_id: string;
  message_key: string;
  status: string;
  upvotes: number;
  downvotes: number;
  created_at: number;
};

export async function getCommunitySnapshot(
  viewerUserId: string | null,
  now = Date.now(),
): Promise<CommunitySnapshot> {
  await ensureWorld(now);
  const d1 = getRawD1();
  const membership = viewerUserId ? await getMembership(viewerUserId) : null;
  const territoryCode = membership?.home_territory_code ?? null;
  const candidateRows = territoryCode
    ? await getCandidates(membership!.faction_id)
    : [];
  const candidateProfiles = await Promise.all(
    candidateRows.map(async (candidate) => {
      const candidateRef = await publicUserRef(candidate.user_id);
      return {
        ...candidate,
        candidateRef,
        label: publicLabel(candidateRef),
      };
    }),
  );
  const candidateByUserId = new Map(candidateProfiles.map((candidate) => [candidate.user_id, candidate]));

  const [seatRows, ballotRows, validTargetRows] = territoryCode
    ? await Promise.all([
        all<SeatRow>(
          d1.prepare(
            `SELECT seat.seat_kind, seat.user_id, membership.role, seat.term_ends_at
             FROM council_seats seat
             LEFT JOIN faction_memberships membership
               ON membership.season_id = seat.season_id AND membership.user_id = seat.user_id
             WHERE seat.season_id = ?1 AND seat.territory_code = ?2
             ORDER BY CASE seat.seat_kind
               WHEN 'public-1' THEN 1 WHEN 'public-2' THEN 2 WHEN 'defense' THEN 3
               WHEN 'strategy' THEN 4 ELSE 5 END`,
          ).bind(ACTIVE_SEASON_ID, territoryCode),
        ),
        all<BallotRow>(
          d1.prepare(
            `SELECT election_kind, voter_user_id, ranked_choices_json
             FROM council_ballots WHERE season_id = ?1 AND territory_code = ?2`,
          ).bind(ACTIVE_SEASON_ID, territoryCode),
        ),
        all<{ code: string; name: string; route_kind: string }>(
          d1.prepare(
            `SELECT adjacency.to_code AS code, territory.name, adjacency.route_kind
             FROM territory_adjacencies adjacency
             JOIN territories territory ON territory.code = adjacency.to_code
             JOIN territory_states state
               ON state.season_id = ?1 AND state.territory_code = adjacency.to_code
             WHERE adjacency.from_code = ?2 AND state.supply > 0
             ORDER BY territory.name`,
          ).bind(ACTIVE_SEASON_ID, territoryCode),
        ),
      ])
    : [[], [], []];

  const seats = await Promise.all(
    SEAT_KINDS.map(async (seatKind) => {
      const stored = seatRows.find((seat) => seat.seat_kind === seatKind);
      if (!stored?.user_id) {
        return { seatKind, memberRef: null, label: null, role: null, termEndsAt: null };
      }
      const profile = candidateByUserId.get(stored.user_id);
      const memberRef = profile?.candidateRef ?? await publicUserRef(stored.user_id);
      return {
        seatKind,
        memberRef,
        label: profile?.label ?? publicLabel(memberRef),
        role: stored.role,
        termEndsAt: stored.term_ends_at,
      };
    }),
  );
  const filledSeatCount = seats.filter((seat) => seat.memberRef).length;
  const targetBallots = toRankedBallots(ballotRows, 'target');
  let targetResult = resolveRankedChoice(
    validTargetRows.map((target) => target.code),
    targetBallots,
    Math.max(1, Math.ceil(filledSeatCount / 2)),
  );
  if (targetResult.status === 'tie') {
    const runoff = resolveRankedChoice(
      targetResult.finalists,
      toRankedBallots(ballotRows, 'public-runoff'),
      1,
    );
    if (runoff.status !== 'no-quorum') targetResult = runoff;
  }

  const [announcementRows, notificationRows, voteRows, safetyRows] = await Promise.all([
    all<AnnouncementRow>(d1.prepare(
      `SELECT announcement.id, announcement.territory_code, territory.name AS territory_name,
              announcement.author_user_id, announcement.message_key, announcement.status,
              announcement.upvotes, announcement.downvotes, announcement.created_at
       FROM announcements announcement
       JOIN territories territory ON territory.code = announcement.territory_code
       WHERE announcement.status = 'published'
       ORDER BY announcement.created_at DESC LIMIT 30`,
    )),
    viewerUserId
      ? all<{ id: string; kind: string; payload_json: string; read_at: number | null; created_at: number }>(
          d1.prepare(
            `SELECT id, kind, payload_json, read_at, created_at FROM notifications
             WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 20`,
          ).bind(viewerUserId),
        )
      : Promise.resolve([]),
    viewerUserId
      ? all<{ payload_json: string }>(
          d1.prepare(
            `SELECT payload_json FROM game_events
             WHERE season_id = ?1 AND actor_user_id = ?2 AND event_type = 'ANNOUNCEMENT_VOTE_CAST'`,
          ).bind(ACTIVE_SEASON_ID, viewerUserId),
        )
      : Promise.resolve([]),
    viewerUserId
      ? all<{ action: string; target_id: string }>(
          d1.prepare(
            `SELECT action, target_id FROM audit_events
             WHERE actor_user_id = ?1 AND action IN
               ('community.block','community.unblock','community.mute','community.unmute')
             ORDER BY sequence`,
          ).bind(viewerUserId),
        )
      : Promise.resolve([]),
  ]);

  const viewerVotes = new Map<string, 'up' | 'down'>();
  for (const row of voteRows) {
    const payload = safeJson(row.payload_json) as { announcementId?: string; direction?: string } | null;
    if (payload?.announcementId && (payload.direction === 'up' || payload.direction === 'down')) {
      viewerVotes.set(payload.announcementId, payload.direction);
    }
  }
  const blockedRefs = new Set<string>();
  const mutedRefs = new Set<string>();
  for (const row of safetyRows) {
    if (row.action === 'community.block') blockedRefs.add(row.target_id);
    if (row.action === 'community.unblock') blockedRefs.delete(row.target_id);
    if (row.action === 'community.mute') mutedRefs.add(row.target_id);
    if (row.action === 'community.unmute') mutedRefs.delete(row.target_id);
  }

  const announcements = (
    await Promise.all(announcementRows.map(async (announcement) => {
      const authorRef = await publicUserRef(announcement.author_user_id);
      return {
        id: announcement.id,
        territoryCode: announcement.territory_code,
        territoryName: announcement.territory_name,
        authorRef,
        authorLabel: publicLabel(authorRef),
        messageKey: announcement.message_key,
        status: announcement.status,
        upvotes: announcement.upvotes,
        downvotes: announcement.downvotes,
        viewerVote: viewerVotes.get(announcement.id) ?? null,
        createdAt: announcement.created_at,
      };
    }))
  ).filter((announcement) => !blockedRefs.has(announcement.authorRef) && !mutedRefs.has(announcement.authorRef));

  const viewerRef = viewerUserId ? await publicUserRef(viewerUserId) : null;
  const lastRoleAction = viewerUserId
    ? await d1.prepare(
        `SELECT created_at FROM audit_events
         WHERE actor_user_id = ?1 AND action = 'community.role-action'
         ORDER BY created_at DESC LIMIT 1`,
      ).bind(viewerUserId).first<{ created_at: number }>()
    : null;
  const nextRoleActionAt = lastRoleAction ? lastRoleAction.created_at + DAY_MILLISECONDS : null;
  const isCouncilMember = Boolean(viewerRef && seats.some((seat) => seat.memberRef === viewerRef));
  return {
    mode: 'live-community',
    serverTime: now,
    territory: membership ? {
      code: membership.home_territory_code,
      name: membership.territory_name,
      factionName: membership.faction_name,
    } : null,
    council: {
      seats,
      candidates: candidateProfiles.map((candidate) => ({
        candidateRef: candidate.candidateRef,
        label: candidate.label,
        role: candidate.role,
        contributionScore: candidate.contribution_score,
      })),
      validTargets: validTargetRows.map((target) => ({
        code: target.code,
        name: target.name,
        routeKind: target.route_kind,
      })),
      representativeBallotCast: Boolean(
        viewerUserId && ballotRows.some(
          (ballot) => ballot.election_kind === 'representative' && ballot.voter_user_id === viewerUserId,
        ),
      ),
      targetBallotCast: Boolean(
        viewerUserId && ballotRows.some(
          (ballot) => ballot.election_kind === 'target' && ballot.voter_user_id === viewerUserId,
        ),
      ),
      targetResult: {
        status: targetResult.status,
        winner: targetResult.winner,
        finalists: targetResult.finalists,
      },
    },
    announcements,
    notifications: notificationRows.map((notification) => ({
      id: notification.id,
      kind: notification.kind,
      payload: safeJson(notification.payload_json),
      readAt: notification.read_at,
      createdAt: notification.created_at,
    })),
    viewer: viewerUserId ? {
      userRef: viewerRef!,
      role: membership?.role ?? null,
      roleActionAvailable: !nextRoleActionAt || nextRoleActionAt <= now,
      nextRoleActionAt,
      isCouncilMember,
      canPublish: Boolean(isCouncilMember || membership?.role === 'herald'),
      blockedRefs: [...blockedRefs],
      mutedRefs: [...mutedRefs],
    } : null,
  };
}

export async function executeRoleAction(
  user: IdentityUser,
  command: { territoryCode: string },
  idempotencyKey: string,
  now = Date.now(),
): Promise<CommunitySnapshot> {
  await ensureWorld(now);
  const d1 = getRawD1();
  const membership = await requireMembership(user.userId);
  if (membership.home_territory_code !== command.territoryCode) {
    throw new GameCommandError('La acción de rol solo se aplica a tu provincia.', 403);
  }
  const auditId = `audit-role-${(await sha256(`${user.userId}|${idempotencyKey}`)).slice(0, 32)}`;
  const duplicate = await d1.prepare('SELECT id FROM audit_events WHERE id = ?1')
    .bind(auditId).first<{ id: string }>();
  if (duplicate) return getCommunitySnapshot(user.userId, now);
  const lastAction = await d1.prepare(
    `SELECT created_at FROM audit_events
     WHERE actor_user_id = ?1 AND action = 'community.role-action'
     ORDER BY created_at DESC LIMIT 1`,
  ).bind(user.userId).first<{ created_at: number }>();
  if (lastAction && lastAction.created_at + DAY_MILLISECONDS > now) {
    throw new GameCommandError('La acción de rol ya se utilizó hoy.', 429);
  }

  let roleAction;
  try {
    roleAction = roleActionFor(membership.role);
  } catch {
    throw new GameCommandError('El rol de temporada no es válido.', 409);
  }
  const state = await d1.prepare(
    `SELECT free_garrison, supply, fortification_bp FROM territory_states
     WHERE season_id = ?1 AND territory_code = ?2`,
  ).bind(ACTIVE_SEASON_ID, command.territoryCode).first<{
    free_garrison: number;
    supply: number;
    fortification_bp: number;
  }>();
  if (!state) throw new GameCommandError('La provincia no tiene estado activo.', 404);

  let appliedAmount = roleAction.amount;
  if (roleAction.effect === 'supply') appliedAmount = Math.max(0, Math.min(roleAction.amount, 1_500 - state.supply));
  if (roleAction.effect === 'fortification') appliedAmount = Math.max(0, Math.min(roleAction.amount, 15_000 - state.fortification_bp));
  let intelBand: { minimum: number; maximum: number } | null = null;
  if (roleAction.effect === 'intel') {
    const target = await d1.prepare(
      `SELECT state.free_garrison FROM territory_adjacencies adjacency
       JOIN territory_states state
         ON state.season_id = ?1 AND state.territory_code = adjacency.to_code
       WHERE adjacency.from_code = ?2 ORDER BY state.free_garrison DESC LIMIT 1`,
    ).bind(ACTIVE_SEASON_ID, command.territoryCode).first<{ free_garrison: number }>();
    const midpoint = Math.round(Number(target?.free_garrison ?? 0) / 500) * 500;
    intelBand = { minimum: Math.max(0, midpoint - 500), maximum: midpoint + 500 };
  }

  const effectStatements: D1PreparedStatement[] = [];
  if (roleAction.effect === 'free-garrison') {
    effectStatements.push(d1.prepare(
      `UPDATE territory_states SET free_garrison = free_garrison + ?1, version = version + 1
       WHERE season_id = ?2 AND territory_code = ?3`,
    ).bind(appliedAmount, ACTIVE_SEASON_ID, command.territoryCode));
  }
  if (roleAction.effect === 'supply') {
    effectStatements.push(d1.prepare(
      `UPDATE territory_states SET supply = supply + ?1, version = version + 1
       WHERE season_id = ?2 AND territory_code = ?3`,
    ).bind(appliedAmount, ACTIVE_SEASON_ID, command.territoryCode));
  }
  if (roleAction.effect === 'fortification') {
    effectStatements.push(d1.prepare(
      `UPDATE territory_states SET fortification_bp = fortification_bp + ?1, version = version + 1
       WHERE season_id = ?2 AND territory_code = ?3`,
    ).bind(appliedAmount, ACTIVE_SEASON_ID, command.territoryCode));
  }
  if (roleAction.effect === 'faction-score' || roleAction.effect === 'morale') {
    effectStatements.push(d1.prepare('UPDATE factions SET score = score + ?1 WHERE id = ?2')
      .bind(appliedAmount, membership.faction_id));
  }
  if (roleAction.effect === 'free-support') {
    effectStatements.push(d1.prepare(
      `UPDATE wallets SET free_support = free_support + ?1, updated_at = ?2
       WHERE season_id = ?3 AND user_id = ?4`,
    ).bind(appliedAmount, now, ACTIVE_SEASON_ID, user.userId));
  }

  const eventId = crypto.randomUUID();
  const dayIndex = Math.floor(now / DAY_MILLISECONDS);
  const payload = canonicalEvent({
    amount: appliedAmount,
    effect: roleAction.effect,
    intelBand,
    role: membership.role,
    territoryCode: command.territoryCode,
  });
  const statements: D1PreparedStatement[] = [
    ...effectStatements,
    d1.prepare(
      `UPDATE faction_memberships SET contribution_score = contribution_score + 25
       WHERE season_id = ?1 AND user_id = ?2`,
    ).bind(ACTIVE_SEASON_ID, user.userId),
    d1.prepare(
      `INSERT INTO game_events
       (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id, payload_json, payload_hash, engine_version, created_at)
       VALUES (?1, ?2, 'ROLE_ACTION_COMPLETED', ?3, 'territory', ?4, ?5, ?6, ?7, ?8)`,
    ).bind(eventId, ACTIVE_SEASON_ID, user.userId, command.territoryCode, payload, await sha256(payload), ENGINE_VERSION, now),
    d1.prepare(
      `INSERT INTO audit_events
       (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
       VALUES (?1, ?2, 'community.role-action', 'territory', ?3, 'accepted', ?4, ?5)`,
    ).bind(
      auditId,
      user.userId,
      command.territoryCode,
      JSON.stringify({ effect: roleAction.effect, role: membership.role }),
      now,
    ),
    d1.prepare(
      `INSERT INTO notifications (id, user_id, kind, payload_json, dedupe_key, read_at, created_at)
       VALUES (?1, ?2, 'role-action', ?3, ?4, NULL, ?5)`,
    ).bind(
      `notification-role-${(await sha256(`${user.userId}|${dayIndex}`)).slice(0, 32)}`,
      user.userId,
      payload,
      `role-action:${ACTIVE_SEASON_ID}:${dayIndex}`,
      now,
    ),
  ];
  if (roleAction.assetKind && appliedAmount > 0) {
    statements.push(d1.prepare(
      `INSERT INTO ledger_entries
       (id, season_id, user_id, territory_code, asset_kind, amount, reason, event_id, idempotency_key, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    ).bind(
      crypto.randomUUID(),
      ACTIVE_SEASON_ID,
      user.userId,
      command.territoryCode,
      roleAction.assetKind,
      appliedAmount,
      `role:${membership.role}`,
      eventId,
      `role-action:${ACTIVE_SEASON_ID}:${user.userId}:${idempotencyKey}`,
      now,
    ));
  }
  await d1.batch(statements);
  return getCommunitySnapshot(user.userId, now);
}

export async function castCouncilBallot(
  user: IdentityUser,
  command: { territoryCode: string; electionKind: 'representative' | 'target' | 'public-runoff'; rankedChoices: string[] },
  idempotencyKey: string,
  now = Date.now(),
): Promise<CommunitySnapshot> {
  await ensureWorld(now);
  await assertRateLimit(user.userId, 'community.ballot', 12, DAY_MILLISECONDS, now);
  const d1 = getRawD1();
  const membership = await requireMembership(user.userId);
  if (membership.home_territory_code !== command.territoryCode) {
    throw new GameCommandError('Solo puedes votar en la provincia que representas.', 403);
  }
  if (new Set(command.rankedChoices).size !== command.rankedChoices.length) {
    throw new GameCommandError('Las preferencias no pueden repetirse.', 400);
  }

  const existingByKey = await d1
    .prepare('SELECT voter_user_id FROM council_ballots WHERE idempotency_key = ?1')
    .bind(idempotencyKey)
    .first<{ voter_user_id: string }>();
  if (existingByKey) {
    if (existingByKey.voter_user_id !== user.userId) {
      throw new GameCommandError('Clave de idempotencia ya utilizada.', 409);
    }
    return getCommunitySnapshot(user.userId, now);
  }
  const alreadyVoted = await d1
    .prepare(
      `SELECT id FROM council_ballots
       WHERE season_id = ?1 AND territory_code = ?2 AND election_kind = ?3 AND voter_user_id = ?4`,
    )
    .bind(ACTIVE_SEASON_ID, command.territoryCode, command.electionKind, user.userId)
    .first<{ id: string }>();
  if (alreadyVoted) throw new GameCommandError('Ya has votado en esta elección.', 409);

  if (command.electionKind === 'representative') {
    const candidates = await getCandidates(membership.faction_id);
    const refs = new Set(await Promise.all(candidates.map((candidate) => publicUserRef(candidate.user_id))));
    if (command.rankedChoices.some((choice) => !refs.has(choice))) {
      throw new GameCommandError('La papeleta contiene un candidato no elegible.', 400);
    }
  } else {
    const targets = await validTargetCodes(command.territoryCode);
    if (command.rankedChoices.some((choice) => !targets.has(choice))) {
      throw new GameCommandError('El objetivo no tiene una ruta de suministro válida.', 400);
    }
    if (command.electionKind === 'target') {
      const seat = await d1
        .prepare(
          `SELECT 1 AS allowed FROM council_seats
           WHERE season_id = ?1 AND territory_code = ?2 AND user_id = ?3 AND term_ends_at > ?4`,
        )
        .bind(ACTIVE_SEASON_ID, command.territoryCode, user.userId, now)
        .first<{ allowed: number }>();
      if (!seat) throw new GameCommandError('Solo el consejo puede votar el objetivo inicial.', 403);
    } else {
      const snapshot = await getCommunitySnapshot(user.userId, now);
      if (snapshot.council.targetResult.status !== 'tie') {
        throw new GameCommandError('No hay una segunda vuelta pública activa.', 409);
      }
      if (command.rankedChoices.some((choice) => !snapshot.council.targetResult.finalists.includes(choice))) {
        throw new GameCommandError('La segunda vuelta solo acepta los objetivos finalistas.', 400);
      }
    }
  }

  const ballotId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const payload = canonicalEvent({
    electionKind: command.electionKind,
    rankedChoices: command.rankedChoices,
    territoryCode: command.territoryCode,
  });
  await d1.batch([
    d1.prepare(
      `INSERT INTO council_ballots
       (id, season_id, territory_code, election_kind, voter_user_id, ranked_choices_json, idempotency_key, cast_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(
      ballotId,
      ACTIVE_SEASON_ID,
      command.territoryCode,
      command.electionKind,
      user.userId,
      JSON.stringify(command.rankedChoices),
      idempotencyKey,
      now,
    ),
    d1.prepare(
      `INSERT INTO game_events
       (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id, payload_json, payload_hash, engine_version, created_at)
       VALUES (?1, ?2, 'COUNCIL_VOTE_CAST', ?3, 'council', ?4, ?5, ?6, ?7, ?8)`,
    ).bind(eventId, ACTIVE_SEASON_ID, user.userId, command.territoryCode, payload, await sha256(payload), ENGINE_VERSION, now),
    d1.prepare(
      `INSERT INTO audit_events
       (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
       VALUES (?1, ?2, 'community.ballot', 'council', ?3, 'accepted', ?4, ?5)`,
    ).bind(crypto.randomUUID(), user.userId, command.territoryCode, JSON.stringify({ electionKind: command.electionKind }), now),
  ]);

  if (command.electionKind === 'representative') {
    await reconcileCouncil(command.territoryCode, membership.faction_id, now);
  }
  return getCommunitySnapshot(user.userId, now);
}

export async function publishAnnouncement(
  user: IdentityUser,
  command: { territoryCode: string; messageKey: AnnouncementKey },
  idempotencyKey: string,
  now = Date.now(),
): Promise<CommunitySnapshot> {
  await ensureWorld(now);
  await assertRateLimit(user.userId, 'community.announcement', 6, HOUR_MILLISECONDS, now);
  const d1 = getRawD1();
  const membership = await requireMembership(user.userId);
  if (membership.home_territory_code !== command.territoryCode) {
    throw new GameCommandError('Solo puedes anunciar para tu provincia.', 403);
  }
  const seat = await d1
    .prepare(
      `SELECT 1 AS allowed FROM council_seats
       WHERE season_id = ?1 AND territory_code = ?2 AND user_id = ?3 AND term_ends_at > ?4`,
    )
    .bind(ACTIVE_SEASON_ID, command.territoryCode, user.userId, now)
    .first<{ allowed: number }>();
  if (!seat && membership.role !== 'herald') {
    throw new GameCommandError('Solo el consejo o un heraldo pueden publicar anuncios.', 403);
  }

  const deterministicId = `announcement-${(await sha256(`${user.userId}|${idempotencyKey}`)).slice(0, 32)}`;
  const existing = await d1.prepare('SELECT id FROM announcements WHERE id = ?1').bind(deterministicId).first();
  if (existing) return getCommunitySnapshot(user.userId, now);
  const payload = canonicalEvent({
    announcementId: deterministicId,
    messageKey: command.messageKey,
    territoryCode: command.territoryCode,
  });
  const eventId = crypto.randomUUID();
  await d1.batch([
    d1.prepare(
      `INSERT INTO announcements
       (id, season_id, territory_code, author_user_id, message_key, status, upvotes, downvotes, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'published', 0, 0, ?6)`,
    ).bind(deterministicId, ACTIVE_SEASON_ID, command.territoryCode, user.userId, command.messageKey, now),
    d1.prepare(
      `INSERT INTO game_events
       (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id, payload_json, payload_hash, engine_version, created_at)
       VALUES (?1, ?2, 'ANNOUNCEMENT_PUBLISHED', ?3, 'announcement', ?4, ?5, ?6, ?7, ?8)`,
    ).bind(eventId, ACTIVE_SEASON_ID, user.userId, deterministicId, payload, await sha256(payload), ENGINE_VERSION, now),
    d1.prepare(
      `INSERT OR IGNORE INTO notifications (id, user_id, kind, payload_json, dedupe_key, read_at, created_at)
       SELECT 'notification-' || ?1 || '-' || membership.user_id,
              membership.user_id, 'council-announcement', ?2, 'announcement:' || ?1, NULL, ?3
       FROM faction_memberships membership
       JOIN notification_preferences preference ON preference.user_id = membership.user_id
       WHERE membership.season_id = ?4 AND membership.faction_id = ?5 AND preference.council_alerts = 1`,
    ).bind(deterministicId, payload, now, ACTIVE_SEASON_ID, membership.faction_id),
    d1.prepare(
      `INSERT INTO audit_events
       (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
       VALUES (?1, ?2, 'community.announcement', 'announcement', ?3, 'published', ?4, ?5)`,
    ).bind(crypto.randomUUID(), user.userId, deterministicId, JSON.stringify({ messageKey: command.messageKey }), now),
  ]);
  return getCommunitySnapshot(user.userId, now);
}

export async function voteAnnouncement(
  user: IdentityUser,
  command: { announcementId: string; direction: 'up' | 'down' },
  now = Date.now(),
): Promise<CommunitySnapshot> {
  await assertRateLimit(user.userId, 'community.announcement-vote', 40, DAY_MILLISECONDS, now);
  const d1 = getRawD1();
  const announcement = await d1
    .prepare("SELECT author_user_id FROM announcements WHERE id = ?1 AND status = 'published'")
    .bind(command.announcementId)
    .first<{ author_user_id: string }>();
  if (!announcement) throw new GameCommandError('El anuncio no existe.', 404);
  if (announcement.author_user_id === user.userId) {
    throw new GameCommandError('No puedes votar tu propio anuncio.', 403);
  }
  const eventId = `event-announcement-vote-${(await sha256(`${command.announcementId}|${user.userId}`)).slice(0, 32)}`;
  const existing = await d1.prepare('SELECT id FROM game_events WHERE id = ?1').bind(eventId).first();
  if (existing) return getCommunitySnapshot(user.userId, now);
  const payload = canonicalEvent({ announcementId: command.announcementId, direction: command.direction });
  const column = command.direction === 'up' ? 'upvotes' : 'downvotes';
  await d1.batch([
    d1.prepare(
      `INSERT INTO game_events
       (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id, payload_json, payload_hash, engine_version, created_at)
       VALUES (?1, ?2, 'ANNOUNCEMENT_VOTE_CAST', ?3, 'announcement', ?4, ?5, ?6, ?7, ?8)`,
    ).bind(eventId, ACTIVE_SEASON_ID, user.userId, command.announcementId, payload, await sha256(payload), ENGINE_VERSION, now),
    d1.prepare(`UPDATE announcements SET ${column} = ${column} + 1 WHERE id = ?1`).bind(command.announcementId),
    d1.prepare(
      `INSERT INTO audit_events
       (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
       VALUES (?1, ?2, 'community.announcement-vote', 'announcement', ?3, 'accepted', ?4, ?5)`,
    ).bind(crypto.randomUUID(), user.userId, command.announcementId, JSON.stringify({ direction: command.direction }), now),
  ]);
  return getCommunitySnapshot(user.userId, now);
}

export async function submitReport(
  user: IdentityUser,
  command: { targetType: 'announcement' | 'user-profile'; targetId: string; reason: ReportReason; details?: string },
  idempotencyKey: string,
  now = Date.now(),
): Promise<{ reportId: string; status: 'queued-for-human-review' }> {
  await assertRateLimit(user.userId, 'community.report', 12, DAY_MILLISECONDS, now);
  const d1 = getRawD1();
  if (command.targetType === 'announcement') {
    const target = await d1.prepare('SELECT id FROM announcements WHERE id = ?1').bind(command.targetId).first();
    if (!target) throw new GameCommandError('El contenido denunciado no existe.', 404);
  } else {
    const resolved = await resolveUserRef(command.targetId);
    if (!resolved) throw new GameCommandError('El perfil denunciado no existe.', 404);
    if (resolved === user.userId) throw new GameCommandError('No puedes denunciar tu propio perfil.', 400);
  }
  const reportId = `report-${(await sha256(`${user.userId}|${idempotencyKey}`)).slice(0, 32)}`;
  const existing = await d1.prepare('SELECT id FROM reports WHERE id = ?1').bind(reportId).first();
  if (existing) return { reportId, status: 'queued-for-human-review' };
  const route = classifyReport(command.reason);
  const moderationId = `moderation-${reportId.slice(7)}`;
  const eventId = crypto.randomUUID();
  const payload = canonicalEvent({
    queue: route.queue,
    reason: command.reason,
    reportId,
    targetId: command.targetId,
    targetType: command.targetType,
  });
  await d1.batch([
    d1.prepare(
      `INSERT INTO reports (id, reporter_user_id, target_type, target_id, reason, details, status, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'open', ?7)`,
    ).bind(
      reportId,
      user.userId,
      command.targetType,
      command.targetId,
      command.reason,
      sanitizeReportDetails(command.details),
      now,
    ),
    d1.prepare(
      `INSERT INTO moderation_decisions
       (id, report_id, decision, rule_codes_json, reviewer_user_id, appeal_status, created_at)
       VALUES (?1, ?2, ?3, ?4, NULL, 'not-requested', ?5)`,
    ).bind(moderationId, reportId, route.decision, JSON.stringify(route.ruleCodes), now),
    d1.prepare(
      `INSERT INTO game_events
       (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id, payload_json, payload_hash, engine_version, created_at)
       VALUES (?1, ?2, 'MODERATION_ACTION', ?3, 'report', ?4, ?5, ?6, ?7, ?8)`,
    ).bind(eventId, ACTIVE_SEASON_ID, user.userId, reportId, payload, await sha256(payload), ENGINE_VERSION, now),
    d1.prepare(
      `INSERT INTO audit_events
       (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
       VALUES (?1, ?2, 'community.report', ?3, ?4, 'queued', ?5, ?6)`,
    ).bind(crypto.randomUUID(), user.userId, command.targetType, command.targetId, JSON.stringify({ queue: route.queue, reportId }), now),
  ]);
  return { reportId, status: 'queued-for-human-review' };
}

export async function setSafetyAction(
  user: IdentityUser,
  command: { targetRef: string; action: 'block' | 'unblock' | 'mute' | 'unmute' },
  idempotencyKey: string,
  now = Date.now(),
): Promise<CommunitySnapshot> {
  const targetUserId = await resolveUserRef(command.targetRef);
  if (!targetUserId) throw new GameCommandError('El perfil no existe.', 404);
  if (targetUserId === user.userId) throw new GameCommandError('No puedes silenciar tu propio perfil.', 400);
  const d1 = getRawD1();
  const auditId = `audit-safety-${(await sha256(`${user.userId}|${idempotencyKey}`)).slice(0, 32)}`;
  await d1.prepare(
    `INSERT OR IGNORE INTO audit_events
     (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
     VALUES (?1, ?2, ?3, 'user-profile', ?4, 'accepted', '{}', ?5)`,
  ).bind(auditId, user.userId, `community.${command.action}`, command.targetRef, now).run();
  return getCommunitySnapshot(user.userId, now);
}

export async function updateNotificationPreferences(
  user: IdentityUser,
  command: {
    locale: 'es' | 'en';
    quietHoursStart: number;
    quietHoursEnd: number;
    maxWarAlertsPerDay: number;
    councilAlerts: boolean;
  },
  idempotencyKey: string,
  now = Date.now(),
): Promise<CommunitySnapshot> {
  const d1 = getRawD1();
  const auditId = `audit-preferences-${(await sha256(`${user.userId}|${idempotencyKey}`)).slice(0, 32)}`;
  await d1.batch([
    d1.prepare(
      `INSERT INTO notification_preferences
       (user_id, locale, quiet_hours_start, quiet_hours_end, max_war_alerts_per_day, council_alerts, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(user_id) DO UPDATE SET locale = excluded.locale,
         quiet_hours_start = excluded.quiet_hours_start, quiet_hours_end = excluded.quiet_hours_end,
         max_war_alerts_per_day = excluded.max_war_alerts_per_day,
         council_alerts = excluded.council_alerts, updated_at = excluded.updated_at`,
    ).bind(
      user.userId,
      command.locale,
      command.quietHoursStart,
      command.quietHoursEnd,
      command.maxWarAlertsPerDay,
      command.councilAlerts ? 1 : 0,
      now,
    ),
    d1.prepare('UPDATE users SET locale = ?1, updated_at = ?2 WHERE id = ?3')
      .bind(command.locale, now, user.userId),
    d1.prepare(
      `INSERT OR IGNORE INTO audit_events
       (id, actor_user_id, action, target_type, target_id, outcome, metadata_json, created_at)
       VALUES (?1, ?2, 'community.notification-preferences', 'user', ?2, 'updated', ?3, ?4)`,
    ).bind(
      auditId,
      user.userId,
      JSON.stringify({
        councilAlerts: command.councilAlerts,
        locale: command.locale,
        maxWarAlertsPerDay: command.maxWarAlertsPerDay,
        quietHoursEnd: command.quietHoursEnd,
        quietHoursStart: command.quietHoursStart,
      }),
      now,
    ),
  ]);
  return getCommunitySnapshot(user.userId, now);
}

async function reconcileCouncil(territoryCode: string, factionId: string, now: number) {
  const d1 = getRawD1();
  const candidates = await getCandidates(factionId);
  const ballots = await all<BallotRow>(
    d1.prepare(
      `SELECT election_kind, voter_user_id, ranked_choices_json FROM council_ballots
       WHERE season_id = ?1 AND territory_code = ?2 AND election_kind = 'representative'`,
    ).bind(ACTIVE_SEASON_ID, territoryCode),
  );
  const refs = new Map(
    await Promise.all(candidates.map(async (candidate) => [candidate.user_id, await publicUserRef(candidate.user_id)] as const)),
  );
  const refToUserId = new Map([...refs].map(([userId, ref]) => [ref, userId]));
  const roster = buildCouncilRoster(
    candidates.map((candidate) => ({
      id: refs.get(candidate.user_id)!,
      role: candidate.role,
      contributionScore: candidate.contribution_score,
      supporterPoints: candidate.supporter_points,
    })),
    toRankedBallots(ballots, 'representative'),
  );
  const season = await d1.prepare('SELECT ends_at FROM seasons WHERE id = ?1')
    .bind(ACTIVE_SEASON_ID).first<{ ends_at: number }>();
  const termEndsAt = Math.min(season?.ends_at ?? now + COUNCIL_TERM_MILLISECONDS, now + COUNCIL_TERM_MILLISECONDS);
  const payload = canonicalEvent({
    roster: roster.map((seat) => ({ seatKind: seat.seatKind, memberRef: seat.userId })),
    territoryCode,
  });
  const statements = roster.map((seat) => d1.prepare(
    `INSERT INTO council_seats (season_id, territory_code, seat_kind, user_id, term_starts_at, term_ends_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(season_id, territory_code, seat_kind) DO UPDATE SET
       user_id = excluded.user_id, term_starts_at = excluded.term_starts_at,
       term_ends_at = excluded.term_ends_at`,
  ).bind(
    ACTIVE_SEASON_ID,
    territoryCode,
    seat.seatKind,
    seat.userId ? refToUserId.get(seat.userId) ?? null : null,
    now,
    termEndsAt,
  ));
  statements.push(
    d1.prepare(
      `INSERT INTO game_events
       (id, season_id, event_type, actor_user_id, aggregate_type, aggregate_id, payload_json, payload_hash, engine_version, created_at)
       VALUES (?1, ?2, 'COUNCIL_ROSTER_RESOLVED', NULL, 'council', ?3, ?4, ?5, ?6, ?7)`,
    ).bind(crypto.randomUUID(), ACTIVE_SEASON_ID, territoryCode, payload, await sha256(payload), ENGINE_VERSION, now),
  );
  await d1.batch(statements);
}

async function getMembership(userId: string): Promise<MembershipRow | null> {
  return getRawD1()
    .prepare(
      `SELECT membership.faction_id, faction.name AS faction_name, membership.home_territory_code,
              territory.name AS territory_name, membership.role, membership.contribution_score
       FROM faction_memberships membership
       JOIN factions faction ON faction.id = membership.faction_id
       JOIN territories territory ON territory.code = membership.home_territory_code
       WHERE membership.season_id = ?1 AND membership.user_id = ?2`,
    )
    .bind(ACTIVE_SEASON_ID, userId)
    .first<MembershipRow>();
}

async function requireMembership(userId: string): Promise<MembershipRow> {
  const membership = await getMembership(userId);
  if (!membership) throw new GameCommandError('Elige primero una provincia.', 409);
  return membership;
}

async function getCandidates(factionId: string): Promise<CandidateRow[]> {
  return all<CandidateRow>(
    getRawD1().prepare(
      `SELECT membership.user_id, membership.role, membership.contribution_score,
              COALESCE(wallet.supporter_points, 0) AS supporter_points
       FROM faction_memberships membership
       LEFT JOIN wallets wallet
         ON wallet.season_id = membership.season_id AND wallet.user_id = membership.user_id
       WHERE membership.season_id = ?1 AND membership.faction_id = ?2
       ORDER BY membership.contribution_score DESC, membership.joined_at`,
    ).bind(ACTIVE_SEASON_ID, factionId),
  );
}

async function validTargetCodes(territoryCode: string): Promise<Set<string>> {
  const rows = await all<{ code: string }>(
    getRawD1().prepare(
      `SELECT adjacency.to_code AS code FROM territory_adjacencies adjacency
       JOIN territory_states state
         ON state.season_id = ?1 AND state.territory_code = adjacency.to_code
       WHERE adjacency.from_code = ?2 AND state.supply > 0`,
    ).bind(ACTIVE_SEASON_ID, territoryCode),
  );
  return new Set(rows.map((row) => row.code));
}

async function resolveUserRef(targetRef: string): Promise<string | null> {
  const users = await all<{ user_id: string }>(
    getRawD1().prepare(
      `SELECT DISTINCT user_id FROM faction_memberships WHERE season_id = ?1`,
    ).bind(ACTIVE_SEASON_ID),
  );
  for (const user of users) {
    if (await publicUserRef(user.user_id) === targetRef) return user.user_id;
  }
  return null;
}

function toRankedBallots(rows: BallotRow[], electionKind: string): RankedBallot[] {
  return rows.flatMap((row) => {
    if (row.election_kind !== electionKind) return [];
    const choices = safeJson(row.ranked_choices_json);
    return Array.isArray(choices) && choices.every((choice) => typeof choice === 'string')
      ? [{ voterId: row.voter_user_id, choices }]
      : [];
  });
}

async function assertRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMilliseconds: number,
  now: number,
) {
  const row = await getRawD1()
    .prepare(
      'SELECT COUNT(*) AS count FROM audit_events WHERE actor_user_id = ?1 AND action = ?2 AND created_at >= ?3',
    )
    .bind(userId, action, now - windowMilliseconds)
    .first<{ count: number }>();
  if (Number(row?.count ?? 0) >= limit) {
    throw new GameCommandError('Demasiadas acciones. Inténtalo de nuevo más tarde.', 429);
  }
}

async function publicUserRef(userId: string): Promise<string> {
  return (await sha256(`candidate|${ACTIVE_SEASON_ID}|${userId}`)).slice(0, 16);
}

function publicLabel(userRef: string): string {
  return `Estratega ${userRef.slice(-4).toUpperCase()}`;
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

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
