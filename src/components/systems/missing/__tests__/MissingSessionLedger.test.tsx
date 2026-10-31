import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MissingSessionLedger } from "../MissingSessionLedger";
import type { LedgerEvent } from "@/lib/systems/missing/types";

const mockLedgerEvents: LedgerEvent[] = [
  {
    id: "event-1",
    campaignId: "campaign-1",
    habitantId: "habitant-1",
    actorRole: "writer",
    actorId: "user-1",
    eventType: "TEST_ROLLED",
    payload: {
      type: "common",
      dice: [5],
      outcome: "gain",
      details: "Teste comum: dado [5] (Ganho).",
    },
    timestamp: "2026-10-27T10:00:00Z",
  },
  {
    id: "event-2",
    campaignId: "campaign-1",
    habitantId: "habitant-1",
    actorRole: "writer",
    actorId: "user-1",
    eventType: "LINE_ERASED",
    payload: {
      lineIndex: 2,
      reason: "Confrontou a entidade no farol.",
    },
    timestamp: "2026-10-27T10:05:00Z",
  },
  {
    id: "event-3",
    campaignId: "campaign-1",
    actorRole: "voice",
    actorId: "master-1",
    eventType: "CLUE_CREATED",
    payload: {
      title: "Chave Ensanguentada",
      isFalseClue: true,
    },
    timestamp: "2026-10-27T10:10:00Z",
  },
];

describe("MissingSessionLedger Component", () => {
  it("renderiza os eventos do livro-razão no estilo de ocorrência datilografada", () => {
    render(<MissingSessionLedger events={mockLedgerEvents} />);

    expect(screen.getByText("Registro de Fatos")).toBeInTheDocument();
    expect(screen.getByText("GANHO (Sucesso)")).toBeInTheDocument();
    expect(
      screen.getByText("Linha do Registro #2 foi permanentemente rasurada."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nova evidência documentada: “Chave Ensanguentada”/),
    ).toBeInTheDocument();
  });

  it("permite filtrar eventos por categoria", () => {
    render(<MissingSessionLedger events={mockLedgerEvents} />);

    expect(screen.getByTestId("evento-ledger-event-1")).toBeInTheDocument();
    expect(screen.getByTestId("evento-ledger-event-2")).toBeInTheDocument();
    expect(screen.getByTestId("evento-ledger-event-3")).toBeInTheDocument();

    // Filtra por Testes & Rolagens
    const filtroTestes = screen.getByTestId("filtro-ledger-testes");
    fireEvent.click(filtroTestes);

    expect(screen.getByTestId("evento-ledger-event-1")).toBeInTheDocument();
    expect(screen.queryByTestId("evento-ledger-event-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("evento-ledger-event-3")).not.toBeInTheDocument();
  });

  it("chama onRefresh ao clicar no botão de atualizar", () => {
    const handleRefresh = vi.fn();

    render(<MissingSessionLedger events={mockLedgerEvents} onRefresh={handleRefresh} />);

    const btnRefresh = screen.getByTestId("btn-recarregar-ledger");
    fireEvent.click(btnRefresh);

    expect(handleRefresh).toHaveBeenCalled();
  });
});
