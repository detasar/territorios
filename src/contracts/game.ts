import { z } from 'zod';

export const territoryCodeSchema = z.string().regex(/^\d{2}$/);

export const joinFactionSchema = z.object({
  territoryCode: territoryCodeSchema,
  role: z
    .enum([
      'scout',
      'defender',
      'quartermaster',
      'builder',
      'diplomat',
      'strategist',
      'herald',
    ])
    .default('defender'),
});

export const supportCommandSchema = z.object({
  battleId: z.string().min(8).max(80).regex(/^[a-z0-9-]+$/),
  amount: z.number().int().min(1).max(5_000),
  assetKind: z.enum(['free_support', 'paid_support']),
});

export const councilBallotSchema = z.object({
  territoryCode: territoryCodeSchema,
  electionKind: z.enum(['representative', 'target', 'public-runoff']),
  rankedChoices: z.array(z.string().min(2).max(80)).min(1).max(5),
});

export const announcementSchema = z.object({
  territoryCode: territoryCodeSchema,
  messageKey: z.enum([
    'DEFEND_HERE',
    'SUPPLY_NEEDED',
    'TARGET_CONFIRMED',
    'HOLD_POSITION',
    'THANK_YOU_DEFENDERS',
  ]),
});

export const reportSchema = z.object({
  targetType: z.enum(['announcement', 'user-profile']),
  targetId: z.string().min(1).max(80),
  reason: z.enum([
    'illegal-content',
    'hate-harassment',
    'threat',
    'personal-information',
    'fraud-impersonation',
    'political-propaganda',
    'other',
  ]),
  details: z.string().trim().max(500).optional(),
});

export const notificationPreferenceSchema = z.object({
  locale: z.enum(['es', 'en']),
  quietHoursStart: z.number().int().min(0).max(23),
  quietHoursEnd: z.number().int().min(0).max(23),
  maxWarAlertsPerDay: z.number().int().min(0).max(4),
  councilAlerts: z.boolean(),
});

export const announcementVoteSchema = z.object({
  announcementId: z.string().min(8).max(80).regex(/^[a-zA-Z0-9-]+$/),
  direction: z.enum(['up', 'down']),
});

export const safetyActionSchema = z.object({
  targetRef: z.string().regex(/^[a-f0-9]{16}$/),
  action: z.enum(['block', 'unblock', 'mute', 'unmute']),
});

export const roleActionSchema = z.object({
  territoryCode: territoryCodeSchema,
});

export type CommunitySnapshot = {
  mode: 'live-community';
  serverTime: number;
  territory: null | {
    code: string;
    name: string;
    factionName: string;
  };
  council: {
    term: null | {
      id: string;
      number: number;
      startsAt: number;
      endsAt: number;
    };
    campaign: null | {
      id: string;
      cycleNumber: number;
      phase: 'planning' | 'mobilizing' | 'active' | 'cooldown' | 'resolved';
      originTerritoryCode: string;
      targetTerritoryCode: string | null;
      targetTerritoryName: string | null;
      battleId: string | null;
      ballotClosesAt: number;
      mobilizesAt: number | null;
      cooldownEndsAt: number | null;
    };
    seats: Array<{
      seatKind: 'public-1' | 'public-2' | 'defense' | 'strategy' | 'supporter';
      memberRef: string | null;
      label: string | null;
      role: string | null;
      termEndsAt: number | null;
    }>;
    candidates: Array<{
      candidateRef: string;
      label: string;
      role: string;
      contributionScore: number;
    }>;
    validTargets: Array<{
      code: string;
      name: string;
      routeKind: string;
    }>;
    representativeBallotCast: boolean;
    targetBallotCast: boolean;
    canVoteTarget: boolean;
    targetResult: {
      status: 'winner' | 'tie' | 'no-quorum';
      winner: string | null;
      finalists: string[];
    };
  };
  announcements: Array<{
    id: string;
    territoryCode: string;
    territoryName: string;
    authorRef: string;
    authorLabel: string;
    messageKey: string;
    status: string;
    upvotes: number;
    downvotes: number;
    viewerVote: 'up' | 'down' | null;
    createdAt: number;
  }>;
  notifications: Array<{
    id: string;
    kind: string;
    payload: unknown;
    readAt: number | null;
    createdAt: number;
  }>;
  viewer: null | {
    userRef: string;
    role: string | null;
    roleActionAvailable: boolean;
    nextRoleActionAt: number | null;
    isCouncilMember: boolean;
    canPublish: boolean;
    blockedRefs: string[];
    mutedRefs: string[];
  };
};

