import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CampaignForm } from "../CampaignForm";
import { ThemeProvider } from "@/context/ThemeContext";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("CampaignForm — Seleção de Tema na Criação (RF-Tema)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  const renderComponent = () => {
    return render(
      <ThemeProvider>
        <CampaignForm />
      </ThemeProvider>,
    );
  };

  it("renders theme selection block with title, mode filters, and AAA badges", () => {
    renderComponent();

    expect(screen.getByText("Tema Visual da Campanha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^todos$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^escuros$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^claros$/i })).toBeInTheDocument();

    // Verifica se os cards de tema aparecem
    expect(screen.getByText("Roxo Abissal")).toBeInTheDocument();
    expect(screen.getByText("Pergaminho RPG (Claro)")).toBeInTheDocument();
  });

  it("filters themes when clicking 'Escuros' or 'Claros'", () => {
    renderComponent();

    // Filtra para 'Escuros'
    fireEvent.click(screen.getByRole("button", { name: /^escuros$/i }));
    expect(screen.getByText("Roxo Abissal")).toBeInTheDocument();
    expect(screen.queryByText("Pergaminho RPG (Claro)")).not.toBeInTheDocument();

    // Filtra para 'Claros'
    fireEvent.click(screen.getByRole("button", { name: /^claros$/i }));
    expect(screen.queryByText("Roxo Abissal")).not.toBeInTheDocument();
    expect(screen.getByText("Pergaminho RPG (Claro)")).toBeInTheDocument();
    expect(screen.getByText("Alabastro Puro (Claro)")).toBeInTheDocument();
  });

  it("allows selecting a different theme and sends chosen theme on form submission", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { id: "new-camp-123" } }),
    });

    renderComponent();

    // Preenche nome
    const nameInput = screen.getByPlaceholderText(/As Crônicas de Morkvold/i);
    fireEvent.change(nameInput, { target: { value: "Campanha Âmbar e Ouro" } });

    // Seleciona o tema Âmbar
    const amberThemeCard = screen.getByText("Ouro & Âmbar Solar").closest("[role='radio']");
    expect(amberThemeCard).not.toBeNull();
    fireEvent.click(amberThemeCard!);

    // Submete o formulário
    const submitButton = screen.getByRole("button", { name: /Concluir e Criar Campanha/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const [url, options] = (global.fetch as any).mock.calls[0];
    expect(url).toBe("/api/campaigns");
    expect(options.method).toBe("POST");

    const payload = JSON.parse(options.body);
    expect(payload.name).toBe("Campanha Âmbar e Ouro");
    expect(payload.theme).toBe("amber-dark");
    expect(mockPush).toHaveBeenCalledWith("/master/campaigns/new-camp-123");
  });
});
