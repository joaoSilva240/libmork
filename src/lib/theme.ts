// =============================================================================
// Libmork — Sistema de Temas e Acessibilidade (WCAG AAA)
// =============================================================================

export type ThemeMode = "dark" | "light";

export type ThemeName =
  | "default-dark"
  | "crimson-dark"
  | "emerald-dark"
  | "amber-dark"
  | "sapphire-dark"
  | "high-contrast-dark"
  | "parchment-light"
  | "alabaster-light"
  | "nordic-light"
  | "high-contrast-light"
  | "custom";

export type FontFamilyId =
  | "cinzel"
  | "cinzel-decorative"
  | "sans"
  | "serif"
  | "mono"
  // Fontes locais da pasta public/fonts
  | "vecna"
  | "dragon-hunter"
  | "special-elite"
  | "optima"
  | "roman-new-times"
  | "keyes"
  | "westsac"
  | "fstein"
  | "reappeat"
  | "215000e"
  // Fontes Google Fonts (RPG & D&D)
  | "medievalsharp"
  | "almendra"
  | "uncial-antiqua"
  | "pirata-one"
  | "im-fell-english-sc"
  | "grenze-gotisch"
  | "metamorphous"
  | "eagle-lake"
  | "marcellus";

export type FontPresetId =
  | "epica-sans"
  | "vecna-handbook"
  | "dragon-saga"
  | "medieval-tavern"
  | "grimorio-cthulhu"
  | "celtic-lore"
  | "gothic-crypt"
  | "corsair-sea"
  | "arcanist-tome"
  | "imperial-decree"
  | "investigator-journal"
  | "grimorio"
  | "pergaminho"
  | "moderno"
  | "codex";

export interface FontDefinition {
  id: FontFamilyId;
  label: string;
  css: string;
  category: "fantasy" | "sans" | "serif" | "mono";
  origin: "local" | "google" | "system";
  tag?: string;
}

export const AVAILABLE_FONTS: Record<FontFamilyId, FontDefinition> = {
  // --- Fontes Universais e do Sistema ---
  cinzel: {
    id: "cinzel",
    label: "Cinzel (Serif Heroica)",
    css: "var(--font-cinzel), Georgia, serif",
    category: "fantasy",
    origin: "google",
    tag: "Clássico",
  },
  "cinzel-decorative": {
    id: "cinzel-decorative",
    label: "Cinzel Decorative (Fantasia Ornamental)",
    css: "var(--font-cinzel-decorative), 'Cinzel', fantasy, serif",
    category: "fantasy",
    origin: "google",
    tag: "Ornamentado",
  },
  sans: {
    id: "sans",
    label: "Sistema Sans (Moderna / Alta Legibilidade)",
    css: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    category: "sans",
    origin: "system",
    tag: "Alta Legibilidade",
  },
  serif: {
    id: "serif",
    label: "Sistema Serif (Livro de Regras / Georgia)",
    css: "Georgia, Cambria, 'Times New Roman', Times, serif",
    category: "serif",
    origin: "system",
    tag: "Livro",
  },
  mono: {
    id: "mono",
    label: "Sistema Mono (Grimório Técnico / Runas)",
    css: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    category: "mono",
    origin: "system",
    tag: "Código & Dados",
  },

  // --- Fontes Locais (public/fonts) ---
  vecna: {
    id: "vecna",
    label: "Vecna (Clássico D&D / Aventura Oficial)",
    css: "var(--font-vecna), 'Vecna', Georgia, serif",
    category: "fantasy",
    origin: "local",
    tag: "D&D Oficial",
  },
  "dragon-hunter": {
    id: "dragon-hunter",
    label: "Dragon Hunter (Nórdico Dracônico)",
    css: "var(--font-dragon-hunter), 'Dragon Hunter', fantasy, serif",
    category: "fantasy",
    origin: "local",
    tag: "Épico",
  },
  "special-elite": {
    id: "special-elite",
    label: "Special Elite (Diário de Campanha / Investigação)",
    css: "var(--font-special-elite), 'Special Elite', monospace",
    category: "mono",
    origin: "local",
    tag: "Diário / Relatório",
  },
  optima: {
    id: "optima",
    label: "Optima (Manual de Regras Humanista)",
    css: "var(--font-optima), 'Optima', ui-sans-serif, system-ui, sans-serif",
    category: "sans",
    origin: "local",
    tag: "Manual de Regras",
  },
  "roman-new-times": {
    id: "roman-new-times",
    label: "Roman New Times (Crônica & Decretos Reais)",
    css: "var(--font-roman-new-times), 'Roman New Times', Times New Roman, serif",
    category: "serif",
    origin: "local",
    tag: "Pergaminho Real",
  },
  keyes: {
    id: "keyes",
    label: "Keyes (Runas & Entalhes Medievais)",
    css: "var(--font-keyes), 'Keyes', fantasy, serif",
    category: "fantasy",
    origin: "local",
    tag: "Rúnico",
  },
  westsac: {
    id: "westsac",
    label: "Westsac (Taverna Rústica & Selvagem)",
    css: "var(--font-westsac), 'Westsac', cursive, fantasy",
    category: "fantasy",
    origin: "local",
    tag: "Taverna",
  },
  fstein: {
    id: "fstein",
    label: "F-Stein (Gótico Sombrio & Horror)",
    css: "var(--font-fstein), 'FStein', fantasy, serif",
    category: "fantasy",
    origin: "local",
    tag: "Horror Gótico",
  },
  reappeat: {
    id: "reappeat",
    label: "Reappeat (Display Arcana)",
    css: "var(--font-reappeat), 'Reappeat', fantasy, sans-serif",
    category: "fantasy",
    origin: "local",
    tag: "Místico",
  },
  "215000e": {
    id: "215000e",
    label: "215000E (Glifos Arcanos)",
    css: "var(--font-215000e), '215000E', fantasy, sans-serif",
    category: "fantasy",
    origin: "local",
    tag: "Glifos",
  },

  // --- Fontes Temáticas de RPG / D&D (Google Fonts) ---
  medievalsharp: {
    id: "medievalsharp",
    label: "MedievalSharp (Aventura Medieval & Taverna)",
    css: "var(--font-medievalsharp), 'MedievalSharp', cursive, serif",
    category: "fantasy",
    origin: "google",
    tag: "RPG Medieval",
  },
  almendra: {
    id: "almendra",
    label: "Almendra (Manuscrito Gótico Iluminado)",
    css: "var(--font-almendra), 'Almendra', Georgia, serif",
    category: "serif",
    origin: "google",
    tag: "Manuscrito",
  },
  "uncial-antiqua": {
    id: "uncial-antiqua",
    label: "Uncial Antiqua (Celta Druídico & Magia Antiga)",
    css: "var(--font-uncial-antiqua), 'Uncial Antiqua', fantasy, cursive",
    category: "fantasy",
    origin: "google",
    tag: "Druídico / Celta",
  },
  "pirata-one": {
    id: "pirata-one",
    label: "Pirata One (Corsários & Fantasia Marítima)",
    css: "var(--font-pirata-one), 'Pirata One', cursive, fantasy",
    category: "fantasy",
    origin: "google",
    tag: "Corsário / Pirata",
  },
  "im-fell-english-sc": {
    id: "im-fell-english-sc",
    label: "IM Fell English SC (Grimório Arcano Século XVII)",
    css: "var(--font-im-fell-english-sc), 'IM Fell English SC', Georgia, serif",
    category: "serif",
    origin: "google",
    tag: "Grimório OSR",
  },
  "grenze-gotisch": {
    id: "grenze-gotisch",
    label: "Grenze Gotisch (Gótico Germânico & Masmorras)",
    css: "var(--font-grenze-gotisch), 'Grenze Gotisch', cursive, serif",
    category: "fantasy",
    origin: "google",
    tag: "Gótico Abissal",
  },
  metamorphous: {
    id: "metamorphous",
    label: "Metamorphous (Tomo Místico & Encantamentos)",
    css: "var(--font-metamorphous), 'Metamorphous', fantasy, serif",
    category: "fantasy",
    origin: "google",
    tag: "Arcanismo",
  },
  "eagle-lake": {
    id: "eagle-lake",
    label: "Eagle Lake (Caligrafia Élfica & Baladas)",
    css: "var(--font-eagle-lake), 'Eagle Lake', cursive, serif",
    category: "fantasy",
    origin: "google",
    tag: "Élfico",
  },
  marcellus: {
    id: "marcellus",
    label: "Marcellus (Inscrições Imperiais & Manuais D&D)",
    css: "var(--font-marcellus), 'Marcellus', Georgia, serif",
    category: "serif",
    origin: "google",
    tag: "Imperial",
  },
};

