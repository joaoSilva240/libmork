import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { ThemeProvider } from "@/context/ThemeContext";
import { ThemeConfigPanel } from "../ThemeConfigPanel";
import { THEME_STORAGE_KEY } from "@/lib/theme";

describe("ThemeConfigPanel (src/components/theme/ThemeConfigPanel.tsx)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.style.cssText = "";
  });

  const renderWithProvider = () => {
    return render(
      <ThemeProvider>
        <ThemeConfigPanel />
      </ThemeProvider>,
    );
  };

  it("renders light/dark mode switcher, accessibility banner, and preset options", () => {
    renderWithProvider();

    expect(screen.getByText("Modo de Luminosidade")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /🌙 Escuro/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /☀️ Claro/ })).toBeInTheDocument();
    expect(
      screen.getByText(/Auditoria de Acessibilidade — Padrão WCAG 2\.1 \(AAA\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Temas Calibrados AAA/i)).toBeInTheDocument();
  });

  it("switches to light mode when clicking 'Claro'", () => {
    renderWithProvider();

    const lightButton = screen.getByRole("button", { name: /☀️ Claro/ });
    fireEvent.click(lightButton);

    expect(document.documentElement.getAttribute("data-theme-mode")).toBe("light");
    expect(document.documentElement.style.getPropertyValue("--theme-bg-deep")).toBe("#f8fafc");
    expect(document.documentElement.style.getPropertyValue("--color-gray-950")).toBe("#f8fafc");
    expect(document.documentElement.style.getPropertyValue("--color-purple-600")).toBe("#6b21a8");
    const stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
    expect(stored.mode).toBe("light");
    expect(screen.getByText("Alabastro Puro (Claro)")).toBeInTheDocument();
  });

  it("switches to dark mode when clicking 'Escuro'", () => {
    renderWithProvider();

    // Primeiro ativa o modo claro
    fireEvent.click(screen.getByRole("button", { name: /☀️ Claro/ }));
    expect(document.documentElement.getAttribute("data-theme-mode")).toBe("light");

    // Agora volta para o modo escuro
    fireEvent.click(screen.getByRole("button", { name: /🌙 Escuro/ }));
    expect(document.documentElement.getAttribute("data-theme-mode")).toBe("dark");
  });

  it("allows selecting a curated preset theme", () => {
    renderWithProvider();

    const crimsonCard = screen.getByText("Carmesim Vampírico").closest("[role='radio']");
    expect(crimsonCard).not.toBeNull();
    fireEvent.click(crimsonCard!);

    expect(document.documentElement.getAttribute("data-theme")).toBe("crimson-dark");
    const stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
    expect(stored.name).toBe("crimson-dark");
  });

  it("navigates to 'Cores do Sistema (60-30-10)' subtab and edits colors", () => {
    renderWithProvider();

    const colorsTabButton = screen.getByRole("button", { name: /Cores do Sistema/i });
    fireEvent.click(colorsTabButton);

    expect(screen.getByText("Dominante (60%)")).toBeInTheDocument();
    expect(screen.getByText("Secundário (30%)")).toBeInTheDocument();
    expect(screen.getByText("Destaque (10%)")).toBeInTheDocument();

    const hexInputs = screen.getAllByDisplayValue("#09090b");
    fireEvent.change(hexInputs[0], { target: { value: "#050505" } });

    const stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
    expect(stored.name).toBe("custom");
    expect(stored.colors.dominant.deep).toBe("#050505");
  });

  it("navigates to 'Tipografia & Fontes' subtab and switches font presets and individual fonts", () => {
    renderWithProvider();

    const fontsTabButton = screen.getByRole("button", { name: /Tipografia & Fontes/i });
    fireEvent.click(fontsTabButton);

    expect(screen.getByText("Presets Tipográficos Oficiais")).toBeInTheDocument();
    expect(screen.getByText("Seleção Manual de Fontes do Sistema")).toBeInTheDocument();

    // Escolhe preset de fontes
    const grimorioPreset = screen.getByText("Grimório de Fantasia");
    fireEvent.click(grimorioPreset);

    const stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
    expect(stored.fonts.presetId).toBe("grimorio");

    // Seleciona fonte de títulos manualmente
    const selects = screen.getAllByRole("combobox");
    const headingSelect = selects[0];
    fireEvent.change(headingSelect, { target: { value: "sans" } });

    const storedAfter = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
    expect(storedAfter.fonts.headingId).toBe("sans");
  });

  it("resets theme to default when clicking 'Restaurar Tema Padrão'", () => {
    renderWithProvider();

    // Seleciona tema esmeralda
    const emeraldCard = screen.getByText("Esmeralda & Floresta").closest("[role='radio']");
    fireEvent.click(emeraldCard!);
    expect(document.documentElement.getAttribute("data-theme")).toBe("emerald-dark");

    // Clica em restaurar
    const resetButton = screen.getByRole("button", { name: "Restaurar Tema Padrão" });
    fireEvent.click(resetButton);

    expect(document.documentElement.getAttribute("data-theme")).toBe("default-dark");
    const stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
    expect(stored.name).toBe("default-dark");
  });
});
