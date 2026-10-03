// =============================================================================
// Libmork — WealthManager Component Tests (Issue #36)
// =============================================================================

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { WealthManager, type WealthData } from "../WealthManager";

describe("WealthManager Component", () => {
  const mockData: WealthData = {
    totals: {
      bronze: 200,
      prata: 50,
      ouro: 120,
      platina: 5,
      diamante: 1,
    },
    characters: [
      {
        id: "char-1",
        name: "Arthur Pendragon",
        level: 5,
        coins: { bronze: 100, prata: 20, ouro: 80, platina: 3, diamante: 1 },
      },
      {
        id: "char-2",
        name: "Merlin Ambrosius",
        level: 4,
        coins: { bronze: 100, prata: 30, ouro: 40, platina: 2, diamante: 0 },
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should render consolidated vault cards and character coin grid with prominent gold total", () => {
    render(<WealthManager initialData={mockData} />);

    expect(screen.getByText("Cofre do Jogador & Tesouraria")).toBeInTheDocument();
    expect(screen.getAllByText(/Arthur Pendragon/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Merlin Ambrosius/i).length).toBeGreaterThanOrEqual(1);

    // Check consolidated gold equivalent highlighted
    // 1 diamante (1000) + 5 platina (50) + 120 ouro (120) + 50 prata (5) + 200 bronze (2) = 1177 PO
    expect(screen.getByText(/1\.177 PO/i)).toBeInTheDocument();

    // Modal should NOT be open by default
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    expect(screen.getByLabelText("Cofre Consolidado")).toHaveClass(
      "min-w-0",
      "max-w-full",
      "overflow-hidden",
    );
    const vault = screen.getByLabelText("Cofre Consolidado");
    const title = screen.getByRole("heading", { name: "Cofre do Jogador & Tesouraria" });
    const summary = screen.getByLabelText("Resumo consolidado de moedas");
    expect(title.closest("header")).toBeInTheDocument();
    expect(title.closest("header")).not.toContainElement(summary);
    expect(vault).toContainElement(summary);
    expect(screen.getByLabelText("Saldos por Personagem")).toHaveClass("min-w-0", "max-w-full");
  });

  it("should have transfer buttons on character cards with only icon and no 'Transferir' text", () => {
    render(<WealthManager initialData={mockData} />);

    const transferBtn = screen.getByLabelText("Transferir moedas de Arthur Pendragon");
    expect(transferBtn).toBeInTheDocument();
    expect(transferBtn.textContent).toBe("⇄");
    expect(transferBtn.textContent).not.toContain("Transferir");
  });

  it("should open transfer modal from character card button with pre-selected source", () => {
    render(<WealthManager initialData={mockData} />);

    // Click transfer on Arthur's card
    const transferArthurBtn = screen.getByLabelText("Transferir moedas de Arthur Pendragon");
    fireEvent.click(transferArthurBtn);

    // Modal is now open
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Transferir Moedas")).toBeInTheDocument();

    // Arthur should be pre-selected as source
    const sourceSelect = screen.getByLabelText(/Personagem de Origem/i) as HTMLSelectElement;
    expect(sourceSelect.value).toBe("char-1");

    // Arthur has 80 ouro
    expect(screen.getByText(/Saldo disponível de Ouro:/i)).toBeInTheDocument();
    expect(screen.getAllByText("80").length).toBeGreaterThanOrEqual(1);
  });

  it("should persist a character conversion from its currency summary", async () => {
    const handleRefresh = vi.fn();
    const handleToast = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    render(
      <WealthManager initialData={mockData} onRefresh={handleRefresh} onShowToast={handleToast} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ouro: 80" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Moeda de destino" }), {
      target: { value: "prata" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantidade" }), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar conversão" }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/characters/char-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            coins: { bronze: 100, prata: 30, ouro: 79, platina: 3, diamante: 1 },
          }),
        }),
      );
    });
    expect(handleToast).toHaveBeenCalledWith("Conversão realizada com sucesso!", "success");
    expect(handleRefresh).toHaveBeenCalled();
  });

  it("should fill max amount when clicking 'Máximo' in modal", () => {
    render(<WealthManager initialData={mockData} />);

    const transferArthurBtn = screen.getByLabelText("Transferir moedas de Arthur Pendragon");
    fireEvent.click(transferArthurBtn);

    const maxButton = screen.getByRole("button", { name: "Máximo" });
    fireEvent.click(maxButton);

    const amountInput = screen.getByLabelText(/Quantidade a Transferir/i) as HTMLInputElement;
    expect(amountInput.value).toBe("80");
  });

  it("should validate and call transfer API on submit, closing modal and updating logs", async () => {
    const handleRefresh = vi.fn();
    const handleToast = vi.fn();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, message: "Transferência realizada com sucesso" }),
    });

    render(
      <WealthManager initialData={mockData} onRefresh={handleRefresh} onShowToast={handleToast} />,
    );

    // Open transfer modal for Arthur
    const transferArthurBtn = screen.getByLabelText("Transferir moedas de Arthur Pendragon");
    fireEvent.click(transferArthurBtn);

    const targetSelect = screen.getByLabelText(/Personagem de Destino/i);
    fireEvent.change(targetSelect, { target: { value: "char-2" } });

    const amountInput = screen.getByLabelText(/Quantidade a Transferir/i);
    fireEvent.change(amountInput, { target: { value: "25" } });

    const submitBtn = screen.getByRole("button", { name: "Confirmar Transferência" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/player/wealth/transfer",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            sourceCharacterId: "char-1",
            targetCharacterId: "char-2",
            coinType: "ouro",
            amount: 25,
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(handleToast).toHaveBeenCalledWith("Transferência realizada com sucesso!", "success");
      expect(handleRefresh).toHaveBeenCalled();
    });

    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Check local session logs
    expect(screen.getByText("Transferências Recentes (Sessão Atual)")).toBeInTheDocument();
    expect(screen.getByText("+25")).toBeInTheDocument();
  });

  it("should open character wealth detail modal when clicking on character card", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            linked: [
              {
                junction: { id: "junc-1", quantity: 2 },
                content: {
                  id: "item-1",
                  name: "Espada Longa",
                  sourceData: { price: { value: { gp: 15 } } },
                },
              },
              {
                junction: { id: "junc-2", quantity: 1 },
                content: {
                  id: "item-2",
                  name: "Poção Menor de Cura",
                  priceGold: 3,
                },
              },
            ],
          },
        }),
    });

    render(<WealthManager initialData={mockData} />);

    // Click on Arthur's card
    const arthurCard = screen.getByRole("button", {
      name: "Ver detalhes de riqueza de Arthur Pendragon",
    });
    fireEvent.click(arthurCard);

    // Detail modal opens
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Arthur Pendragon", level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/Nível 5 · Riqueza & Patrimônio Pessoal/i)).toBeInTheDocument();

    // Has accessible coin badges without rendering their names visibly
    const detailDialog = screen.getByRole("dialog");
    for (const [name, amount] of [
      ["Diamante", 1],
      ["Platina", 3],
      ["Ouro", 80],
      ["Prata", 20],
      ["Bronze", 100],
    ] as const) {
      expect(detailDialog.querySelector(`[aria-label="${name}: ${amount}"]`)).toBeInTheDocument();
    }

    // Check tabs
    const inventoryTabBtn = screen.getByRole("button", { name: /Itens & Inventário/i });
    const statementTabBtn = screen.getByRole("button", { name: /Extrato da Sessão/i });
    expect(inventoryTabBtn).toBeInTheDocument();
    expect(statementTabBtn).toBeInTheDocument();

    // Verify items loaded
    await waitFor(() => {
      expect(screen.getByText("Espada Longa")).toBeInTheDocument();
      expect(screen.getByText("15 PO")).toBeInTheDocument();
      expect(screen.getByText("Poção Menor de Cura")).toBeInTheDocument();
      expect(screen.getByText("3 PO")).toBeInTheDocument();
      // Total: 2 * 15 PO + 1 * 3 PO = 33 PO
      expect(screen.getByText(/~33 PO/i)).toBeInTheDocument();
    });

    // Switch to Statement tab
    fireEvent.click(statementTabBtn);

    // Since no transfers yet, should show empty message
    expect(screen.getByText("Nenhuma movimentação registrada nesta sessão.")).toBeInTheDocument();

    // Close detail modal
    const closeButtons = screen.getAllByRole("button", { name: "Fechar" });
    fireEvent.click(closeButtons[0]);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("should show session transfers in character statement tab when available", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, message: "OK" }),
    });

    render(<WealthManager initialData={mockData} />);

    // Perform a transfer from Arthur to Merlin
    const transferArthurBtn = screen.getByLabelText("Transferir moedas de Arthur Pendragon");
    fireEvent.click(transferArthurBtn);

    const targetSelect = screen.getByLabelText(/Personagem de Destino/i);
    fireEvent.change(targetSelect, { target: { value: "char-2" } });

    const amountInput = screen.getByLabelText(/Quantidade a Transferir/i);
    fireEvent.change(amountInput, { target: { value: "10" } });

    const submitBtn = screen.getByRole("button", { name: "Confirmar Transferência" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Now open Arthur's detail modal
    const arthurCard = screen.getByRole("button", {
      name: "Ver detalhes de riqueza de Arthur Pendragon",
    });
    fireEvent.click(arthurCard);

    // Click on statement tab
    const statementTabBtn = screen.getByRole("button", { name: /Extrato da Sessão/i });
    fireEvent.click(statementTabBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/characters/char-1/content/items",
        expect.objectContaining({ credentials: "include" }),
      );
    });

    // Should display the negative transfer log for Arthur
    expect(screen.getByText(/Envio para/i)).toBeInTheDocument();
    expect(screen.getAllByText("Merlin Ambrosius").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("-10")).toBeInTheDocument();
  });
});
