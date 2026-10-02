/**
 * Testes de regressão para Issue #37: fórmulas de character_items.junction
 * devem aparecer no inventário do jogador.
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CharacterContent } from "../CharacterContent";

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rendered = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return {
    ...rendered,
    rerender: (nextUi: ReactNode) =>
      rendered.rerender(<QueryClientProvider client={queryClient}>{nextUi}</QueryClientProvider>),
  };
}

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
    subscribeCharacterInventoryChange: () => () => {},
    notifyCharacterInventoryChange: vi.fn(),
  }),
  DICE_ROLL_LOADING_DELAY: 10,
}));

describe("Issue #37 - Junction formulas (hitRoll/damageRoll) in character_items", () => {
  beforeEach(() => {
    localStorage.clear();
    mockRollDice.mockClear();
    mockRequestDefenseReaction.mockClear();
    mockUpdateActorStatus.mockClear();
    vi.restoreAllMocks();
  });

  it("should display roll buttons when item has junction.hitRoll and junction.damageRoll and is equipped", async () => {
    // Simular item previamente equipado no localStorage
    localStorage.setItem("libmork_equipped_items_char-test-1", JSON.stringify(["item-sword-1"]));

    // Item com fórmulas definidas na junção character_items
    const mockItems = [
      {
        junction: {
          id: "item-junction-1",
          quantity: 1,
          hitRoll: "1d20 + 3",
          damageRoll: "1d8 + 2",
        },
        content: {
          id: "item-sword-1",
          name: "Espada",
          description: "Uma espada comum",
        },
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

    renderWithQuery(
      <CharacterContent
        characterId="char-test-1"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Espada")).toBeInTheDocument();
    });

    // Clicar no card do item para abrir o modal
    const itemCard = screen.getByText("Espada").closest(".snap-start")!;
    fireEvent.click(itemCard);

    // Verificar que o modal está aberto
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Verificar que as fórmulas aparecem no modal
    expect(screen.getByText("1d20 + 3")).toBeInTheDocument(); // hitRoll
    expect(screen.getByText("1d8 + 2")).toBeInTheDocument(); // damageRoll

    // Verificar que os botões de rolagem estão presentes quando equipado
    expect(screen.getByRole("button", { name: /🎲 Sem combate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /⚔️ Em combate/i })).toBeInTheDocument();

    // Verificar que o botão Desequipar está presente
    expect(screen.getByRole("button", { name: /🛡️ Desequipar/i })).toBeInTheDocument();
  });

  it("should NOT display roll buttons when item has formulas but is NOT equipped", async () => {
    // Item com fórmulas, mas não está no localStorage como equipado
    const mockItems = [
      {
        junction: {
          id: "item-junction-unequipped",
          quantity: 1,
          hitRoll: "1d20 + 3",
          damageRoll: "1d8 + 2",
        },
        content: {
          id: "item-sword-unequipped",
          name: "Espada Guardada",
          description: "Uma espada na mochila",
        },
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

    renderWithQuery(
      <CharacterContent
        characterId="char-test-unequipped"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Espada Guardada")).toBeInTheDocument();
    });

    const itemCard = screen.getByText("Espada Guardada").closest(".snap-start")!;
    fireEvent.click(itemCard);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fórmulas ainda aparecem nas informações
    expect(screen.getByText("1d20 + 3")).toBeInTheDocument();
    expect(screen.getByText("1d8 + 2")).toBeInTheDocument();

    // MAS botões de rolagem NÃO devem ser exibidos
    expect(screen.queryByRole("button", { name: /🎲 Sem combate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /⚔️ Em combate/i })).not.toBeInTheDocument();

    // Botão de equipar deve estar presente
    expect(screen.getByRole("button", { name: /🗡️ Equipar/i })).toBeInTheDocument();
  });

  it("should display ONLY equip button when item has NO junction formulas and is NOT equipped", async () => {
    // Item SEM fórmulas na junção
    const mockItems = [
      {
        junction: {
          id: "item-junction-2",
          quantity: 5,
          hitRoll: null,
          damageRoll: null,
        },
        content: {
          id: "item-potion-1",
          name: "Poção de Cura",
          description: "Restaura pontos de vida",
        },
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

    renderWithQuery(
      <CharacterContent
        characterId="char-test-2"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Poção de Cura")).toBeInTheDocument();
    });

    // Clicar no card do item para abrir o modal
    const itemCard = screen.getByText("Poção de Cura").closest(".snap-start")!;
    fireEvent.click(itemCard);

    // Verificar que o modal está aberto
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Verificar que NÃO há seção de fórmulas (pois ambas são null)
    expect(screen.queryByText("Fórmulas")).not.toBeInTheDocument();

    // Verificar que os botões de rolagem NÃO estão presentes (item não equipado)
    expect(screen.queryByRole("button", { name: /🎲 Sem combate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /⚔️ Em combate/i })).not.toBeInTheDocument();

    // Verificar que o botão Equipar ESTÁ presente
    expect(screen.getByRole("button", { name: /🗡️ Equipar/i })).toBeInTheDocument();
  });

  it("should prioritize junction.hitRoll over content.hitRoll (legacy fallback)", async () => {
    // Item com fórmulas na junção E no content (legado)
    const mockItems = [
      {
        junction: {
          id: "item-junction-3",
          quantity: 1,
          hitRoll: "1d20 + 5", // Nova API (prioridade)
          damageRoll: "2d6 + 3", // Nova API (prioridade)
        },
        content: {
          id: "item-axe-1",
          name: "Machado",
          description: "Um machado de guerra",
          rollExpression: "1d20 + 1", // Legado (deve ser ignorado)
          damage: "1d12", // Legado (deve ser ignorado)
        },
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

    renderWithQuery(
      <CharacterContent
        characterId="char-test-3"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Machado")).toBeInTheDocument();
    });

    // Clicar no card do item para abrir o modal
    const itemCard = screen.getByText("Machado").closest(".snap-start")!;
    fireEvent.click(itemCard);

    // Verificar que o modal está aberto
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Verificar que as fórmulas da JUNÇÃO aparecem (não as legadas)
    expect(screen.getByText("1d20 + 5")).toBeInTheDocument(); // junction.hitRoll
    expect(screen.getByText("2d6 + 3")).toBeInTheDocument(); // junction.damageRoll

    // Verificar que as fórmulas legadas NÃO aparecem
    expect(screen.queryByText("1d20 + 1")).not.toBeInTheDocument();
    expect(screen.queryByText("1d12")).not.toBeInTheDocument();
  });

  it("should normalize formulas with @atributo placeholders using characterAttributeModifiers", async () => {
    // Item com fórmulas usando placeholders de atributo
    const mockItems = [
      {
        junction: {
          id: "item-junction-4",
          quantity: 1,
          hitRoll: "1d20 + @forca",
          damageRoll: "1d8 + @vigor",
        },
        content: {
          id: "item-hammer-1",
          name: "Martelo de Guerra",
          description: "Martelo pesado",
        },
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

    const characterAttributeModifiers = {
      forca: 3,
      vigor: 2,
      destreza: 1,
      inteligencia: 0,
      empatia: 0,
      sorte: 0,
    };

    renderWithQuery(
      <CharacterContent
        characterId="char-test-4"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
        characterAttributeModifiers={characterAttributeModifiers}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Martelo de Guerra")).toBeInTheDocument();
    });

    // Clicar no card do item para abrir o modal
    const itemCard = screen.getByText("Martelo de Guerra").closest(".snap-start")!;
    fireEvent.click(itemCard);

    // Verificar que o modal está aberto
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Verificar que as fórmulas normalizadas aparecem (placeholders substituídos)
    expect(screen.getByText("1d20 + 3")).toBeInTheDocument(); // @forca = 3
    expect(screen.getByText("1d8 + 2")).toBeInTheDocument(); // @vigor = 2
  });

  it("should display roll buttons when item has ONLY damageRoll (no hitRoll) and is equipped", async () => {
    localStorage.setItem("libmork_equipped_items_char-test-5", JSON.stringify(["item-grenade-1"]));
    const mockItems = [
      {
        junction: {
          id: "item-junction-5",
          quantity: 1,
          hitRoll: null,
          damageRoll: "2d6 + 3",
        },
        content: {
          id: "item-grenade-1",
          name: "Granada",
          description: "Explosivo de área",
        },
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

    renderWithQuery(
      <CharacterContent
        characterId="char-test-5"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Granada")).toBeInTheDocument();
    });

    const itemCard = screen.getByText("Granada").closest(".snap-start")!;
    fireEvent.click(itemCard);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Verifica que apenas damageRoll aparece
    expect(screen.getByText("2d6 + 3")).toBeInTheDocument();

    // Verifica que os botões de rolagem estão presentes (mesmo sem hitRoll, quando equipado)
    expect(screen.getByRole("button", { name: /🎲 Sem combate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /⚔️ Em combate/i })).toBeInTheDocument();
  });

  it("should display roll buttons when item has ONLY hitRoll (no damageRoll) and is equipped", async () => {
    localStorage.setItem("libmork_equipped_items_char-test-6", JSON.stringify(["item-net-1"]));
    const mockItems = [
      {
        junction: {
          id: "item-junction-6",
          quantity: 1,
          hitRoll: "1d20 + 5",
          damageRoll: null,
        },
        content: {
          id: "item-net-1",
          name: "Rede",
          description: "Imobiliza o alvo",
        },
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

    renderWithQuery(
      <CharacterContent
        characterId="char-test-6"
        defaultType="items"
        allowedTypes={["items", "spells", "conditions"]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Rede")).toBeInTheDocument();
    });

    const itemCard = screen.getByText("Rede").closest(".snap-start")!;
    fireEvent.click(itemCard);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Verifica que apenas hitRoll aparece
    expect(screen.getByText("1d20 + 5")).toBeInTheDocument();

    // Verifica que os botões de rolagem estão presentes (mesmo sem damageRoll, quando equipado)
    expect(screen.getByRole("button", { name: /🎲 Sem combate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /⚔️ Em combate/i })).toBeInTheDocument();
  });

  it("should always display roll buttons for spells regardless of equipment state", async () => {
    const mockSpells = [
      {
        junction: {
          id: "spell-junction-1",
        },
        content: {
          id: "spell-fireball-1",
          name: "Bola de Fogo",
          description: "Explosão de chamas",
          circle: 2,
          manaCost: 4,
          rollExpression: "1d20 + 4",
          damage: "4d6",
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
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { linked: [], available: [] } }),
      });
    });

    renderWithQuery(
      <CharacterContent
        characterId="char-test-spell"
        defaultType="spells"
        allowedTypes={["items", "spells", "conditions"]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Bola de Fogo")).toBeInTheDocument();
    });

    const spellCard = screen.getByText("Bola de Fogo").closest(".snap-start")!;
    fireEvent.click(spellCard);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Magia deve exibir ambos os botões
    expect(screen.getByRole("button", { name: /🎲 Sem combate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /⚔️ Em combate/i })).toBeInTheDocument();
    // E não deve exibir botão de equipar
    expect(screen.queryByRole("button", { name: /Equipar/i })).not.toBeInTheDocument();
  });
});
