import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CoinsBalance } from "@/lib/validators/character";
import { CurrencyConversionModal } from "../CurrencyConversionModal";

const coins: CoinsBalance = {
  bronze: 50,
  prata: 10,
  ouro: 5,
  platina: 2,
  diamante: 1,
};

describe("CurrencyConversionModal", () => {
  it("confirms an exact conversion with the selected target", () => {
    const onConfirm = vi.fn();
    render(
      <CurrencyConversionModal
        isOpen
        sourceCoin="ouro"
        coins={coins}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Moeda de destino" }), {
      target: { value: "prata" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantidade" }), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar conversão" }));

    expect(onConfirm).toHaveBeenCalledWith({ ...coins, ouro: 3, prata: 30 });
  });

  it("disables confirmation for insufficient and non-divisible quantities", () => {
    const onConfirm = vi.fn();
    render(
      <CurrencyConversionModal
        isOpen
        sourceCoin="ouro"
        coins={coins}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const quantity = screen.getByRole("spinbutton", { name: "Quantidade" });
    const confirm = screen.getByRole("button", { name: "Confirmar conversão" });
    fireEvent.change(quantity, { target: { value: "6" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Saldo insuficiente");
    expect(confirm).toBeDisabled();

    fireEvent.change(quantity, { target: { value: "1" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Moeda de destino" }), {
      target: { value: "platina" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("não pode ser convertida exatamente");
    expect(confirm).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("disables confirmation while loading", () => {
    render(
      <CurrencyConversionModal
        isOpen
        sourceCoin="ouro"
        coins={coins}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        isLoading
      />,
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantidade" }), {
      target: { value: "1" },
    });
    expect(screen.getByRole("button", { name: "Confirmar conversão" })).toBeDisabled();
  });
});
