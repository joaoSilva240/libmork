// =============================================================================
// Libmork — Sistema MISSING — Edição ZERO: Testes Automatizados de Regras
// =============================================================================

import { describe, expect, it } from "vitest";
import {
  calculateErasuresOnLoss,
  canDeclareEpiphany,
  checkHabitantDisappearance,
  reduceThreatDanger,
  resolveDiceOutcome,
  resolveForcedTest,
  resolveTest,
  roll1d6,
  roll2d6,
  validateSceneDanger,
} from "../rules";
import {
  EQUIPMENT_TABLE_2D6,
  type HabitantLine,
  type InvestigationConnection,
  type MissingEquipment,
  type MissingThreat,
} from "../types";
import {
  createClueSchema,
  createConnectionSchema,
  createHabitantSchema,
  declareEpiphanySchema,
  eraseLineSchema,
  sceneThreatsSchema,
  threatSchema,
} from "../validators";

describe("MISSING — Edição ZERO: Motor de Regras e Domínio Puro", () => {
  describe("1. Rolagens Básicas (roll1d6 e roll2d6)", () => {
    it("deve rolar 1d6 retornando valor inteiro entre 1 e 6", () => {
      for (let i = 0; i < 50; i++) {
        const roll = roll1d6();
        expect(Number.isInteger(roll)).toBe(true);
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(6);
      }
    });

    it("deve rolar 2d6 retornando par de inteiros entre 1 e 6", () => {
      for (let i = 0; i < 50; i++) {
        const [d1, d2] = roll2d6();
        expect(Number.isInteger(d1)).toBe(true);
        expect(Number.isInteger(d2)).toBe(true);
        expect(d1).toBeGreaterThanOrEqual(1);
        expect(d1).toBeLessThanOrEqual(6);
        expect(d2).toBeGreaterThanOrEqual(1);
        expect(d2).toBeLessThanOrEqual(6);
      }
    });
  });

  describe("2. Avaliação de Desfecho (resolveDiceOutcome)", () => {
    it("deve retornar 'loss' para valores 1, 2 e 3", () => {
      expect(resolveDiceOutcome(1)).toBe("loss");
      expect(resolveDiceOutcome(2)).toBe("loss");
      expect(resolveDiceOutcome(3)).toBe("loss");
    });

    it("deve retornar 'gain' para valores 4, 5 e 6", () => {
      expect(resolveDiceOutcome(4)).toBe("gain");
      expect(resolveDiceOutcome(5)).toBe("gain");
      expect(resolveDiceOutcome(6)).toBe("gain");
    });
  });

  describe("3. Resolução de Testes (resolveTest)", () => {
    describe("Teste Comum (1d6)", () => {
      it("deve resolver teste comum resultando em Perda quando dado <= 3", () => {
        const result = resolveTest({
          type: "common",
          dice: [2],
        });

        expect(result.type).toBe("common");
        expect(result.selectedDie).toBe(2);
        expect(result.supportBonus).toBe(0);
        expect(result.effectiveTotal).toBe(2);
        expect(result.outcome).toBe("loss");
        expect(result.details).toContain("Perda");
      });

      it("deve resolver teste comum resultando em Ganho quando dado >= 4", () => {
        const result = resolveTest({
          type: "common",
          dice: [5],
        });

        expect(result.type).toBe("common");
        expect(result.selectedDie).toBe(5);
        expect(result.supportBonus).toBe(0);
        expect(result.effectiveTotal).toBe(5);
        expect(result.outcome).toBe("gain");
        expect(result.details).toContain("Ganho");
      });
    });

    describe("Teste Provável (2d6 - maior dado)", () => {
      it("deve selecionar o maior dado em teste provável gerando Ganho", () => {
        const result = resolveTest({
          type: "probable",
          dice: [2, 5],
        });

        expect(result.type).toBe("probable");
        expect(result.selectedDie).toBe(5);
        expect(result.effectiveTotal).toBe(5);
        expect(result.outcome).toBe("gain");
      });

      it("deve selecionar o maior dado em teste provável gerando Perda quando ambos são baixos", () => {
        const result = resolveTest({
          type: "probable",
          dice: [1, 3],
        });

        expect(result.type).toBe("probable");
        expect(result.selectedDie).toBe(3);
        expect(result.effectiveTotal).toBe(3);
        expect(result.outcome).toBe("loss");
      });
    });

    describe("Teste Improvável (2d6 - menor dado)", () => {
      it("deve selecionar o menor dado em teste improvável gerando Perda", () => {
        const result = resolveTest({
          type: "improbable",
          dice: [2, 5],
        });

        expect(result.type).toBe("improbable");
        expect(result.selectedDie).toBe(2);
        expect(result.effectiveTotal).toBe(2);
        expect(result.outcome).toBe("loss");
      });

      it("deve selecionar o menor dado em teste improvável gerando Ganho quando ambos são altos", () => {
        const result = resolveTest({
          type: "improbable",
          dice: [4, 6],
        });

        expect(result.type).toBe("improbable");
        expect(result.selectedDie).toBe(4);
        expect(result.effectiveTotal).toBe(4);
        expect(result.outcome).toBe("gain");
      });
    });

    describe("Bônus de Apoio (+1 por ganho somado ao maior dado)", () => {
      it("deve somar +1 por apoio ao dado único de um teste comum e transformar Perda em Ganho", () => {
        const result = resolveTest({
          type: "common",
          dice: [3],
          supportGains: 1,
        });

        expect(result.selectedDie).toBe(3);
        expect(result.supportBonus).toBe(1);
        expect(result.effectiveTotal).toBe(4);
        expect(result.outcome).toBe("gain");
      });

      it("deve somar +1 por apoio ao maior dado em um teste provável", () => {
        const result = resolveTest({
          type: "probable",
          dice: [2, 3],
          supportGains: 1,
        });

        expect(result.selectedDie).toBe(3);
        expect(result.supportBonus).toBe(1);
        expect(result.effectiveTotal).toBe(4);
        expect(result.outcome).toBe("gain");
      });

      it("em teste improvável, apoio soma ao maior dado mantendo o menor dado decisivo", () => {
        // Conforme o livro pág. 13: '+1 ao maior dos dados em seu Teste original'
        // Teste improvável dita a conclusão com o menor resultado entre eles (pág. 12)
        const result = resolveTest({
          type: "improbable",
          dice: [2, 5],
          supportGains: 1,
        });

        expect(result.selectedDie).toBe(2);
        expect(result.supportBonus).toBe(1);
        expect(result.effectiveTotal).toBe(2);
        expect(result.outcome).toBe("loss");
      });
    });
  });

  describe("4. Forçar Testes (resolveForcedTest)", () => {
    const activeEquipment: MissingEquipment = {
      id: "eq-1",
      slot: 1,
      name: "Lanterna",
      status: "active",
      notes: "Que pisca na presença do mal",
    };

    const lostEquipment: MissingEquipment = {
      id: "eq-2",
      slot: 2,
      name: "Revólver",
      status: "lost",
      notes: "Sem munição e quebrado",
      lostReason: "Perdido em teste forçado anterior",
    };

    it("deve impedir forçar teste caso o equipamento já esteja perdido", () => {
      const original = resolveTest({ type: "common", dice: [2] });

      expect(() =>
        resolveForcedTest({
          originalResult: original,
          forcedDie: 5,
          equipment: lostEquipment,
        }),
      ).toThrowError(/Não é possível forçar o teste com um equipamento inativo ou perdido/);
    });

    it("deve rejeitar dado forçado fora do intervalo de 1 a 6", () => {
      const original = resolveTest({ type: "common", dice: [2] });

      expect(() =>
        resolveForcedTest({
          originalResult: original,
          forcedDie: 7,
          equipment: activeEquipment,
        }),
      ).toThrowError(/O dado forçado deve estar entre 1 e 6/);
    });

    it("forçar teste comum gerando Perda -> equipamento é perdido (equipmentLost: true)", () => {
      const original = resolveTest({ type: "common", dice: [2] });
      const forced = resolveForcedTest({
        originalResult: original,
        forcedDie: 1,
        equipment: activeEquipment,
      });

      expect(forced.forcedDie).toBe(1);
      expect(forced.newSelectedDie).toBe(1);
      expect(forced.effectiveTotal).toBe(1);
      expect(forced.outcome).toBe("loss");
      expect(forced.equipmentLost).toBe(true);
      expect(forced.details).toContain("foi perdido/danificado");
    });

    it("forçar teste comum gerando Ganho -> equipamento é preservado (equipmentLost: false)", () => {
      const original = resolveTest({ type: "common", dice: [2] });
      const forced = resolveForcedTest({
        originalResult: original,
        forcedDie: 5,
        equipment: activeEquipment,
      });

      expect(forced.forcedDie).toBe(5);
      expect(forced.newSelectedDie).toBe(5);
      expect(forced.effectiveTotal).toBe(5);
      expect(forced.outcome).toBe("gain");
      expect(forced.equipmentLost).toBe(false);
      expect(forced.details).toContain("preservado");
    });

    it("forçar teste provável substitui o menor dado e preserva o resultado obrigatório", () => {
      // original dice [2, 3] -> menor é 2. Substitui por 6. Novo conjunto: [6, 3] -> maior é 6.
      const original = resolveTest({ type: "probable", dice: [2, 3] });
      const forced = resolveForcedTest({
        originalResult: original,
        forcedDie: 6,
        equipment: activeEquipment,
      });

      expect(forced.forcedDie).toBe(6);
      expect(forced.newSelectedDie).toBe(6);
      expect(forced.effectiveTotal).toBe(6);
      expect(forced.outcome).toBe("gain");
      expect(forced.equipmentLost).toBe(false);
    });

    it("forçar teste provável com novo resultado baixo resulta em Perda e perda do equipamento", () => {
      // original dice [1, 2] -> menor é 1. Substitui por 1. Novo conjunto: [1, 2] -> maior é 2 (Perda).
      const original = resolveTest({ type: "probable", dice: [1, 2] });
      const forced = resolveForcedTest({
        originalResult: original,
        forcedDie: 1,
        equipment: activeEquipment,
      });

      expect(forced.forcedDie).toBe(1);
      expect(forced.newSelectedDie).toBe(2);
      expect(forced.effectiveTotal).toBe(2);
      expect(forced.outcome).toBe("loss");
      expect(forced.equipmentLost).toBe(true);
    });
  });

  describe("5. Cálculo de Rasuras em Perda (calculateErasuresOnLoss)", () => {
    it("deve retornar 1 rasura base quando não há ameaças ativas", () => {
      expect(calculateErasuresOnLoss()).toBe(1);
      expect(calculateErasuresOnLoss([])).toBe(1);
    });

    it("deve somar 1 base com o perigo total das ameaças presentes", () => {
      // 1 base + perigo 3 = 4 rasuras
      expect(calculateErasuresOnLoss([{ dangerLevel: 3 }])).toBe(4);

      // 1 base + perigos (1 + 2) = 4 rasuras
      expect(calculateErasuresOnLoss([{ dangerLevel: 1 }, { dangerLevel: 2 }])).toBe(4);

      // 1 base + perigo 1 = 2 rasuras
      expect(calculateErasuresOnLoss([{ dangerLevel: 1 }])).toBe(2);
    });
  });

  describe("6. Validação do Perigo Total da Cena (validateSceneDanger)", () => {
    it("deve validar como válida cena com soma de perigo <= 3", () => {
      expect(validateSceneDanger([])).toEqual({ valid: true, totalDanger: 0 });
      expect(validateSceneDanger([{ dangerLevel: 1 }])).toEqual({
        valid: true,
        totalDanger: 1,
      });
      expect(validateSceneDanger([{ dangerLevel: 1 }, { dangerLevel: 2 }])).toEqual({
        valid: true,
        totalDanger: 3,
      });
      expect(validateSceneDanger([{ dangerLevel: 3 }])).toEqual({
        valid: true,
        totalDanger: 3,
      });
    });

    it("deve invalidar cena cuja soma de perigo ultrapasse 3", () => {
      expect(validateSceneDanger([{ dangerLevel: 2 }, { dangerLevel: 2 }])).toEqual({
        valid: false,
        totalDanger: 4,
      });
      expect(
        validateSceneDanger([{ dangerLevel: 1 }, { dangerLevel: 1 }, { dangerLevel: 2 }]),
      ).toEqual({
        valid: false,
        totalDanger: 4,
      });
    });
  });

  describe("7. Desaparecimento do Habitante (checkHabitantDisappearance)", () => {
    it("deve retornar true quando todas as linhas do registro estiverem rasuradas", () => {
      const lines: HabitantLine[] = [
        { id: "1", index: 1, text: "Memória 1", isErased: true },
        { id: "2", index: 2, text: "Memória 2", isErased: true },
        { id: "3", index: 3, text: "Memória 3", isErased: true },
      ];
      expect(checkHabitantDisappearance(lines)).toBe(true);
    });

    it("deve retornar false quando restar ao menos uma linha intacta", () => {
      const lines: HabitantLine[] = [
        { id: "1", index: 1, text: "Memória 1", isErased: true },
        { id: "2", index: 2, text: "Memória 2", isErased: false },
        { id: "3", index: 3, text: "Memória 3", isErased: true },
      ];
      expect(checkHabitantDisappearance(lines)).toBe(false);
    });

    it("deve retornar false se o habitante não possuir linhas registradas", () => {
      expect(checkHabitantDisappearance([])).toBe(false);
    });
  });

  describe("8. Validação de Epifanias da Teia (canDeclareEpiphany)", () => {
    it("no estágio 1 requer ao menos 1 conexão de cada tipo (cause, origin, perspective)", () => {
      const partialConnections: InvestigationConnection[] = [
        {
          id: "c1",
          campaignId: "camp-1",
          sourceClueId: "p1",
          targetClueId: "p2",
          type: "cause",
          createdAt: new Date().toISOString(),
        },
        {
          id: "c2",
          campaignId: "camp-1",
          sourceClueId: "p2",
          targetClueId: "p3",
          type: "origin",
          createdAt: new Date().toISOString(),
        },
      ];

      const check1 = canDeclareEpiphany(partialConnections, 1);
      expect(check1.canDeclare).toBe(false);
      expect(check1.requiredPerType).toBe(1);
      expect(check1.currentCounts).toEqual({
        cause: 1,
        origin: 1,
        perspective: 0,
      });

      const fullConnections: InvestigationConnection[] = [
        ...partialConnections,
        {
          id: "c3",
          campaignId: "camp-1",
          sourceClueId: "p3",
          targetClueId: "p4",
          type: "perspective",
          createdAt: new Date().toISOString(),
        },
      ];

      const check2 = canDeclareEpiphany(fullConnections, 1);
      expect(check2.canDeclare).toBe(true);
      expect(check2.currentCounts).toEqual({
        cause: 1,
        origin: 1,
        perspective: 1,
      });
    });

    it("no estágio 2 ou superior requer ao menos 2 conexões de cada tipo", () => {
      const stage1Complete: InvestigationConnection[] = [
        {
          id: "c1",
          campaignId: "camp-1",
          sourceClueId: "p1",
          targetClueId: "p2",
          type: "cause",
          createdAt: new Date().toISOString(),
        },
        {
          id: "c2",
          campaignId: "camp-1",
          sourceClueId: "p2",
          targetClueId: "p3",
          type: "origin",
          createdAt: new Date().toISOString(),
        },
        {
          id: "c3",
          campaignId: "camp-1",
          sourceClueId: "p3",
          targetClueId: "p4",
          type: "perspective",
          createdAt: new Date().toISOString(),
        },
      ];

      const checkStage2With1Each = canDeclareEpiphany(stage1Complete, 2);
      expect(checkStage2With1Each.canDeclare).toBe(false);
      expect(checkStage2With1Each.requiredPerType).toBe(2);

      const stage2Complete: InvestigationConnection[] = [
        ...stage1Complete,
        {
          id: "c4",
          campaignId: "camp-1",
          sourceClueId: "p4",
          targetClueId: "p5",
          type: "cause",
          createdAt: new Date().toISOString(),
        },
        {
          id: "c5",
          campaignId: "camp-1",
          sourceClueId: "p5",
          targetClueId: "p6",
          type: "origin",
          createdAt: new Date().toISOString(),
        },
        {
          id: "c6",
          campaignId: "camp-1",
          sourceClueId: "p6",
          targetClueId: "p7",
          type: "perspective",
          createdAt: new Date().toISOString(),
        },
      ];

      const checkStage2With2Each = canDeclareEpiphany(stage2Complete, 2);
      expect(checkStage2With2Each.canDeclare).toBe(true);
      expect(checkStage2With2Each.currentCounts).toEqual({
        cause: 2,
        origin: 2,
        perspective: 2,
      });
    });
  });

  describe("9. Redução de Perigo de Ameaça (reduceThreatDanger)", () => {
    it("deve reduzir nível de perigo em 1 e manter ativa se novo nível > 0", () => {
      const threat: MissingThreat = {
        id: "t1",
        name: "Incêndio Descontrolado",
        dangerLevel: 3,
      };

      const step1 = reduceThreatDanger(threat);
      expect(step1.newDangerLevel).toBe(2);
      expect(step1.isTerminated).toBe(false);

      const step2 = reduceThreatDanger({ ...threat, dangerLevel: 2 });
      expect(step2.newDangerLevel).toBe(1);
      expect(step2.isTerminated).toBe(false);
    });

    it("deve terminar a ameaça quando nível chegar a 0", () => {
      const threat: MissingThreat = {
        id: "t2",
        name: "Gato Arisco",
        dangerLevel: 1,
      };

      const step = reduceThreatDanger(threat);
      expect(step.newDangerLevel).toBe(0);
      expect(step.isTerminated).toBe(true);
    });
  });

  describe("10. Tabela de Equipamentos 2d6 (EQUIPMENT_TABLE_2D6)", () => {
    it("deve cobrir todas as somas de 2 a 12 com nomes e descrições válidas", () => {
      for (let sum = 2; sum <= 12; sum++) {
        const item = EQUIPMENT_TABLE_2D6[sum];
        expect(item).toBeDefined();
        expect(typeof item.name).toBe("string");
        expect(item.name.length).toBeGreaterThan(0);
        expect(typeof item.description).toBe("string");
        expect(item.description.length).toBeGreaterThan(0);
      }
    });

    it("deve conter os itens emblemáticos do manual de MISSING", () => {
      expect(EQUIPMENT_TABLE_2D6[2].name).toBe("Rolo de Filme");
      expect(EQUIPMENT_TABLE_2D6[5].name).toBe("Lanterna");
      expect(EQUIPMENT_TABLE_2D6[10].name).toBe("Revólver");
      expect(EQUIPMENT_TABLE_2D6[12].name).toBe("Chaves");
    });
  });

  describe("11. Validadores Zod (validators.ts)", () => {
    it("deve validar criação válida de Habitante", () => {
      const input = {
        name: "Arthur Pendelton",
        lines: [
          "Cresceu perto do cais de pesca de Carlton.",
          "Perdeu a filha durante o inverno de 84.",
          "Trabalhou 15 anos na usina nuclear local.",
          "Tem fobia profunda de silêncios prolongados.",
          "Guarda uma chave enferrujada que não abre nada.",
        ],
        equipments: [
          { name: "Lanterna", notes: "Luz trêmula" },
          { name: "Caderno", notes: "Páginas amareladas" },
          { name: "Canivete", notes: "Lâmina gasta" },
        ],
      };

      const parsed = createHabitantSchema.safeParse(input);
      expect(parsed.success).toBe(true);
    });

    it("deve rejeitar Habitante com menos de 5 linhas ou mais de 30 linhas", () => {
      const tooFewLines = {
        name: "Arthur",
        lines: ["Linha 1", "Linha 2", "Linha 3", "Linha 4"],
        equipments: [{ name: "Item 1" }, { name: "Item 2" }, { name: "Item 3" }],
      };
      expect(createHabitantSchema.safeParse(tooFewLines).success).toBe(false);

      const tooManyLines = {
        name: "Arthur",
        lines: Array.from({ length: 31 }, (_, i) => `Linha ${i + 1}`),
        equipments: [{ name: "Item 1" }, { name: "Item 2" }, { name: "Item 3" }],
      };
      expect(createHabitantSchema.safeParse(tooManyLines).success).toBe(false);
    });

    it("deve rejeitar Habitante que não possua exatamente 3 equipamentos", () => {
      const twoEquipments = {
        name: "Arthur",
        lines: ["L1", "L2", "L3", "L4", "L5"],
        equipments: [{ name: "Item 1" }, { name: "Item 2" }],
      };
      expect(createHabitantSchema.safeParse(twoEquipments).success).toBe(false);
    });

    it("deve validar rasura de linha de registro", () => {
      const valid = eraseLineSchema.safeParse({
        lineId: "line-123",
        reason: "Perda em teste de investigação",
      });
      expect(valid.success).toBe(true);

      const invalid = eraseLineSchema.safeParse({ lineId: "" });
      expect(invalid.success).toBe(false);
    });

    it("deve validar ameaça individual com níveis de perigo permitidos (1, 2, 3)", () => {
      expect(threatSchema.safeParse({ name: "Cão Raivoso", dangerLevel: 2 }).success).toBe(true);
      expect(threatSchema.safeParse({ name: "Invasor", dangerLevel: 4 }).success).toBe(false);
      expect(threatSchema.safeParse({ name: "Invasor", dangerLevel: 0 }).success).toBe(false);
    });

    it("deve validar conjunto de ameaças da cena garantindo soma <= 3", () => {
      const validScene = [
        { name: "Piso Instável", dangerLevel: 1 },
        { name: "Cão Raivoso", dangerLevel: 2 },
      ];
      expect(sceneThreatsSchema.safeParse(validScene).success).toBe(true);

      const invalidScene = [
        { name: "Cão Raivoso", dangerLevel: 2 },
        { name: "Autoridade Impaciente", dangerLevel: 2 },
      ];
      expect(sceneThreatsSchema.safeParse(invalidScene).success).toBe(false);
    });

    it("deve validar criação de pista com e sem entregue ao habitante", () => {
      const clue = {
        title: "Relógio Parado",
        description: "Travou exatamente às 03:14.",
        isFalseClue: false,
        deliveredToHabitantId: "hab-1",
      };
      expect(createClueSchema.safeParse(clue).success).toBe(true);
    });

    it("deve validar conexão de pistas com tipos válidos", () => {
      const connection = {
        sourceClueId: "clue-1",
        targetClueId: "clue-2",
        type: "cause",
        explanation: "O relógio parou quando a fiação foi cortada.",
      };
      expect(createConnectionSchema.safeParse(connection).success).toBe(true);

      const invalidType = {
        ...connection,
        type: "random_type",
      };
      expect(createConnectionSchema.safeParse(invalidType).success).toBe(false);
    });

    it("deve validar declaração de epifania com efeitos válidos", () => {
      expect(declareEpiphanySchema.safeParse({ chosenEffect: "tear_false_clue" }).success).toBe(
        true,
      );
      expect(declareEpiphanySchema.safeParse({ chosenEffect: "answer_question" }).success).toBe(
        true,
      );
      expect(declareEpiphanySchema.safeParse({ chosenEffect: "deliver_new_clue" }).success).toBe(
        true,
      );
      expect(declareEpiphanySchema.safeParse({ chosenEffect: "unsupported_effect" }).success).toBe(
        false,
      );
    });
  });
});
