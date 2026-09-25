// =============================================================================
// Libmork — Motor de Regras: Sorte
// =============================================================================

export type LuckRng = () => number;

export type LuckRollResult = {
  original: number;
  final: number;
  rolls: number[];
  wasLuckActivated: boolean;
  luckChance: number;
  isPenalty: boolean;
};

/** Applies one bounded luck layer to one die result. */
export function applyLuckToRoll({
  roll,
  luckModifier,
  sides,
  rng = Math.random,
}: {
  roll: number;
  luckModifier?: number;
  sides: number;
  rng?: LuckRng;
}): LuckRollResult {
  const modifier = Math.max(-5, Math.min(5, Math.trunc(luckModifier ?? 0)));
  const luckChance = Math.abs(modifier) * 0.2;
  const isPenalty = modifier < 0;
  if (modifier === 0 || luckChance === 0) {
    return { original: roll, final: roll, rolls: [roll], wasLuckActivated: false, luckChance, isPenalty };
  }

  const rolls = [roll];
  if (rng() >= luckChance) {
    return { original: roll, final: roll, rolls, wasLuckActivated: false, luckChance, isPenalty };
  }

  const reroll = Math.floor(rng() * sides) + 1;
  rolls.push(reroll);
  return {
    original: roll,
    final: isPenalty ? Math.min(roll, reroll) : Math.max(roll, reroll),
    rolls,
    wasLuckActivated: true,
    luckChance,
    isPenalty,
  };
}
