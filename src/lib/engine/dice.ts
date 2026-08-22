// =============================================================================
// Libmork — Motor de Regras: Dados e Rolagens (D-02, D-24)
// =============================================================================
// Executado no CLIENTE para velocidade (D-43).
// =============================================================================

/**
 * Rola um dado de N lados (RNG digital).
 */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Rola múltiplos dados e retorna os resultados individuais.
 */
export function rollDice(count: number, sides: number): number[] {
  return Array.from({ length: count }, () => rollDie(sides));
}

/**
 * Rola 1d20 + modificador (motor d20_mod — D-02).
 * Retorna o resultado total e os componentes.
 */
export function rollD20WithModifier(modifier: number): {
  die: number;
  modifier: number;
  total: number;
} {
  const die = rollDie(20);
  return { die, modifier, total: die + modifier };
}

/**
 * Rola 2d20 e soma (motor dual_d20_sum — D-02).
 * Retorna o resultado total e os dados individuais.
 */
export function rollDualD20Sum(): {
  dice: [number, number];
  total: number;
} {
  const dice: [number, number] = [rollDie(20), rollDie(20)];
  return { dice, total: dice[0] + dice[1] };
}

/**
 * Rola com vantagem: 2d20, pega o maior (D-20 — perícia treinada).
 */
export function rollWithAdvantage(): {
  dice: [number, number];
  result: number;
} {
  const dice: [number, number] = [rollDie(20), rollDie(20)];
  return { dice, result: Math.max(dice[0], dice[1]) };
}

/**
 * Rola com desvantagem: 2d20, pega o menor.
 */
export function rollWithDisadvantage(): {
  dice: [number, number];
  result: number;
} {
  const dice: [number, number] = [rollDie(20), rollDie(20)];
  return { dice, result: Math.min(dice[0], dice[1]) };
}

/**
 * Resolve um teste conforme o motor de regras da campanha (D-02).
 *
 * @param engine Motor de regras da campanha
 * @param modifier Modificador do atributo/perícia
 * @param difficulty Dificuldade do teste
 * @param advantage Se o teste tem vantagem (perícia treinada)
 * @returns Resultado do teste
 */
export function resolveTest(
  engine: "d20_mod" | "dual_d20_sum",
  modifier: number,
  difficulty: number,
  advantage: boolean = false,
): {
  success: boolean;
  total: number;
  details: string;
} {
  if (engine === "d20_mod") {
    let die: number;
    let details: string;

    if (advantage) {
      const roll = rollWithAdvantage();
      die = roll.result;
      details = `2d20 (vantagem) [${roll.dice[0]}, ${roll.dice[1]}] → ${die} + ${modifier}`;
    } else {
      die = rollDie(20);
      details = `1d20 [${die}] + ${modifier}`;
    }

    const total = die + modifier;
    return {
      success: total >= difficulty,
      total,
      details: `${details} = ${total} vs DC ${difficulty}`,
    };
  }

  // dual_d20_sum
  const roll = rollDualD20Sum();
  const total = roll.total + modifier;
  return {
    success: total >= difficulty,
    total,
    details: `2d20 [${roll.dice[0]} + ${roll.dice[1]}] + ${modifier} = ${total} vs DC ${difficulty}`,
  };
}

/**
 * Rola teste de morte (D-25).
 * 1d20 seco (sem modificadores), dificuldade = 10 - mod Vigor.
 */
export function rollDeathSave(vigorModifier: number): {
  success: boolean;
  die: number;
  difficulty: number;
} {
  const die = rollDie(20);
  const difficulty = 10 - vigorModifier;
  return {
    success: die >= difficulty,
    die,
    difficulty,
  };
}
