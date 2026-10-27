// =============================================================================
// Libmork — Testes: Schema Drizzle e Constantes para MISSING — Edição ZERO
// =============================================================================

import { describe, it, expect } from "vitest";
import { getTableName } from "drizzle-orm";
import {
  missingCampaignStates,
  missingHabitants,
  missingActionLedger,
  missingCampaignStatesRelations,
  missingHabitantsRelations,
  missingActionLedgerRelations,
  campaignsRelations,
  usersRelations,
} from "../schema";
import { RULES_ENGINES, type RulesEngine } from "@/lib/utils/constants";
import type {
  RulesEngine as TypesRulesEngine,
  MissingHabitant,
  MissingScene,
  MissingClue,
  LedgerEvent,
  HabitantStatus,
  Role,
} from "@/types";

describe("MISSING — Edição ZERO: Constantes e Motores de Regra", () => {
  it("deve incluir 'missing_zero' em RULES_ENGINES", () => {
    expect(RULES_ENGINES).toContain("missing_zero");
    expect(RULES_ENGINES).toEqual(["d20_mod", "dual_d20_sum", "missing_zero"]);
  });

  it("tipo RulesEngine deve aceitar 'missing_zero'", () => {
    const engine: RulesEngine = "missing_zero";
    expect(engine).toBe("missing_zero");

    const typesEngine: TypesRulesEngine = "missing_zero";
    expect(typesEngine).toBe("missing_zero");
  });

  it("deve permitir consumo global de tipos de MISSING via @/types", () => {
    const role: Role = "voice";
    const status: HabitantStatus = "active";
    expect(role).toBe("voice");
    expect(status).toBe("active");

    const habitantMock: Partial<MissingHabitant> = {
      name: "Investigador Teste",
      status: "active",
      lines: [],
    };
    expect(habitantMock.name).toBe("Investigador Teste");

    const sceneMock: Partial<MissingScene> = {
      title: "Cena Inicial",
      isActive: true,
      threats: [],
    };
    expect(sceneMock.title).toBe("Cena Inicial");

    const clueMock: Partial<MissingClue> = {
      title: "Foto Queimada",
      isFalseClue: false,
    };
    expect(clueMock.title).toBe("Foto Queimada");

    const eventMock: Partial<LedgerEvent> = {
      eventType: "TEST_ROLLED",
      actorRole: "writer",
    };
    expect(eventMock.eventType).toBe("TEST_ROLLED");
  });
});

