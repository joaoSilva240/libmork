import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { MissingHabitantSheet } from "../MissingHabitantSheet";
import type { MissingHabitant } from "@/lib/systems/missing/types";

const mockActiveHabitant: MissingHabitant = {
  id: "habitant-1",
  campaignId: "campaign-100",
  ownerId: "user-1",
  name: "Thomas Miller",
  status: "active",
  lines: [
    {
      id: "line-1",
      index: 1,
      text: "Trabalhou na usina nuclear de Carlton por dez anos.",
      isErased: false,
    },
    {
      id: "line-2",
      index: 2,
      text: "Tem medo incontrolável de ruídos metálicos repentinos.",
      isErased: true,
      erasedAt: "1987-10-14",
      erasedReason: "Testemunhou o incidente no setor 4",
    },
    {
      id: "line-3",
      index: 3,
      text: "Guarda a fotografia desbotada da irmã sumida.",
      isErased: false,
    },
  ],
  equipments: [
    {
      id: "eq-1",
      slot: 1,
      name: "Lanterna Antiga",
      notes: "Pisca quando algo se aproxima",
      status: "active",
    },
    {
      id: "eq-2",
      slot: 2,
      name: "Canivete Militar",
      notes: "Encontrado revirando memórias",
      status: "lost",
      lostReason: "Quebrou forçando uma porta emperrada",
    },
    {
      id: "eq-3",
      slot: 3,
      name: "",
      status: "active",
    },
  ],
  createdAt: "2026-10-27T10:00:00Z",
  updatedAt: "2026-10-27T10:00:00Z",
};