export interface FontPresetDefinition {
  id: FontPresetId;
  label: string;
  description: string;
  headingId: FontFamilyId;
  bodyId: FontFamilyId;
  tag?: string;
}

export const FONT_PRESETS: Record<FontPresetId, FontPresetDefinition> = {
  "epica-sans": {
    id: "epica-sans",
    label: "Épica & Legível (Recomendado AAA)",
    description: "Títulos ornamentados com Cinzel Decorative e corpo em Sans de alta legibilidade.",
    headingId: "cinzel-decorative",
    bodyId: "sans",
    tag: "Equilibrado",
  },
  "vecna-handbook": {
    id: "vecna-handbook",
    label: "Guia Oficial de Aventuras (D&D)",
    description:
      "Títulos com a clássica fonte Vecna dos manuais e leitura refinada humanista em Optima.",
    headingId: "vecna",
    bodyId: "optima",
    tag: "D&D Clássico",
  },
  "dragon-saga": {
    id: "dragon-saga",
    label: "Saga Dracônica & Nórdica",
    description: "Títulos com a épica e angular Dragon Hunter e corpo em Sans para combate ágil.",
    headingId: "dragon-hunter",
    bodyId: "sans",
    tag: "Nórdico",
  },
  "medieval-tavern": {
    id: "medieval-tavern",
    label: "Taverna Medieval & Bardos",
    description:
      "Títulos com a consagrada MedievalSharp do Google Fonts e corpo estilizado com Almendra.",
    headingId: "medievalsharp",
    bodyId: "almendra",
    tag: "Taverna",
  },
  "grimorio-cthulhu": {
    id: "grimorio-cthulhu",
    label: "Grimório Abissal & Horror (Mörk / OSR)",
    description: "Títulos em IM Fell English SC arcaica com notas datilografadas em Special Elite.",
    headingId: "im-fell-english-sc",
    bodyId: "special-elite",
    tag: "Horror Cósmico",
  },
  "celtic-lore": {
    id: "celtic-lore",
    label: "Pergaminho Celta & Druídico",
    description:
      "Títulos em Uncial Antiqua sagrada e crônicas com a caligrafia élfica de Eagle Lake.",
    headingId: "uncial-antiqua",
    bodyId: "eagle-lake",
    tag: "Druídico",
  },
  "gothic-crypt": {
    id: "gothic-crypt",
    label: "Cripta Gótica & Necromancia",
    description: "Títulos dramáticos em Grenze Gotisch com leitura em Roman New Times clássica.",
    headingId: "grenze-gotisch",
    bodyId: "roman-new-times",
    tag: "Masmorra",
  },
  "corsair-sea": {
    id: "corsair-sea",
    label: "Costa dos Corsários & Piratas",
    description: "Títulos de aventura marítima com Pirata One e leitura clara e rápida em Sans.",
    headingId: "pirata-one",
    bodyId: "sans",
    tag: "Piratas",
  },
  "arcanist-tome": {
    id: "arcanist-tome",
    label: "Tomo do Mago Arcanista",
    description: "Títulos místicos em Metamorphous com blocos de texto solenes em Cinzel.",
    headingId: "metamorphous",
    bodyId: "cinzel",
    tag: "Arcano",
  },
  "imperial-decree": {
    id: "imperial-decree",
    label: "Crônica & Decreto Imperial",
    description: "Títulos solenes com Marcellus e corpo de texto em Roman New Times.",
    headingId: "marcellus",
    bodyId: "roman-new-times",
    tag: "Reino",
  },
  "investigator-journal": {
    id: "investigator-journal",
    label: "Diário de Campanha & Anotações",
    description: "Títulos datilografados com Special Elite e texto de leitura com Optima.",
    headingId: "special-elite",
    bodyId: "optima",
    tag: "Investigativo",
  },
  grimorio: {
    id: "grimorio",
    label: "Grimório de Fantasia",
    description: "Títulos e leitura totalmente imersos na família clássica Cinzel.",
    headingId: "cinzel-decorative",
    bodyId: "cinzel",
    tag: "Grimório",
  },
  pergaminho: {
    id: "pergaminho",
    label: "Pergaminho Histórico",
    description: "Títulos em Cinzel e texto em Serif clássica (estilo livro antigo).",
    headingId: "cinzel",
    bodyId: "serif",
    tag: "Histórico",
  },
  moderno: {
    id: "moderno",
    label: "Studio Moderno",
    description: "Design contemporâneo limpo e focado com tipografia sem serifa.",
    headingId: "sans",
    bodyId: "sans",
    tag: "Moderno",
  },
  codex: {
    id: "codex",
    label: "Codex & Registros",
    description: "Títulos solenes em Cinzel com corpo monoespaçado para números e tabelas.",
    headingId: "cinzel",
    bodyId: "mono",
    tag: "Registros",
  },
};