export type WorldSnapshot = {
  mode: 'live-world';
  serverTime: number;
  lastUpdatedAt: number;
  season: {
    id: string;
    number: number;
    name: string;
    phase: string;
    status: string;
    startsAt: number;
    endsAt: number;
    lastResolvedTick: number;
    engineVersion: string;
    nextTickAt: number;
  };
  previousSeason: null | {
    id: string;
    number: number;
    name: string;
    winnerFactionId: string;
    winnerFactionName: string;
    finalizedAt: number;
  };
  territories: Array<{
    code: string;
    name: string;
    ownerFactionId: string;
    ownerFactionName: string;
    color: string;
    siegeBp: number;
    attackerFactionId: string | null;
    freeGarrison: number;
    paidGarrison: number;
    supply: number;
    fortificationBp: number;
    occupiedAt: number | null;
  }>;
  battles: Array<{
    id: string;
    campaignId: string;
    originTerritoryCode: string;
    targetTerritoryCode: string;
    originName: string;
    targetName: string;
    attackerFactionId: string;
    defenderFactionId: string;
    siegeBp: number;
    tickCount: number;
    freeAttackPower: number;
    paidAttackPower: number;
    startedAt: number;
    engineVersion: string;
    routeKind: string;
    routeCostBp: number;
    viewerSide: 'attacker' | 'defender' | null;
    canSupport: boolean;
    supportDisabledReason:
      | 'sign-in-required'
      | 'join-faction'
      | 'not-party'
      | null;
    combatContext: {
      supplyConnected: boolean;
      attacker: {
        supplyBp: number;
        distanceBp: number;
        overextensionBp: number;
        fortificationBp: number;
        homelandBp: number;
      };
      defender: {
        supplyBp: number;
        distanceBp: number;
        overextensionBp: number;
        fortificationBp: number;
        homelandBp: number;
      };
    };
  }>;
  factionLeaderboard: Array<{
    factionId: string;
    name: string;
    color: string;
    territories: number;
    score: number;
  }>;
  playerLeaderboard: Array<{
    player: string;
    role: string;
    contributionScore: number;
    factionName: string;
  }>;
  recentEvents: Array<{
    sequence: number;
    eventType: string;
    summaryKey: string;
    summaryArgs: Record<string, string | number>;
    payloadHash: string;
    createdAt: number;
  }>;
  catalog: Array<{
    id: string;
    name: string;
    description: string;
    priceCents: number;
    currency: string;
    paidSupport: number;
  }>;
  viewer: null | {
    displayName: string;
    membership: null | {
      factionId: string;
      factionName: string;
      territoryCode: string;
      role: string;
      contributionScore: number;
    };
    wallet: null | {
      freeSupport: number;
      paidSupport: number;
      supporterPoints: number;
    };
    preferences: null | {
      locale: string;
      quietHoursStart: number;
      quietHoursEnd: number;
      maxWarAlertsPerDay: number;
      councilAlerts: boolean;
    };
  };
  onboarding: {
    nextAction: 'sign-in' | 'join-faction' | 'support-front' | 'wait-for-front' | 'complete';
    eligibleBattleCount: number;
    hasSupportedThisSeason: boolean;
  };
};
