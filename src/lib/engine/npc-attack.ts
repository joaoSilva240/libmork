// =============================================================================
// Libmork — Engine: resolução de ataque de NPC (Issue #90)
// =============================================================================

export type NpcDamageType = "cortante" | "contundente" | "perfurante";

export const NPC_DAMAGE_TYPES: readonly NpcDamageType[] = [
  "cortante",
  "contundente",
  "perfurante",
] as const;

export type NpcPinAttackInput = {
  attackExpression?: string | null;
  damageExpression?: string | null;
  damageType?: string | null;
  rollExpression?: string | null;
};

export type NpcAttackSource =
  | "configured"
  | "legacy-paren"
  | "legacy-damage-only"
  | "attack-only"
  | "none";

export type NpcPinAttack = {
  attackExpr: string;
  damageExpr?: string;
  damageType?: string;
  source: NpcAttackSource;
};

/**
 * Convenção legada `ataque(dano)` — antes viva em `parseNpcPinExpression`
 * (ActorOverlay). Extraída para módulo puro e reutilizada como fallback de
 * compatibilidade.
 */
function parseLegacyExpression(rawExpr?: string | null): {
  attackExpr: string;
  damageExpr?: string;
  source: NpcAttackSource;
} {
  const expr = (rawExpr || "").trim();

  if (!expr) {
    return { attackExpr: "1d20", source: "none" };
  }

  // Convenção `ataque(dano)`: ex. `1d20+5(1d8+3)`.
  const parenMatch = expr.match(/^([^(]+)\(([^)]+)\)/);
  if (parenMatch) {
    let attackPart = parenMatch[1].trim();
    const damagePart = parenMatch[2].trim();

    if (/^[+-]?\d+$/.test(attackPart)) {
      const sign = attackPart.startsWith("-") ? "" : "+";
      attackPart = `1d20${sign}${attackPart.replace(/^\+/, "")}`;
    }

    return {
      attackExpr: attackPart || "1d20",
      damageExpr: damagePart || undefined,
      source: "legacy-paren",
    };
  }

  // Modificador puro (`+9` / `-2`): apenas ataque — NUNCA inventa `1d6+X`.
  if (/^[+-]?\d+$/.test(expr)) {
    const val = expr.startsWith("-") ? expr : `+${expr.replace(/^\+/, "")}`;
    return { attackExpr: `1d20${val}`, source: "attack-only" };
  }

  // Ataque puro (`1d20+7`): sem dano configurado; a UI deve avisar.
  if (/d20/i.test(expr)) {
    return { attackExpr: expr, source: "attack-only" };
  }

  // Dano puro (`1d8+3`): ataque padrão + dano legado.
  return { attackExpr: "1d20", damageExpr: expr, source: "legacy-damage-only" };
}

/**
 * Dobra a quantidade de dados de uma expressão de dano, preservando o
 * modificador (crítico no natural 20 — issue #90 follow-up):
 *   1d6+3 → 2d6+3 | 2d6+5 → 4d6+5 | 3d6 → 6d6
 * Retorna a própria expressão se ela não estiver no formato XdY±Z.
 */
export function doubleDamageDice(expr: string | undefined | null): string | undefined {
  if (!expr) return undefined;
  const match = expr.trim().match(/^(\d+)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?$/i);
  if (!match) return expr.trim();

  const dice = Number.parseInt(match[1], 10) * 2;
  const sides = match[2];
  const sign = match[3];
  const mod = match[4];
  const modPart = sign && mod ? `${sign}${mod}` : "";
  return `${dice}d${sides}${modPart}`;
}

/**
 * Resolve ataque/dano de um atalho de NPC (issue #90).
 *
 * Regras:
 * 1. Campos configurados (`attackExpression`/`damageExpression`) têm prioridade
 *    — `source: "configured"`.
 * 2. Sem campos configurados, cai no parser legado (`ataque(dano)` etc.) só
 *    por compatibilidade com pins antigos.
 * 3. NUNCA inventa `1d6+X`: sem dano configurado, `damageExpr` fica ausente e
 *    `source` indica `attack-only`/`none` para a UI avisar explicitamente.
 */
export function resolveNpcPinAttack(pin: NpcPinAttackInput): NpcPinAttack {
  const attackExpression = pin.attackExpression?.trim();
  const damageExpression = pin.damageExpression?.trim();
  const damageType = pin.damageType?.trim() || undefined;

  if (attackExpression || damageExpression) {
    return {
      attackExpr: attackExpression || "1d20",
      damageExpr: damageExpression || undefined,
      damageType,
      source: "configured",
    };
  }

  const legacy = parseLegacyExpression(pin.rollExpression);
  return {
    attackExpr: legacy.attackExpr,
    damageExpr: legacy.damageExpr,
    source: legacy.source,
  };
}
