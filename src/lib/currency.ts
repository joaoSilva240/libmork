import type { CoinsBalance } from "@/lib/validators/character";

/** Smallest-unit values used by every currency conversion and total. */
export const COIN_UNITS: Record<keyof CoinsBalance, number> = {
  bronze: 1,
  prata: 10,
  ouro: 100,
  platina: 1000,
  diamante: 100000,
};

export const COIN_KEYS: (keyof CoinsBalance)[] = ["diamante", "platina", "ouro", "prata", "bronze"];

export function totalInBronze(coins: CoinsBalance): number {
  return COIN_KEYS.reduce((total, key) => total + (coins[key] ?? 0) * COIN_UNITS[key], 0);
}
