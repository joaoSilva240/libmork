"use client";

// =============================================================================
// Libmork — Contexto Global de Temas e Acessibilidade (WCAG AAA)
// =============================================================================

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type ThemeConfig,
  type ThemeMode,
  type ThemeName,
  type FontFamilyId,
  type FontPresetId,
  themes,
  DEFAULT_THEME,
  AVAILABLE_FONTS,
  FONT_PRESETS,
  applyTheme,
  getStoredTheme,
  saveStoredTheme,
  evaluateThemeContrast,
  optimizeForAaa,
  ensureAaaTextColor,
} from "@/lib/theme";

export interface ThemeContextValue {
  theme: ThemeConfig;
  mode: ThemeMode;
  setThemeName: (name: ThemeName) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setThemeConfig: (config: ThemeConfig) => void;
  updateColor: (
    section: "dominant" | "secondary" | "accent",
    key: string,
    value: string,
  ) => void;
  setFontPreset: (presetId: FontPresetId) => void;
  setFonts: (headingId: FontFamilyId, bodyId: FontFamilyId) => void;
  optimizeContrast: () => void;
  resetTheme: () => void;
  applyCampaignThemeOverride: (themeName?: string | null) => void;
  clearCampaignThemeOverride: () => void;
  isAaaCompliant: boolean;
  contrastEvaluation: ReturnType<typeof evaluateThemeContrast>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeConfig>(() => {
    if (typeof window === "undefined") {
      return { ...themes[DEFAULT_THEME] };
    }
    return getStoredTheme();
  });

  const [campaignOverride, setCampaignOverride] = useState<ThemeConfig | null>(null);

  // O tema ativo é o override da campanha (se presente) ou o tema global do usuário
  const activeTheme = useMemo(() => {
    return campaignOverride || theme;
  }, [campaignOverride, theme]);

  // Aplica o tema ativo no DOM sempre que mudar
  useEffect(() => {
    applyTheme(activeTheme);
  }, [activeTheme]);