describe("MissingHabitantSheet Component (Analog Horror UI)", () => {
  it("renderiza o nome do habitante e linhas do registro", () => {
    render(<MissingHabitantSheet habitant={mockActiveHabitant} />);

    expect(screen.getByText("Thomas Miller")).toBeInTheDocument();
    expect(
      screen.getByText("Trabalhou na usina nuclear de Carlton por dez anos."),
    ).toBeInTheDocument();
    expect(screen.getByText("Guarda a fotografia desbotada da irmã sumida.")).toBeInTheDocument();
  });

  it("renderiza estilo de tarja preta nas linhas rasuradas", () => {
    render(<MissingHabitantSheet habitant={mockActiveHabitant} />);

    const erasedSpan = screen.getByTestId("erased-line-2");
    expect(erasedSpan).toBeInTheDocument();
    expect(erasedSpan).toHaveClass("bg-black");
    expect(erasedSpan).toHaveClass("line-through");

    // A linha rasurada não deve exibir o botão de rasurar
    expect(screen.queryByTestId("btn-rasurar-2")).not.toBeInTheDocument();

    // Linha ativa deve possuir botão de rasurar
    expect(screen.getByTestId("btn-rasurar-1")).toBeInTheDocument();
  });

  it("renderiza os 3 post-its com status ativo e lost com seus carimbos", () => {
    render(<MissingHabitantSheet habitant={mockActiveHabitant} />);

    // Slot 1: ativo
    expect(screen.getByText("Lanterna Antiga")).toBeInTheDocument();
    expect(screen.queryByTestId("stamp-lost-1")).not.toBeInTheDocument();

    // Slot 2: perdido / inutilizado
    expect(screen.getByText("Canivete Militar")).toBeInTheDocument();
    const stampLost = screen.getByTestId("stamp-lost-2");
    expect(stampLost).toBeInTheDocument();
    expect(stampLost).toHaveTextContent("INUTILIZADO / PERDIDO");

    // Slot 3: vazio com botão de rolar 2d6
    expect(screen.getByTestId("btn-rolar-equipamento-3")).toBeInTheDocument();
  });

  it("exibe o carimbo dramático de desaparecimento quando todas as linhas forem rasuradas", () => {
    const disappearedHabitant: MissingHabitant = {
      ...mockActiveHabitant,
      status: "missing",
      lines: [
        {
          id: "line-1",
          index: 1,
          text: "Linha 1 esquecida",
          isErased: true,
        },
        {
          id: "line-2",
          index: 2,
          text: "Linha 2 esquecida",
          isErased: true,
        },
      ],
    };

    render(<MissingHabitantSheet habitant={disappearedHabitant} />);

    const stamp = screen.getByTestId("habitant-disappeared-stamp");
    expect(stamp).toBeInTheDocument();
    expect(stamp).toHaveTextContent("HABITANTE DESAPARECIDO");
  });

  it("chama onEraseLine ao confirmar a rasura de uma linha ativa", async () => {
    const handleErase = vi.fn();
    render(<MissingHabitantSheet habitant={mockActiveHabitant} onEraseLine={handleErase} />);

    // Clica no botão de rasurar da linha 1
    const btnRasurar = screen.getByTestId("btn-rasurar-1");
    await act(async () => {
      fireEvent.click(btnRasurar);
    });

    // Digita o motivo e confirma
    const inputMotivo = screen.getByPlaceholderText("Motivo da rasura...");
    const btnConfirmar = screen.getByTestId("btn-confirmar-rasura-1");
    await act(async () => {
      fireEvent.change(inputMotivo, { target: { value: "Perda de sanidade na neblina" } });
      fireEvent.click(btnConfirmar);
    });

    expect(handleErase).toHaveBeenCalledWith("line-1", "Perda de sanidade na neblina");
  });

  it("permite adicionar nova linha ao registro respeitando o limite", async () => {
    const handleAdd = vi.fn();
    render(<MissingHabitantSheet habitant={mockActiveHabitant} onAddLine={handleAdd} />);

    const btnAdd = screen.getByTestId("btn-adicionar-linha");
    await act(async () => {
      fireEvent.click(btnAdd);
    });

    const inputNovaLinha = screen.getByPlaceholderText("Escreva uma nova linha do registro...");
    const btnSalvar = screen.getByTestId("btn-confirmar-add-linha");

    await act(async () => {
      fireEvent.change(inputNovaLinha, {
        target: { value: "Encontrou um dente humano dentro da gaveta trancada." },
      });
      fireEvent.click(btnSalvar);
    });

    expect(handleAdd).toHaveBeenCalledWith("Encontrou um dente humano dentro da gaveta trancada.");
  });

  it("abre o modal de rolagem ao clicar em 'Realizar Teste'", () => {
    render(<MissingHabitantSheet habitant={mockActiveHabitant} />);

    expect(screen.queryByTestId("missing-dice-roller-modal")).not.toBeInTheDocument();

    const btnRealizarTeste = screen.getByTestId("btn-realizar-teste");
    expect(btnRealizarTeste).toBeInTheDocument();
    fireEvent.click(btnRealizarTeste);

    expect(screen.getByTestId("missing-dice-roller-modal")).toBeInTheDocument();
  });

  it("alterna entre as abas 'Ficha' e 'Inventário' via menu inferior", () => {
    render(<MissingHabitantSheet habitant={mockActiveHabitant} />);

    const tabFicha = screen.getByTestId("tab-ficha");
    const tabInventario = screen.getByTestId("tab-inventario");
    expect(tabFicha).toBeInTheDocument();
    expect(tabInventario).toBeInTheDocument();

    const secaoFicha = screen.getByRole("region", { name: "Folha de Memórias do Habitante" });
    const secaoInventario = screen.getByRole("region", { name: "Inventário de Equipamentos" });

    // Inicialmente na aba "Ficha"
    expect(secaoFicha).toHaveClass("block");
    expect(secaoInventario).toHaveClass("hidden");

    // Clica na aba "Inventário"
    fireEvent.click(tabInventario);
    expect(secaoFicha).toHaveClass("hidden");
    expect(secaoInventario).toHaveClass("block");

    // Volta para a aba "Ficha"
    fireEvent.click(tabFicha);
    expect(secaoFicha).toHaveClass("block");
    expect(secaoInventario).toHaveClass("hidden");
  });

  it("inicia na aba 'Inventário' se initialTab='inventory' for passado", () => {
    render(<MissingHabitantSheet habitant={mockActiveHabitant} initialTab="inventory" />);

    const secaoFicha = screen.getByRole("region", { name: "Folha de Memórias do Habitante" });
    const secaoInventario = screen.getByRole("region", { name: "Inventário de Equipamentos" });

    expect(secaoFicha).toHaveClass("hidden");
    expect(secaoInventario).toHaveClass("block");
  });

  it("chama onClose quando o botão fechar for clicado", () => {
    const handleClose = vi.fn();
    render(<MissingHabitantSheet habitant={mockActiveHabitant} onClose={handleClose} />);

    const btnFechar = screen.getByRole("button", { name: "Fechar ficha" });
    expect(btnFechar).toBeInTheDocument();

    fireEvent.click(btnFechar);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
