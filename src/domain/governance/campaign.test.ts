import { describe, expect, it } from 'vitest';
import {
  advanceCampaign,
  createPlanningCampaign,
  type CampaignState,
} from './campaign';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe('campaign lifecycle', () => {
  it('locks a supplied target, mobilizes, resolves, cools down, and opens the next round', () => {
    const planning = createPlanningCampaign({
      id: 'campaign-28-1',
      seasonId: 'season-1',
      councilTerritoryCode: '28',
      originTerritoryCode: '28',
      attackerFactionId: 'faction-28',
      cycleNumber: 1,
      opensAt: 0,
      ballotClosesAt: 15 * MINUTE,
    });

    const locked = advanceCampaign(planning, {
      now: 5 * MINUTE,
      targetWinner: '45',
    });
    expect(locked.campaign).toMatchObject({
      phase: 'mobilizing',
      targetTerritoryCode: '45',
      mobilizesAt: 20 * MINUTE,
    });
    expect(locked.effects).toEqual([
      { type: 'target-locked', campaignId: 'campaign-28-1', targetTerritoryCode: '45' },
    ]);

    const active = advanceCampaign(locked.campaign, { now: 20 * MINUTE });
    expect(active.campaign).toMatchObject({
      phase: 'active',
      battleId: 'battle-campaign-28-1',
    });
    expect(active.effects[0]).toMatchObject({
      type: 'create-battle',
      originTerritoryCode: '28',
      targetTerritoryCode: '45',
      startedAt: 20 * MINUTE,
    });

    const cooling = advanceCampaign(active.campaign, {
      now: 2 * HOUR,
      battleOutcome: 'captured',
    });
    expect(cooling.campaign).toMatchObject({
      phase: 'cooldown',
      resolvedAt: 2 * HOUR,
      cooldownEndsAt: 3 * HOUR,
    });

    const next = advanceCampaign(cooling.campaign, {
      now: 3 * HOUR,
      nextCampaignId: 'campaign-28-2',
      nextBallotClosesAt: 3 * HOUR + 15 * MINUTE,
    });
    expect(next.campaign).toMatchObject({
      id: 'campaign-28-2',
      phase: 'planning',
      cycleNumber: 2,
      councilTerritoryCode: '28',
      originTerritoryCode: '45',
      targetTerritoryCode: null,
      battleId: null,
    });
    expect(next.effects).toEqual([
      { type: 'open-next-cycle', previousCampaignId: 'campaign-28-1', campaignId: 'campaign-28-2' },
    ]);
  });

  it('does not advance without the evidence required by the current phase', () => {
    const planning = createPlanningCampaign({
      id: 'campaign-01-1',
      seasonId: 'season-1',
      councilTerritoryCode: '01',
      originTerritoryCode: '01',
      attackerFactionId: 'faction-01',
      cycleNumber: 1,
      opensAt: 0,
      ballotClosesAt: 15 * MINUTE,
    });

    expect(advanceCampaign(planning, { now: MINUTE })).toEqual({
      campaign: planning,
      effects: [],
    });
    const locked = advanceCampaign(planning, { now: MINUTE, targetWinner: '02' }).campaign;
    expect(advanceCampaign(locked, { now: 2 * MINUTE })).toEqual({ campaign: locked, effects: [] });
  });

  it('uses the scheduled mobilization time when reconciliation arrives late', () => {
    const planning = createPlanningCampaign({
      id: 'campaign-28-late',
      seasonId: 'season-1',
      councilTerritoryCode: '28',
      originTerritoryCode: '28',
      attackerFactionId: 'faction-28',
      cycleNumber: 1,
      opensAt: 0,
      ballotClosesAt: 15 * MINUTE,
    });
    const mobilizing = advanceCampaign(planning, {
      now: MINUTE,
      targetWinner: '45',
    }).campaign;

    expect(advanceCampaign(mobilizing, { now: 2 * HOUR }).effects[0]).toMatchObject({
      type: 'create-battle',
      startedAt: 16 * MINUTE,
    });
  });

  it('proves five consecutive conquest cycles without resetting campaign history', () => {
    let campaign: CampaignState = createPlanningCampaign({
      id: 'campaign-28-1',
      seasonId: 'season-1',
      councilTerritoryCode: '28',
      originTerritoryCode: '28',
      attackerFactionId: 'faction-28',
      cycleNumber: 1,
      opensAt: 0,
      ballotClosesAt: 15 * MINUTE,
    });
    const targets = ['45', '13', '16', '19', '02'];

    targets.forEach((target, index) => {
      const base = index * 4 * HOUR;
      campaign = advanceCampaign(campaign, { now: base + MINUTE, targetWinner: target }).campaign;
      campaign = advanceCampaign(campaign, { now: base + 16 * MINUTE }).campaign;
      campaign = advanceCampaign(campaign, { now: base + 2 * HOUR, battleOutcome: 'captured' }).campaign;
      campaign = advanceCampaign(campaign, {
        now: base + 3 * HOUR,
        nextCampaignId: `campaign-28-${index + 2}`,
        nextBallotClosesAt: base + 3 * HOUR + 15 * MINUTE,
      }).campaign;
    });

    expect(campaign).toMatchObject({
      id: 'campaign-28-6',
      cycleNumber: 6,
      phase: 'planning',
      originTerritoryCode: '02',
    });
  });
});
