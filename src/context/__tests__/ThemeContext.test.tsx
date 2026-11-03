import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { AVAILABLE_FONTS, RADIUS_PRESETS, themes } from "@/lib/theme";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

const cssVar = (name: string) => document.documentElement.style.getPropertyValue(name);

describe("ThemeContext — override de tema da campanha", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
  });

  function setupUserPreferences() {
    const hook = renderHook(() => useTheme(), { wrapper });
    act(() => {
      hook.result.current.setThemeName("nordic-light");
    });
    act(() => {
      hook.result.current.setFonts("cinzel-decorative", "special-elite");
      hook.result.current.updateUiDetails({ borderRadius: "none", iconScale: "lg", textScale: "lg" });
    });
    return hook;
  }

  it("aplica apenas as cores da campanha, preservando fontes e arredondamento do usuário", () => {
    const { result } = setupUserPreferences();
    const userFonts = result.current.theme.fonts;
    const userUi = result.current.theme.ui;

    act(() => {
      result.current.applyCampaignThemeOverride("crimson-dark");
    });

    const crimson = themes["crimson-dark"];
    expect(result.current.theme.name).toBe("crimson-dark");
    expect(result.current.theme.mode).toBe(crimson.mode);
    expect(result.current.theme.colors).toEqual(crimson.colors);
    expect(result.current.theme.fonts).toEqual(userFonts);
    expect(result.current.theme.ui).toEqual(userUi);

    expect(cssVar("--accent-primary")).toBe(crimson.colors.accent.primary);
    expect(cssVar("--dominant-deep")).toBe(crimson.colors.dominant.deep);
    expect(cssVar("--secondary-pure")).toBe(crimson.colors.secondary.pure);

    expect(cssVar("--font-heading")).toBe(AVAILABLE_FONTS["cinzel-decorative"].css);
    expect(cssVar("--font-body")).toBe(AVAILABLE_FONTS["special-elite"].css);
    expect(cssVar("--theme-radius-lg")).toBe(RADIUS_PRESETS.none.lg);
    expect(cssVar("--radius-md")).toBe(RADIUS_PRESETS.none.md);
    expect(cssVar("--theme-icon-scale")).toBe("1.2");
    expect(cssVar("--theme-text-scale")).toBe("110%");
  });

  it("mantém tipografia e arredondamento ao alternar entre campanhas com temas diferentes", () => {
    const { result } = setupUserPreferences();

    act(() => {
      result.current.applyCampaignThemeOverride("crimson-dark");
    });
    const headingAfterFirst = cssVar("--font-heading");
    const radiusAfterFirst = cssVar("--theme-radius-lg");

    act(() => {
      result.current.applyCampaignThemeOverride("amber-dark");
    });

    expect(cssVar("--accent-primary")).toBe(themes["amber-dark"].colors.accent.primary);
    expect(cssVar("--font-heading")).toBe(headingAfterFirst);
    expect(cssVar("--theme-radius-lg")).toBe(radiusAfterFirst);
  });

  it("reflete alterações de UI feitas pelo usuário enquanto o override está ativo", () => {
    const { result } = setupUserPreferences();

    act(() => {
      result.current.applyCampaignThemeOverride("crimson-dark");
    });
    act(() => {
      result.current.updateUiDetails({ borderRadius: "xl" });
    });

    expect(cssVar("--theme-radius-lg")).toBe(RADIUS_PRESETS.xl.lg);
    expect(cssVar("--accent-primary")).toBe(themes["crimson-dark"].colors.accent.primary);
  });

  it("restaura o tema completo do usuário ao limpar o override", () => {
    const { result } = setupUserPreferences();
    const userColors = result.current.theme.colors;

    act(() => {
      result.current.applyCampaignThemeOverride("crimson-dark");
    });
    act(() => {
      result.current.clearCampaignThemeOverride();
    });

    expect(result.current.theme.name).toBe("nordic-light");
    expect(result.current.theme.colors).toEqual(userColors);
    expect(cssVar("--accent-primary")).toBe(userColors.accent.primary);
  });
});
