import { describe, it, expect } from "vitest";
import {
  getPf2eModifier,
  getPf2eProficiencyBonus,
  getPf2eMultipleAttackPenalty,
  resolvePf2eDegreeOfSuccess,
  calculatePf2eAc,
  calculatePf2eSave,
  resolvePf2eAttack,
} from "../pf2e-rules";

describe("Pathfinder 2e Core Rules Engine (Phase 1)", () => {
  describe("1. Modificadores de Atributo (getPf2eModifier)", () => {
    it("calcula modificadores de atributo no padrão oficial d20 (score - 10) / 2", () => {
      expect(getPf2eModifier(8)).toBe(-1);
      expect(getPf2eModifier(9)).toBe(-1);
      expect(getPf2eModifier(10)).toBe(0);
      expect(getPf2eModifier(11)).toBe(0);
      expect(getPf2eModifier(12)).toBe(1);
      expect(getPf2eModifier(14)).toBe(2);
      expect(getPf2eModifier(16)).toBe(3);
      expect(getPf2eModifier(18)).toBe(4);
      expect(getPf2eModifier(20)).toBe(5);
    });
  });

  describe("2. Sistema de Proficiência TEML (getPf2eProficiencyBonus)", () => {
    it("Untrained concede bônus 0 independentemente do nível", () => {
      expect(getPf2eProficiencyBonus("untrained", 1)).toBe(0);
      expect(getPf2eProficiencyBonus("untrained", 10)).toBe(0);
      expect(getPf2eProficiencyBonus("untrained", 20)).toBe(0);
    });

    it("Trained concede nível + 2", () => {
      expect(getPf2eProficiencyBonus("trained", 1)).toBe(3);
      expect(getPf2eProficiencyBonus("trained", 5)).toBe(7);
      expect(getPf2eProficiencyBonus("trained", 20)).toBe(22);
    });

    it("Expert concede nível + 4", () => {
      expect(getPf2eProficiencyBonus("expert", 1)).toBe(5);
      expect(getPf2eProficiencyBonus("expert", 10)).toBe(14);
    });

    it("Master concede nível + 6", () => {
      expect(getPf2eProficiencyBonus("master", 1)).toBe(7);
      expect(getPf2eProficiencyBonus("master", 15)).toBe(21);
    });

    it("Legendary concede nível + 8", () => {
      expect(getPf2eProficiencyBonus("legendary", 1)).toBe(9);
      expect(getPf2eProficiencyBonus("legendary", 20)).toBe(28);
    });
  });

  describe("3. Penalidade de Ataques Múltiplos — MAP (getPf2eMultipleAttackPenalty)", () => {
    it("armas convencionais sofrem 0 / -5 / -10", () => {
      expect(getPf2eMultipleAttackPenalty(0, false)).toBe(0);
      expect(getPf2eMultipleAttackPenalty(1, false)).toBe(-5);
      expect(getPf2eMultipleAttackPenalty(2, false)).toBe(-10);
      expect(getPf2eMultipleAttackPenalty(3, false)).toBe(-10);
    });

    it("armas com traço Ágil (Agile) sofrem 0 / -4 / -8", () => {
      expect(getPf2eMultipleAttackPenalty(0, true)).toBe(0);
      expect(getPf2eMultipleAttackPenalty(1, true)).toBe(-4);
      expect(getPf2eMultipleAttackPenalty(2, true)).toBe(-8);
      expect(getPf2eMultipleAttackPenalty(3, true)).toBe(-8);
    });
  });

  describe("4. Quatro Graus de Sucesso (resolvePf2eDegreeOfSuccess)", () => {
    it("determina Sucesso Crítico quando total >= DC + 10", () => {
      const res = resolvePf2eDegreeOfSuccess({ roll: 15, modifier: 5, dc: 10 });
      expect(res.total).toBe(20);
      expect(res.degree).toBe("critical_success");
      expect(res.success).toBe(true);
    });

    it("determina Sucesso quando DC <= total < DC + 10", () => {
      const res = resolvePf2eDegreeOfSuccess({ roll: 10, modifier: 5, dc: 15 });
      expect(res.total).toBe(15);
      expect(res.degree).toBe("success");
      expect(res.success).toBe(true);
    });

    it("determina Falha quando DC - 10 < total < DC", () => {
      const res = resolvePf2eDegreeOfSuccess({ roll: 8, modifier: 5, dc: 15 });
      expect(res.total).toBe(13);
      expect(res.degree).toBe("failure");
      expect(res.success).toBe(false);
    });

    it("determina Falha Crítica quando total <= DC - 10", () => {
      const res = resolvePf2eDegreeOfSuccess({ roll: 3, modifier: 1, dc: 15 });
      expect(res.total).toBe(4);
      expect(res.degree).toBe("critical_failure");
      expect(res.success).toBe(false);
    });

    describe("Regra oficial de Natural 20 (eleva 1 grau)", () => {
      it("eleva Falha para Sucesso", () => {
        // total 20 vs DC 25 seria falha, mas d20=20 eleva para sucesso
        const res = resolvePf2eDegreeOfSuccess({ roll: 20, modifier: 0, dc: 25 });
        expect(res.initialDegree).toBe("failure");
        expect(res.degree).toBe("success");
        expect(res.isNatural20).toBe(true);
        expect(res.success).toBe(true);
      });

      it("eleva Sucesso para Sucesso Crítico", () => {
        // total 25 vs DC 20 seria sucesso comum, vira sucesso crítico
        const res = resolvePf2eDegreeOfSuccess({ roll: 20, modifier: 5, dc: 20 });
        expect(res.initialDegree).toBe("success");
        expect(res.degree).toBe("critical_success");
      });

      it("eleva Falha Crítica para Falha", () => {
        // total 20 vs DC 35 seria falha crítica, sobe para falha comum
        const res = resolvePf2eDegreeOfSuccess({ roll: 20, modifier: 0, dc: 35 });
        expect(res.initialDegree).toBe("critical_failure");
        expect(res.degree).toBe("failure");
      });
    });

    describe("Regra oficial de Natural 1 (rebaixa 1 grau)", () => {
      it("rebaixa Sucesso para Falha", () => {
        // total 16 vs DC 15 seria sucesso, rebaixa para falha
        const res = resolvePf2eDegreeOfSuccess({ roll: 1, modifier: 15, dc: 15 });
        expect(res.initialDegree).toBe("success");
        expect(res.degree).toBe("failure");
        expect(res.isNatural1).toBe(true);
        expect(res.success).toBe(false);
      });

      it("rebaixa Sucesso Crítico para Sucesso", () => {
        // total 26 vs DC 15 seria crítico (>= 25), rebaixa para sucesso
        const res = resolvePf2eDegreeOfSuccess({ roll: 1, modifier: 25, dc: 15 });
        expect(res.initialDegree).toBe("critical_success");
        expect(res.degree).toBe("success");
      });

      it("rebaixa Falha para Falha Crítica", () => {
        // total 6 vs DC 15 seria falha, rebaixa para falha crítica
        const res = resolvePf2eDegreeOfSuccess({ roll: 1, modifier: 5, dc: 15 });
        expect(res.initialDegree).toBe("failure");
        expect(res.degree).toBe("critical_failure");
      });
    });
  });

  describe("5. Cálculo de CA e Salvaguardas (calculatePf2eAc, calculatePf2eSave)", () => {
    it("calcula CA base 10 + Destreza + Proficiência + Item", () => {
      const ac = calculatePf2eAc({
        dexterityMod: 3,
        armorProficiencyBonus: 3, // Trained Nível 1
        itemBonus: 1,
      });
      expect(ac).toBe(17);
    });

    it("respeita o limite de Destreza da armadura (maxDexBonus)", () => {
      const ac = calculatePf2eAc({
        dexterityMod: 4,
        armorProficiencyBonus: 3,
        itemBonus: 4,
        maxDexBonus: 1, // Armadura pesada com cap de Dex
      });
      expect(ac).toBe(10 + 1 + 3 + 4); // 18
    });

    it("acrescenta bônus de escudo levantado", () => {
      const acWithShield = calculatePf2eAc({
        dexterityMod: 2,
        armorProficiencyBonus: 3,
        shieldRaised: true,
        shieldBonus: 2,
      });
      expect(acWithShield).toBe(10 + 2 + 3 + 2); // 17
    });

    it("calcula Salvaguarda somando atributo, proficiência e itens", () => {
      const fortSave = calculatePf2eSave({
        attributeMod: 3, // CON +3
        proficiencyBonus: 5, // Expert Nível 1
        itemBonus: 1,
      });
      expect(fortSave).toBe(9);
    });
  });

  describe("6. Resolução de Ataque (resolvePf2eAttack)", () => {
    it("erro quando o ataque não atinge a CA", () => {
      const res = resolvePf2eAttack({
        rawDamage: 10,
        reaction: "dodge",
        attackRoll: 14,
        defenseValue: 16,
        vigor: 10,
        level: 1,
        isPhysical: true,
      });
      expect(res.hit).toBe(false);
      expect(res.damageTaken).toBe(0);
    });

    it("acerto normal aplica o dano total contra esquiva", () => {
      const res = resolvePf2eAttack({
        rawDamage: 10,
        reaction: "dodge",
        attackRoll: 16,
        defenseValue: 16,
        vigor: 10,
        level: 1,
        isPhysical: true,
      });
      expect(res.hit).toBe(true);
      expect(res.damageTaken).toBe(10);
    });

    it("acerto crítico (ataque >= CA + 10) dobra o dano", () => {
      const res = resolvePf2eAttack({
        rawDamage: 10,
        reaction: "dodge",
        attackRoll: 26,
        defenseValue: 16,
        vigor: 10,
        level: 1,
        isPhysical: true,
      });
      expect(res.hit).toBe(true);
      expect(res.damageTaken).toBe(20); // Dano dobrado!
      expect(res.details).toContain("ACERTO CRÍTICO");
    });

    it("bloqueio com escudo mitiga dano pela dureza", () => {
      const res = resolvePf2eAttack({
        rawDamage: 12,
        reaction: "block",
        attackRoll: 18,
        defenseValue: 15,
        vigor: 14, // mod +2
        level: 2,
        isPhysical: true,
      });
      expect(res.hit).toBe(true);
      expect(res.blocked).toBe(5); // max(5, mod 2 + lv 2 = 4) -> 5
      expect(res.damageTaken).toBe(7); // 12 - 5 = 7
    });
  });
});