describe("MISSING — Edição ZERO: Schema de Tabelas Drizzle", () => {
  describe("Tabela missingCampaignStates", () => {
    it("deve mapear para a tabela SQL 'missing_campaign_states'", () => {
      expect(getTableName(missingCampaignStates)).toBe("missing_campaign_states");
    });

    it("deve possuir todas as colunas obrigatórias com configurações corretas", () => {
      expect(missingCampaignStates.id).toBeDefined();
      expect(missingCampaignStates.id.primary).toBe(true);

      expect(missingCampaignStates.campaignId).toBeDefined();
      expect(missingCampaignStates.campaignId.isUnique).toBe(true);
      expect(missingCampaignStates.campaignId.notNull).toBe(true);

      expect(missingCampaignStates.activeScene).toBeDefined();
      expect(missingCampaignStates.activeScene.notNull).toBe(true);
      expect(missingCampaignStates.activeScene.default).toEqual({
        title: "Cena Inicial",
        isActive: true,
        threats: [],
      });

      expect(missingCampaignStates.cluesBank).toBeDefined();
      expect(missingCampaignStates.cluesBank.notNull).toBe(true);
      expect(missingCampaignStates.cluesBank.default).toEqual([]);

      expect(missingCampaignStates.investigationWeb).toBeDefined();
      expect(missingCampaignStates.investigationWeb.notNull).toBe(true);
      expect(missingCampaignStates.investigationWeb.default).toEqual({ connections: [] });

      expect(missingCampaignStates.epiphanyHistory).toBeDefined();
      expect(missingCampaignStates.epiphanyHistory.notNull).toBe(true);
      expect(missingCampaignStates.epiphanyHistory.default).toEqual([]);

      expect(missingCampaignStates.createdAt).toBeDefined();
      expect(missingCampaignStates.createdAt.notNull).toBe(true);

      expect(missingCampaignStates.updatedAt).toBeDefined();
      expect(missingCampaignStates.updatedAt.notNull).toBe(true);
    });
  });

  describe("Tabela missingHabitants", () => {
    it("deve mapear para a tabela SQL 'missing_habitants'", () => {
      expect(getTableName(missingHabitants)).toBe("missing_habitants");
    });

    it("deve possuir todas as colunas obrigatórias com configurações corretas", () => {
      expect(missingHabitants.id).toBeDefined();
      expect(missingHabitants.id.primary).toBe(true);

      expect(missingHabitants.campaignId).toBeDefined();
      expect(missingHabitants.campaignId.notNull).toBe(true);

      expect(missingHabitants.ownerId).toBeDefined();
      expect(missingHabitants.ownerId.notNull).toBe(true);

      expect(missingHabitants.name).toBeDefined();
      expect(missingHabitants.name.notNull).toBe(true);

      expect(missingHabitants.status).toBeDefined();
      expect(missingHabitants.status.notNull).toBe(true);
      expect(missingHabitants.status.default).toBe("active");

      expect(missingHabitants.lines).toBeDefined();
      expect(missingHabitants.lines.notNull).toBe(true);
      expect(missingHabitants.lines.default).toEqual([]);

      expect(missingHabitants.equipments).toBeDefined();
      expect(missingHabitants.equipments.notNull).toBe(true);
      expect(missingHabitants.equipments.default).toEqual([]);

      expect(missingHabitants.createdAt).toBeDefined();
      expect(missingHabitants.createdAt.notNull).toBe(true);

      expect(missingHabitants.updatedAt).toBeDefined();
      expect(missingHabitants.updatedAt.notNull).toBe(true);
    });
  });

  describe("Tabela missingActionLedger", () => {
    it("deve mapear para a tabela SQL 'missing_action_ledger'", () => {
      expect(getTableName(missingActionLedger)).toBe("missing_action_ledger");
    });

    it("deve possuir todas as colunas obrigatórias com configurações corretas", () => {
      expect(missingActionLedger.id).toBeDefined();
      expect(missingActionLedger.id.primary).toBe(true);

      expect(missingActionLedger.campaignId).toBeDefined();
      expect(missingActionLedger.campaignId.notNull).toBe(true);

      expect(missingActionLedger.habitantId).toBeDefined();
      // habitantId é opcional (on delete set null)
      expect(missingActionLedger.habitantId.notNull).toBe(false);

      expect(missingActionLedger.actorRole).toBeDefined();
      expect(missingActionLedger.actorRole.notNull).toBe(true);

      expect(missingActionLedger.actorId).toBeDefined();
      expect(missingActionLedger.actorId.notNull).toBe(true);

      expect(missingActionLedger.eventType).toBeDefined();
      expect(missingActionLedger.eventType.notNull).toBe(true);

      expect(missingActionLedger.payload).toBeDefined();
      expect(missingActionLedger.payload.notNull).toBe(true);
      expect(missingActionLedger.payload.default).toEqual({});

      expect(missingActionLedger.createdAt).toBeDefined();
      expect(missingActionLedger.createdAt.notNull).toBe(true);
    });
  });
});

describe("MISSING — Edição ZERO: Relacionamentos Drizzle", () => {
  it("deve exportar relations para as 3 tabelas de MISSING", () => {
    expect(missingCampaignStatesRelations).toBeDefined();
    expect(missingHabitantsRelations).toBeDefined();
    expect(missingActionLedgerRelations).toBeDefined();
  });

  it("deve exportar relations atualizadas para campaigns e users", () => {
    expect(campaignsRelations).toBeDefined();
    expect(usersRelations).toBeDefined();
  });
});
