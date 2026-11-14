import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PipBoySheet } from "../PipBoySheet";
import { createInitialFalloutCharacter } from "@/lib/systems/fallout/rules";
import type { FalloutCharacter } from "@/lib/systems/fallout/types";

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
    expect(screen.getByText(/Carga:/i)).toBeInTheDocument();

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
        level: 5,
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

  it("associa aria-controls a um id de painel válido (sem espaços) para perk multi-palavra", () => {
    openDataTab();
    const item = screen.getByTestId("perk-item-Gun Nut");
    const toggle = within(item).getByRole("button", { name: /Gun Nut/ });

    fireEvent.click(toggle);

    const controls = toggle.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(controls).not.toMatch(/\s/);
    const panel = document.getElementById(controls as string);
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute("data-testid", "perk-details-Gun Nut");
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

  it("gera id de instância único ao carregar o mesmo item duas vezes e remove só uma cópia", async () => {
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

    function StatefulSheet() {
      const [character, setCharacter] = React.useState<FalloutCharacter>(buildCharacter([]));
      return (
        <PipBoySheet
          character={character}
          onUpdateCharacter={(patch) => setCharacter((c) => ({ ...c, ...patch }))}
        />
      );
    }
    render(<StatefulSheet />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));

    fireEvent.click(screen.getByRole("button", { name: /Adicionar item/i }));
    const card = await screen.findByTestId("item-card-item-nuka");
    fireEvent.click(within(card).getByRole("button", { name: /Adicionar Nuka-Cola/i }));
    fireEvent.click(within(card).getByRole("button", { name: /Adicionar Nuka-Cola/i }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    const toggles = await screen.findAllByRole("button", { name: /Nuka-Cola/ });
    expect(toggles).toHaveLength(2);

    fireEvent.click(toggles[0]);
    const removeButtons = screen.getAllByRole("button", { name: "Remover Nuka-Cola" });
    expect(removeButtons).toHaveLength(1);
    fireEvent.click(removeButtons[0]);

    expect(screen.getAllByRole("button", { name: /Nuka-Cola/ })).toHaveLength(1);
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

describe("PipBoySheet INV — acoes de apparel", () => {
  function buildCharWithApparel(apparelOverrides: any = {}): any {
    const char = createInitialFalloutCharacter(
      {
        name: "Test", origin: "vault_dweller", level: 1, xp: 0,
        attributes: { str: 6, per: 8, end: 7, cha: 5, int: 6, agi: 9, luc: 6 },
        tagSkills: [], perks: [], caps: 0,
      },
      "user-1", "char-test",
    );
    char.items = [{
      id: "app-1", name: "Combat Armor", type: "apparel",
      apparelType: "armor", locationsCovered: ["torso"],
      resistances: { physical: 3, energy: 2, radiation: 1, poison: 0 },
      weight: 10, costCaps: 50, equipped: false, stashed: false, powered: false,
      ...apparelOverrides,
    }];
    return char;
  }

  beforeEach(() => { vi.restoreAllMocks(); });

  it("toggle equipar chama onUpdateCharacter com equipped:true", () => {
    const onUpdate = vi.fn();
    render(<PipBoySheet character={buildCharWithApparel()} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-app-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Equipar/ }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ id: "app-1", equipped: true })],
    }));
  });

  it("toggle guardar chama onUpdateCharacter com stashed:true", () => {
    const onUpdate = vi.fn();
    render(<PipBoySheet character={buildCharWithApparel()} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-app-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ id: "app-1", stashed: true })],
    }));
  });

  it("powerArmor mostra botao Energizar somente quando equipado", () => {
    const onUpdate = vi.fn();
    const char = buildCharWithApparel({ apparelType: "powerArmor", equipped: true });
    render(<PipBoySheet character={char} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-app-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Energizar/ }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ id: "app-1", powered: true })],
    }));
  });
});

