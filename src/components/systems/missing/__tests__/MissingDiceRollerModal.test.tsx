import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MissingDiceRollerModal } from "../MissingDiceRollerModal";
import type { MissingHabitant, MissingThreat } from "@/lib/systems/missing/types";

const mockHabitant: MissingHabitant = {
  id: "habitant-42",
  campaignId: "campaign-1",
  ownerId: "user-1",
  name: "Arthur Pendelton",
  status: "active",
  lines: [
    {
      id: "line-1",
      index: 1,
      text: "Conhece todas as rotas de fuga da doca velha.",
      isErased: false,
    },
    {
      id: "line-2",
      index: 2,
      text: "Lembra-se da senha do gerador de emergência.",
      isErased: false,
    },
    {
      id: "line-3",
      index: 3,
      text: "Linha esquecida",
      isErased: true,
    },
  ],
  equipments: [
    {
      id: "eq-1",
      slot: 1,
      name: "Pé de Cabra",
      status: "active",
    },
    {
      id: "eq-2",
      slot: 2,
      name: "Rádio Amador",
      status: "lost",
    },
    {
      id: "eq-3",
      slot: 3,
      name: "Chave Inglesa",
      status: "active",
    },
  ],
  createdAt: "2026-10-27T10:00:00Z",
  updatedAt: "2026-10-27T10:00:00Z",
};

const mockThreats: MissingThreat[] = [
  {
    id: "threat-1",
    name: "Cão Hidrófobo da Neblina",
    dangerLevel: 2,
  },
];

describe("MissingDiceRollerModal Component", () => {
  it("permite alternar entre teste comum, provável e improvável", () => {
    render(<MissingDiceRollerModal isOpen={true} onClose={vi.fn()} habitant={mockHabitant} />);

    const btnComum = screen.getByTestId("btn-teste-comum");
    const btnProvavel = screen.getByTestId("btn-teste-provavel");
    const btnImprovavel = screen.getByTestId("btn-teste-improvavel");

    expect(btnComum).toBeInTheDocument();
    expect(btnProvavel).toBeInTheDocument();
    expect(btnImprovavel).toBeInTheDocument();

    // Alterna para Provável
    fireEvent.click(btnProvavel);
    expect(screen.getByTestId("btn-citar-frase")).toBeInTheDocument();

    // Alterna para Improvável
    fireEvent.click(btnImprovavel);
    expect(screen.queryByTestId("btn-citar-frase")).not.toBeInTheDocument();
  });

  it("permite citar frase do registro no teste provável para justificar familiaridade", () => {
    render(<MissingDiceRollerModal isOpen={true} onClose={vi.fn()} habitant={mockHabitant} />);

    // Seleciona teste provável
    fireEvent.click(screen.getByTestId("btn-teste-provavel"));

    // Clica para abrir lista de frases
    const btnCitar = screen.getByTestId("btn-citar-frase");
    fireEvent.click(btnCitar);

    // Clica na opção da frase 1
    const opcaoFrase1 = screen.getByTestId("opcao-frase-1");
    fireEvent.click(opcaoFrase1);

    const citacao = screen.getByTestId("citacao-selecionada");
    expect(citacao).toHaveTextContent("Conhece todas as rotas de fuga da doca velha.");
  });

  it("exibe alerta crítico sobre perda permanente de equipamento ao forçar teste", () => {
    render(<MissingDiceRollerModal isOpen={true} onClose={vi.fn()} habitant={mockHabitant} />);

    const checkboxForcar = screen.getByTestId("checkbox-forcar-teste");
    expect(checkboxForcar).not.toBeChecked();

    // Ativa forçar teste
    fireEvent.click(checkboxForcar);
    expect(checkboxForcar).toBeChecked();

    const alerta = screen.getByTestId("alerta-forcar-teste");
    expect(alerta).toBeInTheDocument();
    expect(alerta).toHaveTextContent(
      "Se o resultado for Perda, este equipamento será permanentemente inutilizado.",
    );

    // O dropdown de seleção de equipamento só deve listar os itens com status 'active'
    const select = screen.getByTestId("select-equipamento-forcado");
    expect(select).toHaveTextContent("Pé de Cabra");
    expect(select).toHaveTextContent("Chave Inglesa");
    expect(select).not.toHaveTextContent("Rádio Amador"); // status: lost
  });

  it("executa rolagem local e exibe dados e indicador de GANHO ou PERDA", async () => {
    const handleComplete = vi.fn();

    render(
      <MissingDiceRollerModal
        isOpen={true}
        onClose={vi.fn()}
        habitant={mockHabitant}
        activeThreats={mockThreats}
        onRollComplete={handleComplete}
      />,
    );

    const btnRolar = screen.getByTestId("btn-confirmar-rolagem");
    fireEvent.click(btnRolar);

    // Painel de resultado deve ser montado
    const painelResultado = await screen.findByTestId("painel-resultado-rolagem");
    expect(painelResultado).toBeInTheDocument();

    // Pelo menos um selo de Ganho ou Perda deve estar presente
    const seloGanho = screen.queryByTestId("selo-resultado-ganho");
    const seloPerda = screen.queryByTestId("selo-resultado-perda");

    expect(Boolean(seloGanho || seloPerda)).toBe(true);

    // Se resultou em perda, deve exibir o aviso com cálculo de rasuras de ameaça
    if (seloPerda) {
      const aviso = screen.getByTestId("aviso-perda-rasuras");
      expect(aviso).toHaveTextContent(
        "Ação gerou Perda: Rasurar 1 linha (+ 2 das ameaças ativas da cena).",
      );
    }

    expect(handleComplete).toHaveBeenCalled();
  });
});
