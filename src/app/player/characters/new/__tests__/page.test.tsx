import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NewCharacterPage from "../page";

// Mocks
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/components/characters/CharacterWizard", () => ({
  CharacterWizard: () => <div data-testid="character-wizard">Character Wizard Component</div>,
}));

vi.mock("@/components/systems/missing/MissingHabitantCreateForm", () => ({
  MissingHabitantCreateForm: ({ onCancel }: { onCancel?: () => void }) => (
    <div data-testid="missing-habitant-form">
      <span>Missing Habitant Form Component</span>
      {onCancel && <button onClick={onCancel}>Trocar de Sistema</button>}
    </div>
  ),
}));

describe("NewCharacterPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it("exibe seleção de sistema quando não houver ?system= na URL", () => {
    render(<NewCharacterPage />);

    expect(
      screen.getByText("A qual sistema este personagem pertence?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Libmork Clássico (d20)")).toBeInTheDocument();
    expect(
      screen.getByText("MISSING — Edição ZERO (Horror Analógico)"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("character-wizard")).not.toBeInTheDocument();
    expect(screen.queryByTestId("missing-habitant-form")).not.toBeInTheDocument();
  });

  it("renderiza CharacterWizard ao clicar no Card A (Libmork Clássico)", () => {
    render(<NewCharacterPage />);

    fireEvent.click(screen.getByText("Libmork Clássico (d20)"));

    expect(screen.getByTestId("character-wizard")).toBeInTheDocument();
    expect(screen.queryByText("A qual sistema este personagem pertence?")).not.toBeInTheDocument();
  });

  it("renderiza MissingHabitantCreateForm ao clicar no Card B (MISSING)", () => {
    render(<NewCharacterPage />);

    fireEvent.click(screen.getByText("MISSING — Edição ZERO (Horror Analógico)"));

    expect(screen.getByTestId("missing-habitant-form")).toBeInTheDocument();
    expect(screen.queryByText("A qual sistema este personagem pertence?")).not.toBeInTheDocument();
  });

  it("renderiza diretamente o formulário de MISSING se ?system=missing_zero estiver na URL", () => {
    mockSearchParams = new URLSearchParams("system=missing_zero");

    render(<NewCharacterPage />);

    expect(screen.getByTestId("missing-habitant-form")).toBeInTheDocument();
    expect(screen.queryByText("A qual sistema este personagem pertence?")).not.toBeInTheDocument();
  });

  it("renderiza diretamente o CharacterWizard se ?system=libmork estiver na URL", () => {
    mockSearchParams = new URLSearchParams("system=libmork");

    render(<NewCharacterPage />);

    expect(screen.getByTestId("character-wizard")).toBeInTheDocument();
    expect(screen.queryByText("A qual sistema este personagem pertence?")).not.toBeInTheDocument();
  });
});
