import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CharacterContent,
  getContentName,
  getContentDescription,
  getContentExtraEffect,
  parseClassBenefits,
} from "../CharacterContent";

const { mockRollDice, mockRequestDefenseReaction, mockUpdateActorStatus } = vi.hoisted(() => ({
  mockRollDice: vi.fn(),
  mockRequestDefenseReaction: vi.fn(),
  mockUpdateActorStatus: vi.fn(),
}));

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    isConnected: true,
    rollDice: mockRollDice,
    requestDefenseReaction: mockRequestDefenseReaction,
    updateActorStatus: mockUpdateActorStatus,
  }),
  DICE_ROLL_LOADING_DELAY: 10,
}));

describe("CharacterContent - Gallery Mode (#UI-005)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockRollDice.mockClear();
    mockRequestDefenseReaction.mockClear();
    mockUpdateActorStatus.mockClear();
    vi.restoreAllMocks();
  });

  it("renders 3 carousels when allowedTypes contains items and spells (gallery mode)", async () => {
    const mockSpells = [
      {
        junction: { id: "spell-j1" },
        content: { id: "sp-1", name: "Bola de Fogo", circle: 2, manaCost: 4, actionCostOverride: 2 },
      },
    ];
    const mockItems = [
      {
        junction: { id: "item-j1", quantity: 3 },
        content: { id: "it-1", name: "Poção de Vida" },
      },
    ];
    const mockConditions = [
      {
        junction: { id: "cond-j1", permanent: true },
        content: { id: "cd-1", name: "Envenenado" },
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/content/spells")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: mockSpells, available: [] } }),
        });
      }
      if (url.includes("/content/items")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: mockItems, available: [] } }),
        });
      }
      if (url.includes("/content/conditions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: mockConditions, available: [] } }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      });
    });

    render(
      <CharacterContent
        characterId="char-123"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />
    );

    // Wait for all 3 carousels to render
    await waitFor(() => {
      expect(screen.getByText(/🔮 Magias \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/🎒 Itens \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/⚡ Condições \(1\)/i)).toBeInTheDocument();
    });

    // Verify card contents and sizing (#UI-006, #UI-007, #UI-008)
    const spellCard = screen.getByText("Bola de Fogo").closest(".snap-start");
    expect(spellCard).toHaveClass("w-[28%]", "min-w-[92px]", "max-w-[110px]", "aspect-square", "p-2", "snap-start", "relative", "overflow-hidden");
    expect(spellCard?.parentElement).toHaveClass("flex", "gap-2", "overflow-x-auto");

    expect(screen.getByText("Bola de Fogo")).toBeInTheDocument();
    expect(screen.getByText("Círculo 2")).toBeInTheDocument();
    expect(screen.getByText("4 Mana")).toBeInTheDocument();

    const itemCard = screen.getByText("Poção de Vida").closest(".snap-start");
    expect(itemCard).toHaveClass("w-[28%]", "min-w-[92px]", "max-w-[110px]", "aspect-square", "p-2", "snap-start", "relative", "overflow-hidden");

    expect(screen.getByText("Poção de Vida")).toBeInTheDocument();
    expect(screen.getByText("Qtd: 3")).toBeInTheDocument();

    const conditionCard = screen.getByText("Envenenado").closest(".snap-start");
    expect(conditionCard).toHaveClass("w-[28%]", "min-w-[92px]", "max-w-[110px]", "aspect-square", "p-2", "snap-start", "relative", "overflow-hidden");

    expect(screen.getByText("Envenenado")).toBeInTheDocument();
    expect(screen.getByText("Permanente")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover" })).toBeInTheDocument();

    // Background and gradient layers (#UI-007, #UI-008: opacity-60)
    const spellBg = spellCard?.querySelector(".opacity-60");
    expect(spellBg).toHaveClass("absolute", "inset-0", "z-0", "pointer-events-none");

    const spellGradient = spellCard?.querySelector(".bg-gradient-to-t");
    expect(spellGradient).toHaveClass("absolute", "inset-0", "z-10", "from-gray-950", "pointer-events-none");

    const itemBg = itemCard?.querySelector(".opacity-60");
    expect(itemBg).toHaveClass("absolute", "inset-0", "z-0", "pointer-events-none");

    const itemGradient = itemCard?.querySelector(".bg-gradient-to-t");
    expect(itemGradient).toHaveClass("absolute", "inset-0", "z-10", "from-gray-950", "pointer-events-none");

    // Action cost indicator dots (#UI-007)
    const spellCostBadge = screen.getByLabelText("Custo: 2 ação(ões)");
    expect(spellCostBadge).toBeInTheDocument();
    expect(spellCostBadge.children).toHaveLength(3);
    expect(spellCostBadge.children[0]).toHaveClass("bg-amber-400");
    expect(spellCostBadge.children[1]).toHaveClass("bg-amber-400");
    expect(spellCostBadge.children[2]).toHaveClass("bg-gray-700/60");

    const itemCostBadge = screen.getByLabelText("Custo: 1 ação(ões)");
    expect(itemCostBadge).toBeInTheDocument();
    expect(itemCostBadge.children).toHaveLength(3);
    expect(itemCostBadge.children[0]).toHaveClass("bg-amber-400");
    expect(itemCostBadge.children[1]).toHaveClass("bg-gray-700/60");
    expect(itemCostBadge.children[2]).toHaveClass("bg-gray-700/60");

    // Conditions without actionCostOverride should NOT display action dots
    expect(conditionCard?.querySelector("[aria-label*='Custo:']")).toBeNull();

    // Bottom navigation buttons should NOT be rendered in gallery mode
    expect(screen.queryByRole("button", { name: "Itens" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Magias" })).not.toBeInTheDocument();
  });

  it("shows empty state messages when gallery categories have no linked items", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { linked: [], available: [] } }),
      })
    );

    render(
      <CharacterContent
        characterId="char-123"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Nenhuma magia vinculada")).toBeInTheDocument();
      expect(screen.getByText("Nenhum item no inventário")).toBeInTheDocument();
      expect(screen.getByText("Nenhuma condição ativa")).toBeInTheDocument();
    });
  });

  it("calls DELETE on condition removal in gallery mode", async () => {
    const mockConditions = [
      {
        junction: { id: "cond-j1", permanent: false },
        content: { id: "cd-1", name: "Cegueira" },
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "DELETE") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      if (url.includes("/content/conditions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: mockConditions, available: [] } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { linked: [], available: [] } }),
      });
    });

    render(
      <CharacterContent
        characterId="char-123"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Cegueira")).toBeInTheDocument();
      expect(screen.getByText("Ativa")).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole("button", { name: "Remover" });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/characters/char-123/content/conditions/cond-j1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("maintains traditional list view when allowedTypes is only skills", async () => {
    const mockSkills = [
      {
        junction: { id: "skill-j1", trained: true },
        content: { id: "sk-1", name: "Atletismo", rollExpression: "1d20+FOR" },
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/content/skills")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: mockSkills, available: [] } }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      });
    });

    render(
      <CharacterContent
        characterId="char-123"
        defaultType="skills"
        allowedTypes={["skills"]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Todas as Perícias")).toBeInTheDocument();
      expect(screen.getByText("Atletismo")).toBeInTheDocument();
      expect(screen.getByText("★ Treinada")).toBeInTheDocument();
    });

    // Should NOT render gallery carousels
    expect(screen.queryByText(/🔮 Magias/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/🎒 Itens/i)).not.toBeInTheDocument();
  });

  it("renders action cost dots for conditions and spells with actionCostOverride (#UI-007)", async () => {
    const mockSpells = [
      {
        junction: { id: "spell-j2" },
        content: { id: "sp-2", name: "Ritual Supremo", circle: 4, actionCostOverride: 3, manaCost: 10 },
      },
    ];
    const mockItems = [
      {
        junction: { id: "item-j2", quantity: 1 },
        content: { id: "it-2", name: "Arma Pesada", actionCostOverride: 2 },
      },
    ];
    const mockConditions = [
      {
        junction: { id: "cond-j2", permanent: false },
        content: { id: "cd-2", name: "Paralisia Parcial", actionCostOverride: 2 },
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/content/spells")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: mockSpells, available: [] } }),
        });
      }
      if (url.includes("/content/items")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: mockItems, available: [] } }),
        });
      }
      if (url.includes("/content/conditions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: mockConditions, available: [] } }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      });
    });

    render(
      <CharacterContent
        characterId="char-123"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Ritual Supremo")).toBeInTheDocument();
      expect(screen.getByText("Arma Pesada")).toBeInTheDocument();
      expect(screen.getByText("Paralisia Parcial")).toBeInTheDocument();
    });

    // Spell has 3 actions cost
    const spellCostBadge = screen.getByLabelText("Custo: 3 ação(ões)");
    expect(spellCostBadge).toBeInTheDocument();
    expect(spellCostBadge.children).toHaveLength(3);
    expect(spellCostBadge.children[0]).toHaveClass("bg-amber-400");
    expect(spellCostBadge.children[1]).toHaveClass("bg-amber-400");
    expect(spellCostBadge.children[2]).toHaveClass("bg-amber-400");

    // Condition with actionCostOverride: 2
    const condCard = screen.getByText("Paralisia Parcial").closest(".snap-start");
    const condCostBadge = condCard?.querySelector("[aria-label='Custo: 2 ação(ões)']");
    expect(condCostBadge).toBeInTheDocument();
    expect(condCostBadge?.children).toHaveLength(3);
    expect(condCostBadge?.children[0]).toHaveClass("bg-amber-400");
    expect(condCostBadge?.children[1]).toHaveClass("bg-amber-400");
    expect(condCostBadge?.children[2]).toHaveClass("bg-gray-700/60");

    // Item with actionCostOverride: 2
    const itemCard = screen.getByText("Arma Pesada").closest(".snap-start");
    const itemCostBadge = itemCard?.querySelector("[aria-label='Custo: 2 ação(ões)']");
    expect(itemCostBadge).toBeInTheDocument();
  });

  it("opens detail overlay modal when clicking on a gallery card and can close it (#UI-008)", async () => {
    const mockSpells = [
      {
        junction: { id: "spell-j1" },
        content: { id: "sp-1", name: "Bola de Fogo", circle: 2, manaCost: 4, actionCostOverride: 2, description: "Cria uma explosão flamejante." },
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/content/spells")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: mockSpells, available: [] } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { linked: [], available: [] } }),
      });
    });

    render(
      <CharacterContent
        characterId="char-123"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Bola de Fogo")).toBeInTheDocument();
    });

    // Modal should not be open yet
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Click card to open modal
    const card = screen.getByText("Bola de Fogo").closest(".snap-start")!;
    fireEvent.click(card);

    // Modal should now be visible
    expect(screen.getByRole("dialog", { name: "Bola de Fogo" })).toBeInTheDocument();
    expect(screen.getByText("Magia")).toBeInTheDocument();
    expect(screen.getByText("Cria uma explosão flamejante.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "⚔️ Em combate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🎲 Sem combate" })).toBeInTheDocument();

    // Close button works
    const closeBtn = screen.getByRole("button", { name: "Fechar" });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("manages item equip/unequip system, persists to localStorage, and blocks rolling when unequipped (#UI-008)", async () => {
    const mockItems = [
      {
        junction: { id: "item-j1", quantity: 2 },
        content: { id: "it-sword-1", name: "Espada Longa", rollExpression: "1d20+3", damage: "1d8+2" },
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/content/items")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: mockItems, available: [] } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { linked: [], available: [] } }),
      });
    });

    render(
      <CharacterContent
        characterId="char-123"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Espada Longa")).toBeInTheDocument();
    });

    // Card in gallery should NOT show "Equipado" initially
    const itemCard = screen.getByText("Espada Longa").closest(".snap-start")!;
    expect(itemCard.textContent).not.toContain("Equipado");

    // Click card to open modal
    fireEvent.click(itemCard);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Na mochila")).toBeInTheDocument();

    // Try combat roll while unequipped
    const combatRollBtn = screen.getByRole("button", { name: "⚔️ Em combate" });
    fireEvent.click(combatRollBtn);
    expect(screen.getByText("Equipe o item antes de usá-lo em combate.")).toBeInTheDocument();

    // Try free roll while unequipped
    const freeRollBtn = screen.getByRole("button", { name: "🎲 Sem combate" });
    fireEvent.click(freeRollBtn);
    expect(screen.getByText("Equipe o item antes de usá-lo.")).toBeInTheDocument();

    // Equip item outside combat (free)
    const equipBtn = screen.getByRole("button", { name: /🗡️ Equipar/i });
    fireEvent.click(equipBtn);

    expect(screen.getByText("Item equipado")).toBeInTheDocument();
    expect(localStorage.getItem("libmork_equipped_items_char-123")).toBe(JSON.stringify(["it-sword-1"]));
    expect(within(screen.getByRole("dialog")).getByText("Equipado")).toBeInTheDocument();
    expect(within(itemCard as HTMLElement).getByText("Equipado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /🛡️ Desequipar/i })).toBeInTheDocument();

    // Close modal and verify card has badge "Equipado"
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(itemCard.textContent).toContain("Equipado");

    // Reopen modal and unequip
    fireEvent.click(itemCard);
    const unequipBtn = screen.getByRole("button", { name: /🛡️ Desequipar/i });
    fireEvent.click(unequipBtn);

    expect(screen.getByText("Item desequipado")).toBeInTheDocument();
    expect(localStorage.getItem("libmork_equipped_items_char-123")).toBe(JSON.stringify([]));
    expect(screen.getByText("Na mochila")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /🗡️ Equipar/i })).toBeInTheDocument();
  });

  it("spends 1 action to equip/unequip item when combat is active and validates turn (#UI-008)", async () => {
    const mockItems = [
      {
        junction: { id: "item-j1", quantity: 1 },
        content: { id: "it-shield-1", name: "Escudo Pesado" },
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/content/items")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: mockItems, available: [] } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { linked: [], available: [] } }),
      });
    });

    const mockCombatState = {
      id: "combat-1",
      campaignId: "camp-1",
      active: true,
      round: 1,
      currentTurnIndex: 0,
      pendingReaction: null,
      logs: [],
      combatants: [
        {
          id: "char-123",
          characterId: "char-123",
          name: "Gildor",
          type: "character" as const,
          actionsRemaining: 2,
          actionsTotal: 3,
          maxActions: 3,
          hpCurrent: 20,
          hpMax: 20,
          manaCurrent: 10,
          manaMax: 10,
          initiative: 15,
          vigor: 10,
          destreza: 10,
          level: 1,
        },
      ],
    };

    const onCombatStateChange = vi.fn();
    const onActorStatusChange = vi.fn();

    render(
      <CharacterContent
        characterId="char-123"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
        combatState={mockCombatState}
        combatants={mockCombatState.combatants}
        onCombatStateChange={onCombatStateChange}
        onActorStatusChange={onActorStatusChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Escudo Pesado")).toBeInTheDocument();
    });

    const itemCard = screen.getByText("Escudo Pesado").closest(".snap-start")!;
    fireEvent.click(itemCard);

    // Equip button shows "(1 ação)"
    const equipBtn = screen.getByRole("button", { name: /🗡️ Equipar \(1 ação\)/i });
    expect(equipBtn).toBeInTheDocument();

    fireEvent.click(equipBtn);

    expect(onCombatStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        combatants: [
          expect.objectContaining({
            id: "char-123",
            actionsRemaining: 1,
          }),
        ],
      })
    );
    expect(onActorStatusChange).toHaveBeenCalled();
    expect(screen.getByText("Item equipado (-1 ação)")).toBeInTheDocument();
    expect(localStorage.getItem("libmork_equipped_items_char-123")).toBe(JSON.stringify(["it-shield-1"]));
  });

  it("blocks equip in combat when not player turn or when actions are insufficient (#UI-008)", async () => {
    const mockItems = [
      {
        junction: { id: "item-j1", quantity: 1 },
        content: { id: "it-ring-1", name: "Anel Mágico" },
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/content/items")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: mockItems, available: [] } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { linked: [], available: [] } }),
      });
    });

    // Turn belongs to another combatant
    const mockCombatStateOtherTurn = {
      id: "combat-1",
      campaignId: "camp-1",
      active: true,
      round: 1,
      currentTurnIndex: 0,
      pendingReaction: null,
      logs: [],
      combatants: [
        {
          id: "other-char",
          characterId: "other-char",
          name: "Inimigo",
          type: "npc" as const,
          actionsRemaining: 3,
          actionsTotal: 3,
          maxActions: 3,
          hpCurrent: 10,
          hpMax: 10,
          manaCurrent: 0,
          manaMax: 0,
          initiative: 20,
          vigor: 10,
          destreza: 10,
          level: 1,
        },
        {
          id: "char-123",
          characterId: "char-123",
          name: "Gildor",
          type: "character" as const,
          actionsRemaining: 2,
          actionsTotal: 3,
          maxActions: 3,
          hpCurrent: 20,
          hpMax: 20,
          manaCurrent: 10,
          manaMax: 10,
          initiative: 15,
          vigor: 10,
          destreza: 10,
          level: 1,
        },
      ],
    };

    const { rerender } = render(
      <CharacterContent
        characterId="char-123"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
        combatState={mockCombatStateOtherTurn}
        combatants={mockCombatStateOtherTurn.combatants}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Anel Mágico")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Anel Mágico").closest(".snap-start")!);
    fireEvent.click(screen.getByRole("button", { name: /🗡️ Equipar \(1 ação\)/i }));

    expect(screen.getByText("Seu personagem não está no turno atual do combate.")).toBeInTheDocument();
    expect(localStorage.getItem("libmork_equipped_items_char-123")).toBeNull();

    // Now test with 0 actions remaining on player's turn
    const mockCombatStateNoActions = {
      id: "combat-1",
      campaignId: "camp-1",
      active: true,
      round: 1,
      currentTurnIndex: 0,
      pendingReaction: null,
      logs: [],
      combatants: [
        {
          id: "char-123",
          characterId: "char-123",
          name: "Gildor",
          type: "character" as const,
          actionsRemaining: 0,
          actionsTotal: 3,
          maxActions: 3,
          hpCurrent: 20,
          hpMax: 20,
          manaCurrent: 10,
          manaMax: 10,
          initiative: 15,
          vigor: 10,
          destreza: 10,
          level: 1,
        },
      ],
    };

    rerender(
      <CharacterContent
        characterId="char-123"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
        combatState={mockCombatStateNoActions}
        combatants={mockCombatStateNoActions.combatants}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /🗡️ Equipar \(1 ação\)/i }));
    expect(screen.getByText("Ações insuficientes (0/1 necessárias).")).toBeInTheDocument();
  });

  it("performs free roll (rolagem sem combate) for equipped item and spell without requiring active combat (#UI-008)", async () => {
    const mockItems = [
      {
        junction: { id: "item-j1", quantity: 1 },
        content: { id: "it-bow-1", name: "Arco Curto", rollExpression: "1d20+2", damage: "1d6" },
      },
    ];
    const mockSpells = [
      {
        junction: { id: "spell-j1" },
        content: { id: "sp-1", name: "Mísseis Mágicos", rollExpression: "1d20", damage: "2d4+2" },
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/content/items")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: mockItems, available: [] } }),
        });
      }
      if (url.includes("/content/spells")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: mockSpells, available: [] } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { linked: [], available: [] } }),
      });
    });

    const onActionResult = vi.fn();

    // Pre-equip the bow in localStorage
    localStorage.setItem("libmork_equipped_items_char-123", JSON.stringify(["it-bow-1"]));

    render(
      <CharacterContent
        characterId="char-123"
        campaignId="camp-abc"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
        onActionResult={onActionResult}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Arco Curto")).toBeInTheDocument();
      expect(screen.getByText("Mísseis Mágicos")).toBeInTheDocument();
    });

    // 1. Roll equipped item free
    fireEvent.click(screen.getByText("Arco Curto").closest(".snap-start")!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "🎲 Sem combate" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockRollDice).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "camp-abc",
        actorId: "char-123",
        rollType: "Arco Curto (Livre)",
        result: expect.any(Number),
      })
    );
    expect(onActionResult).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Arco Curto (Livre)",
        result: expect.any(Number),
      })
    );

    // 2. Roll spell free (no equip needed)
    fireEvent.click(screen.getByText("Mísseis Mágicos").closest(".snap-start")!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "🎲 Sem combate" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockRollDice).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "camp-abc",
        actorId: "char-123",
        rollType: "Mísseis Mágicos (Livre)",
        result: expect.any(Number),
      })
    );
    expect(onActionResult).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Mísseis Mágicos (Livre)",
        result: expect.any(Number),
      })
    );
  });

  it("removes condition from inside the detail modal (#UI-008)", async () => {
    const mockConditions = [
      {
        junction: { id: "cond-modal-1", permanent: false },
        content: { id: "cd-1", name: "Confusão" },
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "DELETE") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      if (url.includes("/content/conditions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: mockConditions, available: [] } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { linked: [], available: [] } }),
      });
    });

    render(
      <CharacterContent
        characterId="char-123"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Confusão")).toBeInTheDocument();
    });

    // Click condition card (not the inner remover button)
    const card = screen.getByText("Confusão").closest(".snap-start")!;
    fireEvent.click(card);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const modalRemoveBtn = screen.getByRole("button", { name: "Remover Condição" });
    fireEvent.click(modalRemoveBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/characters/char-123/content/conditions/cond-modal-1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders class features carousel below conditions when characterClassId is provided and handles unlock/locked state by level (#UI-009)", async () => {
    const mockBenefits = [
      {
        id: "feat-1",
        level: 1,
        benefits: {
          advantages: ["Ataque Poderoso"],
          description: "Causa dano adicional ao atingir o alvo.",
          hp_bonus: 5,
          mana_bonus: 0,
        },
      },
      {
        id: "feat-3",
        level: 3,
        benefits: {
          advantages: ["Postura Defensiva"],
          description: "Aumenta a defesa em combate.",
          hp_bonus: 2,
          mana_bonus: 0,
        },
      },
      {
        id: "feat-5",
        level: 5,
        benefits: {
          advantages: ["Golpe Fulminante"],
          description: "Um ataque que desestabiliza o oponente.",
          hp_bonus: 0,
          mana_bonus: 4,
        },
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/content/spells") || url.includes("/content/items") || url.includes("/content/conditions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: [], available: [] } }),
        });
      }
      if (url.includes("/classes/warrior-cls/benefits")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockBenefits }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      });
    });

    render(
      <CharacterContent
        characterId="char-123"
        characterClassId="warrior-cls"
        characterLevel={3}
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />
    );

    // Verify 4th carousel title and count of unlocked features
    await waitFor(() => {
      expect(screen.getByText("⭐ Habilidades de Classe")).toBeInTheDocument();
      expect(screen.getByText("(2/3 desbloqueadas)")).toBeInTheDocument();
    });

    // Level 1 feature (unlocked)
    const feat1Card = screen.getByText("Ataque Poderoso").closest(".snap-start") as HTMLElement;
    expect(feat1Card).toHaveClass("w-[28%]", "min-w-[92px]", "max-w-[110px]", "aspect-square", "p-2", "snap-start", "relative", "overflow-hidden");
    expect(feat1Card).toHaveClass("border-indigo-900/40");
    expect(feat1Card).not.toHaveClass("grayscale");
    expect(within(feat1Card).getByText("Desbloqueada")).toBeInTheDocument();
    expect(within(feat1Card).getByText("Nv. 1")).toBeInTheDocument();

    // Level 3 feature (unlocked)
    const feat3Card = screen.getByText("Postura Defensiva").closest(".snap-start") as HTMLElement;
    expect(feat3Card).not.toHaveClass("grayscale");
    expect(within(feat3Card).getByText("Desbloqueada")).toBeInTheDocument();
    expect(within(feat3Card).getByText("Nv. 3")).toBeInTheDocument();

    // Level 5 feature (locked)
    const feat5Card = screen.getByText("Golpe Fulminante").closest(".snap-start") as HTMLElement;
    expect(feat5Card).toHaveClass("grayscale", "opacity-60", "bg-gray-950/90", "border-gray-800");
    expect(within(feat5Card).getByText("Bloqueada (Nv. 5)")).toBeInTheDocument();
    expect(within(feat5Card).getByText("🔒")).toBeInTheDocument();
    expect(within(feat5Card).getByText("🔒")).toHaveClass("font-fantasy");
  });

  it("opens and closes detail modal for unlocked class feature card with bonuses and description (#UI-009)", async () => {
    const mockBenefits = [
      {
        id: "feat-1",
        level: 1,
        benefits: {
          advantages: ["Ataque Poderoso"],
          description: "Causa dano adicional ao atingir o alvo.",
          hp_bonus: 5,
          mana_bonus: 0,
        },
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/content/spells") || url.includes("/content/items") || url.includes("/content/conditions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: [], available: [] } }),
        });
      }
      if (url.includes("/classes/warrior-cls/benefits")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockBenefits }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      });
    });

    render(
      <CharacterContent
        characterId="char-123"
        characterClassId="warrior-cls"
        characterLevel={3}
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Ataque Poderoso")).toBeInTheDocument();
    });

    // Click card to open modal
    const featCard = screen.getByText("Ataque Poderoso").closest(".snap-start")!;
    fireEvent.click(featCard);

    expect(screen.getByRole("dialog", { name: "Ataque Poderoso" })).toBeInTheDocument();
    expect(screen.getByText("Habilidade de Classe · Nível 1")).toBeInTheDocument();
    expect(screen.getByText("Habilidade Desbloqueada")).toBeInTheDocument();
    expect(screen.getByText(/Disponível para seu personagem \(Nível 3 ≥ 1\)\./i)).toBeInTheDocument();
    expect(screen.getByText("+5 HP")).toBeInTheDocument();
    expect(screen.getByText("Causa dano adicional ao atingir o alvo.")).toBeInTheDocument();

    // Close modal via footer button
    fireEvent.click(screen.getByText("Fechar"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens detail modal for locked class feature card with required level warning and mana bonus (#UI-009)", async () => {
    const mockBenefits = [
      {
        id: "feat-8",
        level: 8,
        benefits: {
          advantages: ["Tempestade de Golpes"],
          description: "Desfere múltiplos ataques velozes.",
          hp_bonus: 0,
          mana_bonus: 10,
        },
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/content/spells") || url.includes("/content/items") || url.includes("/content/conditions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: [], available: [] } }),
        });
      }
      if (url.includes("/classes/monk-cls/benefits")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockBenefits }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      });
    });

    render(
      <CharacterContent
        characterId="char-123"
        characterClassId="monk-cls"
        characterLevel={2}
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Tempestade de Golpes")).toBeInTheDocument();
    });

    // Click locked card to open modal
    const featCard = screen.getByText("Tempestade de Golpes").closest(".snap-start")!;
    fireEvent.click(featCard);

    expect(screen.getByRole("dialog", { name: "Tempestade de Golpes" })).toBeInTheDocument();
    expect(screen.getByText("Habilidade Bloqueada")).toBeInTheDocument();
    expect(screen.getByText(/Requer que o personagem alcance o nível 8 \(Nível atual: 2\)\./i)).toBeInTheDocument();
    expect(screen.getByText("+10 Mana")).toBeInTheDocument();
    expect(screen.getByText("Desfere múltiplos ataques velozes.")).toBeInTheDocument();

    // Close modal via top-right '✕' button
    fireEvent.click(screen.getByText("✕"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders empty state when characterClassId is provided but class has no benefits, or when characterClassId is absent (#UI-009)", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/content/spells") || url.includes("/content/items") || url.includes("/content/conditions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { linked: [], available: [] } }),
        });
      }
      if (url.includes("/classes/empty-cls/benefits")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      });
    });

    const { rerender } = render(
      <CharacterContent
        characterId="char-123"
        characterClassId="empty-cls"
        characterLevel={1}
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Nenhuma habilidade cadastrada para esta classe")).toBeInTheDocument();
    });

    rerender(
      <CharacterContent
        characterId="char-123"
        characterClassId={null}
        characterLevel={1}
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Nenhuma classe vinculada ao personagem")).toBeInTheDocument();
    });
  });

  describe("AI Translation with API Fallback (#UI-011)", () => {
    it("prioritizes AI translation (name, description, extraEffect) over original API fields in cards and detail modal", async () => {
      const mockSpells = [
        {
          junction: { id: "spell-ai-1" },
          content: {
            id: "sp-ai-1",
            name: "Magic Missile",
            description: "Fires glowing darts of magical force.",
            circle: 1,
            manaCost: 2,
            translation: {
              name: "Míssil Mágico",
              description: "Dispara dardos brilhantes de energia mágica.",
              extraEffect: "Cada dardo atinge infalivelmente a criatura.",
            },
          },
        },
      ];
      const mockItems = [
        {
          junction: { id: "item-ai-1", quantity: 2 },
          content: {
            id: "it-ai-1",
            name: "Healing Potion",
            description: "A magical red liquid that restores health.",
            translation: {
              name: "Poção de Cura",
              description: "Um líquido mágico vermelho que restaura vida.",
            },
          },
        },
      ];
      const mockConditions = [
        {
          junction: { id: "cond-ai-1", permanent: false },
          content: {
            id: "cd-ai-1",
            name: "Poisoned",
            description: "Suffers continuous poison damage.",
            translation: {
              name: "Envenenado",
              description: "Sofre dano contínuo por veneno.",
            },
          },
        },
      ];

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/content/spells")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { linked: mockSpells, available: [] } }),
          });
        }
        if (url.includes("/content/items")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { linked: mockItems, available: [] } }),
          });
        }
        if (url.includes("/content/conditions")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { linked: mockConditions, available: [] } }),
          });
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Not found" }),
        });
      });

      render(
        <CharacterContent
          characterId="char-123"
          defaultType="items"
          allowedTypes={["items", "spells", "conditions"]}
        />
      );

      // Verify translated names in gallery cards
      await waitFor(() => {
        expect(screen.getByText("Míssil Mágico")).toBeInTheDocument();
        expect(screen.getByText("Poção de Cura")).toBeInTheDocument();
        expect(screen.getByText("Envenenado")).toBeInTheDocument();
      });

      expect(screen.queryByText("Magic Missile")).not.toBeInTheDocument();
      expect(screen.queryByText("Healing Potion")).not.toBeInTheDocument();
      expect(screen.queryByText("Poisoned")).not.toBeInTheDocument();

      // Open Spell modal: verify translated name, description and extra effect
      const spellCard = screen.getByText("Míssil Mágico").closest(".snap-start")!;
      fireEvent.click(spellCard);

      expect(screen.getByRole("dialog", { name: "Míssil Mágico" })).toBeInTheDocument();
      expect(screen.getByText("Dispara dardos brilhantes de energia mágica.")).toBeInTheDocument();
      expect(screen.getByText("Efeito Extra")).toBeInTheDocument();
      expect(screen.getByText("Cada dardo atinge infalivelmente a criatura.")).toBeInTheDocument();
      expect(screen.queryByText("Fires glowing darts of magical force.")).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Fechar"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // Open Item modal: verify translated name and description
      const itemCard = screen.getByText("Poção de Cura").closest(".snap-start")!;
      fireEvent.click(itemCard);

      expect(screen.getByRole("dialog", { name: "Poção de Cura" })).toBeInTheDocument();
      expect(screen.getByText("Um líquido mágico vermelho que restaura vida.")).toBeInTheDocument();
      expect(screen.queryByText("A magical red liquid that restores health.")).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Fechar"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // Open Condition modal: verify translated name and description
      const condCard = screen.getByText("Envenenado").closest(".snap-start")!;
      fireEvent.click(condCard);

      expect(screen.getByRole("dialog", { name: "Envenenado" })).toBeInTheDocument();
      expect(screen.getByText("Sofre dano contínuo por veneno.")).toBeInTheDocument();
      expect(screen.queryByText("Suffers continuous poison damage.")).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Fechar"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("gracefully falls back to original API fields when translation is missing, null or empty", async () => {
      const mockSpells = [
        {
          junction: { id: "spell-fb-1" },
          content: {
            id: "sp-fb-1",
            name: "Fireball",
            description: "A bright streak flashes from your pointing finger.",
            circle: 3,
            manaCost: 5,
            translation: null,
          },
        },
      ];
      const mockItems = [
        {
          junction: { id: "item-fb-1", quantity: 1 },
          content: {
            id: "it-fb-1",
            name: "Iron Sword",
            description: "A standard martial weapon.",
            translation: { name: "  ", description: "" },
          },
        },
      ];
      const mockConditions = [
        {
          junction: { id: "cond-fb-1", permanent: true },
          content: {
            id: "cd-fb-1",
            name: "Blinded",
            sourceData: {
              system: {
                description: {
                  value: "A blinded creature can't see and automatically fails ability checks.",
                },
              },
            },
          },
        },
      ];

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/content/spells")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { linked: mockSpells, available: [] } }),
          });
        }
        if (url.includes("/content/items")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { linked: mockItems, available: [] } }),
          });
        }
        if (url.includes("/content/conditions")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { linked: mockConditions, available: [] } }),
          });
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Not found" }),
        });
      });

      render(
        <CharacterContent
          characterId="char-123"
          defaultType="items"
          allowedTypes={["items", "spells", "conditions"]}
        />
      );

      // Verify fallback names in gallery cards
      await waitFor(() => {
        expect(screen.getByText("Fireball")).toBeInTheDocument();
        expect(screen.getByText("Iron Sword")).toBeInTheDocument();
        expect(screen.getByText("Blinded")).toBeInTheDocument();
      });

      // Verify fallback description in spell modal
      fireEvent.click(screen.getByText("Fireball").closest(".snap-start")!);
      expect(screen.getByText("A bright streak flashes from your pointing finger.")).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText("Fechar"));

      // Verify fallback description in item modal
      fireEvent.click(screen.getByText("Iron Sword").closest(".snap-start")!);
      expect(screen.getByText("A standard martial weapon.")).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText("Fechar"));

      // Verify fallback to sourceData.system.description.value in condition modal
      fireEvent.click(screen.getByText("Blinded").closest(".snap-start")!);
      expect(screen.getByText("A blinded creature can't see and automatically fails ability checks.")).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText("Fechar"));
    });

    it("prioritizes class feature translation over API fields with graceful fallback", async () => {
      const mockBenefits = [
        {
          id: "feat-trans",
          level: 1,
          benefits: {
            advantages: ["Second Wind"],
            description: "You have a limited well of stamina that you can draw upon.",
            hp_bonus: 5,
            mana_bonus: 0,
            translation: {
              advantages: ["Retomar o Fôlego"],
              description: "Você possui uma reserva limitada de vigor da qual pode extrair forças.",
            },
          },
        },
        {
          id: "feat-trans-name",
          level: 2,
          benefits: {
            name: "Action Surge",
            description: "You can push yourself beyond your normal limits.",
            hp_bonus: 0,
            mana_bonus: 5,
            translation: {
              name: "Surto de Ação",
              description: "Você pode se esforçar além dos seus limites normais.",
            },
          },
        },
        {
          id: "feat-fallback",
          level: 3,
          benefits: {
            advantages: ["Extra Attack"],
            description: "You can attack twice whenever you take the Attack action.",
            hp_bonus: 0,
            mana_bonus: 0,
          },
        },
      ];

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/content/spells") || url.includes("/content/items") || url.includes("/content/conditions")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { linked: [], available: [] } }),
          });
        }
        if (url.includes("/classes/fighter-cls/benefits")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockBenefits }),
          });
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Not found" }),
        });
      });

      render(
        <CharacterContent
          characterId="char-123"
          characterClassId="fighter-cls"
          characterLevel={3}
          defaultType="items"
          allowedTypes={["items", "spells", "conditions"]}
        />
      );

      // Verify translated and fallback feature names in gallery
      await waitFor(() => {
        expect(screen.getByText("Retomar o Fôlego")).toBeInTheDocument();
        expect(screen.getByText("Surto de Ação")).toBeInTheDocument();
        expect(screen.getByText("Extra Attack")).toBeInTheDocument();
      });

      expect(screen.queryByText("Second Wind")).not.toBeInTheDocument();
      expect(screen.queryByText("Action Surge")).not.toBeInTheDocument();

      // Open translated feat modal
      fireEvent.click(screen.getByText("Retomar o Fôlego").closest(".snap-start")!);
      expect(screen.getByRole("dialog", { name: "Retomar o Fôlego" })).toBeInTheDocument();
      expect(screen.getByText("Você possui uma reserva limitada de vigor da qual pode extrair forças.")).toBeInTheDocument();
      expect(screen.queryByText("You have a limited well of stamina that you can draw upon.")).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText("Fechar"));

      // Open fallback feat modal
      fireEvent.click(screen.getByText("Extra Attack").closest(".snap-start")!);
      expect(screen.getByRole("dialog", { name: "Extra Attack" })).toBeInTheDocument();
      expect(screen.getByText("You can attack twice whenever you take the Attack action.")).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText("Fechar"));
    });

    it("validates helper functions unit logic directly", () => {
      // getContentName
      expect(getContentName(null, "Fallback")).toBe("Fallback");
      expect(getContentName({}, "Fallback")).toBe("Fallback");
      expect(getContentName({ name: "API Name" })).toBe("API Name");
      expect(getContentName({ name: "API Name", translation: { name: "Traduzido" } })).toBe("Traduzido");
      expect(getContentName({ name: "API Name", translation: { name: "  " } })).toBe("API Name");

      // getContentDescription
      expect(getContentDescription(null, "Fallback")).toBe("Fallback");
      expect(getContentDescription({}, "Fallback")).toBe("Fallback");
      expect(getContentDescription({ description: "Desc API" })).toBe("Desc API");
      expect(getContentDescription({ description: "Desc API", translation: { description: "Desc IA" } })).toBe("Desc IA");
      expect(
        getContentDescription({
          translation: { system: { description: { value: "Desc IA System" } } },
        })
      ).toBe("Desc IA System");
      expect(
        getContentDescription({
          sourceData: { system: { description: { value: "Desc Source System" } } },
        })
      ).toBe("Desc Source System");

      // getContentExtraEffect
      expect(getContentExtraEffect(null)).toBeNull();
      expect(getContentExtraEffect({})).toBeNull();
      expect(getContentExtraEffect({ extraEffect: "API Extra" })).toBe("API Extra");
      expect(getContentExtraEffect({ extraEffect: "API Extra", translation: { extraEffect: "IA Extra" } })).toBe("IA Extra");
      expect(getContentExtraEffect({ translation: { extra_effect: "IA Snake Extra" } })).toBe("IA Snake Extra");

      // parseClassBenefits
      const parsed = parseClassBenefits([
        {
          level: 1,
          benefits: {
            translation: { advantages: ["Tradução Array 1", "Tradução Array 2"] },
            advantages: ["Original"],
            description: "Ben Desc",
          },
        },
        {
          level: 2,
          benefits: {
            translation: { name: "Nome Traduzido" },
            name: "Original Name",
          },
        },
        {
          level: 3,
          benefits: {
            translation: { description: "Descrição que ultrapassa trinta e cinco caracteres para teste de corte" },
          },
        },
        {
          level: 4,
          benefits: {},
        },
      ]);
      expect(parsed[0].name).toBe("Tradução Array 1, Tradução Array 2");
      expect(parsed[1].name).toBe("Nome Traduzido");
      expect(parsed[2].name).toBe("Descrição que ultrapassa trinta e c");
      expect(parsed[3].name).toBe("Habilidade Nv. 4");
    });
  });
});
