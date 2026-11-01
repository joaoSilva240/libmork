import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CharacterCard } from "../CharacterCard";
import type { Character } from "@/types";

const mockCharacter: Character = {
  id: "char-1",
  ownerId: "user-1",
  classId: "class-1",
  raceId: "race-1",
  activeHeritages: [],
  name: "Thorin Escudo de Carvalho",
  imageUrl: "https://example.com/thorin.jpg",
  hitPointsMax: 30,
  hitPointsCurrent: 30,
  manaPointsMax: 10,
  manaPointsCurrent: 10,
  attributes: {
    forca: 16,
    destreza: 12,
    vigor: 14,
    inteligencia: 10,
    empatia: 8,
    sorte: 10,
  },
  level: 3,
  xp: 450,
  block: 12,
  deathStatus: "alive",
  deathSuccesses: 0,
  deathFailures: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-15"),
  className: "Guerreiro",
  raceName: "Anão",
  campaignName: "A Forja das Sombras",
  campaignId: "campaign-1",
};

describe("CharacterCard", () => {
  it("renderiza o card do personagem com nome, nível, classe e imagem", () => {
    render(<CharacterCard character={mockCharacter} />);

    expect(screen.getByText("Thorin Escudo de Carvalho")).toBeInTheDocument();
    expect(screen.getByText(/Nv\. 3/)).toBeInTheDocument();
    expect(screen.getByText(/Guerreiro/)).toBeInTheDocument();

    const image = screen.getByAltText("Thorin Escudo de Carvalho");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", "https://example.com/thorin.jpg");
  });

  it("exibe o badge de status 'Vivo' com estilo emerald quando o personagem está com HP > 0 e deathStatus 'alive'", () => {
    render(<CharacterCard character={mockCharacter} />);

    const statusBadge = screen.getByText("💚 Vivo");
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge).toHaveClass("border-emerald-700/60", "bg-emerald-950/90", "text-emerald-300");
  });

  it("exibe o badge de status 'Caído' com estilo amber quando o personagem está com HP <= 0 e deathStatus 'falling'", () => {
    const fallenCharacter: Character = {
      ...mockCharacter,
      hitPointsCurrent: 0,
      deathStatus: "falling",
    };
    render(<CharacterCard character={fallenCharacter} />);

    const statusBadge = screen.getByText("🩸 Caído");
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge).toHaveClass("border-amber-700/60", "bg-amber-950/90", "text-amber-300");
  });

  it("exibe o badge de status 'Morto' com estilo red quando o personagem está com deathStatus 'dead'", () => {
    const deadCharacter: Character = {
      ...mockCharacter,
      hitPointsCurrent: 0,
      deathStatus: "dead",
    };
    render(<CharacterCard character={deadCharacter} />);

    const statusBadge = screen.getByText("💀 Morto");
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge).toHaveClass("border-red-700/60", "bg-red-950/90", "text-red-300");
  });

  it("exibe HP e Mana estilizados com badges coloridos", () => {
    render(<CharacterCard character={mockCharacter} />);

    expect(screen.getByText(/❤️ HP 30\/30/)).toBeInTheDocument();
    expect(screen.getByText(/✦ Mana 10\/10/)).toBeInTheDocument();
  });

  it("exibe o nome da campanha vinculada quando presente", () => {
    render(<CharacterCard character={mockCharacter} />);

    expect(screen.getByText(/🏰 Campanha: A Forja das Sombras/)).toBeInTheDocument();
  });

  it("não exibe o nome da campanha quando o personagem não está vinculado a uma campanha", () => {
    const noCampaignCharacter: Character = {
      ...mockCharacter,
      campaignName: null,
      campaignId: null,
    };
    render(<CharacterCard character={noCampaignCharacter} />);

    expect(screen.queryByText(/🏰 Campanha:/)).not.toBeInTheDocument();
  });

  it("exibe Bloqueio e XP no rodapé", () => {
    render(<CharacterCard character={mockCharacter} />);

    expect(screen.getByText(/Bloqueio: 21/)).toBeInTheDocument();
    expect(screen.getByText(/XP: 450/)).toBeInTheDocument();
  });

  it("renderiza sem imagem com avatar inicial quando imageUrl for null", () => {
    const noImageCharacter: Character = {
      ...mockCharacter,
      imageUrl: null,
    };
    render(<CharacterCard character={noImageCharacter} />);

    const avatar = screen.getByText("T");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveClass("bg-purple-950", "text-purple-200");
  });

  it("renderiza o link para a ficha do personagem com href correto", () => {
    render(<CharacterCard character={mockCharacter} />);

    const link = screen.getByRole("link", { name: /Ver ficha de Thorin Escudo de Carvalho/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/player/characters/char-1");
  });

  it("exibe estilo de hover e transições conforme a linguagem visual dos cards de campanha", () => {
    render(<CharacterCard character={mockCharacter} />);

    const link = screen.getByRole("link", { name: /Ver ficha de Thorin Escudo de Carvalho/ });
    expect(link).toHaveClass(
      "group",
      "relative",
      "overflow-hidden",
      "rounded-xl",
      "border",
      "border-secondary-border",
      "hover:border-accent",
      "hover:shadow-[0_0_20px_rgba(147,51,234,0.25)]",
      "cursor-pointer"
    );
  });

  it("renderiza a camada de degradê escuro sobre a imagem de fundo", () => {
    const { container } = render(<CharacterCard character={mockCharacter} />);

    const overlay = container.querySelector(".bg-gradient-to-t.from-gray-950");
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveClass("absolute", "inset-0", "pointer-events-none");
  });

  it("renderiza o gráfico spider de atributos com acessibilidade e polígono de dados", () => {
    const { container } = render(<CharacterCard character={mockCharacter} />);

    const chart = screen.getByRole("img", { name: "Gráfico de atributos do personagem" });
    expect(chart).toBeInTheDocument();
    expect(chart).toHaveClass("pointer-events-none");

    const characterPolygon = chart.querySelector("polygon[fill='url(#character-spider-gradient)']");
    expect(characterPolygon).toBeInTheDocument();
    expect(characterPolygon).toHaveAttribute("points");

    const circles = chart.querySelectorAll("circle");
    expect(circles).toHaveLength(6);
  });

  it("renderiza o gráfico spider utilizando valores padrão para atributos ausentes", () => {
    const partialAttributesCharacter: Character = {
      ...mockCharacter,
      attributes: {
        forca: 18,
      } as any,
    };
    render(<CharacterCard character={partialAttributesCharacter} />);

    const chart = screen.getByRole("img", { name: "Gráfico de atributos do personagem" });
    expect(chart).toBeInTheDocument();

    const characterPolygon = chart.querySelector("polygon[fill='url(#character-spider-gradient)']");
    expect(characterPolygon).toBeInTheDocument();
    expect(characterPolygon).toHaveAttribute("points");
  });
});
