import type { WorldSnapshot } from '../../contracts/game';

type Battle = WorldSnapshot['battles'][number];

export type SupportImpact = {
  battleId: string;
  route: string;
  side: 'attacker' | 'defender';
  amount: number;
  beforePower: number;
  afterPower: number;
  nextTickAt: number;
};

export function groupFronts<T extends Pick<Battle, 'viewerSide'>>(battles: T[]): {
  mine: T[];
  others: T[];
} {
  return battles.reduce<{ mine: T[]; others: T[] }>((groups, battle) => {
    groups[battle.viewerSide ? 'mine' : 'others'].push(battle);
    return groups;
  }, { mine: [], others: [] });
}

export function viewerHomeSupply(world: WorldSnapshot): {
  code: string;
  name: string;
  supply: number;
} | null {
  const homeCode = world.viewer?.membership?.territoryCode;
  if (!homeCode) return null;
  const home = world.territories.find((territory) => territory.code === homeCode);
  return home ? { code: home.code, name: home.name, supply: home.supply } : null;
}

export function deriveSupportImpact(
  before: WorldSnapshot,
  after: WorldSnapshot,
  battleId: string,
): SupportImpact | null {
  const beforeBattle = before.battles.find((battle) => battle.id === battleId);
  const afterBattle = after.battles.find((battle) => battle.id === battleId);
  const side = beforeBattle?.viewerSide;
  const beforeBalance = before.viewer?.wallet?.freeSupport;
  const afterBalance = after.viewer?.wallet?.freeSupport;
  if (!beforeBattle || !afterBattle || !side || beforeBalance === undefined || afterBalance === undefined) {
    return null;
  }
  const amount = beforeBalance - afterBalance;
  if (amount <= 0) return null;

  const beforePower = side === 'attacker'
    ? beforeBattle.freeAttackPower
    : before.territories.find((territory) => territory.code === beforeBattle.targetTerritoryCode)?.freeGarrison;
  const afterPower = side === 'attacker'
    ? afterBattle.freeAttackPower
    : after.territories.find((territory) => territory.code === afterBattle.targetTerritoryCode)?.freeGarrison;
  if (beforePower === undefined || afterPower === undefined || afterPower < beforePower) return null;

  return {
    battleId,
    route: `${beforeBattle.originName} → ${beforeBattle.targetName}`,
    side,
    amount,
    beforePower,
    afterPower,
    nextTickAt: after.season.nextTickAt,
  };
}
