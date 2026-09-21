import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CharacterDetail } from "../CharacterDetail";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "char-sticky-test-123" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    isConnected: true,
    joinCampaign: vi.fn(),
    subscribeInitiativeRequest: vi.fn(() => vi.fn()),
    subscribeDefenseRequest: vi.fn(() => vi.fn()),
    subscribeCombatState: vi.fn(() => vi.fn()),
    subscribeActorStatus: vi.fn(() => vi.fn()),
    subscribeDuelInvite: vi.fn(() => vi.fn()),
    subscribeDuelResponse: vi.fn(() => vi.fn()),
    subscribeDuelState: vi.fn(() => vi.fn()),
    subscribeDuelFinish: vi.fn(() => vi.fn()),
    rollDice: vi.fn(),
    updateActorStatus: vi.fn(),
    respondDefenseReaction: vi.fn(),
    updateCombatState: vi.fn(),
    updateDuelState: vi.fn(),
  }),
  DICE_ROLL_LOADING_DELAY: 10,
}));

vi.mock("@/components/characters/CharacterContent", () => ({
  CharacterContent: () => <div data-testid="character-content">Character Content</div>,
}));

vi.mock("@/components/characters/ShareLink", () => ({
  ShareLink: () => <div>ShareLink</div>,
}));

vi.mock("@/components/characters/ImageUpload", () => ({
  ImageUpload: () => <div>ImageUpload</div>,
}));

vi.mock("@/components/characters/NfcManager", () => ({
  NfcManager: () => <div>NfcManager</div>,
}));

const mockCharacter = {
  id: "char-sticky-test-123",
  name: "Thorin Oakenshield",
  level: 3,
  race: "anão",
  className: "guerreiro",
  imageUrl: "https://example.com/avatar.jpg",
  hitPointsCurrent: 14,
  hitPointsMax: 28,
  manaPointsCurrent: 6,
  manaPointsMax: 12,
  xp: 250,
  attributes: {
    forca: 16,
    destreza: 12,
    vigor: 15,
    inteligencia: 10,
    empatia: 8,
  },
  campaignId: "camp-sticky-123",
};

describe("CharacterDetail - Sticky Character Summary (Issue #11)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    global.fetch = vi.fn((url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/characters/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockCharacter }),
        } as Response);
      }
      if (urlStr.includes("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ user: { shadowPoints: 0 } }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
    });
  });

  it("renderiza o card de resumo com classes sticky e atributos essenciais de fixação no topo", async () => {
    render(<CharacterDetail />);

    await waitFor(() => {
      expect(screen.getByText("Thorin Oakenshield")).toBeInTheDocument();
    });

    const summaryCard = screen.getByTestId("character-status-summary");
    expect(summaryCard).toBeInTheDocument();

    // Valida posicionamento sticky
    expect(summaryCard.className).toContain("sticky");
    expect(summaryCard.className).toContain("top-14");
    expect(summaryCard.className).toContain("z-30");
    expect(summaryCard.className).toContain("backdrop-blur-md");

    // Valida que os elementos obrigatórios estão dentro do resumo fixo
    expect(summaryCard).toHaveTextContent("Thorin Oakenshield");
    expect(summaryCard).toHaveTextContent("Nível 3");
    expect(summaryCard).toHaveTextContent("14 / 28"); // Vida
    expect(summaryCard).toHaveTextContent("6 / 12"); // Mana
    expect(summaryCard).toHaveTextContent("50 / 100 XP"); // Progresso XP (250 % 100 = 50)
    
    // Foto do personagem
    const avatar = screen.getByAltText("Thorin Oakenshield");
    expect(summaryCard).toContainElement(avatar);
  });

  it("renderiza os blocos de atributos principais após o card de resumo", async () => {
    render(<CharacterDetail />);

    await waitFor(() => {
      expect(screen.getByText("Thorin Oakenshield")).toBeInTheDocument();
    });

    const summaryCard = screen.getByTestId("character-status-summary");
    const attributesHeading = screen.getByText("Atributos Principais");
    
    expect(attributesHeading).toBeInTheDocument();
    // Atributos não estão contidos no card de resumo (ficam abaixo dele na árvore)
    expect(summaryCard).not.toContainElement(attributesHeading);
  });

  it("permanece visível ao alternar para a aba 'skills' ou 'inventory'", async () => {
    render(<CharacterDetail />);

    await waitFor(() => {
      expect(screen.getByText("Thorin Oakenshield")).toBeInTheDocument();
    });

    const summaryCard = screen.getByTestId("character-status-summary");
    expect(summaryCard).toBeInTheDocument();

    // Alterna para a aba "skills" (Perícias)
    const skillsTabButton = screen.getByRole("button", { name: /perícias/i });
    fireEvent.click(skillsTabButton);

    expect(screen.getByTestId("character-status-summary")).toBeInTheDocument();
    expect(summaryCard).toHaveTextContent("Thorin Oakenshield");

    // Alterna para a aba "inventory" (Inventário)
    const inventoryTabButton = screen.getByRole("button", { name: /inventário/i });
    fireEvent.click(inventoryTabButton);

    expect(screen.getByTestId("character-status-summary")).toBeInTheDocument();
    expect(summaryCard).toHaveTextContent("Thorin Oakenshield");
  });
});
