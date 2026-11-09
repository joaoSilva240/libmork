import { describe, it, expect } from "vitest";
import { resolveNpcPinAttack, NPC_DAMAGE_TYPES } from "../npc-attack";

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
