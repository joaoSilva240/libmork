import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CoinsBalance } from "@/lib/validators/character";
import { CurrencyPouch } from "../CurrencyPouch";

describe("CurrencyPouch", () => {
  const initialCoins: CoinsBalance = {
    bronze: 50,
    prata: 10,
    ouro: 5,
    platina: 2,
    diamante: 1,
  };

  function renderPouch(coins = initialCoins, isLoading = false) {
    const onChange = vi.fn();
    render(
      <CurrencyPouch
        characterId="char-1"
        coins={coins}
        onChange={onChange}
        isLoading={isLoading}
      />,
    );
    return onChange;
  }

  it("renders all coin icons and balances", () => {
    renderPouch();

    for (const icon of ["🟤", "⚪", "🟡", "🔷", "💎"]) {
      expect(screen.getByText(icon)).toBeInTheDocument();
    }
    for (const amount of ["50", "10", "5", "2", "1"]) {
      expect(screen.getByText(amount)).toBeInTheDocument();
    }
  });

  it("opens the conversion dialog when a balance is clicked", () => {
    renderPouch();

    fireEvent.click(screen.getByRole("button", { name: "Ouro: 5" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Converter moedas" })).toBeInTheDocument();
  });

  it("pre-selects the clicked coin as the source", () => {
    renderPouch();

    fireEvent.click(screen.getByRole("button", { name: "Prata: 10" }));

    expect(screen.getByText(/Moeda de origem: ⚪ Prata/)).toBeInTheDocument();
    expect(screen.getByText(/saldo disponível: 10/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Moeda de destino" })).toHaveValue("diamante");
  });

  it("selects a target, accepts a quantity, shows a preview, and confirms an exact conversion", () => {
    const onChange = renderPouch();
    fireEvent.click(screen.getByRole("button", { name: "Ouro: 5" }));

    fireEvent.change(screen.getByRole("combobox", { name: "Moeda de destino" }), {
      target: { value: "prata" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantidade" }), {
      target: { value: "2" },
    });

    expect(screen.getByText(/2 ouro → 20 prata/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar conversão" }));

    expect(onChange).toHaveBeenCalledWith({
      ...initialCoins,
      ouro: 3,
      prata: 30,
    });
  });

  it("blocks confirmation and reports insufficient balance", () => {
    const onChange = renderPouch();
    fireEvent.click(screen.getByRole("button", { name: "Ouro: 5" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantidade" }), {
      target: { value: "6" },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Saldo insuficiente");
    expect(screen.getByRole("button", { name: "Confirmar conversão" })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("blocks confirmation when the conversion is not divisible", () => {
    const onChange = renderPouch();
    fireEvent.click(screen.getByRole("button", { name: "Bronze: 50" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Moeda de destino" }), {
      target: { value: "ouro" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantidade" }), {
      target: { value: "1" },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("não pode ser convertida exatamente");
    expect(screen.getByRole("button", { name: "Confirmar conversão" })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("cancels without calling onChange", () => {
    const onChange = renderPouch();
    fireEvent.click(screen.getByRole("button", { name: "Ouro: 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the conversion overlay with Escape", () => {
    renderPouch();
    fireEvent.click(screen.getByRole("button", { name: "Ouro: 5" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables the balance and confirmation controls while loading", () => {
    renderPouch(initialCoins, true);

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }

    // Loading prevents opening a new conversion, so the confirmation control
    // is covered by the modal's own isLoading behavior in CurrencyConversionModal.
  });
});
