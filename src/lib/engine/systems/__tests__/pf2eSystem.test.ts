import { describe, it, expect, vi } from "vitest";
import { pf2eSystem, Pf2eSystem } from "../pf2eSystem";
import { getGameSystem, listGameSystems } from "../../registry";

describe("Pf2eSystem — GameSystem Implementation", () => {
  it("possui identificador e metadados corretos", () => {
    expect(pf2eSystem.id).toBe("pf2e");
    expect(pf2eSystem.name).toBe("Pathfinder 2e");
    expect(pf2eSystem.description).toContain("Pathfinder 2e");
  });

  it("está registrado no registry global e pode ser recuperado por id", () => {
    const sys = getGameSystem("pf2e");
    expect(sys).toBe(pf2eSystem);

    const systems = listGameSystems();
    const found = systems.find((s) => s.id === "pf2e");
    expect(found).toBeDefined();
    expect(found?.name).toBe("Pathfinder 2e");
  });

  it("calcula modificadores no padrão PF2e", () => {
    expect(pf2eSystem.getModifier(10)).toBe(0);
    expect(pf2eSystem.getModifier(14)).toBe(2);
    expect(pf2eSystem.getModifier(8)).toBe(-1);
  });

  it("calcula status derivados respeitando atributos e nível", () => {
    const stats = pf2eSystem.getDerivedStats(
      {
        forca: 14,
        destreza: 14, // mod +2
        vigor: 12, // mod +1
        inteligencia: 10,
        empatia: 10,
        sorte: 10,
      },
      1,
    );

    // HP: 8 + (8 + 1) * 1 = 17
    expect(stats.hitPointsMax).toBe(17);
    // Mana/Focus inicial = 1
    expect(stats.manaPointsMax).toBe(1);
    // Bloqueio = max(5, 1 + 1) = 5
    expect(stats.block).toBe(5);
    // Slots de perícias = 4 + 0 = 4
    expect(stats.trainedSkillSlots).toBe(4);
    // Modificadores calculados
    expect(stats.modifiers.forca).toBe(2);
    expect(stats.modifiers.destreza).toBe(2);
    expect(stats.modifiers.vigor).toBe(1);

    // Defesa / CA pelo método dedicado de GameSystem:
    // 10 + 2 (dex) + 3 (trained lv1 = 1 + 2) = 15
    expect(pf2eSystem.getDefenseValue(14)).toBe(15);
  });

  it("calcula slots de perícias treinadas baseados em Inteligência", () => {
    // INT 10 (mod 0) -> 4 slots
    expect(pf2eSystem.getTrainedSkillSlots(10, 1)).toBe(4);
    // INT 14 (mod +2) -> 6 slots
    expect(pf2eSystem.getTrainedSkillSlots(14, 1)).toBe(6);
    // INT 6 (mod -2) -> mínimo 2 slots
    expect(pf2eSystem.getTrainedSkillSlots(6, 1)).toBe(2);
  });

  it("executa resolveTest retornando detalhes do grau de sucesso", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.7); // d20 -> 15
    const res = pf2eSystem.resolveTest("d20_mod", 2, 12);
    expect(res.total).toBe(17);
    expect(res.success).toBe(true);
    expect(res.details).toContain("Sucesso");
    randomSpy.mockRestore();
  });

  it("executa resolveAttack dobrando dano no acerto crítico", () => {
    const res = pf2eSystem.resolveAttack({
      rawDamage: 8,
      reaction: "dodge",
      attackRoll: 25,
      defenseValue: 15,
      vigor: 10,
      level: 1,
      isPhysical: true,
    });
    expect(res.hit).toBe(true);
    expect(res.damageTaken).toBe(16); // 8 * 2
  });

  it("define custo padrão de 2 ações para magias em PF2e", () => {
    expect(pf2eSystem.getSpellActionCost(1)).toBe(2);
    expect(pf2eSystem.getSpellActionCost(5)).toBe(2);
    expect(pf2eSystem.getSpellActionCost(1, 1)).toBe(1); // override de 1 ação
    expect(pf2eSystem.getSpellActionCost(1, 3)).toBe(3); // override de 3 ações
  });

  it("processa salvaguardas de morte / recovery checks no padrão PF2e", () => {
    // d20 = 20 -> crítico, +2 sucessos
    const critSuccess = pf2eSystem.processDeathSaveRoll(0, 0, 20, 0);
    expect(critSuccess.newSuccesses).toBe(2);
    expect(critSuccess.newFailures).toBe(0);

    // d20 = 1 -> falha crítica, +2 falhas
    const critFailure = pf2eSystem.processDeathSaveRoll(0, 0, 1, 0);
    expect(critFailure.newSuccesses).toBe(0);
    expect(critFailure.newFailures).toBe(2);

    // acúmulo de 3 falhas -> morto
    const deadResult = pf2eSystem.processDeathSaveRoll(0, 2, 8, 0);
    expect(deadResult.isDead).toBe(true);

    // acúmulo de 3 sucessos -> estabilizado
    const stabilizedResult = pf2eSystem.processDeathSaveRoll(2, 0, 12, 0);
    expect(stabilizedResult.isStabilized).toBe(true);
  });
});
