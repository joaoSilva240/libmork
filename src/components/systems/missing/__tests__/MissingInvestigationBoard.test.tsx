import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { MissingInvestigationBoard } from "../MissingInvestigationBoard";
import type { MissingClue, InvestigationConnection } from "@/lib/systems/missing/types";

const mockClues: MissingClue[] = [
  {
    id: "clue-1",
    campaignId: "campaign-1",
    title: "Martelo do Zelador",
    description: "Marcado com sangue seco na base.",
    isFalseClue: false,
    deliveredToHabitantId: null,
    createdAt: "2026-10-27T10:00:00Z",
  },
  {
    id: "clue-2",
    campaignId: "campaign-1",
    title: "Cadeado Rompido",
    description: "Do portão que dava para o reservatório.",
    isFalseClue: false,
    deliveredToHabitantId: null,
    createdAt: "2026-10-27T10:05:00Z",
  },
  {
    id: "clue-3",
    campaignId: "campaign-1",
    title: "Diário de Bordo",
    description: "Anotações com caligrafia idêntica ao bilhete.",
    isFalseClue: false,
    deliveredToHabitantId: null,
    createdAt: "2026-10-27T10:10:00Z",
  },
];

const mockConnectionsStage1Ready: InvestigationConnection[] = [
  {
    id: "conn-1",
    campaignId: "campaign-1",
    sourceClueId: "clue-1",
    targetClueId: "clue-2",
    type: "cause",
    explanation: "Martelo foi usado para estourar o cadeado.",
    createdAt: "2026-10-27T10:15:00Z",
  },
  {
    id: "conn-2",
    campaignId: "campaign-1",
    sourceClueId: "clue-1",
    targetClueId: "clue-3",
    type: "origin",
    explanation: "Pertencem ambos à oficina de manutenção.",
    createdAt: "2026-10-27T10:16:00Z",
  },
  {
    id: "conn-3",
    campaignId: "campaign-1",
    sourceClueId: "clue-2",
    targetClueId: "clue-3",
    type: "perspective",
    explanation: "Relatam o mesmo evento por ângulos opostos.",
    createdAt: "2026-10-27T10:17:00Z",
  },
];

describe("MissingInvestigationBoard Component", () => {
  it("renderiza as pistas entregues no formato post-it no quadro de cortiça", () => {
    render(
      <MissingInvestigationBoard campaignId="campaign-1" clues={mockClues} connections={[]} />,
    );

    const postit1 = screen.getByTestId("postit-pista-clue-1");
    expect(within(postit1).getByText("Martelo do Zelador")).toBeInTheDocument();

    const postit2 = screen.getByTestId("postit-pista-clue-2");
    expect(within(postit2).getByText("Cadeado Rompido")).toBeInTheDocument();

    const postit3 = screen.getByTestId("postit-pista-clue-3");
    expect(within(postit3).getByText("Diário de Bordo")).toBeInTheDocument();
  });

  it("permite traçar uma nova conexão entre duas pistas", async () => {
    const handleCreateConn = vi.fn();

    render(
      <MissingInvestigationBoard
        campaignId="campaign-1"
        clues={mockClues}
        connections={[]}
        onCreateConnection={handleCreateConn}
      />,
    );

    const selectOrigem = screen.getByTestId("select-pista-origem");
    const selectDestino = screen.getByTestId("select-pista-destino");
    const btnCausa = screen.getByTestId("btn-conexao-causa");
    const inputExplicacao = screen.getByTestId("input-explicacao-conexao");
    const btnConectar = screen.getByTestId("btn-conectar-pistas");

    await act(async () => {
      fireEvent.change(selectOrigem, { target: { value: "clue-1" } });
      fireEvent.change(selectDestino, { target: { value: "clue-2" } });
      fireEvent.click(btnCausa);
      fireEvent.change(inputExplicacao, {
        target: { value: "O martelo rompeu o cadeado" },
      });
      fireEvent.click(btnConectar);
    });

    expect(handleCreateConn).toHaveBeenCalledWith({
      sourceClueId: "clue-1",
      targetClueId: "clue-2",
      type: "cause",
      explanation: "O martelo rompeu o cadeado",
    });
  });

  it("filtra conexões por tipo", () => {
    render(
      <MissingInvestigationBoard
        campaignId="campaign-1"
        clues={mockClues}
        connections={mockConnectionsStage1Ready}
      />,
    );

    expect(screen.getByTestId("conexao-item-conn-1")).toBeInTheDocument();
    expect(screen.getByTestId("conexao-item-conn-2")).toBeInTheDocument();
    expect(screen.getByTestId("conexao-item-conn-3")).toBeInTheDocument();

    // Filtra apenas por Causa
    fireEvent.click(screen.getByTestId("filtro-causa"));

    expect(screen.getByTestId("conexao-item-conn-1")).toBeInTheDocument();
    expect(screen.queryByTestId("conexao-item-conn-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("conexao-item-conn-3")).not.toBeInTheDocument();
  });

  it("habilita botão de Epifania e permite escolher um dos 3 efeitos ao cumprir meta", async () => {
    const handleDeclare = vi.fn();

    render(
      <MissingInvestigationBoard
        campaignId="campaign-1"
        clues={mockClues}
        connections={mockConnectionsStage1Ready}
        onDeclareEpiphany={handleDeclare}
      />,
    );

    // Meta cumprida (1 de cada no Estágio 1): botão Declarar Epifania ativo
    const btnEpifania = screen.getByTestId("btn-declarar-epifania");
    expect(btnEpifania).not.toBeDisabled();

    // Abre o modal
    await act(async () => {
      fireEvent.click(btnEpifania);
    });
    expect(screen.getByTestId("modal-epifania")).toBeInTheDocument();

    // Seleciona efeito: 2. A Voz responde com total honestidade a uma pergunta
    const radioPergunta = screen.getByTestId("radio-efeito-responder-pergunta");
    const inputNotas = screen.getByTestId("input-notas-epifania");
    const btnConfirmar = screen.getByTestId("btn-confirmar-epifania");

    await act(async () => {
      fireEvent.click(radioPergunta);
      fireEvent.change(inputNotas, {
        target: { value: "Quem trancou a porta do abrigo?" },
      });
      fireEvent.click(btnConfirmar);
    });

    expect(handleDeclare).toHaveBeenCalledWith({
      chosenEffect: "answer_question",
      notes: "Quem trancou a porta do abrigo?",
    });
  });
});
