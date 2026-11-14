import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

describe("PipBoySheet — aba DATA (perks)", () => {
  const gunNut = {
    name: "Gun Nut",
    rank: 2,
    maxRank: 4,
    description: "Permite criar mods de armas.",
    requirements: "INT 6, Nível 2",
    imageUrl: null,
    sourceKey: "perk-gun-nut",
  };

  function buildCharacter(perks: Array<string | typeof gunNut> = [gunNut, "Action Boy"]) {
    return createInitialFalloutCharacter(
      {
        name: "Cooper Howard",
        origin: "ghoul",
        level: 3,
        xp: 350,
        attributes: { str: 6, per: 8, end: 7, cha: 5, int: 6, agi: 9, luc: 6 },
        tagSkills: ["small_guns"],
        perks,
        caps: 250,
      },
      "user-1",
      "char-cooper",
    );
  }

  function openDataTab(character = buildCharacter(), onUpdateCharacter = vi.fn()) {
    render(<PipBoySheet character={character} onUpdateCharacter={onUpdateCharacter} />);
    fireEvent.click(screen.getByRole("tab", { name: "DATA" }));
    return onUpdateCharacter;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lista perks estruturados e legados com rank e expande os detalhes em accordion", () => {
    openDataTab();

    const gunNutItem = screen.getByTestId("perk-item-Gun Nut");
    expect(within(gunNutItem).getByText("Rank 2 / 4")).toBeInTheDocument();
    // Perk legado em string continua aparecendo, com rank 1 e sem teto.
    expect(within(screen.getByTestId("perk-item-Action Boy")).getByText("Rank 1")).toBeInTheDocument();

    const toggle = within(gunNutItem).getByRole("button", { name: /Gun Nut/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("perk-details-Gun Nut")).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const details = screen.getByTestId("perk-details-Gun Nut");
    expect(within(details).getByText("Permite criar mods de armas.")).toBeInTheDocument();
    expect(within(details).getByText("INT 6, Nível 2")).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByTestId("perk-details-Gun Nut")).toBeNull();
  });

  it("ajusta o rank em jogo respeitando maxRank", () => {
    const onUpdate = openDataTab();
    const item = screen.getByTestId("perk-item-Gun Nut");
    fireEvent.click(within(item).getByRole("button", { name: /Gun Nut/ }));

    fireEvent.click(within(item).getByRole("button", { name: "Aumentar rank de Gun Nut" }));
    expect(onUpdate).toHaveBeenCalledWith({
      perks: [{ ...gunNut, rank: 3 }, "Action Boy"],
    });

    fireEvent.click(within(item).getByRole("button", { name: "Diminuir rank de Gun Nut" }));
    expect(onUpdate).toHaveBeenLastCalledWith({
      perks: [{ ...gunNut, rank: 1 }, "Action Boy"],
    });
  });

  it("ajusta o rank de um perk legado em string sem perder o nome", () => {
    const onUpdate = openDataTab();
    const item = screen.getByTestId("perk-item-Action Boy");
    fireEvent.click(within(item).getByRole("button", { name: /Action Boy/ }));

    fireEvent.click(within(item).getByRole("button", { name: "Aumentar rank de Action Boy" }));

    expect(onUpdate).toHaveBeenCalledWith({
      perks: [gunNut, { name: "Action Boy", rank: 2 }],
    });
  });

  it("desabilita o aumento no maxRank e a redução no rank 1", () => {
    const character = buildCharacter([{ ...gunNut, rank: 4 }]);
    openDataTab(character);
    const item = screen.getByTestId("perk-item-Gun Nut");
    fireEvent.click(within(item).getByRole("button", { name: /Gun Nut/ }));

    expect(within(item).getByRole("button", { name: "Aumentar rank de Gun Nut" })).toBeDisabled();
    expect(within(item).getByRole("button", { name: "Diminuir rank de Gun Nut" })).toBeEnabled();
  });

  it("remove o perk da ficha", () => {
    const onUpdate = openDataTab();
    const item = screen.getByTestId("perk-item-Gun Nut");
    fireEvent.click(within(item).getByRole("button", { name: /Gun Nut/ }));

    fireEvent.click(within(item).getByRole("button", { name: "Remover Gun Nut" }));

    expect(onUpdate).toHaveBeenCalledWith({ perks: ["Action Boy"] });
  });

  it("abre o seletor da Biblioteca Global e adiciona o perk escolhido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "perk-fortune-finder",
              name: "Fortune Finder",
              circle: 3,
              useType: "perk",
              description: "Encontra mais tampas de Nuka-Cola.",
              imageUrl: null,
              structuredEffects: {
                requirements: null,
                requirementsEx: {
                  attributes: {
                    str: { value: 0 },
                    per: { value: 0 },
                    end: { value: 0 },
                    cha: { value: 0 },
                    int: { value: 0 },
                    agi: { value: 0 },
                    luc: { value: 5 },
                  },
                  level: 2,
                },
              },
            },
          ],
        }),
      })),
    );
    const onUpdate = openDataTab();

    fireEvent.click(screen.getByRole("button", { name: /Adicionar perk/i }));
    expect(
      await screen.findByRole("dialog", { name: "Seletor de Perks Pip-Boy" }),
    ).toBeInTheDocument();

    const card = await screen.findByTestId("perk-card-perk-fortune-finder");
    fireEvent.click(within(card).getByRole("button", { name: /Adicionar Fortune Finder/i }));

    expect(onUpdate).toHaveBeenCalledWith({
      perks: [
        gunNut,
        "Action Boy",
        {
          name: "Fortune Finder",
          rank: 1,
          maxRank: 3,
          description: "Encontra mais tampas de Nuka-Cola.",
          requirements: "SOR 5, Nível 2",
          imageUrl: null,
          sourceKey: "perk-fortune-finder",
        },
      ],
    });
  });

  it("em somente leitura mantém os detalhes e esconde os controles de edição", () => {
    render(<PipBoySheet character={buildCharacter()} readOnly />);
    fireEvent.click(screen.getByRole("tab", { name: "DATA" }));

    expect(screen.queryByRole("button", { name: /Adicionar perk/i })).toBeNull();
    const item = screen.getByTestId("perk-item-Gun Nut");
    fireEvent.click(within(item).getByRole("button", { name: /Gun Nut/ }));

    expect(screen.getByTestId("perk-details-Gun Nut")).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Aumentar rank de Gun Nut" })).toBeNull();
    expect(within(item).queryByRole("button", { name: "Remover Gun Nut" })).toBeNull();
  });
});

