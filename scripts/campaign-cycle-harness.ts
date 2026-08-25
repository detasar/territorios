import { castCouncilBallot, getCommunitySnapshot } from '../db/community';
import { getRawD1 } from '../db/index';
import { joinFaction, reconcileWorld } from '../db/game';
import {
  activeSeasonRecord,
  campaignId,
  ensureWorld,
  factionId,
} from '../db/world-bootstrap';
import { captureWindowAt, HOUR_MILLISECONDS } from '../src/domain/world/world';

const BASE_TIME = Date.UTC(2026, 7, 25, 0, 0, 0);
const TEST_USER = {
  userId: 'campaign-cycle-verifier',
  email: 'campaign-cycle@example.test',
  displayName: 'Campaign cycle verifier',
};
const COUNCIL_TERRITORY = '28';
const CONQUEST_TARGETS = ['05', '10', '06', '13', '02'] as const;

const handler = {
  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname !== '/verify') {
      return new Response('Not found', { status: 404 });
    }
    try {
      return Response.json(await verifyCampaignCycle());
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'Unknown campaign verification failure.' },
        { status: 500 },
      );
    }
  },
};

export default handler;

async function verifyCampaignCycle() {
  await ensureWorld(BASE_TIME);
  const firstSeason = await activeSeasonRecord();
  const attackerFactionId = factionId(firstSeason.id, COUNCIL_TERRITORY);
  const openingCampaignId = campaignId(firstSeason.id, COUNCIL_TERRITORY, 1);
  const openingBattleId = `battle-${openingCampaignId}`;

  await joinFaction(
    TEST_USER,
    COUNCIL_TERRITORY,
    'strategist',
    'campaign-cycle-join',
    BASE_TIME,
  );
  const initialCommunity = await getCommunitySnapshot(TEST_USER.userId, BASE_TIME);
  const candidate = initialCommunity.council.candidates[0];
  assert(candidate, 'The verification member was not available as a council candidate.');
  await castCouncilBallot(
    TEST_USER,
    {
      territoryCode: COUNCIL_TERRITORY,
      electionKind: 'representative',
      rankedChoices: [candidate.candidateRef],
    },
    'campaign-cycle-representative-vote',
    BASE_TIME,
  );

  await isolateOpeningFront({
    seasonId: firstSeason.id,
    openingBattleId,
    attackerFactionId,
  });

  let now = nextCaptureWindow(BASE_TIME);
  await reconcileWorld(now);
  await assertCaptured({
    seasonId: firstSeason.id,
    campaignId: openingCampaignId,
    targetTerritoryCode: '45',
    attackerFactionId,
  });

  const cycleEvidence: Array<{
    cycleNumber: number;
    originTerritoryCode: string;
    targetTerritoryCode: string;
    battleStartedAt: number;
    capturedAt: number;
  }> = [];

  for (const [index, targetTerritoryCode] of CONQUEST_TARGETS.entries()) {
    now += HOUR_MILLISECONDS;
    await reconcileWorld(now);
    const planning = await getCommunitySnapshot(TEST_USER.userId, now);
    const campaign = planning.council.campaign;
    const expectedCycle = index + 2;
    assert(campaign?.cycleNumber === expectedCycle, `Campaign ${expectedCycle} did not open.`);
    assert(campaign.phase === 'planning', `Campaign ${expectedCycle} was not in planning.`);
    assert(
      planning.council.validTargets.some((target) => target.code === targetTerritoryCode),
      `Target ${targetTerritoryCode} was not supplied and eligible in campaign ${expectedCycle}.`,
    );
    assert(
      planning.council.canVoteTarget,
      `Campaign ${expectedCycle} did not expose an authorized planning ballot to its council member.`,
    );

    const voteAt = now + 1_000;
    const locked = await castCouncilBallot(
      TEST_USER,
      {
        territoryCode: COUNCIL_TERRITORY,
        electionKind: 'target',
        rankedChoices: [targetTerritoryCode],
      },
      `campaign-cycle-target-vote-${expectedCycle}`,
      voteAt,
    );
    const mobilizing = locked.council.campaign;
    assert(mobilizing?.phase === 'mobilizing', `Campaign ${expectedCycle} target was not locked.`);
    assert(mobilizing.mobilizesAt !== null, `Campaign ${expectedCycle} has no mobilization time.`);
    assert(
      !locked.council.canVoteTarget,
      `Campaign ${expectedCycle} still exposed target voting after its target was locked.`,
    );

    const originBefore = await requiredRow<{ free_garrison: number }>(
      `SELECT free_garrison FROM territory_states
       WHERE season_id = ?1 AND territory_code = ?2`,
      firstSeason.id,
      campaign.originTerritoryCode,
    );
    await Promise.all([
      reconcileWorld(mobilizing.mobilizesAt + 1_000),
      reconcileWorld(mobilizing.mobilizesAt + 1_000),
    ]);
    const battle = await requiredRow<{
      origin_territory_code: string;
      started_at: number;
      free_attack_power: number;
    }>(
      `SELECT origin_territory_code, started_at, free_attack_power FROM battles
       WHERE campaign_id = ?1 AND status = 'active'`,
      campaign.id,
    );
    const originAfter = await requiredRow<{ free_garrison: number }>(
      `SELECT free_garrison FROM territory_states
       WHERE season_id = ?1 AND territory_code = ?2`,
      firstSeason.id,
      campaign.originTerritoryCode,
    );
    assert(
      originBefore.free_garrison - originAfter.free_garrison === battle.free_attack_power,
      `Campaign ${expectedCycle} debited its origin more than once under concurrent reconciliation.`,
    );
    assert(
      battle.started_at === mobilizing.mobilizesAt,
      `Campaign ${expectedCycle} did not use its scheduled mobilization timestamp.`,
    );
    const active = await getCommunitySnapshot(TEST_USER.userId, mobilizing.mobilizesAt + 1_000);
    assert(active.council.campaign?.phase === 'active', `Campaign ${expectedCycle} did not enter active play.`);
    assert(
      !active.council.canVoteTarget,
      `Campaign ${expectedCycle} exposed target voting during active play.`,
    );

    const capturedAt = nextCaptureWindow(mobilizing.mobilizesAt);
    await reconcileWorld(capturedAt);
    await assertCaptured({
      seasonId: firstSeason.id,
      campaignId: campaign.id,
      targetTerritoryCode,
      attackerFactionId,
    });
    cycleEvidence.push({
      cycleNumber: expectedCycle,
      originTerritoryCode: battle.origin_territory_code,
      targetTerritoryCode,
      battleStartedAt: battle.started_at,
      capturedAt,
    });
    now = capturedAt;
  }

  now += HOUR_MILLISECONDS;
  await reconcileWorld(now);
  const nextCampaign = await requiredRow<{
    cycle_number: number;
    phase: string;
    origin_territory_code: string;
  }>(
    `SELECT cycle_number, phase, origin_territory_code FROM campaign_rounds
     WHERE season_id = ?1 AND council_territory_code = ?2
     ORDER BY cycle_number DESC LIMIT 1`,
    firstSeason.id,
    COUNCIL_TERRITORY,
  );
  assert(nextCampaign.cycle_number === 7, 'The seventh planning round did not open.');
  assert(nextCampaign.phase === 'planning', 'The next campaign is not accepting target ballots.');
  assert(nextCampaign.origin_territory_code === '02', 'The conquest frontier did not move to the captured province.');

  const history = await requiredRow<{ captures: number }>(
    `SELECT COUNT(*) AS captures FROM ownership_history
     WHERE season_id = ?1 AND next_faction_id = ?2`,
    firstSeason.id,
    attackerFactionId,
  );
  assert(Number(history.captures) === 6, 'The append-only ownership history does not contain all six captures.');

  const completedSeason = await closeSeasonAndOpenNext(firstSeason.id, firstSeason.ends_at);
  return {
    status: 'pass',
    votedConquestCycles: cycleEvidence.length,
    totalConquestsIncludingOpeningFront: Number(history.captures),
    nextCampaign,
    cycleEvidence,
    seasonReset: completedSeason,
  };
}

