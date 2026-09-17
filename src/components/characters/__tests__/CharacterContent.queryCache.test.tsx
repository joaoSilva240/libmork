import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CharacterContent } from "../CharacterContent";

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

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes as configured globally
        gcTime: 1000 * 60 * 30,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

describe("CharacterContent - TanStack Query Caching & Remount (#8)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    queryClient = createTestQueryClient();
    vi.restoreAllMocks();
  });

  it("reuses cached gallery content on remount within 5 minutes without re-fetching", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/content/spells")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                linked: [
                  {
                    junction: { id: "sp-j1" },
                    content: { id: "sp-1", name: "Raio Solar", circle: 1, manaCost: 2 },
                  },
                ],
                available: [],
              },
            }),
        });
      }
      if (url.includes("/content/items")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                linked: [
                  {
                    junction: { id: "it-j1", quantity: 2 },
                    content: { id: "it-1", name: "Elixir Élfico" },
                  },
                ],
                available: [],
              },
            }),
        });
      }
      if (url.includes("/content/conditions")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                linked: [
                  {
                    junction: { id: "cd-j1", permanent: false },
                    content: { id: "cd-1", name: "Abençoado" },
                  },
                ],
                available: [],
              },
            }),
        });
      }
      if (url.includes("/classes/mage-cls/benefits")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "feat-1",
                  level: 1,
                  benefits: {
                    advantages: ["Foco Arcano"],
                    description: "Aumenta a precisão das magias.",
                    hp_bonus: 0,
                    mana_bonus: 5,
                  },
                },
              ],
            }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      });
    });

    globalThis.fetch = fetchSpy;

    // 1. First mount: user opens "inventário" tab
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <CharacterContent
          characterId="char-test-cache"
          characterClassId="mage-cls"
          characterLevel={1}
          defaultType="items"
          allowedTypes={["items", "spells", "conditions"]}
        />
      </QueryClientProvider>
    );

    // Initial render displays content
    await waitFor(() => {
      expect(screen.getByText("Raio Solar")).toBeInTheDocument();
      expect(screen.getByText("Elixir Élfico")).toBeInTheDocument();
      expect(screen.getByText("Abençoado")).toBeInTheDocument();
      expect(screen.getByText("Foco Arcano")).toBeInTheDocument();
    });

    const callsCountFirstMount = fetchSpy.mock.calls.length;
    expect(callsCountFirstMount).toBe(4); // spells, items, conditions, benefits

    // 2. User switches to "status" tab (CharacterContent unmounts)
    unmount();

    // 3. User switches back to "inventário" tab within 5 minutes (CharacterContent remounts)
    render(
      <QueryClientProvider client={queryClient}>
        <CharacterContent
          characterId="char-test-cache"
          characterClassId="mage-cls"
          characterLevel={1}
          defaultType="items"
          allowedTypes={["items", "spells", "conditions"]}
        />
      </QueryClientProvider>
    );

    // Immediately shows cached data without loading state or new fetch calls
    expect(screen.getByText("Raio Solar")).toBeInTheDocument();
    expect(screen.getByText("Elixir Élfico")).toBeInTheDocument();
    expect(screen.getByText("Abençoado")).toBeInTheDocument();
    expect(screen.getByText("Foco Arcano")).toBeInTheDocument();

    // No new network requests made!
    expect(fetchSpy.mock.calls.length).toBe(callsCountFirstMount);
  });

  it("loads only skills in non-gallery mode (skills tab) and does not query spells/items/conditions/benefits", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/content/skills")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                linked: [
                  {
                    junction: { id: "sk-j1", trained: true },
                    content: { id: "sk-1", name: "Acrobacia", rollExpression: "1d20+DES" },
                  },
                ],
                available: [
                  { id: "sk-2", name: "Arcanismo", rollExpression: "1d20+INT" },
                ],
              },
            }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "Should not be called" }),
      });
    });

    globalThis.fetch = fetchSpy;

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <CharacterContent
          characterId="char-test-skills"
          characterClassId="mage-cls"
          characterLevel={1}
          defaultType="skills"
          allowedTypes={["skills"]}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Todas as Perícias")).toBeInTheDocument();
      expect(screen.getByText("Acrobacia")).toBeInTheDocument();
      expect(screen.getByText("Arcanismo")).toBeInTheDocument();
    });

    // Verify ONLY the skills endpoint was called
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/characters/char-test-skills/content/skills",
      expect.anything()
    );

    // Unmount and remount (switching tabs to status and back to skills)
    unmount();

    render(
      <QueryClientProvider client={queryClient}>
        <CharacterContent
          characterId="char-test-skills"
          characterClassId="mage-cls"
          characterLevel={1}
          defaultType="skills"
          allowedTypes={["skills"]}
        />
      </QueryClientProvider>
    );

    // Reuses cache immediately without new fetch
    expect(screen.getByText("Acrobacia")).toBeInTheDocument();
    expect(screen.getByText("Arcanismo")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("displays loading spinner while query is loading", () => {
    // Return unresolved promise so query stays in loading state
    globalThis.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <CharacterContent
          characterId="char-loading"
          defaultType="items"
          allowedTypes={["items", "spells", "conditions"]}
        />
      </QueryClientProvider>
    );

    // Spinner should be visible
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("displays error toast when gallery query fails", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        statusText: "Internal Server Error",
        json: () => Promise.resolve({ error: "Falha interna no servidor" }),
      })
    );

    render(
      <QueryClientProvider client={queryClient}>
        <CharacterContent
          characterId="char-err"
          defaultType="items"
          allowedTypes={["items", "spells", "conditions"]}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Erro ao carregar conteúdo")).toBeInTheDocument();
    });
  });

  it("displays error toast with API message when skills query fails", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        statusText: "Forbidden",
        json: () => Promise.resolve({ error: "Personagem não pertence ao usuário" }),
      })
    );

    render(
      <QueryClientProvider client={queryClient}>
        <CharacterContent
          characterId="char-skills-err"
          defaultType="skills"
          allowedTypes={["skills"]}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Personagem não pertence ao usuário")).toBeInTheDocument();
    });
  });

  it("invalidates the query and refetches when a condition is unlinked", async () => {
    let conditionRemoved = false;

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        conditionRemoved = true;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      if (url.includes("/content/conditions")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                linked: conditionRemoved
                  ? []
                  : [
                      {
                        junction: { id: "cond-j99", permanent: false },
                        content: { id: "cond-99", name: "Fatigado" },
                      },
                    ],
                available: [],
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { linked: [], available: [] } }),
      });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CharacterContent
          characterId="char-unlink"
          defaultType="items"
          allowedTypes={["items", "spells", "conditions"]}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Fatigado")).toBeInTheDocument();
    });

    // Click "Remover" button on the condition card
    const removeButton = screen.getByRole("button", { name: "Remover" });
    fireEvent.click(removeButton);

    // Condition should be removed and empty state shown after invalidation
    await waitFor(() => {
      expect(screen.getByText("Nenhuma condição ativa")).toBeInTheDocument();
    });
    expect(screen.queryByText("Fatigado")).not.toBeInTheDocument();
  });
});
