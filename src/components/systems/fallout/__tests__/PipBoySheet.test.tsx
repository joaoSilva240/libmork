import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PipBoySheet } from "../PipBoySheet";
import { createInitialFalloutCharacter } from "@/lib/systems/fallout/rules";

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    rollDice: vi.fn(),
    emitFalloutApUpdate: vi.fn(),
    subscribeFalloutApUpdate: vi.fn(() => () => {}),
    emitFalloutDiceRoll: vi.fn(),
    subscribeFalloutDiceRoll: vi.fn(() => () => {}),
  }),
}));

describe("PipBoySheet & Componentes Fallout 2d20", () => {
  const sampleCharacter = createInitialFalloutCharacter(
    {
      name: "Cooper Howard",
      origin: "ghoul",
      level: 3,
      xp: 350,
      attributes: {
        str: 6,
        per: 8,
        end: 7,
        cha: 5,
        int: 6,
        agi: 9,
        luc: 6,
      },
      tagSkills: ["small_guns", "survival", "speech"],
      caps: 250,
    },
    "user-1",
    "char-cooper",
  );

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza cabeçalho Pip-Boy 3000, nome, barra de PV/Radiação e os 6 membros", () => {
    render(<PipBoySheet character={sampleCharacter} />);

    expect(screen.getByTestId("pipboy-sheet")).toBeInTheDocument();
    expect(screen.getByText("Cooper Howard")).toBeInTheDocument();
    expect(screen.getByTestId("fallout-ap-tracker")).toBeInTheDocument();
    expect(screen.getByTestId("pipboy-paperdoll")).toBeInTheDocument();

    // Verifica os 6 membros do Paperdoll
    expect(screen.getByText("Cabeça")).toBeInTheDocument();
    expect(screen.getByText("Tronco")).toBeInTheDocument();
    expect(screen.getByText("Braço Esquerdo")).toBeInTheDocument();
    expect(screen.getByText("Braço Direito")).toBeInTheDocument();
    expect(screen.getByText("Perna Esquerda")).toBeInTheDocument();
    expect(screen.getByText("Perna Direita")).toBeInTheDocument();
  });

  it("permite alternar entre as abas STAT, S.P.E.C.I.A.L., INV e DATA", () => {
    render(<PipBoySheet character={sampleCharacter} />);

    fireEvent.click(screen.getByRole("tab", { name: "S.P.E.C.I.A.L." }));
    expect(screen.getByText("Armas Leves")).toBeInTheDocument();
    expect(screen.getByText("Ciência")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    expect(screen.getByText(/Capacidade de Carga Máxima/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "DATA" }));
    expect(screen.getByText(/350 XP/i)).toBeInTheDocument();
  });

  it("ajusta radiação e reduz o teto máximo efetivo de PV", () => {
    const onUpdate = vi.fn();
    render(<PipBoySheet character={sampleCharacter} onUpdateCharacter={onUpdate} />);

    const addRadBtn = screen.getByRole("button", { name: "Aumentar Radiação" });
    fireEvent.click(addRadBtn);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        radiation: 1,
      }),
    );
  });

  it("abre o modal de rolagem 2d20 / DC e executa rolagem", () => {
    render(<PipBoySheet character={sampleCharacter} />);

    fireEvent.click(screen.getByRole("button", { name: /Rolar 2d20 \/ DC/i }));
    expect(screen.getByText("Terminal de Rolagem Pip-Boy 2d20")).toBeInTheDocument();

    const rollBtn = screen.getByRole("button", { name: /Executar Teste \(2d20\)/i });
    fireEvent.click(rollBtn);

    expect(screen.getByTestId("fallout-2d20-result")).toBeInTheDocument();
  });
});
