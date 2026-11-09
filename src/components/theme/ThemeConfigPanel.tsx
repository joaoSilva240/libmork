"use client";

// =============================================================================
// Libmork — Painel de Configurações de Tema e Acessibilidade (WCAG AAA)
// =============================================================================

import React, { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import {
  AVAILABLE_FONTS,
  FONT_PRESETS,
  themes,
  type FontFamilyId,
  type FontPresetId,
  type ThemeMode,
  type ThemeName,
  type BorderRadiusSize,
  type TextScaleSize,
  type IconScaleSize,
  DEFAULT_UI_DETAILS,
} from "@/lib/theme";

export interface ThemeConfigPanelProps {
  activeSubTab?: "themes_colors" | "fonts" | "ui_details";
  onSubTabChange?: (tab: "themes_colors" | "fonts" | "ui_details") => void;
  hideSubTabsBar?: boolean;
}

export function ThemeConfigPanel({
  activeSubTab: externalSubTab,
  onSubTabChange,
  hideSubTabsBar = false,
}: ThemeConfigPanelProps = {}) {
  const {
    theme,
    mode,
    setThemeName,
    setThemeMode,
    setFontPreset,
    setFonts,
    updateUiDetails,
    resetTheme,
  } = useTheme();

  const [filterMode, setFilterMode] = useState<"all" | "dark" | "light">("all");
  const [internalSubTab, setInternalSubTab] = useState<"themes_colors" | "fonts" | "ui_details">("themes_colors");

  const activeSubTab = externalSubTab ?? internalSubTab;
  const setActiveSubTab = onSubTabChange ?? setInternalSubTab;

  const filteredPresets = Object.values(themes)
    .filter((t) => t.name !== "custom")
    .filter((t) => (filterMode === "all" ? true : t.mode === filterMode));

  return (
    <div className="space-y-6">
      {/* ======================================================================= */}
      {/* NAVEGAÇÃO DE SUB-ABAS (LADO A LADO)                                      */}
      {/* ======================================================================= */}
      {!hideSubTabsBar && (
        <div className="grid grid-cols-3 gap-2 border-b border-secondary-border pb-3">
          <button
            type="button"
            aria-label="Temas & Cores do Sistema (60-30-10)"
            aria-pressed={activeSubTab === "themes_colors"}
            onClick={() => setActiveSubTab("themes_colors")}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === "themes_colors"
                ? "bg-accent text-white shadow-sm ring-1 ring-accent"
                : "text-secondary-muted hover:text-secondary-pure hover:bg-dominant-container/50"
            }`}
          >
            <span className="text-sm">🎨</span>
            <span className="truncate">Temas</span>
          </button>
          <button
            type="button"
            aria-label="Tipografia & Fontes"
            aria-pressed={activeSubTab === "fonts"}
            onClick={() => setActiveSubTab("fonts")}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === "fonts"
                ? "bg-accent text-white shadow-sm ring-1 ring-accent"
                : "text-secondary-muted hover:text-secondary-pure hover:bg-dominant-container/50"
            }`}
          >
            <span className="text-sm">✍️</span>
            <span className="truncate">Tipografia</span>
          </button>
          <button
            type="button"
            aria-label="Detalhes da UI & Aparência"
            aria-pressed={activeSubTab === "ui_details"}
            onClick={() => setActiveSubTab("ui_details")}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === "ui_details"
                ? "bg-accent text-white shadow-sm ring-1 ring-accent"
                : "text-secondary-muted hover:text-secondary-pure hover:bg-dominant-container/50"
            }`}
          >
            <span className="text-sm">📐</span>
            <span className="truncate">Detalhes</span>
          </button>
        </div>
      )}

      {/* ======================================================================= */}
      {/* SUB-ABA 1: TEMAS & CORES UNIFICADOS                                     */}
      {/* ======================================================================= */}
      {activeSubTab === "themes_colors" && (
        <div className="space-y-8">
          {/* Seção 1: Temas Calibrados com Preview do Próprio Tema */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover">
                  Temas Calibrados AAA ({filteredPresets.length})
                </h4>
                <p className="text-xs text-secondary-muted">
                  Cada card reflete fielmente as cores dominantes, superfícies e tipografia do tema correspondente.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <div className="flex items-center gap-1 bg-dominant-deep p-1 rounded-lg border border-secondary-border text-[11px]">
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={`px-2 py-0.5 rounded transition ${
                      filterMode === "all"
                        ? "bg-accent text-white font-bold"
                        : "text-secondary-muted hover:text-secondary-pure"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode("dark");
                      if (mode !== "dark") setThemeMode("dark");
                    }}
                    className={`px-2 py-0.5 rounded transition ${
                      filterMode === "dark"
                        ? "bg-accent text-white font-bold"
                        : "text-secondary-muted hover:text-secondary-pure"
                    }`}
                  >
                    🌙 Escuro
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode("light");
                      if (mode !== "light") setThemeMode("light");
                    }}
                    className={`px-2 py-0.5 rounded transition ${
                      filterMode === "light"
                        ? "bg-accent text-white font-bold"
                        : "text-secondary-muted hover:text-secondary-pure"
                    }`}
                  >
                    ☀️ Claro
                  </button>
                </div>

                <button
                  type="button"
                  onClick={resetTheme}
                  className="rounded-lg border border-secondary-border bg-dominant-container px-2.5 py-1 text-xs font-semibold text-secondary-offwhite hover:bg-dominant-container/80 hover:text-secondary-pure transition"
                >
                  Restaurar Tema Padrão
                </button>
              </div>
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5"
              role="radiogroup"
              aria-label="Temas do sistema"
            >
              {filteredPresets.map((preset) => {
                const isSelected = theme.name === preset.name;

                return (
                  <div
                    key={preset.name}
                    onClick={() => setThemeName(preset.name as ThemeName)}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        setThemeName(preset.name as ThemeName);
                      }
                    }}
                    className={`cursor-pointer rounded-xl border p-4 transition-all select-none flex flex-col justify-between gap-3 shadow-md ${
                      isSelected
                        ? "ring-2 ring-accent scale-[1.01]"
                        : "hover:scale-[1.01] hover:shadow-lg opacity-95 hover:opacity-100"
                    }`}
                    style={{
                      backgroundColor: preset.colors.dominant.deep,
                      borderColor: isSelected
                        ? preset.colors.accent.primary
                        : preset.colors.dominant.border,
                      color: preset.colors.secondary.pure,
                    }}
                  >
                    {/* Header do Card Preview */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider"
                          style={{
                            backgroundColor: preset.colors.dominant.container,
                            color: preset.colors.secondary.offwhite,
                            border: `1px solid ${preset.colors.dominant.border}`,
                          }}
                        >
                          {preset.mode === "dark" ? "🌙 Escuro" : "☀️ Claro"}
                        </span>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                          style={{
                            backgroundColor: preset.colors.accent.dark,
                            color: "#ffffff",
                          }}
                        >
                          AAA
                        </span>
                      </div>

                      {isSelected ? (
                        <span
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: preset.colors.accent.glow,
                            color: preset.colors.accent.vibrant,
                            border: `1px solid ${preset.colors.accent.primary}`,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full animate-pulse"
                            style={{ backgroundColor: preset.colors.accent.primary }}
                          />
                          Ativo
                        </span>
                      ) : (
                        <span
                          className="text-[10px] opacity-75 hover:opacity-100"
                          style={{ color: preset.colors.secondary.muted }}
                        >
                          Aplicar
                        </span>
                      )}
                    </div>

                    {/* Superfície Elevada Interna com Tipografia Real do Tema */}
                    <div
                      className="rounded-lg p-3 border space-y-2.5 transition-all shadow-inner"
                      style={{
                        backgroundColor: preset.colors.secondary.card,
                        borderColor: preset.colors.secondary.border,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-sm font-bold truncate leading-tight"
                          style={{
                            color: preset.colors.secondary.pure,
                            fontFamily: preset.fonts.heading,
                          }}
                        >
                          {preset.label}
                        </span>

                        <span
                          className="text-[9px] font-bold px-2 py-0.5 rounded shadow-sm shrink-0"
                          style={{
                            backgroundColor: preset.colors.accent.primary,
                            color: "#ffffff",
                          }}
                        >
                          Ação
                        </span>
                      </div>

                      <p
                        className="text-xs line-clamp-2 leading-relaxed"
                        style={{
                          color: preset.colors.secondary.muted,
                          fontFamily: preset.fonts.body,
                        }}
                      >
                        {preset.description}
                      </p>

                      {/* Swatches e Metadados do Tema */}
                      <div
                        className="flex items-center justify-between pt-2 border-t text-[10px]"
                        style={{ borderColor: preset.colors.dominant.border }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-3.5 w-3.5 rounded-full border shadow-sm"
                            style={{
                              backgroundColor: preset.colors.dominant.deep,
                              borderColor: preset.colors.secondary.border,
                            }}
                            title="Fundo Dominante"
                          />
                          <span
                            className="h-3.5 w-3.5 rounded-full border shadow-sm"
                            style={{
                              backgroundColor: preset.colors.secondary.card,
                              borderColor: preset.colors.secondary.border,
                            }}
                            title="Superfície Card"
                          />
                          <span
                            className="h-3.5 w-3.5 rounded-full border shadow-sm"
                            style={{
                              backgroundColor: preset.colors.accent.primary,
                              borderColor: preset.colors.accent.vibrant,
                            }}
                            title="Destaque Interativo"
                          />
                          <span
                            className="h-3.5 w-3.5 rounded-full border shadow-sm"
                            style={{
                              backgroundColor: preset.colors.secondary.pure,
                              borderColor: preset.colors.secondary.border,
                            }}
                            title="Texto Primário"
                          />
                        </div>

                        <span
                          className="font-mono text-[9px] font-medium"
                          style={{ color: preset.colors.secondary.offwhite }}
                        >
                          WCAG AAA ✓
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* SUB-ABA 3: TIPOGRAFIA E FONTES DO SISTEMA                                */}
      {/* ======================================================================= */}
      {activeSubTab === "fonts" && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover">
                Presets Tipográficos Oficiais
              </h4>
              <span className="text-[11px] text-secondary-muted">
                {Object.keys(FONT_PRESETS).length} combinações curadas para RPG e leitura AAA
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.values(FONT_PRESETS).map((p) => {
                const isSelected = theme.fonts.presetId === p.id;
                const headingDef = AVAILABLE_FONTS[p.headingId];
                const bodyDef = AVAILABLE_FONTS[p.bodyId];

                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setFontPreset(p.id as FontPresetId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setFontPreset(p.id as FontPresetId);
                      }
                    }}
                    className={`cursor-pointer rounded-xl border p-4 transition-all select-none flex flex-col justify-between ${
                      isSelected
                        ? "border-accent bg-accent/15 ring-2 ring-accent shadow-md"
                        : "border-secondary-border bg-secondary-card hover:border-accent/50 hover:bg-secondary-card/90"
                    }`}
                  >
                    {/* Top Header do Card: Tag + Status de Ativação */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {p.tag && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-dominant-deep border border-secondary-border text-secondary-muted font-medium">
                            {p.tag}
                          </span>
                        )}
                        {headingDef?.origin === "local" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                            Local
                          </span>
                        )}
                        {headingDef?.origin === "google" && !p.headingId.startsWith("cinzel") && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 font-mono">
                            Google Fonts
                          </span>
                        )}
                      </div>

                      {isSelected ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-accent-hover bg-accent/20 px-2 py-0.5 rounded-full border border-accent/40">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" /> Ativo
                        </span>
                      ) : (
                        <span className="text-[10px] text-secondary-muted hover:text-secondary-pure">
                          Aplicar
                        </span>
                      )}
                    </div>

                    {/* Preview Direto das Fontes Ofertadas */}
                    <div className="my-2 p-3 rounded-lg bg-dominant-deep/80 border border-secondary-border/70 shadow-inner">
                      {/* Título com a fonte do cabeçalho do preset */}
                      <div
                        className="text-base font-bold text-secondary-pure leading-tight mb-1.5 truncate"
                        style={{ fontFamily: headingDef?.css }}
                        title={p.label}
                      >
                        {p.label}
                      </div>

                      {/* Descrição com a fonte do corpo do preset */}
                      <p
                        className="text-xs text-secondary-muted line-clamp-2 leading-relaxed"
                        style={{ fontFamily: bodyDef?.css }}
                      >
                        {p.description}
                      </p>
                    </div>

                    {/* Rodapé com identificação das fontes utilizadas */}
                    <div className="text-[10px] text-secondary-muted flex items-center justify-between border-t border-secondary-border/50 pt-2 mt-auto">
                      <div className="flex items-center gap-1 truncate max-w-[65%]">
                        <span className="text-secondary-offwhite font-semibold">Títulos:</span>
                        <span
                          className="text-accent-hover font-medium truncate"
                          style={{ fontFamily: headingDef?.css }}
                        >
                          {headingDef?.label.split(" (")[0]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 truncate max-w-[35%] justify-end">
                        <span className="text-secondary-offwhite font-semibold">Corpo:</span>
                        <span
                          className="text-secondary-pure font-medium truncate"
                          style={{ fontFamily: bodyDef?.css }}
                        >
                          {bodyDef?.label.split(" (")[0]}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-secondary-border bg-secondary-card p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-secondary-border pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover">
                Seleção Manual de Fontes do Sistema
              </h4>
              <span className="text-[11px] text-secondary-muted">
                Inclui fontes da pasta local (D&D/Vecna), Google Fonts temáticas e do sistema
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-secondary-offwhite mb-1.5">
                  Fonte para Títulos (h1, h2, h3, botões de ação)
                </label>
                <select
                  value={theme.fonts.headingId}
                  onChange={(e) =>
                    setFonts(e.target.value as FontFamilyId, theme.fonts.bodyId)
                  }
                  className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-3 py-2 text-xs text-secondary-pure outline-none focus:ring-2 focus:ring-accent"
                >
                  <optgroup label="⚔️ Clássicas de RPG & D&D (Locais)">
                    {Object.values(AVAILABLE_FONTS)
                      .filter((f) => f.origin === "local")
                      .map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.label}
                        </option>
                      ))}
                  </optgroup>

                  <optgroup label="📜 Temáticas de RPG & Fantasia (Google Fonts)">
                    {Object.values(AVAILABLE_FONTS)
                      .filter((f) => f.origin === "google" && !f.id.startsWith("cinzel"))
                      .map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.label}
                        </option>
                      ))}
                  </optgroup>

                  <optgroup label="✨ Universais do Sistema">
                    {Object.values(AVAILABLE_FONTS)
                      .filter((f) => f.origin === "system" || f.id.startsWith("cinzel"))
                      .map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.label}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary-offwhite mb-1.5">
                  Fonte para Corpo de Texto (descrições, tabelas, leitura)
                </label>
                <select
                  value={theme.fonts.bodyId}
                  onChange={(e) =>
                    setFonts(theme.fonts.headingId, e.target.value as FontFamilyId)
                  }
                  className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-3 py-2 text-xs text-secondary-pure outline-none focus:ring-2 focus:ring-accent"
                >
                  <optgroup label="⚔️ Clássicas de RPG & D&D (Locais)">
                    {Object.values(AVAILABLE_FONTS)
                      .filter((f) => f.origin === "local")
                      .map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.label}
                        </option>
                      ))}
                  </optgroup>

                  <optgroup label="📜 Temáticas de RPG & Fantasia (Google Fonts)">
                    {Object.values(AVAILABLE_FONTS)
                      .filter((f) => f.origin === "google" && !f.id.startsWith("cinzel"))
                      .map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.label}
                        </option>
                      ))}
                  </optgroup>

                  <optgroup label="✨ Universais do Sistema">
                    {Object.values(AVAILABLE_FONTS)
                      .filter((f) => f.origin === "system" || f.id.startsWith("cinzel"))
                      .map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.label}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Amostrador Tipográfico Interativo */}
            <div className="rounded-lg border border-secondary-border bg-dominant-deep p-3.5 space-y-2">
              <span className="text-[10px] font-mono text-accent-hover uppercase tracking-wider block">
                Amostra da Tipografia Ativa
              </span>
              <div
                className="text-base font-bold text-secondary-pure transition-all"
                style={{ fontFamily: theme.fonts.heading }}
              >
                Títulos & Ações: A Masmorra do Olho Tirano (D&D 5e / OSR)
              </div>
              <div
                className="text-xs text-secondary-muted leading-relaxed transition-all"
                style={{ fontFamily: theme.fonts.body }}
              >
                Corpo & Leitura: “Nas profundezas da cripta esquecida, os glifos sussurram segredos esquecidos pelos deuses. Role 1d20 + modificador de Sabedoria para decifrar a inscrição rúnica.”
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* SUB-ABA 3: DETALHES DA UI (BORDAS, TEXTOS E ÍCONES)                     */}
      {/* ======================================================================= */}
      {activeSubTab === "ui_details" && (
        <div className="space-y-6">
          {/* Seção 1: Arredondamento das Bordas */}
          <div className="rounded-xl border border-secondary-border bg-secondary-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-secondary-border pb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover">
                  Arredondamento das Bordas (Border Radius)
                </h4>
                <p className="text-xs text-secondary-muted">
                  Defina o estilo visual das quinas em botões, cards, painéis e caixas modais.
                </p>
              </div>
              <span className="text-[11px] font-mono text-secondary-offwhite bg-dominant-deep px-2 py-0.5 rounded border border-secondary-border">
                Ativo: {theme.ui?.borderRadius || DEFAULT_UI_DETAILS.borderRadius}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { id: "none", label: "Reto / 0px", sampleRadius: "0px" },
                { id: "sm", label: "Sutil / 4px", sampleRadius: "4px" },
                { id: "md", label: "Padrão / 8px", sampleRadius: "8px" },
                { id: "lg", label: "Arredondado / 12px", sampleRadius: "12px" },
                { id: "xl", label: "Amplo / 16px", sampleRadius: "16px" },
                { id: "full", label: "Pílula / Fluido", sampleRadius: "9999px" },
              ].map((opt) => {
                const currentRadius = theme.ui?.borderRadius || DEFAULT_UI_DETAILS.borderRadius;
                const isSelected = currentRadius === opt.id;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateUiDetails({ borderRadius: opt.id as BorderRadiusSize })}
                    style={{ borderRadius: opt.sampleRadius }}
                    className={`flex flex-col items-center justify-center p-3 border transition-all text-center select-none ${
                      isSelected
                        ? "border-accent bg-accent/20 ring-2 ring-accent"
                        : "border-secondary-border bg-dominant-deep hover:border-accent/50 hover:bg-dominant-container/40"
                    }`}
                  >
                    <div
                      className="h-7 w-7 border-2 border-accent mb-2 bg-accent/20 transition-all shadow-sm"
                      style={{ borderRadius: opt.sampleRadius }}
                    />
                    <span className="text-xs font-bold text-secondary-pure">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seção 2: Tamanho dos Textos & Ícones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tamanho dos Textos */}
            <div className="rounded-xl border border-secondary-border bg-secondary-card p-5 space-y-4">
              <div className="border-b border-secondary-border pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover">
                  Escala de Tamanho dos Textos
                </h4>
                <p className="text-xs text-secondary-muted">
                  Ajuste a densidade tipográfica global da aplicação para maior conforto de leitura.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: "sm", label: "Compacto", scale: "90%", desc: "Mais dados na tela" },
                  { id: "md", label: "Padrão", scale: "100%", desc: "Equilíbrio original" },
                  { id: "lg", label: "Confortável", scale: "110%", desc: "Leitura relaxada" },
                  { id: "xl", label: "Acessibilidade", scale: "120%", desc: "Alta visibilidade" },
                ].map((opt) => {
                  const currentScale = theme.ui?.textScale || DEFAULT_UI_DETAILS.textScale;
                  const isSelected = currentScale === opt.id;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateUiDetails({ textScale: opt.id as TextScaleSize })}
                      className={`p-3 rounded-lg border text-left transition select-none ${
                        isSelected
                          ? "border-accent bg-accent/20 ring-1 ring-accent"
                          : "border-secondary-border bg-dominant-deep hover:border-accent/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-secondary-pure">{opt.label}</span>
                        <span className="text-[10px] font-mono text-accent-hover">{opt.scale}</span>
                      </div>
                      <span className="text-[11px] text-secondary-muted block">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tamanho dos Ícones */}
            <div className="rounded-xl border border-secondary-border bg-secondary-card p-5 space-y-4">
              <div className="border-b border-secondary-border pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover">
                  Tamanho dos Ícones
                </h4>
                <p className="text-xs text-secondary-muted">
                  Dimensione os símbolos e glifos visuais da interface (dados, botões e ações).
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: "sm", label: "Pequeno", scale: "85%", iconSize: "scale-85" },
                  { id: "md", label: "Padrão", scale: "100%", iconSize: "scale-100" },
                  { id: "lg", label: "Grande", scale: "120%", iconSize: "scale-120" },
                ].map((opt) => {
                  const currentIcon = theme.ui?.iconScale || DEFAULT_UI_DETAILS.iconScale;
                  const isSelected = currentIcon === opt.id;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateUiDetails({ iconScale: opt.id as IconScaleSize })}
                      className={`p-3 rounded-lg border flex flex-col items-center justify-center transition select-none ${
                        isSelected
                          ? "border-accent bg-accent/20 ring-1 ring-accent"
                          : "border-secondary-border bg-dominant-deep hover:border-accent/40"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5 my-2">
                        <span className={`text-base transition-transform ${opt.iconSize}`}>⚔️</span>
                        <span className={`text-base transition-transform ${opt.iconSize}`}>🛡️</span>
                      </div>
                      <span className="text-xs font-bold text-secondary-pure">{opt.label}</span>
                      <span className="text-[10px] font-mono text-secondary-muted">{opt.scale}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
