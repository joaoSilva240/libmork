import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { useState } from "react";
import { ContentManager } from "@/components/content/ContentManager";

// Mock das child libraries para focar na alternância de abas e botões
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
  LibraryDocuments: ({ onRegisterActions }: any) => {
    const [isTomeOpen, setIsTomeOpen] = useState(false);

    React.useEffect(() => {
      if (onRegisterActions) {
        onRegisterActions({
          openCreate: () => {},
          openTome: () => setIsTomeOpen(true),
        });
      }
    }, [onRegisterActions]);

    return (
      <div data-testid="documents-view">
        {isTomeOpen ? (
          <div data-testid="tome-inline-panel">
            <h2>Tome</h2>
            <iframe title="Visualizador Tome" src="http://100.122.171.83:8080" />
            <a href="http://100.122.171.83:8080" target="_blank" rel="noopener noreferrer">
              Abrir em nova aba
            </a>
            <button type="button" onClick={() => setIsTomeOpen(false)}>
              Voltar / Fechar Tome
            </button>
          </div>
        ) : (
          <div>Lista de Documentos</div>
        )}
      </div>
    );
  },
}));

describe("ContentManager - Tome Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      })
    ) as any;
  });

  it("exibe o botão Tome apenas na aba Regras / PDFs e aciona o visualizador Tome inline (sem modal)", async () => {
    render(<ContentManager basePath="/api/content" title="Biblioteca Mestre" />);

    // Na aba inicial (Perícias), não deve existir o botão Tome
    expect(screen.queryByRole("button", { name: /^Tome$/i })).not.toBeInTheDocument();

    // Clica na aba "Regras / PDFs"
    const docsTab = screen.getByRole("button", { name: "Regras / PDFs" });
    fireEvent.click(docsTab);

    // Agora o botão Tome deve existir
    const tomeButton = screen.getByRole("button", { name: /^Tome$/i });
    expect(tomeButton).toBeInTheDocument();

    // Clica no botão Tome
    fireEvent.click(tomeButton);

    // Deve abrir inline no componente sem dialog/modal
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tome" })).toBeInTheDocument();
    const iframe = screen.getByTitle("Visualizador Tome");
    expect(iframe).toHaveAttribute("src", "http://100.122.171.83:8080");

    // Fallback presente
    const fallbackLinks = screen.getAllByRole("link", { name: /Abrir em nova aba/i });
    expect(fallbackLinks.length).toBeGreaterThan(0);
    expect(fallbackLinks[0]).toHaveAttribute("href", "http://100.122.171.83:8080");
    expect(fallbackLinks[0]).toHaveAttribute("target", "_blank");
    expect(fallbackLinks[0]).toHaveAttribute("rel", "noopener noreferrer");

    // Fecha / Volta do Tome inline
    const closeButton = screen.getByRole("button", { name: "Voltar / Fechar Tome" });
    fireEvent.click(closeButton);
    expect(screen.queryByRole("heading", { name: "Tome" })).not.toBeInTheDocument();
    expect(screen.getByText("Lista de Documentos")).toBeInTheDocument();
  });
});