async function isolateOpeningFront(input: {
  seasonId: string;
  openingBattleId: string;
  attackerFactionId: string;
}) {
  const d1 = getRawD1();
  const pathTargets = ['45', ...CONQUEST_TARGETS];
  await d1.batch([
    d1.prepare(
      `UPDATE battles SET status = 'repelled', ended_at = ?1
       WHERE season_id = ?2 AND status = 'active' AND id <> ?3`,
    ).bind(BASE_TIME, input.seasonId, input.openingBattleId),
    d1.prepare(
      `UPDATE territory_states SET attacker_faction_id = NULL, active_battle_id = NULL,
              siege_bp = 0, battle_tick_count = 0, version = version + 1
       WHERE season_id = ?1 AND active_battle_id IS NOT NULL AND active_battle_id <> ?2`,
    ).bind(input.seasonId, input.openingBattleId),
    d1.prepare(
      `UPDATE campaign_rounds SET phase = 'cooldown', resolved_at = ?1,
              cooldown_ends_at = ?1, outcome = 'repelled'
       WHERE season_id = ?2 AND phase = 'active' AND id <> ?3`,
    ).bind(BASE_TIME, input.seasonId, campaignId(input.seasonId, COUNCIL_TERRITORY, 1)),
    d1.prepare(
      `UPDATE battles SET free_attack_power = 1000000, paid_attack_power = 0
       WHERE id = ?1 AND attacker_faction_id = ?2 AND status = 'active'`,
    ).bind(input.openingBattleId, input.attackerFactionId),
    d1.prepare(
      `UPDATE territory_states SET free_garrison = 1, paid_garrison = 0,
              supply = 1000, fortification_bp = 10000, version = version + 1
       WHERE season_id = ?1 AND territory_code IN (${pathTargets.map(() => '?').join(',')})`,
    ).bind(input.seasonId, ...pathTargets),
  ]);
}