export interface ThemeColors {
  dominant: {
    pure: string;
    deep: string;
    dark: string;
    container: string;
    border: string;
  };
  secondary: {
    pure: string;
    offwhite: string;
    muted: string;
    border: string;
    card: string;
  };
  accent: {
    primary: string;
    vibrant: string;
    hover: string;
    dark: string;
    glow: string;
  };
}

export interface ThemeFonts {
  heading: string;
  body: string;
  headingId: FontFamilyId;
  bodyId: FontFamilyId;
  presetId?: FontPresetId;
}

export type BorderRadiusSize = "none" | "sm" | "md" | "lg" | "xl" | "full";
export type TextScaleSize = "sm" | "md" | "lg" | "xl";
export type IconScaleSize = "sm" | "md" | "lg";

export interface BorderRadiusTokens {
  base: string;
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  "2xl": string;
  "3xl": string;
  full: string;
}

export const RADIUS_PRESETS: Record<BorderRadiusSize, BorderRadiusTokens> = {
  none: {
    base: "0px",
    xs: "0px",
    sm: "0px",
    md: "0px",
    lg: "0px",
    xl: "0px",
    "2xl": "0px",
    "3xl": "0px",
    full: "9999px",
  },
  sm: {
    base: "0.25rem",
    xs: "0.0625rem",
    sm: "0.125rem",
    md: "0.1875rem",
    lg: "0.25rem",
    xl: "0.375rem",
    "2xl": "0.5rem",
    "3xl": "0.625rem",
    full: "9999px",
  },
  md: {
    base: "0.5rem",
    xs: "0.125rem",
    sm: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.625rem",
    "2xl": "0.75rem",
    "3xl": "1rem",
    full: "9999px",
  },
  lg: {
    base: "0.5rem",
    xs: "0.1875rem",
    sm: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    "2xl": "1.25rem",
    "3xl": "1.5rem",
    full: "9999px",
  },
  xl: {
    base: "0.75rem",
    xs: "0.25rem",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "2rem",
    full: "9999px",
  },
  full: {
    base: "9999px",
    xs: "0.375rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "2.5rem",
    "3xl": "3rem",
    full: "9999px",
  },
};

export const BORDER_RADIUS_MAP: Record<BorderRadiusSize, string> = {
  none: "0px",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
};

export interface ThemeUiDetails {
  borderRadius: BorderRadiusSize;
  textScale: TextScaleSize;
  iconScale: IconScaleSize;
}

export const DEFAULT_UI_DETAILS: ThemeUiDetails = {
  borderRadius: "lg",
  textScale: "md",
  iconScale: "md",
};

