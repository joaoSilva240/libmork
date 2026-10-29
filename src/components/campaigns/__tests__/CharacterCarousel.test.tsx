import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CharacterCarousel } from "../CharacterCarousel";
import type { RosterActor } from "../ActorOverlay";

describe("CharacterCarousel Component", () => {
  const mockHabitantActive: RosterActor = {
    kind: "character",
    id: "habitant-1",
    name: "Agente Marcos",
    imageUrl: null,
    level: 1,
    xp: 0,
    hitPoints: 1,
    hitPointsMax: 1,
    manaPoints: 0,
    manaPointsMax: 0,
    status: "active",
  };

  const mockHabitantMissing: RosterActor = {
    kind: "character",
    id: "habitant-2",
    name: "Clara Desaparecida",
    imageUrl: null,
    level: 1,
    xp: 0,
    hitPoints: 0,
    hitPointsMax: 1,
    manaPoints: 0,
    manaPointsMax: 0,
    status: "missing",
  };

  it("renderiza empty state específico de MISSING quando mesa vazia e isMissing=true", () => {
    render(<CharacterCarousel actors={[]} onSelect={vi.fn()} isMissing={true} />);
    expect(screen.getByText("📋 Nenhum Habitante Registrado")).toBeInTheDocument();
    expect(screen.queryByText("⚡ Mesa Vazia")).not.toBeInTheDocument();
  });

  it("renderiza empty state tradicional d20 quando isMissing=false", () => {
    render(<CharacterCarousel actors={[]} onSelect={vi.fn()} isMissing={false} />);
    expect(screen.getByText("⚡ Mesa Vazia")).toBeInTheDocument();
  });

  it("oculta widgets d20 (nível, HP/MP) e exibe badges analógicos (ATIVO / DESAPARECIDO) quando isMissing=true", () => {
    render(
      <CharacterCarousel
        actors={[mockHabitantActive, mockHabitantMissing]}
        onSelect={vi.fn()}
        isMissing={true}
      />
    );

    // Nomes
    expect(screen.getByText("Agente Marcos")).toBeInTheDocument();
    expect(screen.getByText("Clara Desaparecida")).toBeInTheDocument();

    // Badges analógicos
    expect(screen.getByText("ATIVO")).toBeInTheDocument();
    expect(screen.getByText("DESAPARECIDO")).toBeInTheDocument();

    // Registro civil label
    expect(screen.getAllByText("REGISTRO CIVIL")).toHaveLength(2);

    // Não deve exibir nível nem barra de HP/MP d20
    expect(screen.queryByText("Nv 1")).not.toBeInTheDocument();
    expect(screen.queryByText(/HP 1\/1/)).not.toBeInTheDocument();
  });

  it("aciona onSelect ao clicar no card de um habitante", () => {
    const handleSelect = vi.fn();
    render(
      <CharacterCarousel
        actors={[mockHabitantActive]}
        onSelect={handleSelect}
        isMissing={true}
      />
    );

    fireEvent.click(screen.getByText("Agente Marcos"));
    expect(handleSelect).toHaveBeenCalledWith(mockHabitantActive);
  });
});
