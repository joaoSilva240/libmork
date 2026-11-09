import { describe, it, expect } from "vitest";
import { resolveNpcPinAttack, doubleDamageDice, NPC_DAMAGE_TYPES } from "../npc-attack";

describe("doubleDamageDice — crítico no natural 20 (follow-up #90)", () => {
  it("dobra apenas os dados, preservando o modificador", () => {
    expect(doubleDamageDice("1d6+3")).toBe("2d6+3");
    expect(doubleDamageDice("2d6+5")).toBe("4d6+5");
    expect(doubleDamageDice("3d6")).toBe("6d6");
    expect(doubleDamageDice("1d12-2")).toBe("2d12-2");
  });

  it("dobra qualquer dado, inclusive d20 (callers só aplicam a dano)", () => {
    expect(doubleDamageDice("1d20+9")).toBe("2d20+9");
    expect(doubleDamageDice("texto aleatório")).toBe("texto aleatório");
    expect(doubleDamageDice(undefined)).toBeUndefined();
    expect(doubleDamageDice(null)).toBeUndefined();
  });
});

describe("resolveNpcPinAttack (issue #90)", () => {
  it("usa campos configurados quando presentes", () => {
    const result = resolveNpcPinAttack({
      attackExpression: "1d20+9",
      damageExpression: "3d6+5",
      damageType: "cortante",
    });

    expect(result).toEqual({
      attackExpr: "1d20+9",
      damageExpr: "3d6+5",
      damageType: "cortante",
      source: "configured",
    });
  });

  it("configured: ataque sem dano configurado fica sem damageExpr", () => {
    const result = resolveNpcPinAttack({ attackExpression: "1d20+9" });

    expect(result.attackExpr).toBe("1d20+9");
    expect(result.damageExpr).toBeUndefined();
    expect(result.source).toBe("configured");
  });

  it("legado com parênteses continua funcionando (ataque(dano))", () => {
    const result = resolveNpcPinAttack({ rollExpression: "1d20+5(1d8+3)" });

    expect(result).toEqual({
      attackExpr: "1d20+5",
      damageExpr: "1d8+3",
      source: "legacy-paren",
    });
  });

  it("legado com parênteses e modificador puro no ataque expande para 1d20±X", () => {
    const result = resolveNpcPinAttack({ rollExpression: "+5(1d8+3)" });

    expect(result.attackExpr).toBe("1d20+5");
    expect(result.damageExpr).toBe("1d8+3");
    expect(result.source).toBe("legacy-paren");
  });

  it("modificador puro NUNCA inventa 1d6+X (bug da issue #90)", () => {
    const result = resolveNpcPinAttack({ rollExpression: "+9" });

    expect(result.attackExpr).toBe("1d20+9");
    expect(result.damageExpr).toBeUndefined();
    expect(result.source).toBe("attack-only");
  });

  it("1d20+7 (sugerido pela UI antiga) não gera dano em silêncio", () => {
    const result = resolveNpcPinAttack({ rollExpression: "1d20+7" });

    expect(result.attackExpr).toBe("1d20+7");
    expect(result.damageExpr).toBeUndefined();
    expect(result.source).toBe("attack-only");
  });

  it("dano puro (1d8+3) mantém ataque padrão + dano legado", () => {
    const result = resolveNpcPinAttack({ rollExpression: "1d8+3" });

    expect(result.attackExpr).toBe("1d20");
    expect(result.damageExpr).toBe("1d8+3");
    expect(result.source).toBe("legacy-damage-only");
  });

  it("expressão vazia: ataque padrão e sem dano", () => {
    const result = resolveNpcPinAttack({});

    expect(result).toEqual({ attackExpr: "1d20", source: "none" });
  });

  it("campos configurados têm prioridade sobre rollExpression legado", () => {
    const result = resolveNpcPinAttack({
      attackExpression: "1d20+9",
      damageExpression: "3d6+5",
      rollExpression: "1d20+5(1d8+3)",
    });

    expect(result.attackExpr).toBe("1d20+9");
    expect(result.damageExpr).toBe("3d6+5");
    expect(result.source).toBe("configured");
  });

  it("expõe a lista de tipos de dano suportados", () => {
    expect(NPC_DAMAGE_TYPES).toEqual(["cortante", "contundente", "perfurante"]);
  });
});
