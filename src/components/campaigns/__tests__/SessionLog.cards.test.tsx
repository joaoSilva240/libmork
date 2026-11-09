import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionLog } from "../SessionLog";
import type { CampaignLog } from "@/types";

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    isConnected: true,
    subscribeCampaignLogCreated: () => () => {},
    subscribeCampaignLogUpdated: () => () => {},
    subscribeDiceRoll: () => () => {},
    broadcastCampaignLogUpdate: vi.fn(),
  }),
}));

const campaignId = "camp-123";

function makeLog(overrides: Partial<CampaignLog> & { id: string }): CampaignLog {
  return {
    campaignId,
    actorType: "character",
    actorId: "actor-1",
    actorName: "Hero",
    action: "system_note",
    description: "Evento genérico",
    payload: {},
    createdById: "user-1",
    createdAt: new Date("2026-11-03T10:00:00Z"),
    ...overrides,
  };
}

async function renderWithLogs(logs: CampaignLog[]) {
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: logs }),
    } as Response),
  );

  const utils = render(<SessionLog campaignId={campaignId} />);

  await waitFor(() => {
    expect(screen.getByTestId("filter-all")).toBeInTheDocument();
  });

  return utils;
}

describe("SessionLog — cards do log (Issue #72)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Avatar no canto superior esquerdo", () => {
    it("usa a foto do ator quando o payload traz actorImageUrl", async () => {
      await renderWithLogs([makeLog({ id: "log-1", payload: { actorImageUrl: "/img/hero.png" } })]);

      const img = screen.getByAltText("Hero") as HTMLImageElement;
      expect(img.src).toContain("/img/hero.png");
      expect(screen.getByTestId("log-avatar-image")).toBeInTheDocument();
    });

    it("cai para a inicial do nome quando não há imagem", async () => {
      await renderWithLogs([makeLog({ id: "log-1", actorName: "Thalia", payload: {} })]);

      expect(screen.getByTestId("log-avatar-initial")).toHaveTextContent("T");
    });

    it("usa o escudo para eventos do sistema", async () => {
      await renderWithLogs([
        makeLog({ id: "log-1", actorType: "system", actorName: null, payload: {} }),
      ]);

      expect(screen.getByTestId("log-avatar-system")).toBeInTheDocument();
    });
  });

  describe("2. Badges de perda de HP e Mana", () => {
    it("destaca a queda de HP com badge carmesim e borda de alerta no card", async () => {
      await renderWithLogs([
        makeLog({
          id: "log-1",
          action: "hp_change",
          description: "HP de Hero: 10 → 2 (-8)",
          payload: { from: 10, to: 2, delta: -8 },
        }),
      ]);

      const badge = screen.getByTestId("hp-badge");
      expect(badge).toHaveTextContent("-8 HP");
      expect(badge.className).toContain("text-red-300");
      expect(screen.getByTestId("session-log-entry").className).toContain("border-red-800/80");
    });

    it("destaca o gasto de Mana com badge azul", async () => {
      await renderWithLogs([
        makeLog({
          id: "log-1",
          action: "mana_change",
          description: "Mana de Hero: 5 → 2 (-3)",
          payload: { from: 5, to: 2, delta: -3 },
        }),
      ]);

      const badge = screen.getByTestId("mana-badge");
      expect(badge).toHaveTextContent("-3 MP");
      expect(badge.className).toContain("text-blue-300");
    });

    it("deduz o delta quando o log só traz from e to", async () => {
      await renderWithLogs([
        makeLog({
          id: "log-1",
          action: "hp_change",
          payload: { from: 12, to: 4 },
        }),
      ]);

      expect(screen.getByTestId("hp-badge")).toHaveTextContent("-8 HP");
    });

    it("não gera badge de impacto em ganhos, mantendo o texto suave", async () => {
      await renderWithLogs([
        makeLog({
          id: "log-1",
          action: "hp_change",
          description: "HP de Hero: 2 → 10 (+8)",
          payload: { from: 2, to: 10, delta: 8 },
        }),
      ]);

      expect(screen.queryByTestId("hp-badge")).not.toBeInTheDocument();
      expect(screen.getByText("HP de Hero: 2 → 10 (+8)")).toBeInTheDocument();
    });
  });

  describe("3. Chip da condição", () => {
    it("isola o nome vindo do payload em um chip", async () => {
      await renderWithLogs([
        makeLog({
          id: "log-1",
          action: "condition_add",
          description: 'Condição "Envenenado" aplicada em Hero',
          payload: { conditionId: "c-1", conditionName: "Envenenado" },
        }),
      ]);

      expect(screen.getByTestId("condition-chip")).toHaveTextContent("Envenenado");
    });

    it("ainda acha o nome entre aspas quando o payload não o traz", async () => {
      await renderWithLogs([
        makeLog({
          id: "log-1",
          action: "condition_remove",
          description: 'Condição "Caído" removida de Hero',
          payload: { conditionId: "c-2" },
        }),
      ]);

      expect(screen.getByTestId("condition-chip")).toHaveTextContent("Caído");
    });

    it("não renderiza chip para outros eventos com aspas na descrição", async () => {
      await renderWithLogs([
        makeLog({ id: "log-1", action: "system_note", description: 'Nota "solta" do mestre' }),
      ]);

      expect(screen.queryByTestId("condition-chip")).not.toBeInTheDocument();
    });
  });

  describe("4. Dado desenhado com o resultado dentro", () => {
    it("desenha um d20 hexagonal e mantém o dado vazio enquanto a rolagem é pedida", async () => {
      const { container } = await renderWithLogs([
        makeLog({
          id: "log-1",
          action: "roll_request",
          description: "Hero deve rolar 1d20+3",
          payload: { rollExpression: "1d20+3", result: null },
        }),
      ]);

      expect(screen.getByTestId("die-glyph")).toBeInTheDocument();
      expect(screen.getByTestId("die-value")).toHaveTextContent("?");
      expect(screen.getByText("1d20+3")).toBeInTheDocument();
      expect(container.querySelector("svg path")).not.toBeNull();
      expect(container.querySelector("svg rect")).toBeNull();
    });

    it("desenha o d6 como quadrado arredondado com o total no centro", async () => {
      const { container } = await renderWithLogs([
        makeLog({
          id: "log-1",
          action: "roll_result",
          description: "Hero rolou 2d6 e obteve 9",
          payload: { rollExpression: "2d6", result: 9 },
        }),
      ]);

      expect(screen.getByTestId("die-value")).toHaveTextContent("9");
      expect(container.querySelector("svg rect")).not.toBeNull();
    });

    it("lê os lados do dado mesmo com modificador na expressão", async () => {
      const { container } = await renderWithLogs([
        makeLog({
          id: "log-1",
          action: "roll_result",
          payload: { rollExpression: "1d100", result: 77 },
        }),
      ]);

      expect(screen.getByTestId("die-value")).toHaveTextContent("77");
      expect(container.querySelector("svg rect")).toBeNull();
    });
  });

  describe("5. Barra de filtros por categoria", () => {
    const mixedLogs = [
      makeLog({
        id: "log-1",
        action: "hp_change",
        description: "Perda de HP",
        payload: { delta: -4 },
      }),
      makeLog({
        id: "log-2",
        action: "mana_change",
        description: "Gasto de Mana",
        payload: { delta: -2 },
      }),
      makeLog({
        id: "log-3",
        action: "condition_add",
        description: "Condição aplicada",
        payload: {},
      }),
      makeLog({
        id: "log-4",
        action: "roll_request",
        description: "Rolagem pedida",
        payload: { rollExpression: "1d20" },
      }),
      makeLog({
        id: "log-5",
        action: "roll_result",
        description: "Rolagem feita",
        payload: { rollExpression: "1d20", result: 14 },
      }),
      makeLog({ id: "log-6", action: "xp_gain", description: "XP ganha", payload: {} }),
      makeLog({ id: "log-7", action: "npc_include", description: "NPC incluído", payload: {} }),
    ];

    it("mostra contadores por categoria na barra", async () => {
      await renderWithLogs(mixedLogs);

      expect(screen.getByTestId("filter-all")).toHaveTextContent("Todos (7)");
      expect(screen.getByTestId("filter-impact")).toHaveTextContent("Dano e Mana (2)");
      expect(screen.getByTestId("filter-conditions")).toHaveTextContent("Condição (1)");
      expect(screen.getByTestId("filter-rolls")).toHaveTextContent("Rolagens (2)");
      expect(screen.getByTestId("filter-others")).toHaveTextContent("Outros (2)");
    });

    it("filtra a lista ao trocar de aba", async () => {
      await renderWithLogs(mixedLogs);

      expect(screen.getByText("XP ganha")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("filter-rolls"));
      expect(screen.getByText("Rolagem pedida")).toBeInTheDocument();
      expect(screen.getByText("Rolagem feita")).toBeInTheDocument();
      expect(screen.queryByText("XP ganha")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("filter-impact"));
      expect(screen.getByText("Perda de HP")).toBeInTheDocument();
      expect(screen.queryByText("Rolagem feita")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("filter-all"));
      expect(screen.getByText("XP ganha")).toBeInTheDocument();
    });

    it("avisa quando a categoria não tem eventos", async () => {
      await renderWithLogs([makeLog({ id: "log-1", action: "hp_change", payload: { delta: -1 } })]);

      fireEvent.click(screen.getByTestId("filter-conditions"));
      expect(screen.getByText("Nenhum evento neste filtro.")).toBeInTheDocument();
    });
  });
});
