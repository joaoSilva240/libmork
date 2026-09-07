import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CharacterDetail } from "../CharacterDetail";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "char-toast-test-123" }),
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
  id: "char-toast-test-123",
  name: "Gildor",
  level: 1,
  race: "humano",
  className: "mago",
  hitPointsCurrent: 12,
  hitPointsMax: 12,
  manaPointsCurrent: 6,
  manaPointsMax: 6,
  attributes: {
    forca: 10,
    destreza: 12,
    vigor: 10,
    inteligencia: 16,
    empatia: 10,
  },
  campaignId: "camp-123",
};

describe("CharacterDetail - Skills Toast Flutuante Persistente (#UI-003)", () => {
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
          json: () => Promise.resolve({ user: { shadowPoints: 2 } }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
    });
  });

  it("exibe o toast flutuante na aba de perícias quando não dispensado previamente", async () => {
    render(<CharacterDetail />);

    // Espera carregar a ficha
    await waitFor(() => {
      expect(screen.getByText("Gildor")).toBeInTheDocument();
    });

    // Clica na aba de perícias (ícone ou botão)
    const skillsTabButton = screen.getByRole("button", { name: /perícias/i });
    fireEvent.click(skillsTabButton);

    // O toast flutuante deve estar presente com o texto e contagem
    const toastHeading = await screen.findByRole("heading", { name: "Perícias & Treinamento" });
    expect(toastHeading).toBeInTheDocument();
    expect(
      screen.getByText(/Slots de perícias treinadas disponíveis por Inteligência:/i)
    ).toBeInTheDocument();

    // Botão de dispensar com aria-label correto
    const dismissButton = screen.getByRole("button", { name: "Fechar e não mostrar novamente" });
    expect(dismissButton).toBeInTheDocument();
  });

  it("dispensa o toast ao clicar no botão '✕' e grava a preferência no localStorage", async () => {
    render(<CharacterDetail />);

    await waitFor(() => {
      expect(screen.getByText("Gildor")).toBeInTheDocument();
    });

    const skillsTabButton = screen.getByRole("button", { name: /perícias/i });
    fireEvent.click(skillsTabButton);

    const dismissButton = await screen.findByRole("button", { name: "Fechar e não mostrar novamente" });
    fireEvent.click(dismissButton);

    // Toast deve sumir
    expect(screen.queryByText("Perícias & Treinamento")).not.toBeInTheDocument();

    // Chave no localStorage deve estar com "true"
    expect(localStorage.getItem(`libmork_dismissed_skills_toast_${mockCharacter.id}`)).toBe("true");
  });

  it("não exibe o toast se já foi previamente dispensado no localStorage", async () => {
    localStorage.setItem(`libmork_dismissed_skills_toast_${mockCharacter.id}`, "true");

    render(<CharacterDetail />);

    await waitFor(() => {
      expect(screen.getByText("Gildor")).toBeInTheDocument();
    });

    const skillsTabButton = screen.getByRole("button", { name: /perícias/i });
    fireEvent.click(skillsTabButton);

    // O toast não deve aparecer
    expect(screen.queryByText("Perícias & Treinamento")).not.toBeInTheDocument();
  });
});