async function assertCaptured(input: {
  seasonId: string;
  campaignId: string;
  targetTerritoryCode: string;
  attackerFactionId: string;
}) {
  const row = await requiredRow<{
    battle_status: string;
    campaign_phase: string;
    outcome: string;
    owner_faction_id: string;
  }>(
    `SELECT battle.status AS battle_status, campaign.phase AS campaign_phase,
            campaign.outcome, state.owner_faction_id
     FROM battles battle
     JOIN campaign_rounds campaign ON campaign.id = battle.campaign_id
     JOIN territory_states state
       ON state.season_id = battle.season_id
      AND state.territory_code = battle.target_territory_code
     WHERE battle.season_id = ?1 AND battle.campaign_id = ?2
       AND battle.target_territory_code = ?3`,
    input.seasonId,
    input.campaignId,
    input.targetTerritoryCode,
  );
  assert(row.battle_status === 'captured', `Campaign ${input.campaignId} did not capture its target.`);
  assert(row.campaign_phase === 'cooldown', `Campaign ${input.campaignId} did not enter cooldown.`);
  assert(row.outcome === 'captured', `Campaign ${input.campaignId} did not record a captured outcome.`);
  assert(row.owner_faction_id === input.attackerFactionId, `Target ${input.targetTerritoryCode} did not change owner.`);
}

async function closeSeasonAndOpenNext(seasonId: string, endsAt: number) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await reconcileWorld(endsAt + 1);
    const active = await activeSeasonRecord();
    if (active.id !== seasonId) {
      const completed = await requiredRow<{
        status: string;
        winner_faction_id: string | null;
        finalized_at: number | null;
      }>('SELECT status, winner_faction_id, finalized_at FROM seasons WHERE id = ?1', seasonId);
      assert(completed.status === 'completed', 'The previous season did not close.');
      assert(completed.winner_faction_id, 'The completed season has no Crown winner.');
      assert(completed.finalized_at !== null, 'The completed season has no finalization timestamp.');
      return {
        completedSeasonId: seasonId,
        winnerFactionId: completed.winner_faction_id,
        nextSeasonId: active.id,
        nextSeasonNumber: active.number,
      };
    }
  }
  throw new Error('Season closure did not finish within the bounded reconciliation budget.');
}

function nextCaptureWindow(after: number): number {
  const minimum = after + 6 * HOUR_MILLISECONDS;
  let candidate = Math.ceil((after + 1) / HOUR_MILLISECONDS) * HOUR_MILLISECONDS;
  for (let attempt = 0; attempt < 48; attempt += 1) {
    if (candidate >= minimum && captureWindowAt(candidate)) return candidate;
    candidate += HOUR_MILLISECONDS;
  }
  throw new Error('No Madrid capture window was found within 48 hours.');
}

async function requiredRow<T>(sql: string, ...values: Array<string | number>): Promise<T> {
  const row = await getRawD1().prepare(sql).bind(...values).first<T>();
  if (!row) throw new Error(`Verification query returned no row: ${sql.split('\n')[0]}`);
  return row;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
