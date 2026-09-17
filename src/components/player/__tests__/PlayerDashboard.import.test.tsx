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

    // Click the import button
    const importButton = screen.getByText("↩ Importar Personagem Existente");
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

    const importButton = screen.getByText("↩ Importar Personagem Existente");
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

    const importButton = screen.getByText("↩ Importar Personagem Existente");
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

    const importButton = screen.getByText("↩ Importar Personagem Existente");
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
                { id: "char-linked", name: "Already Linked", level: 1, hitPointsCurrent: 10, hitPointsMax: 10 },
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
                    { id: "char-linked", name: "Already Linked", level: 1, hitPointsCurrent: 10, hitPointsMax: 10 },
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

    const importButton = screen.getByText("↩ Importar Personagem Existente");
    fireEvent.click(importButton);

    // Toast should appear instead of modal
    await waitFor(() => {
      expect(screen.getByText("Você não tem personagens para importar")).toBeInTheDocument();
    });

    // Modal should NOT be visible
    expect(screen.queryByText("Importar Personagem")).not.toBeInTheDocument();
  });
});
