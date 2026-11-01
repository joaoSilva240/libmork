// =============================================================================
// Libmork — PlayerDashboard: Toggle de Visualização (Galeria vs Lista)
// =============================================================================

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PlayerDashboard } from "../PlayerDashboard";
import type { Character } from "@/types";
import type { MissingHabitant } from "@/lib/systems/missing/types";

vi.mock("@/components/auth/LogoutButton", () => ({
  LogoutButton: () => <button data-testid="logout-button">Sair</button>,
}));

const mockCharacter: Character = {
  id: "char-1",
  ownerId: "u-1",
  classId: "class-1",
  raceId: "race-1",
  activeHeritages: [],
  name: "Artemis Shadowalker",
  imageUrl: "https://example.com/artemis.jpg",
  hitPointsMax: 25,
  hitPointsCurrent: 20,
  manaPointsMax: 15,
  manaPointsCurrent: 10,
  attributes: {
    forca: 14,
    destreza: 18,
    vigor: 12,
    inteligencia: 14,
    empatia: 10,
    sorte: 12,
  },
  level: 5,
  xp: 1200,
  block: 14,
  deathStatus: "alive",
  deathSuccesses: 0,
  deathFailures: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-15"),
  className: "Ladino",
  raceName: "Elfo",
  campaignName: "Sombras de Arton",
  campaignId: "camp-1",
};

const mockHabitant: MissingHabitant = {
  id: "hab-1",
  campaignId: null,
  ownerId: "u-1",
  name: "Detetive John Doe",
  status: "active",
  lines: [
    { id: "l-1", index: 1, text: "Memória 1: Chegada na cidade", isErased: false },
    { id: "l-2", index: 2, text: "Memória 2: O quarto do hotel", isErased: false },
  ],
  equipments: [
    { id: "eq-1", slot: 1, name: "Lanterna Antiga", notes: "Luz amarelada", status: "active" },
    { id: "eq-2", slot: 2, name: "Gravador de Rolo", notes: "Sem fita", status: "active" },
    { id: "eq-3", slot: 3, name: "Caderno Pautado", notes: "Anotações ilegíveis", status: "lost" },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("PlayerDashboard - Toggle de Visualização (Galeria vs Lista)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/auth/me") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                id: "u-1",
                email: "artemis@libmork.com",
                displayName: "Artemis",
                role: "player",
              },
            }),
        });
      }

      if (url === "/api/characters") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [mockCharacter] }),
        });
      }

      if (url === "/api/systems/missing/habitants") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [mockHabitant] }),
        });
      }

      if (url === "/api/player/campaigns") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }

      if (url === "/api/player/wealth") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: null }),
        });
      }

      return Promise.resolve({ ok: false });
    });
  });

  it("renderiza os botões de alternância de visualização com ícones e acessibilidade", async () => {
    render(<PlayerDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Meus Personagens")).toBeInTheDocument();
    });

    const galleryButton = screen.getByRole("button", { name: "Visualizar como galeria" });
    const listButton = screen.getByRole("button", { name: "Visualizar como lista" });

    expect(galleryButton).toBeInTheDocument();
    expect(listButton).toBeInTheDocument();

    // Galeria deve vir selecionada por padrão
    expect(galleryButton).toHaveAttribute("aria-pressed", "true");
    expect(listButton).toHaveAttribute("aria-pressed", "false");
  });

  it("renderiza todos os detalhes do personagem no modo galeria (padrão)", async () => {
    render(<PlayerDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Artemis Shadowalker")).toBeInTheDocument();
    });

    // Elementos detalhados presentes no modo galeria
    expect(screen.getByText(/Nv\. 5 · Ladino/)).toBeInTheDocument();
    expect(screen.getByText("💚 Vivo")).toBeInTheDocument();
    expect(screen.getByText(/HP 20\/25/)).toBeInTheDocument();
    expect(screen.getByText(/Mana 10\/15/)).toBeInTheDocument();
    expect(screen.getByText(/Bloqueio:/)).toBeInTheDocument();
    expect(screen.getByText(/XP: 1200/)).toBeInTheDocument();
    expect(screen.getByText(/Campanha: Sombras de Arton/)).toBeInTheDocument();
    expect(screen.getByLabelText("Gráfico de atributos do personagem")).toBeInTheDocument();

    // Missing habitant em modo galeria exibe detalhes
    expect(screen.getByText("Detetive John Doe")).toBeInTheDocument();
    expect(screen.getByText(/linhas de memórias legíveis/)).toBeInTheDocument();
    expect(screen.getByText(/itens disponíveis/)).toBeInTheDocument();
  });

  it("ao alternar para modo lista, oculta elementos detalhados e mantém apenas avatar, nome e tag nível/classe", async () => {
    render(<PlayerDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Artemis Shadowalker")).toBeInTheDocument();
    });

    const listButton = screen.getByRole("button", { name: "Visualizar como lista" });
    const galleryButton = screen.getByRole("button", { name: "Visualizar como galeria" });

    fireEvent.click(listButton);

    expect(listButton).toHaveAttribute("aria-pressed", "true");
    expect(galleryButton).toHaveAttribute("aria-pressed", "false");

    // Elementos essenciais mantidos no modo lista
    expect(screen.getByText("Artemis Shadowalker")).toBeInTheDocument();
    expect(screen.getByText(/Nv\. 5 · Ladino/)).toBeInTheDocument();
    const characterLink = screen.getByRole("link", { name: "Ver ficha de Artemis Shadowalker" });
    expect(characterLink).toHaveAttribute("href", "/player/characters/char-1");

    const avatarImg = screen.getByAltText("Artemis Shadowalker");
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute("src", "https://example.com/artemis.jpg");

    // Elementos detalhados DEVEM ser ocultados
    expect(screen.queryByText("💚 Vivo")).not.toBeInTheDocument();
    expect(screen.queryByText(/HP 20\/25/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mana 10\/15/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bloqueio:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/XP: 1200/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Campanha: Sombras de Arton/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Gráfico de atributos do personagem")).not.toBeInTheDocument();

    // Missing habitant em modo lista também oculta contadores detalhados
    expect(screen.getByText("Detetive John Doe")).toBeInTheDocument();
    expect(screen.queryByText(/linhas de memórias legíveis/)).not.toBeInTheDocument();
    expect(screen.queryByText(/itens disponíveis/)).not.toBeInTheDocument();
  });

  it("permite alternar de volta para o modo galeria", async () => {
    render(<PlayerDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Artemis Shadowalker")).toBeInTheDocument();
    });

    const listButton = screen.getByRole("button", { name: "Visualizar como lista" });
    const galleryButton = screen.getByRole("button", { name: "Visualizar como galeria" });

    // Alterna para lista
    fireEvent.click(listButton);
    expect(screen.queryByText(/HP 20\/25/)).not.toBeInTheDocument();

    // Alterna de volta para galeria
    fireEvent.click(galleryButton);
    expect(galleryButton).toHaveAttribute("aria-pressed", "true");
    expect(listButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/HP 20\/25/)).toBeInTheDocument();
    expect(screen.getByLabelText("Gráfico de atributos do personagem")).toBeInTheDocument();
  });
});
