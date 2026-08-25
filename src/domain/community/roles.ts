export const PLAYER_ROLES = [
  'scout',
  'defender',
  'quartermaster',
  'builder',
  'diplomat',
  'strategist',
  'herald',
] as const;

export type PlayerRole = (typeof PLAYER_ROLES)[number];

export type RoleAction = {
  effect: 'intel' | 'free-garrison' | 'supply' | 'fortification' | 'faction-score' | 'free-support' | 'morale';
  assetKind: 'free_garrison' | 'supply' | 'fortification_bp' | 'faction_score' | 'free_support' | null;
  amount: number;
};

const actions: Record<PlayerRole, RoleAction> = {
  scout: { effect: 'intel', assetKind: null, amount: 0 },
  defender: { effect: 'free-garrison', assetKind: 'free_garrison', amount: 50 },
  quartermaster: { effect: 'supply', assetKind: 'supply', amount: 25 },
  builder: { effect: 'fortification', assetKind: 'fortification_bp', amount: 100 },
  diplomat: { effect: 'faction-score', assetKind: 'faction_score', amount: 10 },
  strategist: { effect: 'free-support', assetKind: 'free_support', amount: 25 },
  herald: { effect: 'morale', assetKind: 'faction_score', amount: 5 },
};

export function roleActionFor(role: string): RoleAction {
  if (!PLAYER_ROLES.includes(role as PlayerRole)) {
    throw new Error(`Unsupported player role: ${role}`);
  }
  return actions[role as PlayerRole];
}