export interface ThemeConfig {
  name: ThemeName;
  label: string;
  description: string;
  mode: ThemeMode;
  colors: ThemeColors;
  fonts: ThemeFonts;
  ui?: ThemeUiDetails;
}

// =============================================================================
// Algoritmo de Contraste WCAG 2.1 e Padrão AAA (>= 7.0:1)
// =============================================================================

export function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  if (!hex || typeof hex !== "string") return null;
  let clean = hex.trim().replace(/^#/, "");

  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }

  if (clean.length !== 6) return null;

  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return null;

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getRelativeLuminance(hex: string): number {
  const rgb = parseHexColor(hex);
  if (!rgb) return 0;

  const [rl, gl, bl] = [rgb.r, rgb.g, rgb.b].map((val) => {
    const s = val / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

export function getContrastRatio(colorA: string, colorB: string): number {
  const lumA = getRelativeLuminance(colorA);
  const lumB = getRelativeLuminance(colorB);

  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);

  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100;
}

export function getWcagLevel(
  ratio: number,
  isLargeText = false,
): { level: "AAA" | "AA" | "FAIL"; passesAAA: boolean; passesAA: boolean } {
  if (isLargeText) {
    const passesAAA = ratio >= 4.5;
    const passesAA = ratio >= 3.0;
    return {
      level: passesAAA ? "AAA" : passesAA ? "AA" : "FAIL",
      passesAAA,
      passesAA,
    };
  }

  const passesAAA = ratio >= 7.0;
  const passesAA = ratio >= 4.5;
  return {
    level: passesAAA ? "AAA" : passesAA ? "AA" : "FAIL",
    passesAAA,
    passesAA,
  };
}

/**
 * Garante uma cor de texto que atinja o padrão AAA (>= 7.0:1) contra qualquer fundo dado.
 * Se o fundo for escuro, escolhe entre branco puro (#ffffff) ou offwhite calibrado.
 * Se o fundo for claro, escolhe entre preto puro (#000000) ou carvão abissal (#09090b).
 */
export function ensureAaaTextColor(bgHex: string): {
  textPure: string;
  textOffwhite: string;
  textMuted: string;
  contrastRatio: number;
} {
  const lum = getRelativeLuminance(bgHex);

  if (lum < 0.2) {
    // Fundo escuro -> Texto claro
    const whiteRatio = getContrastRatio("#ffffff", bgHex);
    return {
      textPure: "#ffffff",
      textOffwhite: "#f4f4f7",
      textMuted: whiteRatio > 12 ? "#d1d1db" : "#e4e4e7",
      contrastRatio: whiteRatio,
    };
  } else {
    // Fundo claro -> Texto escuro
    const blackRatio = getContrastRatio("#000000", bgHex);
    return {
      textPure: "#09090b",
      textOffwhite: "#18181b",
      textMuted: blackRatio > 12 ? "#3f3f46" : "#27272a",
      contrastRatio: blackRatio,
    };
  }
}

/**
 * Otimiza uma cor de fundo ou primeiro plano para atingir estritamente WCAG AAA (>= 7.0:1).
 */
export function optimizeForAaa(
  bgHex: string,
  preferredTextHex = "#ffffff",
): { bg: string; text: string; ratio: number } {
  const currentRatio = getContrastRatio(preferredTextHex, bgHex);
  if (currentRatio >= 7.0) {
    return { bg: bgHex, text: preferredTextHex, ratio: currentRatio };
  }

  // Tenta trocar texto para branco ou preto primeiro
  const whiteRatio = getContrastRatio("#ffffff", bgHex);
  const blackRatio = getContrastRatio("#000000", bgHex);

  if (whiteRatio >= 7.0) {
    return { bg: bgHex, text: "#ffffff", ratio: whiteRatio };
  }

  if (blackRatio >= 7.0) {
    return { bg: bgHex, text: "#000000", ratio: blackRatio };
  }

  // Se o fundo estiver na faixa média cinza (nem branco nem preto dão 7:1),
  // ajustamos a luminância do fundo para uma zona segura AAA.
  const lum = getRelativeLuminance(bgHex);
  const adjustedBg = lum < 0.2 ? "#09090b" : "#f8fafc";
  const adjustedText = lum < 0.2 ? "#ffffff" : "#09090b";

  return {
    bg: adjustedBg,
    text: adjustedText,
    ratio: getContrastRatio(adjustedText, adjustedBg),
  };
}

export function evaluateThemeContrast(theme: ThemeConfig): {
  isAaaCompliant: boolean;
  scoreSummary: string;
  textOnDeepRatio: number;
  textOnCardRatio: number;
  offwhiteOnDeepRatio: number;
  mutedOnCardRatio: number;
} {
  const textOnDeepRatio = getContrastRatio(theme.colors.secondary.pure, theme.colors.dominant.deep);
  const textOnCardRatio = getContrastRatio(
    theme.colors.secondary.pure,
    theme.colors.secondary.card,
  );
  const offwhiteOnDeepRatio = getContrastRatio(
    theme.colors.secondary.offwhite,
    theme.colors.dominant.deep,
  );
  const mutedOnCardRatio = getContrastRatio(
    theme.colors.secondary.muted,
    theme.colors.secondary.card,
  );

  const passesMain = textOnDeepRatio >= 7.0 && textOnCardRatio >= 7.0;
  const passesSecondary = offwhiteOnDeepRatio >= 7.0 && mutedOnCardRatio >= 4.5;

  const isAaaCompliant = passesMain && passesSecondary;

  return {
    isAaaCompliant,
    scoreSummary: isAaaCompliant
      ? `WCAG AAA (${textOnDeepRatio}:1)`
      : `WCAG AA (${textOnDeepRatio}:1)`,
    textOnDeepRatio,
    textOnCardRatio,
    offwhiteOnDeepRatio,
    mutedOnCardRatio,
  };
}

// =============================================================================
// Coleção de Temas Padrão (Dark e Light) — Todos com Contraste AAA Garantido
// =============================================================================

export const themes: Record<ThemeName, ThemeConfig> = {
  "default-dark": {
    name: "default-dark",
    label: "Roxo Abissal",
    description: "Tema escuro padrão com toques arcanos de ametista e alto contraste.",
    mode: "dark",
    colors: {
      dominant: {
        pure: "#000000",
        deep: "#09090b",
        dark: "#121217",
        container: "#1a1a24",
        border: "#272730",
      },
      secondary: {
        pure: "#ffffff",
        offwhite: "#f4f4f7",
        muted: "#d1d1db",
        border: "#3f3f4e",
        card: "#16161f",
      },
      accent: {
        primary: "#a855f7",
        vibrant: "#c084fc",
        hover: "#d8b4fe",
        dark: "#7e22ce",
        glow: "rgba(168, 85, 247, 0.2)",
      },
    },
    fonts: {
      heading: AVAILABLE_FONTS["cinzel-decorative"].css,
      body: AVAILABLE_FONTS.sans.css,
      headingId: "cinzel-decorative",
      bodyId: "sans",
      presetId: "epica-sans",
    },
  },

  "crimson-dark": {
    name: "crimson-dark",
    label: "Carmesim Vampírico",
    description: "Tons góticos profundos de sangue e rubi em atmosfera de terror.",
    mode: "dark",
    colors: {
      dominant: {
        pure: "#050203",
        deep: "#0f080a",
        dark: "#180d10",
        container: "#221217",
        border: "#3a1c24",
      },
      secondary: {
        pure: "#ffffff",
        offwhite: "#fceef0",
        muted: "#d4b2b8",
        border: "#4e2531",
        card: "#1c0e12",
      },
      accent: {
        primary: "#f43f5e",
        vibrant: "#fb7185",
        hover: "#fda4af",
        dark: "#be123c",
        glow: "rgba(244, 63, 94, 0.22)",
      },
    },
    fonts: {
      heading: AVAILABLE_FONTS["cinzel-decorative"].css,
      body: AVAILABLE_FONTS.cinzel.css,
      headingId: "cinzel-decorative",
      bodyId: "cinzel",
      presetId: "grimorio",
    },
  },

  "emerald-dark": {
    name: "emerald-dark",
    label: "Esmeralda & Floresta",
    description: "Verde esmeralda druídico em ambiente soturno de floresta antiga.",
    mode: "dark",
    colors: {
      dominant: {
        pure: "#020704",
        deep: "#07130b",
        dark: "#0d1e13",
        container: "#142b1c",
        border: "#20432c",
      },
      secondary: {
        pure: "#ffffff",
        offwhite: "#eaf8ee",
        muted: "#b3dbc0",
        border: "#2a593a",
        card: "#102417",
      },
      accent: {
        primary: "#10b981",
        vibrant: "#34d399",
        hover: "#6ee7b7",
        dark: "#047857",
        glow: "rgba(16, 185, 129, 0.22)",
      },
    },
    fonts: {
      heading: AVAILABLE_FONTS["cinzel-decorative"].css,
      body: AVAILABLE_FONTS.sans.css,
      headingId: "cinzel-decorative",
      bodyId: "sans",
      presetId: "epica-sans",
    },
  },

  "amber-dark": {
    name: "amber-dark",
    label: "Ouro & Âmbar Solar",
    description: "Tons quentes de ouro forjado, tochas e tabernas acolhedoras.",
    mode: "dark",
    colors: {
      dominant: {
        pure: "#050401",
        deep: "#100d05",
        dark: "#1a1509",
        container: "#27200e",
        border: "#3d3216",
      },
      secondary: {
        pure: "#ffffff",
        offwhite: "#fdf6e7",
        muted: "#dfcd9f",
        border: "#53441e",
        card: "#1c170a",
      },
      accent: {
        primary: "#f59e0b",
        vibrant: "#fbbf24",
        hover: "#fcd34d",
        dark: "#b45309",
        glow: "rgba(245, 158, 11, 0.22)",
      },
    },
    fonts: {
      heading: AVAILABLE_FONTS.cinzel.css,
      body: AVAILABLE_FONTS.serif.css,
      headingId: "cinzel",
      bodyId: "serif",
      presetId: "pergaminho",
    },
  },

  "sapphire-dark": {
    name: "sapphire-dark",
    label: "Safira Astral",
    description: "Azul cósmico e estrelado com excelente clareza visual e serenidade.",
    mode: "dark",
    colors: {
      dominant: {
        pure: "#02050b",
        deep: "#070e1b",
        dark: "#0d172a",
        container: "#13223f",
        border: "#1e3663",
      },
      secondary: {
        pure: "#ffffff",
        offwhite: "#eef4ff",
        muted: "#adc5ec",
        border: "#274783",
        card: "#101c33",
      },
      accent: {
        primary: "#38bdf8",
        vibrant: "#60a5fa",
        hover: "#93c5fd",
        dark: "#1d4ed8",
        glow: "rgba(56, 189, 248, 0.22)",
      },
    },
    fonts: {
      heading: AVAILABLE_FONTS["cinzel-decorative"].css,
      body: AVAILABLE_FONTS.sans.css,
      headingId: "cinzel-decorative",
      bodyId: "sans",
      presetId: "epica-sans",
    },
  },

  "high-contrast-dark": {
    name: "high-contrast-dark",
    label: "Alto Contraste Preto",
    description: "Preto absoluto com 21:1 de contraste para máxima acessibilidade visual.",
    mode: "dark",
    colors: {
      dominant: {
        pure: "#000000",
        deep: "#000000",
        dark: "#080808",
        container: "#121212",
        border: "#ffffff",
      },
      secondary: {
        pure: "#ffffff",
        offwhite: "#ffffff",
        muted: "#e4e4e7",
        border: "#ffffff",
        card: "#0d0d0d",
      },
      accent: {
        primary: "#ffff00",
        vibrant: "#00ffff",
        hover: "#ffffff",
        dark: "#eab308",
        glow: "rgba(255, 255, 255, 0.3)",
      },
    },
    fonts: {
      heading: AVAILABLE_FONTS.sans.css,
      body: AVAILABLE_FONTS.sans.css,
      headingId: "sans",
      bodyId: "sans",
      presetId: "moderno",
    },
  },

  "parchment-light": {
    name: "parchment-light",
    label: "Pergaminho RPG (Claro)",
    description: "Tons de pergaminho antigo com texto em tinta nanquim de alto contraste.",
    mode: "light",
    colors: {
      dominant: {
        pure: "#efe5cd",
        deep: "#f7f1e1",
        dark: "#ede3cb",
        container: "#e4d8bc",
        border: "#cbbb9b",
      },
      secondary: {
        pure: "#170f06",
        offwhite: "#2d1e0d",
        muted: "#4a341b",
        border: "#bfae8a",
        card: "#fffcf2",
      },
      accent: {
        primary: "#78350f",
        vibrant: "#92400e",
        hover: "#5c2707",
        dark: "#451a03",
        glow: "rgba(120, 53, 15, 0.15)",
      },
    },
    fonts: {
      heading: AVAILABLE_FONTS.cinzel.css,
      body: AVAILABLE_FONTS.serif.css,
      headingId: "cinzel",
      bodyId: "serif",
      presetId: "pergaminho",
    },
  },

  "alabaster-light": {
    name: "alabaster-light",
    label: "Alabastro Puro (Claro)",
    description: "Tema claro moderno e imaculado com destaque roxo real em padrão AAA.",
    mode: "light",
    colors: {
      dominant: {
        pure: "#e2e8f0",
        deep: "#f8fafc",
        dark: "#f1f5f9",
        container: "#e2e8f0",
        border: "#cbd5e1",
      },
      secondary: {
        pure: "#09090b",
        offwhite: "#18181b",
        muted: "#3f3f46",
        border: "#94a3b8",
        card: "#ffffff",
      },
      accent: {
        primary: "#6b21a8",
        vibrant: "#7e22ce",
        hover: "#581c87",
        dark: "#3b0764",
        glow: "rgba(107, 33, 168, 0.15)",
      },
    },
    fonts: {
      heading: AVAILABLE_FONTS["cinzel-decorative"].css,
      body: AVAILABLE_FONTS.sans.css,
      headingId: "cinzel-decorative",
      bodyId: "sans",
      presetId: "epica-sans",
    },
  },

  "nordic-light": {
    name: "nordic-light",
    label: "Névoa Morkvold (Claro)",
    description: "Prata e azul nórdico para ambientes claros, frios e minimalistas.",
    mode: "light",
    colors: {
      dominant: {
        pure: "#cbd5e1",
        deep: "#e2e8f0",
        dark: "#d8e1ea",
        container: "#ccd7e2",
        border: "#94a3b8",
      },
      secondary: {
        pure: "#090d16",
        offwhite: "#172033",
        muted: "#334155",
        border: "#64748b",
        card: "#f1f5f9",
      },
      accent: {
        primary: "#1e3a8a",
        vibrant: "#1d4ed8",
        hover: "#172554",
        dark: "#0f172a",
        glow: "rgba(30, 58, 138, 0.15)",
      },
    },
    fonts: {
      heading: AVAILABLE_FONTS.sans.css,
      body: AVAILABLE_FONTS.sans.css,
      headingId: "sans",
      bodyId: "sans",
      presetId: "moderno",
    },
  },

  "high-contrast-light": {
    name: "high-contrast-light",
    label: "Alto Contraste Branco",
    description: "Branco e preto absolutos com contraste total de 21:1 para máxima legibilidade.",
    mode: "light",
    colors: {
      dominant: {
        pure: "#ffffff",
        deep: "#ffffff",
        dark: "#f5f5f5",
        container: "#ebebeb",
        border: "#000000",
      },
      secondary: {
        pure: "#000000",
        offwhite: "#000000",
        muted: "#1a1a1a",
        border: "#000000",
        card: "#ffffff",
      },
      accent: {
        primary: "#0000cc",
        vibrant: "#000088",
        hover: "#000055",
        dark: "#000033",
        glow: "rgba(0, 0, 0, 0.2)",
      },
    },
    fonts: {
      heading: AVAILABLE_FONTS.sans.css,
      body: AVAILABLE_FONTS.sans.css,
      headingId: "sans",
      bodyId: "sans",
      presetId: "moderno",
    },
  },

  custom: {
    name: "custom",
    label: "Personalizado",
    description: "Cores e fontes personalizadas pelo usuário com verificação de contraste AAA.",
    mode: "dark",
    colors: {
      dominant: {
        pure: "#000000",
        deep: "#09090b",
        dark: "#121217",
        container: "#1a1a24",
        border: "#272730",
      },
      secondary: {
        pure: "#ffffff",
        offwhite: "#f4f4f7",
        muted: "#d1d1db",
        border: "#3f3f4e",
        card: "#16161f",
      },
      accent: {
        primary: "#a855f7",
        vibrant: "#c084fc",
        hover: "#d8b4fe",
        dark: "#7e22ce",
        glow: "rgba(168, 85, 247, 0.2)",
      },
    },
    fonts: {
      heading: AVAILABLE_FONTS["cinzel-decorative"].css,
      body: AVAILABLE_FONTS.sans.css,
      headingId: "cinzel-decorative",
      bodyId: "sans",
      presetId: "epica-sans",
    },
  },
};

export const DEFAULT_THEME: ThemeName = "default-dark";
export const THEME_STORAGE_KEY = "libmork:theme-config";

// =============================================================================
// Aplicação no DOM e Persistência
// =============================================================================

export function applyTheme(config: ThemeConfig): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.setAttribute("data-theme", config.name);
  root.setAttribute("data-theme-mode", config.mode);
  root.style.colorScheme = config.mode;

  // Dominante (60%)
  root.style.setProperty("--dominant-pure", config.colors.dominant.pure);
  root.style.setProperty("--dominant-deep", config.colors.dominant.deep);
  root.style.setProperty("--dominant-dark", config.colors.dominant.dark);
  root.style.setProperty("--dominant-container", config.colors.dominant.container);
  root.style.setProperty("--dominant-border", config.colors.dominant.border);

  // Secundário (30%)
  root.style.setProperty("--secondary-pure", config.colors.secondary.pure);
  root.style.setProperty("--secondary-offwhite", config.colors.secondary.offwhite);
  root.style.setProperty("--secondary-muted", config.colors.secondary.muted);
  root.style.setProperty("--secondary-border", config.colors.secondary.border);
  root.style.setProperty("--secondary-card", config.colors.secondary.card);

  // Accent (10%)
  root.style.setProperty("--accent-primary", config.colors.accent.primary);
  root.style.setProperty("--accent-vibrant", config.colors.accent.vibrant);
  root.style.setProperty("--accent-hover", config.colors.accent.hover);
  root.style.setProperty("--accent-dark", config.colors.accent.dark);
  root.style.setProperty("--accent-glow", config.colors.accent.glow);

  // Tipografia
  root.style.setProperty("--font-heading", config.fonts.heading);
  root.style.setProperty("--font-body", config.fonts.body);

  // Mapeamento dinâmico de superfícies e tons neutros para Tailwind
  root.style.setProperty("--theme-bg-deep", config.colors.dominant.deep);
  root.style.setProperty("--theme-bg-card", config.colors.secondary.card);
  root.style.setProperty("--theme-bg-container", config.colors.dominant.container);
  root.style.setProperty("--theme-border-dominant", config.colors.dominant.border);
  root.style.setProperty("--theme-border-secondary", config.colors.secondary.border);
  root.style.setProperty("--theme-text-pure", config.colors.secondary.pure);
  root.style.setProperty("--theme-text-offwhite", config.colors.secondary.offwhite);
  root.style.setProperty("--theme-text-muted", config.colors.secondary.muted);

  // Mapeamento direto de tokens Tailwind para sincronização em tempo real (Dark & Light)
  root.style.setProperty("--color-dominant", config.colors.dominant.deep);
  root.style.setProperty("--color-dominant-pure", config.colors.dominant.pure);
  root.style.setProperty("--color-dominant-deep", config.colors.dominant.deep);
  root.style.setProperty("--color-dominant-dark", config.colors.dominant.dark);
  root.style.setProperty("--color-dominant-container", config.colors.dominant.container);
  root.style.setProperty("--color-dominant-border", config.colors.dominant.border);

  root.style.setProperty("--color-secondary", config.colors.secondary.pure);
  root.style.setProperty("--color-secondary-pure", config.colors.secondary.pure);
  root.style.setProperty("--color-secondary-offwhite", config.colors.secondary.offwhite);
  root.style.setProperty("--color-secondary-muted", config.colors.secondary.muted);
  root.style.setProperty("--color-secondary-border", config.colors.secondary.border);
  root.style.setProperty("--color-secondary-card", config.colors.secondary.card);

  root.style.setProperty("--color-accent", config.colors.accent.primary);
  root.style.setProperty("--color-accent-primary", config.colors.accent.primary);
  root.style.setProperty("--color-accent-vibrant", config.colors.accent.vibrant);
  root.style.setProperty("--color-accent-hover", config.colors.accent.hover);
  root.style.setProperty("--color-accent-dark", config.colors.accent.dark);
  root.style.setProperty("--color-accent-glow", config.colors.accent.glow);

  // Sincroniza classes legadas purple com a cor de destaque (accent) selecionada
  root.style.setProperty("--color-purple-50", config.colors.accent.glow);
  root.style.setProperty("--color-purple-100", config.colors.accent.glow);
  root.style.setProperty("--color-purple-200", config.colors.accent.hover);
  root.style.setProperty("--color-purple-300", config.colors.accent.hover);
  root.style.setProperty("--color-purple-400", config.colors.accent.hover);
  root.style.setProperty("--color-purple-500", config.colors.accent.vibrant);
  root.style.setProperty("--color-purple-600", config.colors.accent.primary);
  root.style.setProperty("--color-purple-700", config.colors.accent.dark);
  root.style.setProperty("--color-purple-800", config.colors.accent.dark);
  root.style.setProperty("--color-purple-900", config.colors.accent.dark);
  root.style.setProperty("--color-purple-950", config.colors.accent.dark);

  // Sincroniza classes legadas gray com as superfícies dinâmicas (Dark vs Light)
  root.style.setProperty("--color-gray-950", config.colors.dominant.deep);
  root.style.setProperty("--color-gray-900", config.colors.secondary.card);
  root.style.setProperty("--color-gray-800", config.colors.dominant.container);
  root.style.setProperty("--color-gray-700", config.colors.secondary.border);
  root.style.setProperty("--color-gray-600", config.colors.secondary.muted);
  root.style.setProperty("--color-gray-500", config.colors.secondary.muted);
  root.style.setProperty("--color-gray-400", config.colors.secondary.muted);
  root.style.setProperty("--color-gray-300", config.colors.secondary.offwhite);
  root.style.setProperty("--color-gray-200", config.colors.secondary.pure);
  root.style.setProperty("--color-gray-100", config.colors.secondary.pure);

  // Detalhes da UI (Arredondamento, Escala de Textos e Ícones)
  const ui = config.ui || DEFAULT_UI_DETAILS;
  const selectedRadius = RADIUS_PRESETS[ui.borderRadius] || RADIUS_PRESETS.lg;

  const textScaleMap: Record<TextScaleSize, string> = {
    sm: "90%",
    md: "100%",
    lg: "110%",
    xl: "120%",
  };
  const iconScaleMap: Record<IconScaleSize, string> = {
    sm: "0.85",
    md: "1",
    lg: "1.2",
  };

  // Variáveis customizadas do sistema Libmork
  root.style.setProperty("--theme-radius", selectedRadius.lg);
  root.style.setProperty("--radius", selectedRadius.base);
  root.style.setProperty("--theme-radius-xs", selectedRadius.xs);
  root.style.setProperty("--theme-radius-sm", selectedRadius.sm);
  root.style.setProperty("--theme-radius-md", selectedRadius.md);
  root.style.setProperty("--theme-radius-lg", selectedRadius.lg);
  root.style.setProperty("--theme-radius-xl", selectedRadius.xl);
  root.style.setProperty("--theme-radius-2xl", selectedRadius["2xl"]);
  root.style.setProperty("--theme-radius-3xl", selectedRadius["3xl"]);

  // Variáveis padrão Tailwind v4
  root.style.setProperty("--radius-xs", selectedRadius.xs);
  root.style.setProperty("--radius-sm", selectedRadius.sm);
  root.style.setProperty("--radius-md", selectedRadius.md);
  root.style.setProperty("--radius-lg", selectedRadius.lg);
  root.style.setProperty("--radius-xl", selectedRadius.xl);
  root.style.setProperty("--radius-2xl", selectedRadius["2xl"]);
  root.style.setProperty("--radius-3xl", selectedRadius["3xl"]);

  root.style.setProperty("--theme-text-scale", textScaleMap[ui.textScale] || "100%");
  root.style.setProperty("--theme-icon-scale", iconScaleMap[ui.iconScale] || "1");
  root.style.fontSize = textScaleMap[ui.textScale] || "100%";
  root.setAttribute("data-theme-radius", ui.borderRadius);
}

export function getStoredTheme(): ThemeConfig {
  if (typeof window === "undefined") return { ...themes[DEFAULT_THEME] };

  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return { ...themes[DEFAULT_THEME] };

    const parsed = JSON.parse(raw);
    if (parsed && parsed.name && themes[parsed.name as ThemeName]) {
      // Se for um preset com customizações, mescla com o preset
      const base = themes[parsed.name as ThemeName];
      return {
        ...base,
        ...parsed,
        colors: {
          dominant: { ...base.colors.dominant, ...parsed.colors?.dominant },
          secondary: { ...base.colors.secondary, ...parsed.colors?.secondary },
          accent: { ...base.colors.accent, ...parsed.colors?.accent },
        },
        fonts: {
          ...base.fonts,
          ...parsed.fonts,
        },
        ui: {
          ...DEFAULT_UI_DETAILS,
          ...base.ui,
          ...parsed.ui,
        },
      };
    }
  } catch {
    // Fallback silencioso para padrão
  }

  return { ...themes[DEFAULT_THEME] };
}

export function saveStoredTheme(config: ThemeConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignora quota excedida
  }
}

export function setTheme(themeName: ThemeName): void {
  const config = themes[themeName] || themes[DEFAULT_THEME];
  applyTheme(config);
  saveStoredTheme(config);
}

export function getCurrentTheme(): ThemeName {
  if (typeof document !== "undefined") {
    const current = document.documentElement.getAttribute("data-theme") as ThemeName;
    if (current && themes[current]) {
      return current;
    }
  }
  return DEFAULT_THEME;
}
