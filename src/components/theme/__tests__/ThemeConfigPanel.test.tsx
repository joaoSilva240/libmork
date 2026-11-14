import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { ThemeProvider } from "@/context/ThemeContext";
import { ThemeConfigPanel } from "../ThemeConfigPanel";
import { THEME_STORAGE_KEY, AVAILABLE_FONTS } from "@/lib/theme";

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

  it("renders side-by-side subtabs and preset options without luminosity box and accessibility banner", () => {
    renderWithProvider();

    expect(screen.queryByText("Modo de Luminosidade")).not.toBeInTheDocument();
    expect(screen.queryByText(/Auditoria de Acessibilidade/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Temas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tipografia/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Detalhes/i })).toBeInTheDocument();
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

  it("does not render the custom 60-30-10 color customization block in the themes tab", () => {
    renderWithProvider();

    expect(
      screen.queryByText(/Personalização das Cores do Sistema \(60-30-10\)/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Dominante (60%)")).not.toBeInTheDocument();
    expect(screen.queryByText("Secundário (30%)")).not.toBeInTheDocument();
    expect(screen.queryByText("Destaque (10%)")).not.toBeInTheDocument();
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

  it("supports selecting D&D local fonts and Google Fonts TTRPG presets", () => {
    renderWithProvider();

    const fontsTabButton = screen.getByRole("button", { name: /Tipografia & Fontes/i });
    fireEvent.click(fontsTabButton);

    // Seleciona preset temático D&D oficial (Vecna + Optima)
    const vecnaPreset = screen.getByText("Guia Oficial de Aventuras (D&D)");
    expect(vecnaPreset).toBeInTheDocument();
    fireEvent.click(vecnaPreset);

    let stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
    expect(stored.fonts.presetId).toBe("vecna-handbook");
    expect(stored.fonts.headingId).toBe("vecna");
    expect(stored.fonts.bodyId).toBe("optima");

    // Seleciona fonte do Google Fonts (MedievalSharp) manualmente
    const selects = screen.getAllByRole("combobox");
    const headingSelect = selects[0];
    fireEvent.change(headingSelect, { target: { value: "medievalsharp" } });

    stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
    expect(stored.fonts.headingId).toBe("medievalsharp");
  });

  it("renders typographic presets as a live font preview of the offered fonts", () => {
    renderWithProvider();

    const fontsTabButton = screen.getByRole("button", { name: /Tipografia & Fontes/i });
    fireEvent.click(fontsTabButton);

    // O título do preset D&D usa a fonte Vecna
    const vecnaTitle = screen.getByText("Guia Oficial de Aventuras (D&D)");
    expect(vecnaTitle).toHaveStyle({ fontFamily: AVAILABLE_FONTS.vecna.css });

    // O título do preset Dracônico usa a fonte Dragon Hunter
    const dragonTitle = screen.getByText("Saga Dracônica & Nórdica");
    expect(dragonTitle).toHaveStyle({ fontFamily: AVAILABLE_FONTS["dragon-hunter"].css });

    // O título do preset MedievalSharp usa a fonte MedievalSharp
    const medievalTitle = screen.getByText("Taverna Medieval & Bardos");
    expect(medievalTitle).toHaveStyle({ fontFamily: AVAILABLE_FONTS.medievalsharp.css });
  });

  it("renders theme cards as a live preview of the announced theme colors and styling", () => {
    renderWithProvider();

    // Card de Carmesim Vampírico
    const crimsonCard = screen.getByText("Carmesim Vampírico").closest("[role='radio']");
    expect(crimsonCard).not.toBeNull();
    // Verifica que o card usa o background do tema (dominant deep de crimson-dark: #0f080a)
    expect(crimsonCard).toHaveStyle({ backgroundColor: "rgb(15, 8, 10)" });

    // Botão de preview/tag dentro do card usa o accent primário do tema (#f43f5e = rgb(244, 63, 94))
    const actionBadges = screen.getAllByText("Ação");
    expect(actionBadges.length).toBeGreaterThan(0);
    expect(actionBadges[1]).toHaveStyle({ backgroundColor: "rgb(244, 63, 94)" });
  });

  it("navigates to 'Detalhes da UI & Aparência' subtab and adjusts border radius, text scale, and icon scale", () => {
    renderWithProvider();

    const uiTabButton = screen.getByRole("button", { name: /Detalhes da UI/i });
    fireEvent.click(uiTabButton);

    expect(screen.getByText("Arredondamento das Bordas (Border Radius)")).toBeInTheDocument();
    expect(screen.getByText("Escala de Tamanho dos Textos")).toBeInTheDocument();
    expect(screen.getByText("Tamanho dos Ícones")).toBeInTheDocument();

    // Clica na opção de borda 'Arredondado / 12px'
    const lgRadiusBtn = screen.getByRole("button", { name: /Arredondado \/ 12px/i });
    fireEvent.click(lgRadiusBtn);

    expect(document.documentElement.style.getPropertyValue("--theme-radius")).toBe("0.75rem");
    expect(document.documentElement.style.getPropertyValue("--theme-radius-lg")).toBe("0.75rem");
    expect(document.documentElement.style.getPropertyValue("--radius-lg")).toBe("0.75rem");
    expect(document.documentElement.getAttribute("data-theme-radius")).toBe("lg");
    let stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
    expect(stored.ui.borderRadius).toBe("lg");

    // Testa alternar para cantos retos 'Reto / 0px' (none)
    const noneRadiusBtn = screen.getByRole("button", { name: /Reto \/ 0px/i });
    fireEvent.click(noneRadiusBtn);

    expect(document.documentElement.style.getPropertyValue("--theme-radius")).toBe("0px");
    expect(document.documentElement.style.getPropertyValue("--theme-radius-lg")).toBe("0px");
    expect(document.documentElement.style.getPropertyValue("--theme-radius-md")).toBe("0px");
    expect(document.documentElement.style.getPropertyValue("--radius-lg")).toBe("0px");
    expect(document.documentElement.getAttribute("data-theme-radius")).toBe("none");
    stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
    expect(stored.ui.borderRadius).toBe("none");

    // Testa alternar para estilo fluido 'Pílula / Fluido' (full)
    const fullRadiusBtn = screen.getByRole("button", { name: /Pílula \/ Fluido/i });
    fireEvent.click(fullRadiusBtn);

    expect(document.documentElement.style.getPropertyValue("--theme-radius")).toBe("1.5rem");
    expect(document.documentElement.style.getPropertyValue("--radius")).toBe("9999px");
    expect(document.documentElement.style.getPropertyValue("--theme-radius-lg")).toBe("1.5rem");
    expect(document.documentElement.getAttribute("data-theme-radius")).toBe("full");
    stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
    expect(stored.ui.borderRadius).toBe("full");

    // Clica na opção de texto 'Confortável (110%)'
    const lgTextBtn = screen.getByRole("button", { name: /Confortável/i });
    fireEvent.click(lgTextBtn);

    expect(document.documentElement.style.fontSize).toBe("110%");
    stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
    expect(stored.ui.textScale).toBe("lg");

    // Clica na opção de ícones 'Grande (120%)'
    const lgIconBtn = screen.getByRole("button", { name: /Grande/i });
    fireEvent.click(lgIconBtn);

    expect(document.documentElement.style.getPropertyValue("--theme-icon-scale")).toBe("1.2");
    stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
    expect(stored.ui.iconScale).toBe("lg");
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
