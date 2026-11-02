import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ThemeProvider } from "@/context/ThemeContext";
import { ContentManager } from "@/components/content/ContentManager";
import CommunityCard from "@/components/community/CommunityCard";

// Mock das child libraries
vi.mock("@/components/classes/LibraryClasses", () => ({
  LibraryClasses: () => <div data-testid="classes-view">Classes View</div>,
}));
vi.mock("@/components/classes/LibraryClassFeatures", () => ({
  LibraryClassFeatures: () => <div data-testid="class-features-view">Features View</div>,
}));
vi.mock("@/components/races/LibraryRaces", () => ({
  LibraryRaces: () => <div data-testid="races-view">Races View</div>,
}));
vi.mock("@/components/npcs/LibraryNpcs", () => ({
  LibraryNpcs: () => <div data-testid="npcs-view">NPCs View</div>,
}));
vi.mock("@/components/worlds/LibraryWorlds", () => ({
  LibraryWorlds: () => <div data-testid="worlds-view">Worlds View</div>,
}));
vi.mock("@/components/library/LibraryDocuments", () => ({
  LibraryDocuments: () => <div data-testid="documents-view">Documents View</div>,
}));

describe("Theme Elements Propagation (Dynamic Accent and AAA Tokens)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      }),
    );
  });

  it("applies theme accent tokens to ContentManager buttons and selected tabs", async () => {
    await act(async () => {
      render(
        <ThemeProvider>
          <ContentManager basePath="/api/content" title="Biblioteca Global" />
        </ThemeProvider>,
      );
    });

    // Aba inicial selecionada é Perícias ("skills") e deve ter classe bg-accent
    const skillsTab = screen.getByRole("button", { name: "Perícias" });
    expect(skillsTab.className).toContain("bg-accent");

    // Botões "Criar Perícia" e "Importar Perícias" devem usar tokens de tema
    const createSkillBtn = screen.getByRole("button", { name: /\+ Criar Perícia/i });
    expect(createSkillBtn.className).toContain("bg-accent");

    const importSkillBtn = screen.getByRole("button", { name: /Importar Perícias/i });
    expect(importSkillBtn.className).toContain("border-accent");
    expect(importSkillBtn.className).toContain("text-accent-hover");

    // Alterna para Classes e verifica se bg-accent migra para a aba ativa
    const classesTab = screen.getByRole("button", { name: "Classes" });
    await act(async () => {
      fireEvent.click(classesTab);
    });

    expect(classesTab.className).toContain("bg-accent");
    expect(skillsTab.className).not.toContain("bg-accent");

    // Botão Criar Classe na aba ativa
    const createClassBtn = screen.getByRole("button", { name: /\+ Criar Classe/i });
    expect(createClassBtn.className).toContain("bg-accent");
  });

  it("applies theme accent tokens to CommunityCard import button", () => {
    const mockPost: any = {
      id: "post-1",
      authorId: "user-1",
      title: "Espada Espectral Ancestral",
      description: "Uma lendária espada forjada nas brumas.",
      contentType: "item",
      tags: ["arma", "mágica"],
      score: 10,
      likesCount: 10,
      clonesCount: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: "user-1",
        displayName: "Mestre Arcano",
        masterName: "Arcanista",
      },
    };

    render(
      <ThemeProvider>
        <CommunityCard post={mockPost} onOpen={vi.fn()} />
      </ThemeProvider>,
    );

    const importBtn = screen.getByRole("button", { name: /Importar/i });
    expect(importBtn.className).toContain("bg-accent");
    expect(importBtn.className).toContain("hover:bg-accent-vibrant");
  });
});
