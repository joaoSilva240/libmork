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
      perks: [],
      caps: 250,
    },
    "user-1",
    "char-cooper",
  );

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza retrato, nome, PV/Radiação, AP da Equipe e os 7 atributos na aba STAT", () => {
    render(<PipBoySheet character={sampleCharacter} />);

    expect(screen.getByTestId("pipboy-sheet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cooper Howard" })).toBeInTheDocument();
    expect(screen.getByTestId("pipboy-portrait")).toBeInTheDocument();
    expect(screen.getByTestId("fallout-ap-tracker")).toBeInTheDocument();
    expect(screen.getByText(/AP EQUIPE:/i)).toBeInTheDocument();

    // Os 7 atributos S.P.E.C.I.A.L. agora ficam na aba STAT
    expect(screen.getByText("Força")).toBeInTheDocument();
    expect(screen.getByText("Percepção")).toBeInTheDocument();
    expect(screen.getByText("Agilidade")).toBeInTheDocument();

    // A tag "RobCo Pip-Boy 3000 Mk IV" foi removida do cabeçalho
    expect(screen.queryByText("RobCo Pip-Boy 3000 Mk IV")).not.toBeInTheDocument();

    // O paperdoll não fica na aba STAT
    expect(screen.queryByTestId("pipboy-paperdoll")).not.toBeInTheDocument();
  });

  it("move o Monitor de Membros & Armadura para a aba INV com os 6 membros", () => {
    render(<PipBoySheet character={sampleCharacter} />);

    fireEvent.click(screen.getByRole("tab", { name: "INV" }));

    expect(screen.getByTestId("pipboy-paperdoll")).toBeInTheDocument();
    expect(screen.getByText("Monitor de Membros & Armadura")).toBeInTheDocument();
    expect(screen.getByText("Cabeça")).toBeInTheDocument();
    expect(screen.getByText("Tronco")).toBeInTheDocument();
    expect(screen.getByText("Braço Esquerdo")).toBeInTheDocument();
    expect(screen.getByText("Braço Direito")).toBeInTheDocument();
    expect(screen.getByText("Perna Esquerda")).toBeInTheDocument();
    expect(screen.getByText("Perna Direita")).toBeInTheDocument();
  });

  it("alterna entre STAT, S.P.E.C.I.A.L., INV e DATA (perícias só em SPECIAL)", () => {
    render(<PipBoySheet character={sampleCharacter} />);

    fireEvent.click(screen.getByRole("tab", { name: "S.P.E.C.I.A.L." }));
    expect(screen.getByText("Armas Leves")).toBeInTheDocument();
    expect(screen.getByText("Ciência")).toBeInTheDocument();
    // Os atributos não ficam mais na aba SPECIAL
    expect(screen.queryByText("Força")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    expect(screen.getByText(/Capacidade de Carga Máxima/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "DATA" }));
    expect(screen.getByText(/350 XP/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "STAT" }));
    expect(screen.getByTestId("fallout-ap-tracker")).toBeInTheDocument();
    expect(screen.getByText("Força")).toBeInTheDocument();

    // A aba CORPO foi removida
    expect(screen.queryByRole("tab", { name: "CORPO" })).not.toBeInTheDocument();
  });

  it("remove os steppers +/- de PV e Radiação, mantém AP e sintetiza as stats em linha", () => {
    render(<PipBoySheet character={sampleCharacter} onUpdateCharacter={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Aumentar PV" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reduzir PV" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aumentar Radiação" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reduzir Radiação" })).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Adicionar 1 AP" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gastar 1 AP" })).toBeInTheDocument();

    expect(screen.getByText("Defesa")).toBeInTheDocument();
    expect(screen.getByText("Iniciativa")).toBeInTheDocument();
    expect(screen.getByText("Caps")).toBeInTheDocument();
  });

  it("remove os steppers +/- de rank das perícias na aba S.P.E.C.I.A.L.", () => {
    render(<PipBoySheet character={sampleCharacter} onUpdateCharacter={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: "S.P.E.C.I.A.L." }));

    expect(screen.getAllByRole("button", { name: "Rolar" })).toHaveLength(17);
    expect(screen.getAllByRole("button", { name: "★" })).toHaveLength(17);
    // 17★ + 17 Rolar + 1 FAB = 35 botões (nenhum stepper de rank restante)
    expect(screen.getAllByRole("button")).toHaveLength(35);
  });

  it("abre o modal de rolagem 2d20 / DC pelo botão flutuante e executa rolagem", () => {
    render(<PipBoySheet character={sampleCharacter} />);

    const fab = screen.getByTestId("pipboy-roll-fab");
    expect(fab).toHaveAttribute("aria-label", "Rolar 2d20 / DC");

    fireEvent.click(screen.getByRole("button", { name: /Rolar 2d20 \/ DC/i }));
    // Cabeçalho com título removido; o dialog mantém o nome acessível.
    expect(screen.queryByText("Terminal de Rolagem Pip-Boy 2d20")).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Terminal de Rolagem Pip-Boy 2d20" }),
    ).toBeInTheDocument();

    // Dificuldade, Dados Extras e Complicação agora são sliders temáticos.
    expect(screen.getAllByRole("slider")).toHaveLength(3);
    expect(screen.getByRole("slider", { name: "Dificuldade" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Complicação" })).toBeInTheDocument();

    const extraSlider = screen.getByRole("slider", { name: "Dados Extras" });
    fireEvent.change(extraSlider, { target: { value: "3" } });

    const rollBtn = screen.getByRole("button", { name: /Executar Teste \(5d20\)/i });
    fireEvent.click(rollBtn);

    expect(screen.getByTestId("fallout-2d20-result")).toBeInTheDocument();
  });

  it("abre o modal com a perícia e atributo correspondente selecionados ao clicar em Rolar de uma perícia específica", () => {
    render(<PipBoySheet character={sampleCharacter} />);

    fireEvent.click(screen.getByRole("tab", { name: "S.P.E.C.I.A.L." }));

    // Clica em Rolar para Ciência (science -> default attribute int)
    const rollScienceBtn = screen.getByTestId("btn-roll-skill-science");
    fireEvent.click(rollScienceBtn);

    expect(
      screen.getByRole("dialog", { name: "Terminal de Rolagem Pip-Boy 2d20" }),
    ).toBeInTheDocument();

    const skillSelect = screen.getByRole("combobox", { name: "Perícia" });
    const attrSelect = screen.getByRole("combobox", { name: "Atributo S.P.E.C.I.A.L." });

    expect(skillSelect).toHaveValue("science");
    expect(attrSelect).toHaveValue("int");

    // Fecha o modal pelo botão fechar
    fireEvent.click(screen.getByRole("button", { name: "Fechar rolador" }));

    // Clica em Rolar para Sobrevivência (survival -> default attribute end)
    const rollSurvivalBtn = screen.getByTestId("btn-roll-skill-survival");
    fireEvent.click(rollSurvivalBtn);

    expect(screen.getByRole("combobox", { name: "Perícia" })).toHaveValue("survival");
    expect(screen.getByRole("combobox", { name: "Atributo S.P.E.C.I.A.L." })).toHaveValue("end");

    // Permite trocar o atributo manualmente dentro do modal para uma rolagem mista (ex: Sobrevivência + Percepção)
    fireEvent.change(screen.getByRole("combobox", { name: "Atributo S.P.E.C.I.A.L." }), {
      target: { value: "per" },
    });
    expect(screen.getByRole("combobox", { name: "Atributo S.P.E.C.I.A.L." })).toHaveValue("per");
  });
});