describe("PipBoySheet INV — consumir e ammo", () => {
  function buildChar(items: any[] = []): any {
    const char = createInitialFalloutCharacter(
      {
        name: "Test", origin: "vault_dweller", level: 1, xp: 0,
        attributes: { str: 6, per: 8, end: 7, cha: 5, int: 6, agi: 9, luc: 6 },
        tagSkills: [], perks: [], caps: 0,
      },
      "user-1", "char-test",
    );
    char.items = items;
    return char;
  }

  beforeEach(() => { vi.restoreAllMocks(); });

  it("consumir aplica HP e decrementa quantity", () => {
    const onUpdate = vi.fn();
    const char = buildChar([{ id: "c-1", name: "Stimpak", type: "consumable", category: "med", hpRestored: 4, quantity: 2, weight: 0.5, costCaps: 25 }]);
    char.hpCurrent = 5;
    char.hpMax = 10;
    render(<PipBoySheet character={char} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-c-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Consumir/ }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ hpCurrent: 9 }));
  });

  it("consumir ultima unidade pede confirmacao", () => {
    const onUpdate = vi.fn();
    const char = buildChar([{ id: "c-1", name: "Stimpak", type: "consumable", category: "med", hpRestored: 4, quantity: 1, weight: 0.5, costCaps: 25 }]);
    render(<PipBoySheet character={char} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-c-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Consumir/ }));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText(/Última unidade/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar/ }));
    expect(onUpdate).toHaveBeenCalled();
  });

  it("ammo mostra shots no accordion", () => {
    const char = buildChar([{ id: "am-1", name: "10mm", type: "ammo", quantity: 20, weight: 0.1, costCaps: 1, shotsCurrent: 15, shotsMax: 30, stashed: false }]);
    render(<PipBoySheet character={char} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-am-1").querySelector("button")!);
    expect(screen.getByText(/15\/30 cargas/)).toBeTruthy();
  });

  it("readOnly esconde botoes de acao", () => {
    const char = buildChar([{ id: "app-1", name: "Armor", type: "apparel", apparelType: "armor", locationsCovered: ["torso"], resistances: { physical: 3, energy: 0, radiation: 0, poison: 0 }, weight: 10, costCaps: 50, equipped: false, stashed: false, powered: false }]);
    render(<PipBoySheet character={char} readOnly />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-app-1").querySelector("button")!);
    expect(screen.queryByRole("button", { name: /Equipar/ })).toBeNull();
  });
});

