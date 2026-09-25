// =============================================================================
// Libmork — Motor de Regras: Dados e Rolagens (D-02, D-24)
// =============================================================================
// Executado no CLIENTE para velocidade (D-43).
// =============================================================================

import { applyLuckToRoll, type LuckRng, type LuckRollResult } from "./luck";

/** Rola um dado de N lados (RNG digital). */
export function rollDie(sides: number, rng: LuckRng = Math.random): number {
  return Math.floor(rng() * sides) + 1;
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
    sorte: "sorte",
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
export function rollExpression(expression: unknown, fallback = 0, options?: {
  luckModifier?: number;
  rng?: LuckRng;
}): {
  formula: string;
  total: number;
  detail: string;
  missing: boolean;
  valid: boolean;
  luckActivated?: boolean;
  luckDetails?: LuckRollResult[];
} {
  const luckModifier = options?.luckModifier ?? 0;
  const rng = options?.rng ?? Math.random;
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
  const luckDetails: LuckRollResult[] = [];
  let anyLuckActivated = false;
  for (const part of parts) {
    const sign = part.trim().startsWith("-") ? -1 : 1;
    const value = part.replace(/^[+\-]\s*/, "");
    const dice = value.match(/^(\d+)[dD](\d+)$/);
    if (dice) {
      const count = Number(dice[1]);
      const sides = Number(dice[2]);
      const rolls: number[] = [];
      for (let i = 0; i < count; i++) {
        const roll = rollDie(sides, rng);
        const luckResult = applyLuckToRoll({ roll, luckModifier, sides, rng });
        rolls.push(luckResult.final);
        luckDetails.push(luckResult);
        if (luckResult.wasLuckActivated) anyLuckActivated = true;
      }
      total += sign * rolls.reduce((sum, roll) => sum + roll, 0);
      details.push(`${sign < 0 ? "-" : ""}[${rolls.join(", ")}]`);
    } else {
      total += sign * Number(value);
      details.push(`${sign < 0 ? "-" : ""}${value}`);
    }
  }
  return {
    formula,
    total,
    detail: `${formula} = ${total} (${details.join(" ")})`,
    missing: false,
    valid: true,
    luckActivated: anyLuckActivated,
    luckDetails: anyLuckActivated ? luckDetails : undefined,
  };
}

/**
 * Rola 1d20 + modificador (motor d20_mod — D-02).
 * Retorna o resultado total e os componentes.
 */
export function rollD20WithModifier(
  modifier: number,
  luckModifier?: number,
  rng: LuckRng = Math.random
): {
  die: number;
  modifier: number;
  total: number;
  luckActivated?: boolean;
  luckRoll?: LuckRollResult;
} {
  const baseDie = rollDie(20, rng);
  const luck = applyLuckToRoll({ roll: baseDie, luckModifier, sides: 20, rng });
  const die = luck.final;
  return {
    die,
    modifier,
    total: die + modifier,
    luckActivated: luck.wasLuckActivated,
    luckRoll: luck,
  };
}

/**
 * Rola 2d20 e soma (motor dual_d20_sum — D-02).
 * Retorna o resultado total e os dados individuais.
 */
export function rollDualD20Sum(
  luckModifier?: number,
  rng: LuckRng = Math.random
): {
  dice: [number, number];
  total: number;
  luckActivated?: boolean;
  luckRolls?: [LuckRollResult, LuckRollResult];
} {
  const d1 = rollDie(20, rng);
  const luck1 = applyLuckToRoll({ roll: d1, luckModifier, sides: 20, rng });
  const d2 = rollDie(20, rng);
  const luck2 = applyLuckToRoll({ roll: d2, luckModifier, sides: 20, rng });
  const dice: [number, number] = [luck1.final, luck2.final];
  const luckActivated = luck1.wasLuckActivated || luck2.wasLuckActivated;
  return {
    dice,
    total: dice[0] + dice[1],
    luckActivated,
    luckRolls: [luck1, luck2],
  };
}

/**
 * Rola com vantagem: 2d20, pega o maior (D-20 — perícia treinada).
 * Aplica vantagem primeiro e uma única camada de sorte sobre o resultado escolhido.
 */
export function rollWithAdvantage(
  luckModifier?: number,
  rng: LuckRng = Math.random
): {
  dice: [number, number];
  result: number;
  luckActivated?: boolean;
  luckRoll?: LuckRollResult;
} {
  const dice: [number, number] = [rollDie(20, rng), rollDie(20, rng)];
  const chosen = Math.max(dice[0], dice[1]);
  const luck = applyLuckToRoll({ roll: chosen, luckModifier, sides: 20, rng });
  return {
    dice,
    result: luck.final,
    luckActivated: luck.wasLuckActivated,
    luckRoll: luck,
  };
}

/**
 * Rola com desvantagem: 2d20, pega o menor.
 * Aplica desvantagem primeiro e uma única camada de sorte sobre o resultado escolhido.
 */
export function rollWithDisadvantage(
  luckModifier?: number,
  rng: LuckRng = Math.random
): {
  dice: [number, number];
  result: number;
  luckActivated?: boolean;
  luckRoll?: LuckRollResult;
} {
  const dice: [number, number] = [rollDie(20, rng), rollDie(20, rng)];
  const chosen = Math.min(dice[0], dice[1]);
  const luck = applyLuckToRoll({ roll: chosen, luckModifier, sides: 20, rng });
  return {
    dice,
    result: luck.final,
    luckActivated: luck.wasLuckActivated,
    luckRoll: luck,
  };
}

/**
 * Resolve um teste conforme o motor de regras da campanha (D-02).
 *
 * @param engine Motor de regras da campanha
 * @param modifier Modificador do atributo/perícia
 * @param difficulty Dificuldade do teste
 * @param advantage Se o teste tem vantagem (perícia treinada)
 * @param luckModifier Modificador de Sorte opcional (Issue #14)
 * @param rng Gerador de números pseudo-aleatórios opcional
 * @returns Resultado do teste
 */
export function resolveTest(
  engine: "d20_mod" | "dual_d20_sum",
  modifier: number,
  difficulty: number,
  advantage: boolean = false,
  luckModifier?: number,
  rng: LuckRng = Math.random,
): {
  success: boolean;
  total: number;
  details: string;
  luckActivated?: boolean;
} {
  if (engine === "d20_mod") {
    let die: number;
    let details: string;
    let luckActivated = false;

    if (advantage) {
      const roll = rollWithAdvantage(luckModifier, rng);
      die = roll.result;
      luckActivated = Boolean(roll.luckActivated);
      const luckText = roll.luckActivated
        ? ` (Sorte: [${roll.luckRoll?.rolls.join(", ")}])`
        : "";
      details = `2d20 (vantagem) [${roll.dice[0]}, ${roll.dice[1]}] → ${roll.luckRoll?.original ?? die}${luckText} + ${modifier}`;
    } else {
      const roll = rollD20WithModifier(modifier, luckModifier, rng);
      die = roll.die;
      luckActivated = Boolean(roll.luckActivated);
      const luckText = roll.luckActivated
        ? ` (Sorte: [${roll.luckRoll?.rolls.join(", ")}])`
        : "";
      details = `1d20 [${roll.luckRoll?.original ?? die}]${luckText} + ${modifier}`;
    }

    const total = die + modifier;
    return {
      success: total >= difficulty,
      total,
      details: `${details} = ${total} vs DC ${difficulty}`,
      luckActivated,
    };
  }

  // dual_d20_sum
  const roll = rollDualD20Sum(luckModifier, rng);
  const total = roll.total + modifier;
  const luckText = roll.luckActivated
    ? ` (Sorte d1:[${roll.luckRolls?.[0].rolls.join(",")}] d2:[${roll.luckRolls?.[1].rolls.join(",")}])`
    : "";
  return {
    success: total >= difficulty,
    total,
    details: `2d20 [${roll.dice[0]} + ${roll.dice[1]}]${luckText} + ${modifier} = ${total} vs DC ${difficulty}`,
    luckActivated: roll.luckActivated,
  };
}

/**
 * Rola teste de morte (D-25).
 * 1d20 seco (sem modificadores), dificuldade = 10 - mod Vigor.
 * Sorte pode ser aplicada sobre o d20 seco se luckModifier for fornecido.
 */
export function rollDeathSave(
  vigorModifier: number,
  luckModifier?: number,
  rng: LuckRng = Math.random
): {
  success: boolean;
  die: number;
  difficulty: number;
  luckActivated?: boolean;
  luckRoll?: LuckRollResult;
} {
  const baseDie = rollDie(20, rng);
  const luck = applyLuckToRoll({ roll: baseDie, luckModifier, sides: 20, rng });
  const die = luck.final;
  const difficulty = 10 - vigorModifier;
  return {
    success: die >= difficulty,
    die,
    difficulty,
    luckActivated: luck.wasLuckActivated,
    luckRoll: luck,
  };
}
