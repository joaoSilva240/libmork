import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parseHexColor,
  getRelativeLuminance,
  getContrastRatio,
  getWcagLevel,
  ensureAaaTextColor,
  optimizeForAaa,
  evaluateThemeContrast,
  themes,
  AVAILABLE_FONTS,
  FONT_PRESETS,
  applyTheme,
  getStoredTheme,
  saveStoredTheme,
  setTheme,
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
} from "../theme";

describe("Theme & WCAG AAA Contrast Engine (src/lib/theme.ts)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.style.cssText = "";
  });

  describe("parseHexColor & getRelativeLuminance", () => {
    it("parses 6-digit hex color correctly", () => {
      expect(parseHexColor("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseHexColor("#000000")).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseHexColor("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    });

    it("parses 3-digit shorthand hex correctly", () => {
      expect(parseHexColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseHexColor("#000")).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseHexColor("#f00")).toEqual({ r: 255, g: 0, b: 0 });
    });

    it("handles invalid hex input gracefully", () => {
      expect(parseHexColor("invalid")).toBeNull();
      expect(parseHexColor("")).toBeNull();
      expect(parseHexColor("#xyz")).toBeNull();
    });

    it("calculates relative luminance per WCAG 2.1 specification", () => {
      expect(getRelativeLuminance("#ffffff")).toBeCloseTo(1.0, 2);
      expect(getRelativeLuminance("#000000")).toBeCloseTo(0.0, 2);
      // Pure blue has lower relative luminance than pure green
      expect(getRelativeLuminance("#00ff00")).toBeGreaterThan(getRelativeLuminance("#0000ff"));
    });
  });

  describe("getContrastRatio & WCAG levels", () => {
    it("returns 21:1 for black and white", () => {
      const ratio = getContrastRatio("#000000", "#ffffff");
      expect(ratio).toBe(21);
    });

    it("is commutative (A vs B is same as B vs A)", () => {
      expect(getContrastRatio("#09090b", "#ffffff")).toBe(getContrastRatio("#ffffff", "#09090b"));
    });

    it("evaluates WCAG AAA compliance correctly", () => {
      // 21:1 passes AAA normal and large
      const level21 = getWcagLevel(21);
      expect(level21.passesAAA).toBe(true);
      expect(level21.level).toBe("AAA");

      // 5:1 passes AA normal, and AAA large, but fails AAA normal
      const level5Normal = getWcagLevel(5.0, false);
      expect(level5Normal.passesAAA).toBe(false);
      expect(level5Normal.passesAA).toBe(true);
      expect(level5Normal.level).toBe("AA");

      const level5Large = getWcagLevel(5.0, true);
      expect(level5Large.passesAAA).toBe(true);
      expect(level5Large.level).toBe("AAA");

      // 2:1 fails
      const level2 = getWcagLevel(2.0);
      expect(level2.passesAAA).toBe(false);
      expect(level2.passesAA).toBe(false);
      expect(level2.level).toBe("FAIL");
    });
  });

  describe("ensureAaaTextColor & optimizeForAaa", () => {
    it("guarantees AAA text (>= 7.0:1) on dark backgrounds", () => {
      const darkBg = "#09090b";
      const { textPure, contrastRatio } = ensureAaaTextColor(darkBg);
      expect(textPure).toBe("#ffffff");
      expect(contrastRatio).toBeGreaterThanOrEqual(7.0);
    });

    it("guarantees AAA text (>= 7.0:1) on light backgrounds", () => {
      const lightBg = "#f8fafc";
      const { textPure, contrastRatio } = ensureAaaTextColor(lightBg);
      expect(textPure).toBe("#09090b");
      expect(contrastRatio).toBeGreaterThanOrEqual(7.0);
    });

    it("optimizes colors to achieve strictly WCAG AAA standard", () => {
      // Test when contrast is already AAA
      const optimizedAlreadyGood = optimizeForAaa("#000000", "#ffffff");
      expect(optimizedAlreadyGood.ratio).toBeGreaterThanOrEqual(7.0);

      // Test with middle gray background
      const optimizedMiddle = optimizeForAaa("#777777", "#ffffff");
      expect(optimizedMiddle.ratio).toBeGreaterThanOrEqual(7.0);
    });
  });

  describe("Built-in Themes WCAG AAA Verification", () => {
    it("all 10 built-in presets pass WCAG AAA contrast standard on primary text surfaces", () => {
      const themeNames = Object.keys(themes) as Array<keyof typeof themes>;

      for (const name of themeNames) {
        if (name === "custom") continue;
        const theme = themes[name];
        const evaluation = evaluateThemeContrast(theme);

        expect(
          evaluation.textOnDeepRatio,
          `Theme '${name}' text on deep background must meet AAA (>= 7:1)`,
        ).toBeGreaterThanOrEqual(7.0);

        expect(
          evaluation.textOnCardRatio,
          `Theme '${name}' text on card surface must meet AAA (>= 7:1)`,
        ).toBeGreaterThanOrEqual(7.0);

        expect(
          evaluation.offwhiteOnDeepRatio,
          `Theme '${name}' offwhite text must meet AAA (>= 7:1)`,
        ).toBeGreaterThanOrEqual(7.0);

        expect(theme.fonts.heading).toBeDefined();
        expect(theme.fonts.body).toBeDefined();
        expect(AVAILABLE_FONTS[theme.fonts.headingId]).toBeDefined();
        expect(AVAILABLE_FONTS[theme.fonts.bodyId]).toBeDefined();
      }
    });

    it("correctly separates Dark and Light themes", () => {
      expect(themes["default-dark"].mode).toBe("dark");
      expect(themes["crimson-dark"].mode).toBe("dark");
      expect(themes["emerald-dark"].mode).toBe("dark");
      expect(themes["amber-dark"].mode).toBe("dark");
      expect(themes["sapphire-dark"].mode).toBe("dark");
      expect(themes["high-contrast-dark"].mode).toBe("dark");

      expect(themes["parchment-light"].mode).toBe("light");
      expect(themes["alabaster-light"].mode).toBe("light");
      expect(themes["nordic-light"].mode).toBe("light");
      expect(themes["high-contrast-light"].mode).toBe("light");
    });
  });

  describe("Font System & Presets", () => {
    it("contains all current system fonts", () => {
      expect(AVAILABLE_FONTS.cinzel).toBeDefined();
      expect(AVAILABLE_FONTS["cinzel-decorative"]).toBeDefined();
      expect(AVAILABLE_FONTS.sans).toBeDefined();
      expect(AVAILABLE_FONTS.serif).toBeDefined();
      expect(AVAILABLE_FONTS.mono).toBeDefined();
    });

    it("registers all local fonts from public/fonts directory", () => {
      expect(AVAILABLE_FONTS.vecna).toBeDefined();
      expect(AVAILABLE_FONTS.vecna.origin).toBe("local");
      expect(AVAILABLE_FONTS["dragon-hunter"]).toBeDefined();
      expect(AVAILABLE_FONTS["special-elite"]).toBeDefined();
      expect(AVAILABLE_FONTS.optima).toBeDefined();
      expect(AVAILABLE_FONTS["roman-new-times"]).toBeDefined();
      expect(AVAILABLE_FONTS.keyes).toBeDefined();
      expect(AVAILABLE_FONTS.westsac).toBeDefined();
      expect(AVAILABLE_FONTS.fstein).toBeDefined();
      expect(AVAILABLE_FONTS.reappeat).toBeDefined();
      expect(AVAILABLE_FONTS["215000e"]).toBeDefined();
    });

    it("registers all Google Fonts with TTRPG & D&D thematic", () => {
      expect(AVAILABLE_FONTS.medievalsharp).toBeDefined();
      expect(AVAILABLE_FONTS.medievalsharp.origin).toBe("google");
      expect(AVAILABLE_FONTS.almendra).toBeDefined();
      expect(AVAILABLE_FONTS["uncial-antiqua"]).toBeDefined();
      expect(AVAILABLE_FONTS["pirata-one"]).toBeDefined();
      expect(AVAILABLE_FONTS["im-fell-english-sc"]).toBeDefined();
      expect(AVAILABLE_FONTS["grenze-gotisch"]).toBeDefined();
      expect(AVAILABLE_FONTS.metamorphous).toBeDefined();
      expect(AVAILABLE_FONTS["eagle-lake"]).toBeDefined();
      expect(AVAILABLE_FONTS.marcellus).toBeDefined();
    });

    it("defines curated font presets including D&D and Google Fonts RPG presets", () => {
      expect(FONT_PRESETS["epica-sans"]).toBeDefined();
      expect(FONT_PRESETS["vecna-handbook"]).toBeDefined();
      expect(FONT_PRESETS["dragon-saga"]).toBeDefined();
      expect(FONT_PRESETS["medieval-tavern"]).toBeDefined();
      expect(FONT_PRESETS["grimorio-cthulhu"]).toBeDefined();
      expect(FONT_PRESETS["celtic-lore"]).toBeDefined();
      expect(FONT_PRESETS["gothic-crypt"]).toBeDefined();
      expect(FONT_PRESETS["corsair-sea"]).toBeDefined();
      expect(FONT_PRESETS["arcanist-tome"]).toBeDefined();
      expect(FONT_PRESETS["imperial-decree"]).toBeDefined();
      expect(FONT_PRESETS["investigator-journal"]).toBeDefined();
      expect(FONT_PRESETS.grimorio).toBeDefined();
      expect(FONT_PRESETS.pergaminho).toBeDefined();
      expect(FONT_PRESETS.moderno).toBeDefined();
      expect(FONT_PRESETS.codex).toBeDefined();

      // Verifica se todos os presets referenciam fontes válidas em AVAILABLE_FONTS
      for (const preset of Object.values(FONT_PRESETS)) {
        expect(AVAILABLE_FONTS[preset.headingId]).toBeDefined();
        expect(AVAILABLE_FONTS[preset.bodyId]).toBeDefined();
      }
    });
  });

  describe("DOM Application & LocalStorage Persistence", () => {
    it("applyTheme sets attributes and CSS custom properties on documentElement", () => {
      const theme = themes["parchment-light"];
      applyTheme(theme);

      const root = document.documentElement;
      expect(root.getAttribute("data-theme")).toBe("parchment-light");
      expect(root.getAttribute("data-theme-mode")).toBe("light");
      expect(root.style.getPropertyValue("--dominant-deep")).toBe(theme.colors.dominant.deep);
      expect(root.style.getPropertyValue("--secondary-pure")).toBe(theme.colors.secondary.pure);
      expect(root.style.getPropertyValue("--accent-primary")).toBe(theme.colors.accent.primary);
      expect(root.style.getPropertyValue("--font-heading")).toBe(theme.fonts.heading);
      expect(root.style.getPropertyValue("--font-body")).toBe(theme.fonts.body);
    });

    it("saveStoredTheme and getStoredTheme persist across reloads", () => {
      const theme = themes["emerald-dark"];
      saveStoredTheme(theme);

      const loaded = getStoredTheme();
      expect(loaded.name).toBe("emerald-dark");
      expect(loaded.mode).toBe("dark");
      expect(loaded.colors.accent.primary).toBe(theme.colors.accent.primary);
    });

    it("setTheme applies and saves theme", () => {
      setTheme("sapphire-dark");

      expect(document.documentElement.getAttribute("data-theme")).toBe("sapphire-dark");
      const stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
      expect(stored.name).toBe("sapphire-dark");
    });

    it("falls back to default-dark if storage is empty", () => {
      const fallback = getStoredTheme();
      expect(fallback.name).toBe(DEFAULT_THEME);
    });
  });
});
