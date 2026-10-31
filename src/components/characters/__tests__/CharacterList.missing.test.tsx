// =============================================================================
// Libmork — CharacterList: Exibição e Abertura de Ficha de Habitantes de MISSING
// =============================================================================

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CharacterList } from "../CharacterList";
import type { MissingHabitant } from "@/lib/systems/missing/types";

vi.mock("@/components/characters/CharacterCard", () => ({
  CharacterCard: ({ character }: { character: { name: string } }) => (
    <div data-testid="character-card">{character.name}</div>
  ),
}));

vi.mock("@/components/auth/LogoutButton", () => ({ LogoutButton: () => null }));

describe("CharacterList - MISSING Habitants Integration", () => {
  const mockHabitant: MissingHabitant = {
    id: "hab-list-1",
    campaignId: null,
    ownerId: "user-1",
    name: "Detetive Thomas",
    status: "active",
    lines: [
      { id: "l-1", index: 1, text: "Memória 1", isErased: false },
      { id: "l-2", index: 2, text: "Memória 2", isErased: false },
      { id: "l-3", index: 3, text: "Memória 3", isErased: false },
      { id: "l-4", index: 4, text: "Memória 4", isErased: false },
      { id: "l-5", index: 5, text: "Memória 5", isErased: false },
    ],
    equipments: [
      { id: "eq-1", slot: 1, name: "Lanterna", notes: "", status: "active" },
      { id: "eq-2", slot: 2, name: "Chave", notes: "", status: "active" },
      { id: "eq-3", slot: 3, name: "Mapa", notes: "", status: "active" },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza o card do habitante e permite abrir a ficha", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/characters") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      if (url === "/api/systems/missing/habitants") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [mockHabitant] }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<CharacterList />);

    await waitFor(() => {
      expect(screen.getByText("Detetive Thomas")).toBeInTheDocument();
    });

    expect(screen.getByText("MISSING — Edição ZERO")).toBeInTheDocument();
    expect(screen.getByText("5 / 5 linhas de memórias legíveis")).toBeInTheDocument();

    // Clica no card
    fireEvent.click(screen.getByTestId("missing-habitant-card-hab-list-1"));

    await waitFor(() => {
      expect(screen.getByTestId("missing-habitant-sheet")).toBeInTheDocument();
    });

    // Fecha o modal
    const closeBtn = screen.getByRole("button", { name: "Fechar ficha" });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("missing-habitant-sheet")).not.toBeInTheDocument();
    });
  });
});
