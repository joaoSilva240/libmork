// =============================================================================
// Libmork — Motor de Regras: Descanso (Rest)
// =============================================================================

import { getModifier } from "@/lib/engine/attributes";

export type RestType = "precarious" | "mediocre" | "comfortable" | "luxurious";

export interface RestOptionConfig {
  id: RestType;
  label: string;
  fractionLabel: string;
  description: string;
}

export const REST_OPTIONS: Record<RestType, RestOptionConfig> = {
  precarious: {
    id: "precarious",
    label: "Descanso Precário",
    fractionLabel: "1/8",
    description: "Recupera 1/8 do máximo de vida e mana + modificador de Vigor.",
  },
  mediocre: {
    id: "mediocre",
    label: "Descanso Medíocre",
    fractionLabel: "1/4",
    description: "Recupera 1/4 do máximo de vida e mana + modificador de Vigor.",
  },
  comfortable: {
    id: "comfortable",
    label: "Descanso Confortável",
    fractionLabel: "1/2",
    description: "Recupera 1/2 do máximo de vida e mana + modificador de Vigor.",
  },
  luxurious: {
    id: "luxurious",
    label: "Descanso Luxuoso",
    fractionLabel: "Total",
    description: "Restauração total até o máximo de vida e mana.",
  },
};

export interface RestCalculationParams {
  currentHp: number;
  maxHp: number;
  currentMana: number;
  maxMana: number;
  vigor: number;
  restType: RestType;
}

export interface RestCalculationResult {
  newHp: number;
  newMana: number;
  hpRecovered: number;
  manaRecovered: number;
  hpFractionRecovery: number;
  manaFractionRecovery: number;
  vigorModifier: number;
}

/**
 * Calcula a recuperação de vida e mana com base no tipo de descanso e no Vigor do personagem.
 */
export function calculateRest(params: RestCalculationParams): RestCalculationResult {
  const { currentHp, maxHp, currentMana, maxMana, vigor, restType } = params;
  const vigorModifier = getModifier(vigor);

  let hpFractionRecovery: number;
  let manaFractionRecovery: number;

  switch (restType) {
    case "precarious":
      hpFractionRecovery = Math.floor(maxHp / 8);
      manaFractionRecovery = Math.floor(maxMana / 8);
      break;
    case "mediocre":
      hpFractionRecovery = Math.floor(maxHp / 4);
      manaFractionRecovery = Math.floor(maxMana / 4);
      break;
    case "comfortable":
      hpFractionRecovery = Math.floor(maxHp / 2);
      manaFractionRecovery = Math.floor(maxMana / 2);
      break;
    case "luxurious":
      hpFractionRecovery = maxHp;
      manaFractionRecovery = maxMana;
      break;
  }

  const targetHp = currentHp + (hpFractionRecovery + vigorModifier);
  const newHp = Math.min(maxHp, Math.max(0, targetHp));
  const hpRecovered = Math.max(0, newHp - currentHp);

  const targetMana = currentMana + (manaFractionRecovery + vigorModifier);
  const newMana = Math.min(maxMana, Math.max(0, targetMana));
  const manaRecovered = Math.max(0, newMana - currentMana);

  return {
    newHp,
    newMana,
    hpRecovered,
    manaRecovered,
    hpFractionRecovery,
    manaFractionRecovery,
    vigorModifier,
  };
}
