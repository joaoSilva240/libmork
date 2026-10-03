import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurrencySummary } from "../CurrencySummary";

const balance = {
  diamante: 1,
  platina: 5,
  ouro: 120,
  prata: 50,
  bronze: 200,
};

describe("CurrencySummary", () => {
  it.each(["consolidated", "character"] as const)(
    "renders all five currencies in the %s variant",
    (variant) => {
      render(<CurrencySummary balance={balance} variant={variant} />);

      for (const name of ["Diamante", "Platina", "Ouro", "Prata", "Bronze"]) {
        expect(screen.getByLabelText(new RegExp(`^${name}:`))).toBeInTheDocument();
      }
    },
  );

  it("uses a horizontal carousel with square items and keeps labels accessible", () => {
    render(<CurrencySummary balance={balance} variant="character" ariaLabel="Saldos de moedas" />);

    const summary = screen.getByLabelText("Saldos de moedas");
    const carousel = summary.querySelector("div.flex.flex-nowrap");
    const track = carousel?.firstElementChild;

    expect(carousel).toHaveClass(
      "flex",
      "flex-nowrap",
      "w-full",
      "max-w-full",
      "min-w-0",
      "overflow-x-auto",
      "overscroll-x-contain",
      "snap-x",
      "snap-mandatory",
      "touch-pan-x",
      "overflow-y-hidden",
    );
    expect(track).toHaveClass("flex", "w-max", "min-w-full", "flex-nowrap", "gap-2");
    expect(track?.children).toHaveLength(5);

    const gold = screen.getByLabelText("Ouro: 120");
    expect(gold).toHaveClass("size-16", "shrink-0");
    expect(gold).not.toHaveTextContent("Ouro");
    expect(gold).toHaveTextContent("120");
    expect(gold).toHaveAttribute("title", "Ouro: 120");
    expect(gold).toHaveTextContent("🟡");
  });

  it("contains the summary within its parent width", () => {
    render(<CurrencySummary balance={balance} variant="character" ariaLabel="Saldos contidos" />);

    expect(screen.getByLabelText("Saldos contidos")).toHaveClass(
      "w-full",
      "max-w-full",
      "min-w-0",
      "overflow-hidden",
    );
  });

  it("preserves the consolidated gold equivalent", () => {
    render(<CurrencySummary balance={balance} variant="consolidated" />);

    expect(screen.getByText("1.177 PO")).toBeInTheDocument();
  });

  it("keeps the consolidated summary readonly without a change callback", () => {
    render(<CurrencySummary balance={balance} variant="consolidated" />);

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("opens conversion for a character summary when a change callback is provided", () => {
    render(
      <CurrencySummary balance={balance} variant="character" onBalanceChange={() => undefined} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ouro: 120" }));

    expect(screen.getByRole("heading", { name: "Converter moedas" })).toBeInTheDocument();
  });
});
