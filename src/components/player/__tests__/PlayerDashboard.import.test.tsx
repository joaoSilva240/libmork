// =============================================================================
// Libmork — PlayerDashboard: Import Character Modal Tests
// =============================================================================

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PlayerDashboard } from "../PlayerDashboard";

vi.mock("@/components/characters/CharacterCard", () => ({
  CharacterCard: ({ character }: { character: { name: string } }) => <div>{character.name}</div>,
}));

vi.mock("@/components/auth/LogoutButton", () => ({ LogoutButton: () => null }));

describe("PlayerDashboard - Import Character Modal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should open the import modal when clicking 'Importar Personagem Existente' button", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/characters") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "char-1",
                  name: "Hero Alpha",
                  level: 3,
                  hitPointsCurrent: 25,
                  hitPointsMax: 30,
                  imageUrl: null,
                },
                {
                  id: "char-2",
                  name: "Hero Beta",
                  level: 5,
                  hitPointsCurrent: 40,
                  hitPointsMax: 40,
                  imageUrl: null,
                },
              ],
            }),
        });
      }
      if (url === "/api/player/campaigns") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "camp-1",
                  name: "Test Campaign",
                  pvpEnabled: false,
                  rulesEngine: "dual_d20_sum",
                  master: { displayName: "Master User" },
                  characters: [],
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<PlayerDashboard />);

    // Switch to campaigns tab
    const campaignsTab = screen.getByText("Campanhas");
    fireEvent.click(campaignsTab);

    // Wait for campaigns tab content to load
    await waitFor(() => {
      expect(screen.getByText("Test Campaign")).toBeInTheDocument();
    });

    // Click the campaign card to open overlay
    const campaignCard = screen.getByRole("button", { name: /Ver detalhes da campanha Test Campaign/i });
    fireEvent.click(campaignCard);

    // Click the import button inside the overlay
    const importButton = await screen.findByText("↩ Importar Personagem Existente");
    fireEvent.click(importButton);

    // Modal should be visible
    await waitFor(() => {
      expect(screen.getByText("Importar Personagem")).toBeInTheDocument();
    });

    // Both characters should be listed in the modal
    expect(screen.getByText("Hero Alpha")).toBeInTheDocument();
    expect(screen.getByText("Hero Beta")).toBeInTheDocument();
  });

  it("should filter characters by name in the import modal search box", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/characters") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                { id: "char-1", name: "Aragorn", level: 10, hitPointsCurrent: 80, hitPointsMax: 80 },
                { id: "char-2", name: "Legolas", level: 9, hitPointsCurrent: 60, hitPointsMax: 60 },
                { id: "char-3", name: "Gimli", level: 8, hitPointsCurrent: 90, hitPointsMax: 90 },
              ],
            }),
        });
      }
      if (url === "/api/player/campaigns") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "camp-1",
                  name: "Middle Earth",
                  pvpEnabled: false,
                  rulesEngine: "d20_plus_modifier",
                  master: { displayName: "Tolkien" },
                  characters: [],
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<PlayerDashboard />);

    const campaignsTab = screen.getByText("Campanhas");
    fireEvent.click(campaignsTab);

    await waitFor(() => {
      expect(screen.getByText("Middle Earth")).toBeInTheDocument();
    });

    const campaignCard = screen.getByRole("button", { name: /Ver detalhes da campanha/i });
    fireEvent.click(campaignCard);
    const importButton = await screen.findByText("↩ Importar Personagem Existente");
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(screen.getByText("Importar Personagem")).toBeInTheDocument();
    });

    // All three characters visible initially
    expect(screen.getByText("Aragorn")).toBeInTheDocument();
    expect(screen.getByText("Legolas")).toBeInTheDocument();
    expect(screen.getByText("Gimli")).toBeInTheDocument();

    // Type "leg" in the search box
    const searchInput = screen.getByPlaceholderText("Buscar por nome...");
    fireEvent.change(searchInput, { target: { value: "leg" } });

    // Only Legolas should remain
    expect(screen.queryByText("Aragorn")).not.toBeInTheDocument();
    expect(screen.getByText("Legolas")).toBeInTheDocument();
    expect(screen.queryByText("Gimli")).not.toBeInTheDocument();
  });

  it("should submit import successfully and refetch campaigns list", async () => {
    let importCalled = false;

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/characters") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                { id: "char-100", name: "Imported Hero", level: 4, hitPointsCurrent: 35, hitPointsMax: 35 },
              ],
            }),
        });
      }
      if (url === "/api/player/campaigns" && !importCalled) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "camp-200",
                  name: "Campaign Alpha",
                  pvpEnabled: false,
                  rulesEngine: "dual_d20_sum",
                  master: { displayName: "GM" },
                  characters: [],
                },
              ],
            }),
        });
      }
      if (url === "/api/player/campaigns" && importCalled) {
        // After import, return updated data with the character
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "camp-200",
                  name: "Campaign Alpha",
                  pvpEnabled: false,
                  rulesEngine: "dual_d20_sum",
                  master: { displayName: "GM" },
                  characters: [
                    { id: "char-100", name: "Imported Hero", level: 4, hitPointsCurrent: 35, hitPointsMax: 35 },
                  ],
                },
              ],
            }),
        });
      }
      if (url === "/api/campaigns/camp-200/import-character" && init?.method === "POST") {
        importCalled = true;
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<PlayerDashboard />);

    const campaignsTab = screen.getByText("Campanhas");
    fireEvent.click(campaignsTab);

    await waitFor(() => {
      expect(screen.getByText("Campaign Alpha")).toBeInTheDocument();
    });

    const campaignCard = screen.getByRole("button", { name: /Ver detalhes da campanha/i });
    fireEvent.click(campaignCard);
    const importButton = await screen.findByText("↩ Importar Personagem Existente");
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(screen.getByText("Importar Personagem")).toBeInTheDocument();
    });

    // Click "Vincular" button
    const vincularButton = screen.getByRole("button", { name: "Vincular" });
    fireEvent.click(vincularButton);

    // Success toast should appear
    await waitFor(() => {
      expect(screen.getByText("Personagem vinculado com sucesso!")).toBeInTheDocument();
    });

    // Modal should close
    expect(screen.queryByText("Importar Personagem")).not.toBeInTheDocument();
  });

  it("should display warning toast when attempting to import a character already in the campaign (409)", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/characters") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                { id: "char-dup", name: "Duplicate Hero", level: 2, hitPointsCurrent: 20, hitPointsMax: 20 },
              ],
            }),
        });
      }
      if (url === "/api/player/campaigns") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "camp-dup",
                  name: "Duplicate Campaign",
                  pvpEnabled: false,
                  rulesEngine: "d20_plus_modifier",
                  master: { displayName: "GM" },
                  characters: [],
                },
              ],
            }),
        });
      }
      if (url === "/api/campaigns/camp-dup/import-character" && init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ error: "Este personagem já está nesta campanha" }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<PlayerDashboard />);

    const campaignsTab = screen.getByText("Campanhas");
    fireEvent.click(campaignsTab);

    await waitFor(() => {
      expect(screen.getByText("Duplicate Campaign")).toBeInTheDocument();
    });

    const campaignCard = screen.getByRole("button", { name: /Ver detalhes da campanha/i });
    fireEvent.click(campaignCard);
    const importButton = await screen.findByText("↩ Importar Personagem Existente");
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(screen.getByText("Importar Personagem")).toBeInTheDocument();
    });

    const vincularButton = screen.getByRole("button", { name: "Vincular" });
    fireEvent.click(vincularButton);

    // Warning toast should appear
    await waitFor(() => {
      expect(screen.getByText("Este personagem já está nesta campanha")).toBeInTheDocument();
    });
  });

  it("should show info toast when no characters are available to import", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/characters") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                { id: "char-linked", name: "Already Linked", level: 1, hitPointsCurrent: 0, hitPointsMax: 10 },
              ],
            }),
        });
      }
      if (url === "/api/player/campaigns") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "camp-full",
                  name: "Full Campaign",
                  pvpEnabled: false,
                  rulesEngine: "dual_d20_sum",
                  master: { displayName: "GM" },
                  characters: [
                    { id: "char-linked", name: "Already Linked", level: 1, hitPointsCurrent: 0, hitPointsMax: 10 },
                  ],
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<PlayerDashboard />);

    const campaignsTab = screen.getByText("Campanhas");
    fireEvent.click(campaignsTab);

    await waitFor(() => {
      expect(screen.getByText("Full Campaign")).toBeInTheDocument();
    });

    const campaignCard = screen.getByRole("button", { name: /Ver detalhes da campanha/i });
    fireEvent.click(campaignCard);
    const importButton = await screen.findByText("↩ Importar Personagem Existente");
    fireEvent.click(importButton);

    // Toast should appear instead of modal
    await waitFor(() => {
      expect(screen.getByText("Você não tem personagens para importar")).toBeInTheDocument();
    });

    // Modal should NOT be visible
    expect(screen.queryByText("Importar Personagem")).not.toBeInTheDocument();
  });

  it("should render campaign modal with roster, player character details, and badges", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/characters") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      if (url === "/api/player/campaigns") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "camp-hero",
                  name: "Epic Quest",
                  description: "Uma jornada lendária pelos reinos perdidos.",
                  rulesEngine: "d20_mod",
                  pvpEnabled: true,
                  worldMapUrl: "https://example.com/map.jpg",
                  coverImageUrl: "https://example.com/cover.jpg",
                  master: { displayName: "Dungeon Master" },
                  characters: [
                    {
                      id: "char-player-1",
                      name: "Sir Lancelot",
                      imageUrl: "https://example.com/lancelot.png",
                      level: 5,
                      hitPointsCurrent: 45,
                      hitPointsMax: 50,
                      manaPointsCurrent: 20,
                      manaPointsMax: 20,
                    },
                  ],
                  roster: [
                    {
                      id: "char-player-1",
                      name: "Sir Lancelot",
                      imageUrl: "https://example.com/lancelot.png",
                      isMine: true,
                    },
                    {
                      id: "char-ally-2",
                      name: "Gandalf",
                      imageUrl: null,
                      isMine: false,
                    },
                  ],
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<PlayerDashboard />);

    // Navegar para a aba de Campanhas
    const campaignsTab = screen.getByText("Campanhas");
    fireEvent.click(campaignsTab);

    await waitFor(() => {
      expect(screen.getByText("Epic Quest")).toBeInTheDocument();
    });

    // Abrir o modal de detalhes
    const campaignCard = screen.getByRole("button", { name: /Ver detalhes da campanha Epic Quest/i });
    fireEvent.click(campaignCard);

    // Verificar banner, badges e dados
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Epic Quest", level: 2 })).toBeInTheDocument();
      expect(screen.getByText(/PvP Habilitado/i)).toBeInTheDocument();
      expect(screen.getByText(/Mapa Mundi/i)).toBeInTheDocument();
      expect(screen.getByText("Uma jornada lendária pelos reinos perdidos.")).toBeInTheDocument();
    });

    // Seção de Meus Personagens nesta campanha
    expect(screen.getByText(/Meus Personagens nesta campanha/i)).toBeInTheDocument();
    expect(screen.getAllByText("Sir Lancelot").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Nível 5/i)).toBeInTheDocument();
    expect(screen.getByText(/HP 45\/50/i)).toBeInTheDocument();
    expect(screen.getByText(/Mana 20\/20/i)).toBeInTheDocument();

    // Botão Abrir Ficha
    const openSheetButton = screen.getByRole("link", { name: /Abrir Ficha/i });
    expect(openSheetButton).toHaveAttribute("href", "/player/characters/char-player-1");

    // Como Sir Lancelot tem HP 45 (> 0), os botões de criar e importar NÃO devem aparecer
    expect(screen.queryByText("+ Criar Personagem nesta Campanha")).not.toBeInTheDocument();
    expect(screen.queryByText("↩ Importar Personagem Existente")).not.toBeInTheDocument();

    // Roster da mesa não deve mais ser exibido
    expect(screen.queryByText(/Personagens da Mesa \(Roster\)/i)).not.toBeInTheDocument();
  });

  it("should show create and import buttons when character is dead (hitPointsCurrent <= 0)", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/characters") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      if (url === "/api/player/campaigns") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "camp-dead-char",
                  name: "Graveyard Campaign",
                  pvpEnabled: false,
                  rulesEngine: "d20_mod",
                  master: { displayName: "Grim Reaper" },
                  characters: [
                    {
                      id: "char-dead-1",
                      name: "Fallen Hero",
                      level: 2,
                      hitPointsCurrent: 0,
                      hitPointsMax: 20,
                      manaPointsCurrent: 0,
                      manaPointsMax: 10,
                    },
                  ],
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<PlayerDashboard />);

    const campaignsTab = screen.getByText("Campanhas");
    fireEvent.click(campaignsTab);

    await waitFor(() => {
      expect(screen.getByText("Graveyard Campaign")).toBeInTheDocument();
    });

    const campaignCard = screen.getByRole("button", { name: /Ver detalhes da campanha Graveyard Campaign/i });
    fireEvent.click(campaignCard);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Graveyard Campaign", level: 2 })).toBeInTheDocument();
    });

    // Como o personagem está com HP 0 (morto), os botões de criar e importar devem ser exibidos
    expect(screen.getByText("+ Criar Personagem nesta Campanha")).toBeInTheDocument();
    expect(screen.getByText("↩ Importar Personagem Existente")).toBeInTheDocument();
  });
});
