import { describe, it, expect } from "vitest";
import {
  FALLOUT_EXTRA_DICE_AP_COST,
  getExtraDiceApCost,
  getExtraDiceLuckCost,
  evaluateRollDice,
  roll2d20,
  isRadiationImmune,
  clampRadiation,
  getRadiationCondition,
} from "../rules";

describe("Fallout 2d20 — Custo de dados extras", () => {
  it("cobra 0/1/3/6 AP para 0/1/2/3 dados extras", () => {
    expect(FALLOUT_EXTRA_DICE_AP_COST).toEqual([0, 1, 3, 6]);
    expect([0, 1, 2, 3].map(getExtraDiceApCost)).toEqual([0, 1, 3, 6]);
  });

  it("satura o custo no teto de 3 dados extras em vez de retornar undefined", () => {
    expect(getExtraDiceApCost(9)).toBe(6);
    expect(getExtraDiceApCost(-2)).toBe(0);
  });

  it("fora de campanha o custo é 1 Ponto de Sorte por dado extra", () => {
    expect([0, 1, 2, 3].map(getExtraDiceLuckCost)).toEqual([0, 1, 2, 3]);
    expect(getExtraDiceLuckCost(7)).toBe(3);
  });
});

describe("Fallout 2d20 — Avaliação pura dos dados (base do re-roll)", () => {
  const params = {
    attributeValue: 7,
    skillRank: 3,
    isTagSkill: true,
    difficulty: 2,
    extraDiceCount: 1,
  };

  it("recalcula o mesmo resultado a partir das faces guardadas", () => {
    const rolled = roll2d20(params, [1, 20, 12]);
    const replayed = evaluateRollDice([1, 20, 12], params);
    expect(replayed).toEqual(rolled);
  });

  it("conta 2 sucessos no crítico de Tag Skill e complicação no 20", () => {
    const result = evaluateRollDice([2, 20], params);
    expect(result.dice[0]).toEqual({
      value: 2,
      successes: 2,
      isCritical: true,
      isComplication: false,
    });
    expect(result.dice[1].isComplication).toBe(true);
    expect(result.totalSuccesses).toBe(2);
    expect(result.isSuccess).toBe(true);
    expect(result.apGenerated).toBe(0);
  });

  it("só gera AP quando o teste passa, e nunca gera AP negativo", () => {
    expect(evaluateRollDice([1, 1], params).apGenerated).toBe(2);
    expect(evaluateRollDice([19, 18], params).apGenerated).toBe(0);
  });

  it("re-rolar um dado falho pode virar o teste e gerar AP", () => {
    const before = evaluateRollDice([18, 4], params);
    expect(before.isSuccess).toBe(false);

    const after = evaluateRollDice([2, 4], params);
    expect(after.isSuccess).toBe(true);
    expect(after.apGenerated).toBe(1);
  });
});

describe("Fallout 2d20 — Radiação", () => {
  it("ghoul, super mutante e mister handy são imunes", () => {
    expect(isRadiationImmune("ghoul")).toBe(true);
    expect(isRadiationImmune("super_mutant")).toBe(true);
    expect(isRadiationImmune("mister_handy")).toBe(true);
  });

  it("origens humanas não são imunes", () => {
    expect(isRadiationImmune("vault_dweller")).toBe(false);
    expect(isRadiationImmune("wastelander")).toBe(false);
    expect(isRadiationImmune("brotherhood_initiate")).toBe(false);
    expect(isRadiationImmune("survivor")).toBe(false);
  });

  it("limita a radiação entre 0 e o teto base de PV", () => {
    expect(clampRadiation(-5, 12)).toBe(0);
    expect(clampRadiation(30, 12)).toBe(12);
    expect(clampRadiation(4, 12)).toBe(4);
  });

  it("deriva a condição do percentual de radiação sobre o teto de PV", () => {
    expect(getRadiationCondition(0, 20).stage).toBe("clean");
    expect(getRadiationCondition(2, 20).stage).toBe("tainted");
    expect(getRadiationCondition(5, 20).stage).toBe("sickened");
    expect(getRadiationCondition(10, 20).stage).toBe("weakened");
    expect(getRadiationCondition(15, 20).stage).toBe("critical");
    expect(getRadiationCondition(20, 20).stage).toBe("incapacitated");
  });

  it("aplica penalidade de dificuldade crescente conforme a condição", () => {
    expect(getRadiationCondition(0, 20).difficultyPenalty).toBe(0);
    expect(getRadiationCondition(2, 20).difficultyPenalty).toBe(0);
    expect(getRadiationCondition(5, 20).difficultyPenalty).toBe(1);
    expect(getRadiationCondition(10, 20).difficultyPenalty).toBe(1);
    expect(getRadiationCondition(15, 20).difficultyPenalty).toBe(2);
    expect(getRadiationCondition(20, 20).difficultyPenalty).toBe(2);
  });

  it("expõe o teto de PV efetivo junto da condição", () => {
    const condition = getRadiationCondition(6, 20);
    expect(condition.effectiveMaxHp).toBe(14);
    expect(condition.percent).toBe(30);
    expect(condition.label).toBeTruthy();
    expect(condition.description).toBeTruthy();
  });
});
