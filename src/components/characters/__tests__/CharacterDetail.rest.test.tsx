import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CharacterDetail } from "../CharacterDetail";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "char-rest-test-123" }),
  useRouter: () => ({ push: vi.fn() }),
}));

const mockUpdateActorStatus = vi.fn();
const mockUpdateCombatState = vi.fn();

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
    updateActorStatus: mockUpdateActorStatus,
    respondDefenseReaction: vi.fn(),
    updateCombatState: mockUpdateCombatState,
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
  id: "char-rest-test-123",
  name: "Thorin",
  level: 2,
  race: "anão",
  className: "guerreiro",
  hitPointsCurrent: 5,
  hitPointsMax: 20,
  manaPointsCurrent: 2,
  manaPointsMax: 10,
  attributes: {
    forca: 14,
    destreza: 10,
    vigor: 14, // mod +2
    inteligencia: 10,
    empatia: 10,
  },
  campaignId: "camp-rest-123",
};

describe("CharacterDetail - RestPopover Integration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renderiza o botão de descanso na aba status e executa o descanso com sucesso", async () => {
    let patchedBody: Record<string, unknown> | null = null;

    global.fetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/characters/char-rest-test-123") && init?.method === "PATCH") {
        patchedBody = JSON.parse(String(init.body));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { ...mockCharacter, ...patchedBody } }),
        } as Response);
      }
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

    render(<CharacterDetail />);

    // Aguarda carregar
    await waitFor(() => {
      expect(screen.getByText("Thorin")).toBeInTheDocument();
    });

    // Botão de descanso deve estar presente
    const restButton = screen.getByRole("button", { name: /descansar personagem/i });
    expect(restButton).toBeInTheDocument();

    // Clica no botão para abrir o popover
    fireEvent.click(restButton);

    // O menu deve estar aberto com as opções de descanso
    expect(screen.getByText("Descanso Confortável")).toBeInTheDocument();

    // Seleciona Descanso Confortável (1/2 de 20 = 10, vigor 14 -> mod +2 = +12 HP. 5 + 12 = 17)
    // Mana: 1/2 de 10 = 5, + 2 = +7 MP. 2 + 7 = 9
    const comfortableOption = screen.getByRole("menuitem", { name: /descanso confortável/i });
    fireEvent.click(comfortableOption);

    // Aguarda a chamada de PATCH e toast
    await waitFor(() => {
      expect(patchedBody).toEqual({
        hitPointsCurrent: 17,
        manaPointsCurrent: 9,
      });
    });

    // Toast de sucesso deve ser exibido
    await waitFor(() => {
      expect(screen.getByText(/Descanso Confortável: recuperados \+12 HP e \+7 MP/i)).toBeInTheDocument();
    });

    // Verifica que updateActorStatus do socket foi chamado
    expect(mockUpdateActorStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "camp-rest-123",
        actorId: "char-rest-test-123",
        currentHp: 17,
        currentMana: 9,
      })
    );
  });

  it("exibe aviso quando a vida e a mana já estão no máximo", async () => {
    const fullCharacter = {
      ...mockCharacter,
      hitPointsCurrent: 20,
      manaPointsCurrent: 10,
    };

    global.fetch = vi.fn((url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/characters/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: fullCharacter }),
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

    render(<CharacterDetail />);

    await waitFor(() => {
      expect(screen.getByText("Thorin")).toBeInTheDocument();
    });

    const restButton = screen.getByRole("button", { name: /descansar personagem/i });
    fireEvent.click(restButton);

    const luxuriousOption = screen.getByRole("menuitem", { name: /descanso luxuoso/i });
    fireEvent.click(luxuriousOption);

    await waitFor(() => {
      expect(
        screen.getByText("Você já está com a vida e a mana totalmente recuperadas!")
      ).toBeInTheDocument();
    });
  });

  it("reverte os valores em caso de erro na requisição", async () => {
    global.fetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/characters/char-rest-test-123") && init?.method === "PATCH") {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Erro interno" }),
        } as Response);
      }
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

    render(<CharacterDetail />);

    await waitFor(() => {
      expect(screen.getByText("Thorin")).toBeInTheDocument();
    });

    const restButton = screen.getByRole("button", { name: /descansar personagem/i });
    fireEvent.click(restButton);

    const comfortableOption = screen.getByRole("menuitem", { name: /descanso confortável/i });
    fireEvent.click(comfortableOption);

    await waitFor(() => {
      expect(
        screen.getByText("Falha ao salvar descanso. Tente novamente.")
      ).toBeInTheDocument();
    });
  });
});