describe("PipBoySheet — aba INV (equipamentos)", () => {
  const pistol = {
    id: "w1",
    name: "10mm Pistol",
    type: "weapon" as const,
    damageDiceRating: 4,
    damageType: "physical" as const,
    damageEffects: ["piercing" as const],
    qualities: ["reliable" as const],
    ammoType: "10mm Round",
    ammoPerShot: 1,
    fireRate: 2,
    range: "close" as const,
    weight: 4,
    costCaps: 50,
    equipped: false,
  };
  const armor = {
    id: "a1",
    name: "Combat Armor",
    type: "apparel" as const,
    apparelType: "armor" as const,
    locationsCovered: ["head", "torso", "armL", "armR", "legL", "legR"] as const,
    resistances: { physical: 2, energy: 2, radiation: 0, poison: 0 },
    weight: 20,
    costCaps: 185,
    equipped: false,
  };

  function buildCharacter(items: unknown[] = [pistol, armor]) {
    return {
      ...createInitialFalloutCharacter(
        {
          name: "Cooper Howard",
          origin: "ghoul",
          level: 3,
          xp: 350,
          attributes: { str: 6, per: 8, end: 7, cha: 5, int: 6, agi: 9, luc: 6 },
          tagSkills: ["small_guns"],
          perks: [],
          caps: 250,
        },
        "user-1",
        "char-cooper",
      ),
      items: items as never[],
    };
  }

  function openInvTab(character = buildCharacter(), onUpdateCharacter = vi.fn()) {
    render(<PipBoySheet character={character} onUpdateCharacter={onUpdateCharacter} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    return onUpdateCharacter;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lista equipamentos com peso/caps e expande as estatísticas em accordion", () => {
    openInvTab();

    const weaponRow = screen.getByTestId("item-row-w1");
    expect(within(weaponRow).getByText(/4 lbs/)).toBeInTheDocument();
    expect(within(weaponRow).getByText(/50 Tampas/)).toBeInTheDocument();

    const toggle = within(weaponRow).getByRole("button", { name: /10mm Pistol/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("item-details-w1")).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const details = screen.getByTestId("item-details-w1");
    expect(within(details).getByText(/4 DC/)).toBeInTheDocument();
    expect(within(details).getByText(/reliable/)).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByTestId("item-details-w1")).toBeNull();
  });

  it("expande a RD e os locais cobertos de uma armadura", () => {
    openInvTab();
    const armorRow = screen.getByTestId("item-row-a1");
    fireEvent.click(within(armorRow).getByRole("button", { name: /Combat Armor/ }));

    const details = screen.getByTestId("item-details-a1");
    expect(within(details).getByText(/Físico 2/)).toBeInTheDocument();
    expect(within(details).getByText(/Energia 2/)).toBeInTheDocument();
  });

  it("remove o item do inventário", () => {
    const onUpdate = openInvTab();
    const row = screen.getByTestId("item-row-w1");
    fireEvent.click(within(row).getByRole("button", { name: /10mm Pistol/ }));

    fireEvent.click(within(row).getByRole("button", { name: "Remover 10mm Pistol" }));

    expect(onUpdate).toHaveBeenCalledWith({ items: [armor] });
  });

  it("abre o seletor da Biblioteca Global e adiciona o item escolhido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "item-nuka",
              name: "Nuka-Cola",
              description: "Refrigerante pré-guerra.",
              qualityDescription: null,
              imageUrl: null,
              sourceKey: "fallout:consumables:nuka_cola",
              sourceData: {
                pack: "consumables",
                consumableType: "beverage",
                hp: 2,
                quantity: 1,
                weight: 1,
                cost: 20,
              },
            },
          ],
        }),
      })),
    );
    const onUpdate = openInvTab();

    fireEvent.click(screen.getByRole("button", { name: /Adicionar item/i }));
    expect(
      await screen.findByRole("dialog", { name: "Seletor de Itens Pip-Boy" }),
    ).toBeInTheDocument();

    const card = await screen.findByTestId("item-card-item-nuka");
    fireEvent.click(within(card).getByRole("button", { name: /Adicionar Nuka-Cola/i }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const patch = onUpdate.mock.calls[0][0] as { items: Array<{ name: string; type: string }> };
    expect(patch.items).toHaveLength(3);
    expect(patch.items[2]).toMatchObject({ name: "Nuka-Cola", type: "consumable", weight: 1, costCaps: 20 });
  });

  it("em somente leitura mantém os detalhes e esconde os controles de edição", () => {
    render(<PipBoySheet character={buildCharacter()} readOnly />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));

    expect(screen.queryByRole("button", { name: /Adicionar item/i })).toBeNull();
    const row = screen.getByTestId("item-row-w1");
    fireEvent.click(within(row).getByRole("button", { name: /10mm Pistol/ }));

    expect(screen.getByTestId("item-details-w1")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Remover 10mm Pistol" })).toBeNull();
  });
});
