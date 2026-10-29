import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MissingVoicePanel } from "../MissingVoicePanel";
import type { MissingScene, MissingClue, MissingHabitant } from "@/lib/systems/missing/types";

const mockScene: MissingScene = {
  id: "scene-1",
  campaignId: "campaign-1",
  title: "Setor 4 — A Usina Submersa",
  isActive: true,
  threats: [
    {
      id: "threat-1",
      name: "Radiação Vazando",
      dangerLevel: 2,
    },
    {
      id: "threat-2",
      name: "Sombra Estilhaçada",
      dangerLevel: 1,
    },
  ],
};

const mockClues: MissingClue[] = [
  {
    id: "clue-1",
    campaignId: "campaign-1",
    title: "Diário do Engenheiro",
    description: "Páginas arrancadas com cálculos de pressão.",
    isFalseClue: false,
    deliveredToHabitantId: null,
    createdAt: "2026-10-27T10:00:00Z",
  },
  {
    id: "clue-2",
    campaignId: "campaign-1",
    title: "Relatório Falsificado",
    description: "Dizendo que os níveis de contaminação estavam normais.",
    isFalseClue: true,
    deliveredToHabitantId: null,
    createdAt: "2026-10-27T10:05:00Z",
  },
];

const mockHabitants: MissingHabitant[] = [
  {
    id: "habitant-1",
    campaignId: "campaign-1",
    ownerId: "user-1",
    name: "Thomas Miller",
    status: "active",
    lines: [
      { id: "l1", index: 1, text: "L1", isErased: false },
      { id: "l2", index: 2, text: "L2", isErased: false },
      { id: "l3", index: 3, text: "L3", isErased: true },
    ],
    equipments: [
      { id: "e1", slot: 1, name: "Lanterna", status: "active" },
      { id: "e2", slot: 2, name: "Corda", status: "active" },
      { id: "e3", slot: 3, name: "Rádio", status: "lost" },
    ],
    createdAt: "2026-10-27T10:00:00Z",
    updatedAt: "2026-10-27T10:00:00Z",
  },
];

describe("MissingVoicePanel Component", () => {
  it("renderiza o perigo da cena e bloqueia adição quando a soma total atinge 3", () => {
    render(
      <MissingVoicePanel
        campaignId="campaign-1"
        activeScene={mockScene}
        clues={mockClues}
        habitants={mockHabitants}
      />,
    );

    // Perigo total: Radiação (2) + Sombra (1) = 3
    const contador = screen.getByTestId("contador-perigo-cena");
    expect(contador).toHaveTextContent("Perigo Total da Cena: 3 / 3");

    // Botão Adicionar Ameaça deve estar desabilitado quando total == 3
    const btnAddAmeaca = screen.getByTestId("btn-adicionar-ameaca");
    expect(btnAddAmeaca).toBeDisabled();
  });

  it("permite reduzir o perigo de uma ameaça em 1", async () => {
    const handleUpdateScene = vi.fn();

    render(
      <MissingVoicePanel
        campaignId="campaign-1"
        activeScene={mockScene}
        clues={mockClues}
        habitants={mockHabitants}
        onUpdateScene={handleUpdateScene}
      />,
    );

    // Clica para reduzir o perigo da ameaça 1 (de 2 para 1)
    const btnReduzir = screen.getByTestId("btn-reduzir-perigo-threat-1");
    await act(async () => {
      fireEvent.click(btnReduzir);
    });

    expect(handleUpdateScene).toHaveBeenCalledWith(
      expect.objectContaining({
        threats: expect.arrayContaining([
          expect.objectContaining({
            id: "threat-1",
            dangerLevel: 1,
          }),
        ]),
      }),
    );
  });

  it("permite criar nova pista com suporte a pista falsa privada da Voz", async () => {
    const handleCreateClue = vi.fn();

    render(
      <MissingVoicePanel
        campaignId="campaign-1"
        activeScene={mockScene}
        clues={mockClues}
        habitants={mockHabitants}
        onCreateClue={handleCreateClue}
      />,
    );

    const inputTitulo = screen.getByTestId("input-titulo-pista");
    const textareaDesc = screen.getByTestId("textarea-descricao-pista");
    const checkboxFalsa = screen.getByTestId("checkbox-pista-falsa");
    const btnCriar = screen.getByTestId("btn-criar-pista");

    act(() => {
      fireEvent.change(inputTitulo, { target: { value: "Gravação Forjada" } });
      fireEvent.change(textareaDesc, {
        target: { value: "Áudio com vozes simuladas de socorro." },
      });
      fireEvent.click(checkboxFalsa);
    });

    expect(checkboxFalsa).toBeChecked();

    await act(async () => {
      fireEvent.click(btnCriar);
    });

    expect(handleCreateClue).toHaveBeenCalledWith({
      title: "Gravação Forjada",
      description: "Áudio com vozes simuladas de socorro.",
      isFalseClue: true,
      deliveredToHabitantId: null,
    });
  });

  it("renderiza badge de [Pista Falsa] para a Voz e permite entregar pista a um habitante", async () => {
    const handleDeliver = vi.fn();

    render(
      <MissingVoicePanel
        campaignId="campaign-1"
        activeScene={mockScene}
        clues={mockClues}
        habitants={mockHabitants}
        onDeliverClue={handleDeliver}
      />,
    );

    // Badge [Pista Falsa] deve existir na pista 2
    expect(screen.getByTestId("badge-pista-falsa-clue-2")).toBeInTheDocument();
    expect(screen.getByTestId("badge-pista-falsa-clue-2")).toHaveTextContent("[Pista Falsa]");

    // Seleciona habitante 1 no dropdown da pista 1
    const select = screen.getByTestId("select-entrega-clue-1");
    const btnEntregar = screen.getByTestId("btn-entregar-pista-clue-1");
    await act(async () => {
      fireEvent.change(select, { target: { value: "habitant-1" } });
      fireEvent.click(btnEntregar);
    });

    expect(handleDeliver).toHaveBeenCalledWith("clue-1", "habitant-1");
  });

  it("renderiza o monitor de habitantes com status e contadores de linhas e equipamentos", () => {
    render(
      <MissingVoicePanel
        campaignId="campaign-1"
        activeScene={mockScene}
        clues={mockClues}
        habitants={mockHabitants}
      />,
    );

    const monitorCard = screen.getByTestId("monitor-habitant-habitant-1");
    expect(monitorCard).toBeInTheDocument();
    expect(monitorCard).toHaveTextContent("Thomas Miller");

    // Linhas: 2 ativas de 3
    expect(screen.getByTestId("linhas-restantes-habitant-1")).toHaveTextContent("2/3");

    // Equipamentos: 2 ativos de 3
    expect(screen.getByTestId("equipamentos-ativos-habitant-1")).toHaveTextContent("2/3");
  });
});
