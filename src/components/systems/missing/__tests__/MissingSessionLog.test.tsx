import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MissingSessionLog } from "../MissingSessionLog";

const mockSubscribeCreated = vi.fn(() => vi.fn());
const mockSubscribeUpdated = vi.fn(() => vi.fn());

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    isConnected: true,
    subscribeCampaignLogCreated: mockSubscribeCreated,
    subscribeCampaignLogUpdated: mockSubscribeUpdated,
  }),
}));

const mockLedgerEvents = [
  {
    id: "ev-test-1",
    campaignId: "camp-123",
    habitantId: "hab-1",
    actorRole: "writer",
    actorId: "usr-1",
    eventType: "TEST_ROLLED",
    payload: {
      type: "probable",
      dice: [3, 5],
      effectiveTotal: 6,
      outcome: "gain",
      habitantName: "Arthur Pendelton",
      quotedLine: "Lembro do sino tocando às 6h da manhã na capela",
      supportGains: 1,
      details: "Teste provável com apoio",
    },
    timestamp: "2026-10-29T12:00:00Z",
  },
  {
    id: "ev-test-forced",
    campaignId: "camp-123",
    habitantId: "hab-1",
    actorRole: "writer",
    actorId: "usr-1",
    eventType: "TEST_FORCED",
    payload: {
      type: "common",
      dice: [2],
      forcedDie: 1,
      effectiveTotal: 1,
      outcome: "loss",
      habitantName: "Arthur Pendelton",
      equipmentName: "Lanterna Antiga",
      equipmentLost: true,
      erasuresCount: 2,
      details: "A lanterna estourou nos dedos sob a névoa",
    },
    timestamp: "2026-10-29T12:05:00Z",
  },
  {
    id: "ev-line-erased",
    campaignId: "camp-123",
    habitantId: "hab-1",
    actorRole: "writer",
    actorId: "usr-1",
    eventType: "LINE_ERASED",
    payload: {
      lineIndex: 2,
      lineText: "Minha irmã me deu uma medalha de São Cristóvão",
      reason: "Confronto direto com a Sombra",
      habitantName: "Arthur Pendelton",
    },
    timestamp: "2026-10-29T12:10:00Z",
  },
  {
    id: "ev-eq-lost",
    campaignId: "camp-123",
    habitantId: "hab-1",
    actorRole: "writer",
    actorId: "usr-1",
    eventType: "EQUIPMENT_LOST",
    payload: {
      equipmentName: "Canivete Enferrujado",
      reason: "Caiu no bueiro aberto",
    },
    timestamp: "2026-10-29T12:15:00Z",
  },
];

describe("MissingSessionLog Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockLedgerEvents }),
    } as any);
  });

  it("busca e exibe o histórico de ocorrências com estética de boletim", async () => {
    render(<MissingSessionLog campaignId="camp-123" />);

    expect(screen.getByText("BOLETIM DE OCORRÊNCIAS")).toBeInTheDocument();
    expect(screen.getByText("// DIÁRIO DE INVESTIGAÇÃO")).toBeInTheDocument();

    await waitFor(() => {
      // Habitante e Ganho
      expect(screen.getAllByText(/Arthur Pendelton/i).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("GANHO (Sucesso)")).toBeInTheDocument();
      expect(screen.getByText("PERDA (Falha)")).toBeInTheDocument();

      // Memória invocada e apoio
      expect(
        screen.getByText(/Memória invocada: “Lembro do sino tocando às 6h da manhã na capela”/),
      ).toBeInTheDocument();
      expect(screen.getByText("Apoio recebido: +1")).toBeInTheDocument();

      // Teste forçado com equipamento destruído
      expect(screen.getByText(/Equipamento arriscado: “Lanterna Antiga”/)).toBeInTheDocument();
      expect(screen.getByText("EQUIPAMENTO DESTRUÍDO")).toBeInTheDocument();

      // Linha rasurada
      expect(
        screen.getByText("Linha #3 rasurada no registro de Arthur Pendelton"),
      ).toBeInTheDocument();
      expect(screen.getByText(/Confronto direto com a Sombra/)).toBeInTheDocument();

      // Equipamento perdido
      expect(
        screen.getByText(/Equipamento “Canivete Enferrujado” inutilizado permanentemente/),
      ).toBeInTheDocument();
    });
  });

  it("permite filtrar por testes ou rasuras", async () => {
    render(<MissingSessionLog campaignId="camp-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("log-test-ev-test-1")).toBeInTheDocument();
    });

    // Clica em 'Testes'
    fireEvent.click(screen.getByRole("button", { name: "Testes" }));

    expect(screen.getByTestId("log-test-ev-test-1")).toBeInTheDocument();
    expect(screen.getByTestId("log-test-ev-test-forced")).toBeInTheDocument();
    expect(screen.queryByTestId("log-erase-ev-line-erased")).not.toBeInTheDocument();

    // Clica em 'Rasuras'
    fireEvent.click(screen.getByRole("button", { name: "Rasuras" }));

    expect(screen.queryByTestId("log-test-ev-test-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("log-erase-ev-line-erased")).toBeInTheDocument();
    expect(screen.getByTestId("log-lost-ev-eq-lost")).toBeInTheDocument();
  });

  it("aciona recarregamento ao clicar no botão de refresh", async () => {
    render(<MissingSessionLog campaignId="camp-123" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/systems/missing/campaigns/camp-123/ledger",
        expect.anything(),
      );
    });

    const refreshBtn = screen.getByTestId("btn-refresh-missing-log");
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it("renderiza eventos em ordem cronológica decrescente (mais recente primeiro)", async () => {
    render(<MissingSessionLog campaignId="camp-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("missing-session-log-list")).toBeInTheDocument();
    });

    const list = screen.getByTestId("missing-session-log-list");
    const testIds = Array.from(list.querySelectorAll("[data-testid]"))
      .map((el) => el.getAttribute("data-testid"))
      .filter((id) => id?.startsWith("log-"));

    expect(testIds).toEqual([
      "log-lost-ev-eq-lost", // 12:15:00
      "log-erase-ev-line-erased", // 12:10:00
      "log-test-ev-test-forced", // 12:05:00
      "log-test-ev-test-1", // 12:00:00
    ]);
  });
});
