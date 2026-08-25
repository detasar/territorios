const MINUTE_MILLISECONDS = 60_000;
export const MOBILIZATION_MILLISECONDS = 15 * MINUTE_MILLISECONDS;
export const CAMPAIGN_COOLDOWN_MILLISECONDS = 60 * MINUTE_MILLISECONDS;

export type CampaignPhase = 'planning' | 'mobilizing' | 'active' | 'cooldown';
export type BattleOutcome = 'captured' | 'repelled';

export type CampaignState = {
  id: string;
  seasonId: string;
  councilTerritoryCode: string;
  originTerritoryCode: string;
  attackerFactionId: string;
  cycleNumber: number;
  phase: CampaignPhase;
  opensAt: number;
  ballotClosesAt: number;
  targetTerritoryCode: string | null;
  mobilizesAt: number | null;
  battleId: string | null;
  resolvedAt: number | null;
  cooldownEndsAt: number | null;
  outcome: BattleOutcome | null;
};

export type CampaignEffect =
  | { type: 'target-locked'; campaignId: string; targetTerritoryCode: string }
  | {
      type: 'create-battle';
      campaignId: string;
      battleId: string;
      originTerritoryCode: string;
      targetTerritoryCode: string;
      attackerFactionId: string;
      startedAt: number;
    }
  | { type: 'battle-resolved'; campaignId: string; battleId: string; outcome: BattleOutcome }
  | { type: 'open-next-cycle'; previousCampaignId: string; campaignId: string };

export type AdvanceCampaignInput = {
  now: number;
  targetWinner?: string;
  battleOutcome?: BattleOutcome;
  nextCampaignId?: string;
  nextBallotClosesAt?: number;
};

export function createPlanningCampaign(input: {
  id: string;
  seasonId: string;
  councilTerritoryCode: string;
  originTerritoryCode: string;
  attackerFactionId: string;
  cycleNumber: number;
  opensAt: number;
  ballotClosesAt: number;
}): CampaignState {
  assertTimestamp(input.opensAt);
  assertTimestamp(input.ballotClosesAt);
  if (input.ballotClosesAt <= input.opensAt) {
    throw new RangeError('A campaign ballot must close after it opens.');
  }
  if (!Number.isInteger(input.cycleNumber) || input.cycleNumber < 1) {
    throw new RangeError('A campaign cycle number must be a positive integer.');
  }
  return {
    ...input,
    phase: 'planning',
    targetTerritoryCode: null,
    mobilizesAt: null,
    battleId: null,
    resolvedAt: null,
    cooldownEndsAt: null,
    outcome: null,
  };
}

export function advanceCampaign(
  campaign: CampaignState,
  input: AdvanceCampaignInput,
): { campaign: CampaignState; effects: CampaignEffect[] } {
  assertTimestamp(input.now);

  if (campaign.phase === 'planning' && input.targetWinner) {
    const next = {
      ...campaign,
      phase: 'mobilizing' as const,
      targetTerritoryCode: input.targetWinner,
      mobilizesAt: input.now + MOBILIZATION_MILLISECONDS,
    };
    return {
      campaign: next,
      effects: [{
        type: 'target-locked',
        campaignId: campaign.id,
        targetTerritoryCode: input.targetWinner,
      }],
    };
  }

  if (
    campaign.phase === 'mobilizing' &&
    campaign.targetTerritoryCode &&
    campaign.mobilizesAt !== null &&
    input.now >= campaign.mobilizesAt
  ) {
    const battleId = `battle-${campaign.id}`;
    return {
      campaign: { ...campaign, phase: 'active', battleId },
      effects: [{
        type: 'create-battle',
        campaignId: campaign.id,
        battleId,
        originTerritoryCode: campaign.originTerritoryCode,
        targetTerritoryCode: campaign.targetTerritoryCode,
        attackerFactionId: campaign.attackerFactionId,
        startedAt: campaign.mobilizesAt,
      }],
    };
  }

  if (campaign.phase === 'active' && campaign.battleId && input.battleOutcome) {
    return {
      campaign: {
        ...campaign,
        phase: 'cooldown',
        outcome: input.battleOutcome,
        resolvedAt: input.now,
        cooldownEndsAt: input.now + CAMPAIGN_COOLDOWN_MILLISECONDS,
      },
      effects: [{
        type: 'battle-resolved',
        campaignId: campaign.id,
        battleId: campaign.battleId,
        outcome: input.battleOutcome,
      }],
    };
  }

  if (
    campaign.phase === 'cooldown' &&
    campaign.cooldownEndsAt !== null &&
    input.now >= campaign.cooldownEndsAt &&
    input.nextCampaignId &&
    input.nextBallotClosesAt !== undefined
  ) {
    const originTerritoryCode = campaign.outcome === 'captured'
      ? campaign.targetTerritoryCode ?? campaign.originTerritoryCode
      : campaign.originTerritoryCode;
    const next = createPlanningCampaign({
      id: input.nextCampaignId,
      seasonId: campaign.seasonId,
      councilTerritoryCode: campaign.councilTerritoryCode,
      originTerritoryCode,
      attackerFactionId: campaign.attackerFactionId,
      cycleNumber: campaign.cycleNumber + 1,
      opensAt: input.now,
      ballotClosesAt: input.nextBallotClosesAt,
    });
    return {
      campaign: next,
      effects: [{
        type: 'open-next-cycle',
        previousCampaignId: campaign.id,
        campaignId: next.id,
      }],
    };
  }

  return { campaign, effects: [] };
}

function assertTimestamp(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('Campaign timestamps must be finite and non-negative.');
  }
}
