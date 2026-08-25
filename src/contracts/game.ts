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
  locale: z.enum(['es', 'en', 'ca', 'eu', 'gl']),
  quietHoursStart: z.number().int().min(0).max(23),
  quietHoursEnd: z.number().int().min(0).max(23),
  maxWarAlertsPerDay: z.number().int().min(0).max(4),
  councilAlerts: z.boolean(),
});

export type WorldSnapshot = {
  mode: 'live-world';
  serverTime: number;
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
    occupiedAt: number | null;
  }>;
  battles: Array<{
    id: string;
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
    engineVersion: string;
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
    aggregateId: string;
    payload: unknown;
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
};
