// =============================================================================
// Libmork — Sistema Fallout 2d20: Paths dos assets oficiais (public/systems/fallout)
// Arte de Muttley/foundryvtt-fallout (consentimento Modiphius — ver ATTRIBUTION.txt)
// =============================================================================

import type { FalloutBodyLocation, FalloutItemType } from "./types";

const BASE = "/systems/fallout";

/** Filtro CSS que tinge a silhueta preta do Vault Boy com o verde-fósforo do Pip-Boy. */
export const PIPBOY_GREEN_FILTER =
  "invert(64%) sepia(78%) saturate(4274%) hue-rotate(87deg) brightness(111%) contrast(101%)";

export type PaperdollActorKind = "character" | "robot";
export type PaperdollPartState = "healthy" | "wounded" | "crippled";

const ROBOT_PART_FILES: Record<FalloutBodyLocation, string> = {
  head: "optics",
  torso: "body",
  armL: "arm1",
  armR: "arm2",
  legL: "thruster",
  legR: "arm3",
};

export function getPaperdollPartState(injuries: number): PaperdollPartState {
  if (injuries >= 3) return "crippled";
  if (injuries > 0) return "wounded";
  return "healthy";
}

export function getPaperdollImage(
  kind: PaperdollActorKind,
  location: FalloutBodyLocation,
  state: PaperdollPartState,
): string {
  const file = kind === "robot" ? ROBOT_PART_FILES[location] : location;
  return `${BASE}/paperdoll/${kind}/${state}/${file}.png`;
}

export function getCombatDieFace(value: number): string {
  const face = Math.min(6, Math.max(1, Math.round(value)));
  return `${BASE}/dice/combat/d${face}.webp`;
}

export type D20DieState = "neutral" | "success" | "crit" | "complication";

export function getD20Icon(state: D20DieState): string {
  const file = state === "neutral" ? "d20-white" : `d20-${state}`;
  return `${BASE}/dice/d20/${file}.svg`;
}

const HIT_LOCATION_FILES: Record<FalloutBodyLocation, string> = {
  head: "head",
  torso: "body",
  armL: "arm-l",
  armR: "arm-r",
  legL: "leg-l",
  legR: "leg-r",
};

export function getHitLocationIcon(location: FalloutBodyLocation): string {
  return `${BASE}/hit-locations/${HIT_LOCATION_FILES[location]}.webp`;
}

const ITEM_ICON_FILES: Record<FalloutItemType, string> = {
  weapon: "weapon",
  apparel: "apparel",
  ammo: "ammo",
  consumable: "consumable",
  perk: "perk",
  miscellany: "miscellany",
  mod: "weapon_mod",
};

export function getFalloutItemIcon(type: FalloutItemType): string {
  return `${BASE}/items/${ITEM_ICON_FILES[type]}.svg`;
}

export function getFalloutOriginIcon(): string {
  return `${BASE}/items/origin.svg`;
}

export function getFalloutPerkIcon(): string {
  return `${BASE}/items/perk.svg`;
}