  // Sincroniza tema entre abas caso o usuário altere em outra janela
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "libmork:theme-config" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && parsed.name && themes[parsed.name as ThemeName]) {
            setThemeState(getStoredTheme());
          }
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setThemeName = useCallback((name: ThemeName) => {
    const next = themes[name] || themes[DEFAULT_THEME];
    setThemeState(next);
    saveStoredTheme(next);
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeState((current) => {
      // Se o tema atual já for do modo desejado, não faz nada
      if (current.mode === mode) return current;

      // Se existir versão correspondente do tema no outro modo:
      // Ex: default-dark <-> alabaster-light, parchment-light <-> amber-dark, etc.
      let targetName: ThemeName = mode === "light" ? "alabaster-light" : "default-dark";

      if (current.name.includes("high-contrast")) {
        targetName = mode === "light" ? "high-contrast-light" : "high-contrast-dark";
      } else if (current.name.includes("amber") || current.name.includes("parchment")) {
        targetName = mode === "light" ? "parchment-light" : "amber-dark";
      } else if (current.name.includes("sapphire") || current.name.includes("nordic")) {
        targetName = mode === "light" ? "nordic-light" : "sapphire-dark";
      }

      const next = themes[targetName];
      saveStoredTheme(next);
      return next;
    });
  }, []);

  const setThemeConfig = useCallback((newConfig: ThemeConfig) => {
    setThemeState(newConfig);
    saveStoredTheme(newConfig);
  }, []);

  const updateColor = useCallback(
    (
      section: "dominant" | "secondary" | "accent",
      key: string,
      value: string,
    ) => {
      setThemeState((current) => {
        const next: ThemeConfig = {
          ...current,
          name: "custom",
          colors: {
            ...current.colors,
            [section]: {
              ...current.colors[section],
              [key]: value,
            },
          },
        };

        // Se alterou a cor de fundo dominante, recalibra automaticamente textos para garantir AAA
        if (section === "dominant" && (key === "deep" || key === "pure")) {
          const auto = ensureAaaTextColor(value);
          next.colors.secondary.pure = auto.textPure;
          next.colors.secondary.offwhite = auto.textOffwhite;
          next.colors.secondary.muted = auto.textMuted;
        }

        saveStoredTheme(next);
        return next;
      });
    },
    [],
  );

  const setFontPreset = useCallback((presetId: FontPresetId) => {
    const preset = FONT_PRESETS[presetId];
    if (!preset) return;

    setThemeState((current) => {
      const next: ThemeConfig = {
        ...current,
        fonts: {
          heading: AVAILABLE_FONTS[preset.headingId].css,
          body: AVAILABLE_FONTS[preset.bodyId].css,
          headingId: preset.headingId,
          bodyId: preset.bodyId,
          presetId,
        },
      };
      saveStoredTheme(next);
      return next;
    });
  }, []);

  const setFonts = useCallback(
    (headingId: FontFamilyId, bodyId: FontFamilyId) => {
      const headingDef = AVAILABLE_FONTS[headingId];
      const bodyDef = AVAILABLE_FONTS[bodyId];
      if (!headingDef || !bodyDef) return;

      setThemeState((current) => {
        const next: ThemeConfig = {
          ...current,
          fonts: {
            heading: headingDef.css,
            body: bodyDef.css,
            headingId,
            bodyId,
            presetId: undefined,
          },
        };
        saveStoredTheme(next);
        return next;
      });
    },
    [],
  );

  const optimizeContrast = useCallback(() => {
    setThemeState((current) => {
      const optimized = optimizeForAaa(
        current.colors.dominant.deep,
        current.colors.secondary.pure,
      );

      const autoText = ensureAaaTextColor(optimized.bg);

      const next: ThemeConfig = {
        ...current,
        colors: {
          ...current.colors,
          dominant: {
            ...current.colors.dominant,
            deep: optimized.bg,
          },
          secondary: {
            ...current.colors.secondary,
            pure: autoText.textPure,
            offwhite: autoText.textOffwhite,
            muted: autoText.textMuted,
          },
        },
      };

      saveStoredTheme(next);
      return next;
    });
  }, []);

  const resetTheme = useCallback(() => {
    const def = themes[DEFAULT_THEME];
    setThemeState(def);
    saveStoredTheme(def);
  }, []);

  const applyCampaignThemeOverride = useCallback(
    (themeName?: string | null) => {
      if (!themeName) {
        setCampaignOverride(null);
        return;
      }

      if (themes[themeName as ThemeName]) {
        setCampaignOverride(themes[themeName as ThemeName]);
      }
    },
    [],
  );

  const clearCampaignThemeOverride = useCallback(() => {
    setCampaignOverride(null);
  }, []);

  const contrastEvaluation = useMemo(() => {
    return evaluateThemeContrast(activeTheme);
  }, [activeTheme]);

  const value = useMemo<ThemeContextValue>(() => {
    return {
      theme: activeTheme,
      mode: activeTheme.mode,
      setThemeName,
      setThemeMode,
      setThemeConfig,
      updateColor,
      setFontPreset,
      setFonts,
      optimizeContrast,
      resetTheme,
      applyCampaignThemeOverride,
      clearCampaignThemeOverride,
      isAaaCompliant: contrastEvaluation.isAaaCompliant,
      contrastEvaluation,
    };
  }, [
    activeTheme,
    setThemeName,
    setThemeMode,
    setThemeConfig,
    updateColor,
    setFontPreset,
    setFonts,
    optimizeContrast,
    resetTheme,
    applyCampaignThemeOverride,
    clearCampaignThemeOverride,
    contrastEvaluation,
  ]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const defaultThemeValue: ThemeContextValue = {
  theme: themes[DEFAULT_THEME],
  mode: "dark",
  setThemeName: () => {},
  setThemeMode: () => {},
  setThemeConfig: () => {},
  updateColor: () => {},
  setFontPreset: () => {},
  setFonts: () => {},
  optimizeContrast: () => {},
  resetTheme: () => {},
  applyCampaignThemeOverride: () => {},
  clearCampaignThemeOverride: () => {},
  isAaaCompliant: true,
  contrastEvaluation: evaluateThemeContrast(themes[DEFAULT_THEME]),
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  return context || defaultThemeValue;
}
