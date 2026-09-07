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

export type ExpressionValue = string | number | null | undefined | Record<string, unknown>;

/**
 * Normaliza expressões de perícias substituindo tokens de atributos por seus valores.
 */
export function normalizeSkillExpression(
  expression: string | number | null | undefined,
  modifiers: Record<string, number>
): string | null {
  if (expression === null || expression === undefined) return "1d20";
  const str = String(expression).trim();
  if (!str) return "1d20";

  // Mapeamento de atributos aceitos (com e sem acento) para a chave normatizada do mapa
  const attrMap: Record<string, string> = {
    forca: "forca",
    força: "forca",
    destreza: "destreza",
    vigor: "vigor",
    inteligencia: "inteligencia",
    inteligência: "inteligencia",
    empatia: "empatia",
  };

  // Se a expressão for composta apenas por um atributo aceito (case-insensitive)
  const lower = str.toLowerCase();
  if (attrMap[lower]) {
    const key = attrMap[lower];
    const val = modifiers[key] ?? 0;
    return `1d20 + ${val}`;
  }

  // Substituir tokens com regex boundary (\b)
  // Rejeita a expressão se houver qualquer token alfabético desconhecido
  let hasUnknownAlphaToken = false;

  const result = str.replace(/[a-zA-ZáéíóúãõâêîôûçÁÉÍÓÚÃÕÂÊÎÔÛÇ]+/g, (match) => {
    const mLower = match.toLowerCase();
    if (mLower === "d") return match; // Dado 'd' / 'D'
    if (attrMap[mLower]) {
      const key = attrMap[mLower];
      const val = modifiers[key] ?? 0;
      return String(val);
    }
    hasUnknownAlphaToken = true;
    return match;
  });

  if (hasUnknownAlphaToken) return null;
  return result;
}

/**
 * Obtém uma fórmula dos formatos usados pelos importadores. A busca é limitada
 * a dados JSON e nunca interpreta código ou expressões JavaScript.
 */
export function getExpression(value: unknown): string | number | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["formula", "expression", "rollExpression", "value", "damage"]) {
    const candidate = getExpression(record[key]);
    if (candidate !== null) return candidate;
  }
  // Alguns importadores guardam o efeito dentro de dados/effect/amount.
  for (const key of ["data", "effect", "amount", "effects", "result"]) {
    const candidate = getExpression(record[key]);
    if (candidate !== null) return candidate;
  }
  return null;
}

/** Rola apenas expressões seguras no formato NdM (+/- inteiros). */
export function rollExpression(expression: unknown, fallback = 0): {
  formula: string;
  total: number;
  detail: string;
  missing: boolean;
  valid: boolean;
} {
  const normalized = getExpression(expression);
  const missing = normalized === null;
  const formula = missing ? String(fallback) : String(normalized);
  if (typeof normalized === "number") {
    return { formula, total: normalized, detail: `${formula} = ${normalized}`, missing: false, valid: true };
  }
  if (!/^[0-9dD+\-\s]+$/.test(formula)) {
    return { formula, total: fallback, detail: `Fórmula inválida; fallback seguro: ${fallback}`, missing, valid: false };
  }
  const parts = formula.match(/[+-]?\s*(?:\d+[dD]\d+|\d+)/g) ?? [];
  if (!parts.length) return { formula, total: fallback, detail: `Fórmula ausente; fallback seguro: ${fallback}`, missing: true, valid: false };
  let total = 0;
  const details: string[] = [];
  for (const part of parts) {
    const sign = part.trim().startsWith("-") ? -1 : 1;
    const value = part.replace(/^[+\-]\s*/, "");
    const dice = value.match(/^(\d+)[dD](\d+)$/);
    if (dice) {
      const rolls = rollDice(Number(dice[1]), Number(dice[2]));
      total += sign * rolls.reduce((sum, roll) => sum + roll, 0);
      details.push(`${sign < 0 ? "-" : ""}[${rolls.join(", ")}]`);
    } else {
      total += sign * Number(value);
      details.push(`${sign < 0 ? "-" : ""}${value}`);
    }
  }
  return { formula, total, detail: `${formula} = ${total} (${details.join(" ")})`, missing: false, valid: true };
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
