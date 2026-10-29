import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MissingHabitantCreateForm } from "../MissingHabitantCreateForm";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("MissingHabitantCreateForm Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renderiza campos de nome, 5 linhas iniciais e 3 slots de equipamento", () => {
    render(<MissingHabitantCreateForm />);

    expect(screen.getByPlaceholderText(/Arthur Pendelton/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Memória \/ Fato 1/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Memória \/ Fato 5/i)).toBeInTheDocument();
    expect(screen.getByText("Linhas: 5/10")).toBeInTheDocument();

    expect(screen.getByText("Slot 01")).toBeInTheDocument();
    expect(screen.getByText("Slot 02")).toBeInTheDocument();
    expect(screen.getByText("Slot 03")).toBeInTheDocument();
  });

  it("rola 2d6 na tabela oficial e preenche o equipamento do slot", () => {
    render(<MissingHabitantCreateForm />);

    const rollButtons = screen.getAllByRole("button", { name: /Rolar 2d6/i });
    expect(rollButtons).toHaveLength(3);

    // Clica para rolar no Slot 1
    fireEvent.click(rollButtons[0]);

    const item1Input = screen.getByPlaceholderText("Item 1...") as HTMLInputElement;
    expect(item1Input.value.length).toBeGreaterThan(0);
  });

  it("permite adicionar linhas de memória até o limite de 10", () => {
    render(<MissingHabitantCreateForm />);

    const addBtn = screen.getByRole("button", { name: /\+ Adicionar Linha/i });
    for (let i = 0; i < 5; i++) {
      fireEvent.click(addBtn);
    }

    expect(screen.getByText("Linhas: 10/10")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+ Adicionar Linha/i })).not.toBeInTheDocument();
  });

  it("envia os dados via POST /api/systems/missing/habitants e redireciona para /player", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: "hab-123", name: "Agente Carlton" },
      }),
    } as any);

    render(<MissingHabitantCreateForm campaignId="camp-999" />);

    // Preenche Nome
    fireEvent.change(screen.getByPlaceholderText(/Arthur Pendelton/i), {
      target: { value: "Agente Carlton" },
    });

    // Preenche as 5 memórias
    for (let i = 1; i <= 5; i++) {
      fireEvent.change(screen.getByPlaceholderText(new RegExp(`Memória / Fato ${i}`, "i")), {
        target: { value: `Fato de teste ${i} com detalhes do passado` },
      });
    }

    // Preenche 3 equipamentos
    for (let i = 1; i <= 3; i++) {
      fireEvent.change(screen.getByPlaceholderText(new RegExp(`Item ${i}`, "i")), {
        target: { value: `Item Especial ${i}` },
      });
    }

    // Submete
    fireEvent.click(screen.getByRole("button", { name: /Registrar Habitante/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/systems/missing/habitants",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("Agente Carlton"),
        }),
      );
      expect(mockPush).toHaveBeenCalledWith("/player");
    });
  });

  it("exibe mensagem de erro se a requisição falhar", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: "Erro no banco de dados",
      }),
    } as any);

    render(<MissingHabitantCreateForm />);

    fireEvent.change(screen.getByPlaceholderText(/Arthur Pendelton/i), {
      target: { value: "Agente Falha" },
    });

    for (let i = 1; i <= 5; i++) {
      fireEvent.change(screen.getByPlaceholderText(new RegExp(`Memória / Fato ${i}`, "i")), {
        target: { value: `Fato de teste ${i}` },
      });
    }

    for (let i = 1; i <= 3; i++) {
      fireEvent.change(screen.getByPlaceholderText(new RegExp(`Item ${i}`, "i")), {
        target: { value: `Item ${i}` },
      });
    }

    fireEvent.click(screen.getByRole("button", { name: /Registrar Habitante/i }));

    await waitFor(() => {
      expect(screen.getByText("Erro no banco de dados")).toBeInTheDocument();
    });
  });
});
