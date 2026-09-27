import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CurrencyPouch } from "../CurrencyPouch";
import type { CoinsBalance } from "@/lib/validators/character";

describe("CurrencyPouch", () => {
  const initialCoins: CoinsBalance = {
    bronze: 50,
    prata: 10,
    ouro: 5,
    platina: 2,
    diamante: 1,
  };

  it("renders all coin types with their respective icons and values", () => {
    const handleChange = vi.fn();
    render(<CurrencyPouch characterId="char-1" coins={initialCoins} onChange={handleChange} />);

    // Check icons are rendered
    expect(screen.getByText("🟤")).toBeInTheDocument();
    expect(screen.getByText("⚪")).toBeInTheDocument();
    expect(screen.getByText("🟡")).toBeInTheDocument();
    expect(screen.getByText("🔷")).toBeInTheDocument();
    expect(screen.getByText("💎")).toBeInTheDocument();

    // Check values are rendered
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("allows entering edit mode and saving a new coin value", () => {
    const handleChange = vi.fn();
    render(<CurrencyPouch characterId="char-1" coins={initialCoins} onChange={handleChange} />);

    const editBronzeButton = screen.getByTitle("Editar bronze");
    fireEvent.click(editBronzeButton);

    const input = screen.getByRole("spinbutton");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(50);

    fireEvent.change(input, { target: { value: "75" } });
    fireEvent.blur(input); // Auto-save on blur

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith({
      ...initialCoins,
      bronze: 75,
    });
  });

  it("triggers save on Enter key inside the input", () => {
    const handleChange = vi.fn();
    render(<CurrencyPouch characterId="char-1" coins={initialCoins} onChange={handleChange} />);

    const editPrataButton = screen.getByTitle("Editar prata");
    fireEvent.click(editPrataButton);

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "30" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(handleChange).toHaveBeenCalledWith({
      ...initialCoins,
      prata: 30,
    });
  });

  it("cancels editing on Escape key without calling onChange", () => {
    const handleChange = vi.fn();
    render(<CurrencyPouch characterId="char-1" coins={initialCoins} onChange={handleChange} />);

    const editOuroButton = screen.getByTitle("Editar ouro");
    fireEvent.click(editOuroButton);

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(handleChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("no longer applies auto-conversion logic (removed in minimalist redesign)", () => {
    const handleChange = vi.fn();
    render(<CurrencyPouch characterId="char-1" coins={initialCoins} onChange={handleChange} />);

    const editDiamanteButton = screen.getByTitle("Editar diamante");
    fireEvent.click(editDiamanteButton);

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "105" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // No conversion, just direct update
    expect(handleChange).toHaveBeenCalledWith({
      bronze: 50,
      prata: 10,
      ouro: 5,
      platina: 2,
      diamante: 105,
    });
  });

  it("no longer handles cascaded conversion (removed in minimalist redesign)", () => {
    const handleChange = vi.fn();
    const customCoins: CoinsBalance = {
      bronze: 0,
      prata: 0,
      ouro: 0,
      platina: 99,
      diamante: 0,
    };
    render(<CurrencyPouch characterId="char-1" coins={customCoins} onChange={handleChange} />);

    const editDiamanteButton = screen.getByTitle("Editar diamante");
    fireEvent.click(editDiamanteButton);

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "100" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // No conversion, direct update
    expect(handleChange).toHaveBeenCalledWith({
      bronze: 0,
      prata: 0,
      ouro: 0,
      platina: 99,
      diamante: 100,
    });
  });

  it("cancels without calling onChange on invalid number input", () => {
    const handleChange = vi.fn();
    render(<CurrencyPouch characterId="char-1" coins={initialCoins} onChange={handleChange} />);

    const editBronzeButton = screen.getByTitle("Editar bronze");
    fireEvent.click(editBronzeButton);

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(handleChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("disables edit button and input when isLoading is true", () => {
    const handleChange = vi.fn();
    render(<CurrencyPouch characterId="char-1" coins={initialCoins} onChange={handleChange} isLoading={true} />);

    const editBronzeButton = screen.getByTitle("Editar bronze");
    expect(editBronzeButton).toBeDisabled();
  });
});