describe("PipBoySheet INV — encumbrance display", () => {
  function buildChar(): any {
    const char = createInitialFalloutCharacter(
      {
        name: "Test", origin: "vault_dweller", level: 1, xp: 0,
        attributes: { str: 6, per: 8, end: 7, cha: 5, int: 6, agi: 9, luc: 6 },
        tagSkills: [], perks: [], caps: 0,
      },
      "user-1", "char-test",
    );
    return char;
  }

  beforeEach(() => { vi.restoreAllMocks(); });

  it("mostra peso atual e maximo", () => {
    const char = buildChar();
    char.carryWeightCurrent = 45.5;
    char.carryWeightMax = 200;
    char.encumbranceLevel = 0;
    render(<PipBoySheet character={char} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    expect(screen.getByText(/45\.5\/200 lbs/)).toBeTruthy();
  });

  it("mostra badge de sobrecarga quando encumbranceLevel > 0", () => {
    const char = buildChar();
    char.carryWeightCurrent = 300;
    char.carryWeightMax = 200;
    char.encumbranceLevel = 2;
    render(<PipBoySheet character={char} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    expect(screen.getByText(/Sobrecarga 2/)).toBeTruthy();
  });
});

describe("PipBoySheet INV — acoes de arma", () => {
  function buildCharWithWeapon(overrides: any = {}): any {
    const char = createInitialFalloutCharacter(
      {
        name: "Test", origin: "vault_dweller", level: 1, xp: 0,
        attributes: { str: 6, per: 8, end: 7, cha: 5, int: 6, agi: 9, luc: 6 },
        tagSkills: [], perks: [], caps: 0,
      },
      "user-1", "char-test",
    );
    char.items = [{
      id: "w-1", name: "10mm Pistol", type: "weapon",
      damageDiceRating: 4, damageType: "physical", damageEffects: [], qualities: [],
      ammoType: "10mm", ammoPerShot: 1, fireRate: 2, range: "close",
      weight: 4, costCaps: 50, equipped: false, skill: "small_guns",
      stashed: false, installedMods: [], installedModsData: {},
      ...overrides,
    }];
    return char;
  }

  beforeEach(() => { vi.restoreAllMocks(); });

  it("equipar arma chama onUpdateCharacter com equipped:true", () => {
    const onUpdate = vi.fn();
    render(<PipBoySheet character={buildCharWithWeapon()} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-w-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Equipar/ }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ id: "w-1", equipped: true })],
    }));
  });

  it("equipar segunda arma desequipa a primeira", () => {
    const onUpdate = vi.fn();
    const char = buildCharWithWeapon({ equipped: true });
    char.items.push({ ...char.items[0], id: "w-2", name: "Laser Pistol", equipped: false });
    render(<PipBoySheet character={char} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-w-2").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Equipar/ }));
    const patch = onUpdate.mock.calls[0][0];
    expect(patch.items.find((i: any) => i.id === "w-1").equipped).toBe(false);
    expect(patch.items.find((i: any) => i.id === "w-2").equipped).toBe(true);
  });

  it("botao Atirar visivel somente quando equipada", () => {
    render(<PipBoySheet character={buildCharWithWeapon({ equipped: true })} onUpdateCharacter={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-w-1").querySelector("button")!);
    expect(screen.getByRole("button", { name: /Atirar/ })).toBeTruthy();
  });

  it("botao Atirar ausente quando nao equipada", () => {
    render(<PipBoySheet character={buildCharWithWeapon()} onUpdateCharacter={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-w-1").querySelector("button")!);
    expect(screen.queryByRole("button", { name: /Atirar/ })).toBeNull();
  });
});

describe("PipBoySheet INV — mods", () => {
  function buildCharWithMod(): any {
    const char = createInitialFalloutCharacter(
      {
        name: "Test", origin: "vault_dweller", level: 1, xp: 0,
        attributes: { str: 6, per: 8, end: 7, cha: 5, int: 6, agi: 9, luc: 6 },
        tagSkills: [], perks: [], caps: 0,
      },
      "user-1", "char-test",
    );
    char.items = [
      { id: "w-1", name: "10mm", type: "weapon", damageDiceRating: 4, damageType: "physical", damageEffects: [], qualities: [], ammoType: "10mm", ammoPerShot: 1, fireRate: 2, range: "close", weight: 4, costCaps: 50, equipped: true, skill: "small_guns", stashed: false, installedMods: [], installedModsData: {} },
      { id: "m-1", name: "Long Barrel", type: "mod", quantity: 1, weight: 1, costCaps: 20, stashed: false, modTarget: "weapon", modEffects: { damageBonus: 1 } },
    ];
    return char;
  }

  beforeEach(() => { vi.restoreAllMocks(); });

  it("instalar mod aplica efeito e remove do inventario", () => {
    const onUpdate = vi.fn();
    render(<PipBoySheet character={buildCharWithMod()} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-w-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Instalar Mod" }));
    fireEvent.click(screen.getByRole("button", { name: "Instalar Long Barrel" }));
    const patch = onUpdate.mock.calls[0][0];
    const weapon = patch.items.find((i: any) => i.id === "w-1");
    expect(weapon.damageDiceRating).toBe(5);
    expect(weapon.installedMods).toContain("m-1");
    expect(patch.items.find((i: any) => i.id === "m-1")).toBeUndefined();
  });

  it("remover mod reverte efeito e devolve ao inventario", () => {
    const onUpdate = vi.fn();
    const char = buildCharWithMod();
    char.items[0].installedMods = ["m-1"];
    char.items[0].installedModsData = { "m-1": { damageBonus: 1 } };
    char.items[0].damageDiceRating = 5;
    char.items = [char.items[0]];
    render(<PipBoySheet character={char} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-w-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Remover m-1/ }));
    const patch = onUpdate.mock.calls[0][0];
    const weapon = patch.items.find((i: any) => i.id === "w-1");
    expect(weapon.damageDiceRating).toBe(4);
    expect(weapon.installedMods).toEqual([]);
    expect(patch.items.find((i: any) => i.id === "m-1")).toBeTruthy();
  });
});

