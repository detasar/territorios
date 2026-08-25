export function ownerColorForTerritory(code: string): string {
  if (!/^\d{2}$/.test(code)) throw new Error('Canonical territory code must have two digits.');
  const value = Number(code);
  if (value < 1 || value > 52) throw new Error('Canonical territory code must be from 01 through 52.');
  const hue = Math.round((((value - 1) * 137.508) + 8) % 360);
  const saturation = 48 + (value % 4) * 6;
  const lightness = 38 + (value % 3) * 6;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function provinceVisualState(input: {
  territoryCode: string;
  ownerFactionId: string | undefined;
  viewerFactionId: string | undefined;
  selectedTerritoryCode: string;
  activeOriginCode: string | undefined;
  activeTargetCode: string | undefined;
  siegeBp: number | undefined;
}): {
  viewerOwned: boolean;
  frontOrigin: boolean;
  frontTarget: boolean;
  contested: boolean;
  selected: boolean;
} {
  return {
    viewerOwned: Boolean(input.ownerFactionId && input.ownerFactionId === input.viewerFactionId),
    frontOrigin: input.territoryCode === input.activeOriginCode,
    frontTarget: input.territoryCode === input.activeTargetCode,
    contested: (input.siegeBp ?? 0) > 0,
    selected: input.territoryCode === input.selectedTerritoryCode,
  };
}
