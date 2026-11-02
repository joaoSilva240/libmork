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
} from "@/lib/theme";

export function ThemeConfigPanel() {
  const {
    theme,
    mode,
    setThemeName,
    setThemeMode,
    updateColor,
    setFontPreset,
    setFonts,
    optimizeContrast,
    resetTheme,
    isAaaCompliant,
    contrastEvaluation,
  } = useTheme();

  const [filterMode, setFilterMode] = useState<"all" | "dark" | "light">("all");
  const [activeSubTab, setActiveSubTab] = useState<"presets" | "colors" | "fonts">("presets");

  const filteredPresets = Object.values(themes)
    .filter((t) => t.name !== "custom")
    .filter((t) => (filterMode === "all" ? true : t.mode === filterMode));

  return (
    <div className="space-y-6">
      {/* ======================================================================= */}
      {/* 1. SELETOR DE MODO (CLARO / ESCURO) E RESTAURAÇÃO                       */}
      {/* ======================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-secondary-border bg-secondary-card p-4">
        <div>
          <h3 className="text-sm font-bold text-secondary-pure flex items-center gap-2">
            <span>🌓</span> Modo de Luminosidade
          </h3>
          <p className="text-xs text-secondary-muted">
            Alterne entre temas escuros e claros com calibração automática de superfície.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-secondary-border bg-dominant-deep p-1">
            <button
              type="button"
              onClick={() => {
                setThemeMode("dark");
                setFilterMode("dark");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                mode === "dark"
                  ? "bg-accent text-white shadow"
                  : "text-secondary-muted hover:text-secondary-pure"
              }`}
            >
              <span>🌙</span> Escuro
            </button>
            <button
              type="button"
              onClick={() => {
                setThemeMode("light");
                setFilterMode("light");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                mode === "light"
                  ? "bg-amber-500 text-gray-950 shadow"
                  : "text-secondary-muted hover:text-secondary-pure"
              }`}
            >
              <span>☀️</span> Claro
            </button>
          </div>

          <button
            type="button"
            onClick={resetTheme}
            className="rounded-lg border border-secondary-border bg-dominant-container px-3 py-1.5 text-xs font-semibold text-secondary-offwhite hover:bg-dominant-container/80 hover:text-secondary-pure transition"
          >
            Restaurar Tema Padrão
          </button>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 2. MONITOR WCAG AAA EM TEMPO REAL                                       */}
      {/* ======================================================================= */}
      <div
        className={`rounded-xl border p-4 transition-colors ${
          isAaaCompliant
            ? "border-emerald-800/80 bg-emerald-950/30"
            : "border-amber-700/80 bg-amber-950/30"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{isAaaCompliant ? "🛡️" : "⚠️"}</span>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Auditoria de Acessibilidade — Padrão WCAG 2.1 (AAA)
              </h4>
              <p className="text-[11px] text-gray-300">
                {isAaaCompliant
                  ? "Excelente! A paleta ativa atinge a meta máxima de contraste AAA (mínimo 7.0:1 para textos)."
                  : "Atenção: Algumas combinações de cores personalizadas estão abaixo do limiar estrito AAA (7.0:1)."}
              </p>
            </div>
          </div>

          {!isAaaCompliant && (
            <button
              type="button"
              onClick={optimizeContrast}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-gray-950 hover:bg-amber-400 transition shrink-0 shadow"
            >
              ⚡ Otimizar para AAA
            </button>
          )}
        </div>

        {/* Métricas de Contraste Detalhadas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 text-[11px]">
          <div className="rounded-lg bg-dominant-deep/70 p-2">
            <span className="block text-secondary-muted text-[10px]">Texto / Fundo</span>
            <span
              className={`font-mono font-bold ${
                contrastEvaluation.textOnDeepRatio >= 7.0
                  ? "text-emerald-400"
                  : "text-amber-400"
              }`}
            >
              {contrastEvaluation.textOnDeepRatio}:1 (AAA)
            </span>
          </div>
          <div className="rounded-lg bg-dominant-deep/70 p-2">
            <span className="block text-secondary-muted text-[10px]">Texto / Card</span>
            <span
              className={`font-mono font-bold ${
                contrastEvaluation.textOnCardRatio >= 7.0
                  ? "text-emerald-400"
                  : "text-amber-400"
              }`}
            >
              {contrastEvaluation.textOnCardRatio}:1 (AAA)
            </span>
          </div>
          <div className="rounded-lg bg-dominant-deep/70 p-2">
            <span className="block text-secondary-muted text-[10px]">Leitura / Fundo</span>
            <span
              className={`font-mono font-bold ${
                contrastEvaluation.offwhiteOnDeepRatio >= 7.0
                  ? "text-emerald-400"
                  : "text-amber-400"
              }`}
            >
              {contrastEvaluation.offwhiteOnDeepRatio}:1 (AAA)
            </span>
          </div>
          <div className="rounded-lg bg-dominant-deep/70 p-2">
            <span className="block text-secondary-muted text-[10px]">Atenuado / Card</span>
            <span
              className={`font-mono font-bold ${
                contrastEvaluation.mutedOnCardRatio >= 4.5
                  ? "text-emerald-400"
                  : "text-amber-400"
              }`}
            >
              {contrastEvaluation.mutedOnCardRatio}:1 (AA+)
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* SUB-ABAS DO PAINEL: TEMAS PRONTOS / CORES DO SISTEMA / TIPOGRAFIA        */}
      {/* ======================================================================= */}
      <div className="flex border-b border-secondary-border">
        <button
          type="button"
          onClick={() => setActiveSubTab("presets")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeSubTab === "presets"
              ? "border-accent text-secondary-pure"
              : "border-transparent text-secondary-muted hover:text-secondary-pure"
          }`}
        >
          <span>🎨</span> Temas Calibrados AAA ({filteredPresets.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("colors")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeSubTab === "colors"
              ? "border-accent text-secondary-pure"
              : "border-transparent text-secondary-muted hover:text-secondary-pure"
          }`}
        >
          <span>🎛️</span> Cores do Sistema (60-30-10)
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("fonts")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeSubTab === "fonts"
              ? "border-accent text-secondary-pure"
              : "border-transparent text-secondary-muted hover:text-secondary-pure"
          }`}
        >
          <span>✍️</span> Tipografia & Fontes
        </button>
      </div>

      {/* ======================================================================= */}
      {/* SUB-ABA 1: TEMAS PRONTOS                                               */}
      {/* ======================================================================= */}
      {activeSubTab === "presets" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary-muted">
              Escolha um dos esquemas oficiais pré-calibrados para conformidade estrita WCAG AAA:
            </span>
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
                Escuros
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
                Claros
              </button>
            </div>
          </div>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
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
                  className={`cursor-pointer rounded-xl border p-4 transition-all select-none flex flex-col justify-between gap-3 ${
                    isSelected
                      ? "border-accent bg-accent/20 shadow-lg ring-2 ring-accent/80"
                      : "border-secondary-border bg-secondary-card hover:border-accent/50 hover:bg-dominant-container/30"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-secondary-pure">
                          {preset.label}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                            preset.mode === "dark"
                              ? "bg-dominant-container text-secondary-muted"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {preset.mode === "dark" ? "Escuro" : "Claro"}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="h-2.5 w-2.5 rounded-full bg-accent shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-secondary-muted line-clamp-2">
                      {preset.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-secondary-border/60">
                    {/* Swatches das 4 cores fundamentais */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-4 w-4 rounded-full border border-secondary-border shadow-sm"
                        style={{ backgroundColor: preset.colors.dominant.deep }}
                        title="Fundo Dominante"
                      />
                      <span
                        className="h-4 w-4 rounded-full border border-secondary-border shadow-sm"
                        style={{ backgroundColor: preset.colors.secondary.card }}
                        title="Superfície de Card"
                      />
                      <span
                        className="h-4 w-4 rounded-full border border-secondary-border shadow-sm"
                        style={{ backgroundColor: preset.colors.accent.primary }}
                        title="Destaque Interativo"
                      />
                      <span
                        className="h-4 w-4 rounded-full border border-secondary-border shadow-sm"
                        style={{ backgroundColor: preset.colors.secondary.pure }}
                        title="Texto Primário"
                      />
                    </div>

                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-800/60">
                      AAA ✓
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* SUB-ABA 2: CORES DO SISTEMA (CUSTOMIZAÇÃO 60-30-10)                     */}
      {/* ======================================================================= */}
      {activeSubTab === "colors" && (
        <div className="space-y-6">
          <p className="text-xs text-secondary-muted">
            Ajuste as cores principais do sistema. Os textos de leitura e cards são automaticamente calibrados para respeitar a proporção mínima de 7.0:1 (WCAG AAA).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bloco Dominante (60%) */}
            <div className="rounded-xl border border-secondary-border bg-secondary-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-secondary-border pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover">
                  Dominante (60%)
                </h4>
                <span className="text-[10px] text-secondary-muted">Fundo e Base</span>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-secondary-offwhite">
                  Fundo Profundo (deep)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.colors.dominant.deep}
                    onChange={(e) => updateColor("dominant", "deep", e.target.value)}
                    className="h-8 w-12 rounded cursor-pointer border border-secondary-border bg-transparent"
                    title="Seletor de cor profunda"
                  />
                  <input
                    type="text"
                    value={theme.colors.dominant.deep}
                    onChange={(e) => updateColor("dominant", "deep", e.target.value)}
                    className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-2.5 py-1 text-xs text-secondary-pure font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-secondary-offwhite">
                  Superfície Escura (dark)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.colors.dominant.dark}
                    onChange={(e) => updateColor("dominant", "dark", e.target.value)}
                    className="h-8 w-12 rounded cursor-pointer border border-secondary-border bg-transparent"
                    title="Seletor de cor escura"
                  />
                  <input
                    type="text"
                    value={theme.colors.dominant.dark}
                    onChange={(e) => updateColor("dominant", "dark", e.target.value)}
                    className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-2.5 py-1 text-xs text-secondary-pure font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-secondary-offwhite">
                  Borda Dominante
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.colors.dominant.border}
                    onChange={(e) => updateColor("dominant", "border", e.target.value)}
                    className="h-8 w-12 rounded cursor-pointer border border-secondary-border bg-transparent"
                    title="Seletor de cor de borda"
                  />
                  <input
                    type="text"
                    value={theme.colors.dominant.border}
                    onChange={(e) => updateColor("dominant", "border", e.target.value)}
                    className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-2.5 py-1 text-xs text-secondary-pure font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Bloco Secundário (30%) */}
            <div className="rounded-xl border border-secondary-border bg-secondary-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-secondary-border pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover">
                  Secundário (30%)
                </h4>
                <span className="text-[10px] text-secondary-muted">Cards e Texto</span>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-secondary-offwhite">
                  Fundo de Cartão (card)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.colors.secondary.card}
                    onChange={(e) => updateColor("secondary", "card", e.target.value)}
                    className="h-8 w-12 rounded cursor-pointer border border-secondary-border bg-transparent"
                    title="Seletor de cor do cartão"
                  />
                  <input
                    type="text"
                    value={theme.colors.secondary.card}
                    onChange={(e) => updateColor("secondary", "card", e.target.value)}
                    className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-2.5 py-1 text-xs text-secondary-pure font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-secondary-offwhite">
                  Texto Principal (pure)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.colors.secondary.pure}
                    onChange={(e) => updateColor("secondary", "pure", e.target.value)}
                    className="h-8 w-12 rounded cursor-pointer border border-secondary-border bg-transparent"
                    title="Seletor de cor de texto"
                  />
                  <input
                    type="text"
                    value={theme.colors.secondary.pure}
                    onChange={(e) => updateColor("secondary", "pure", e.target.value)}
                    className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-2.5 py-1 text-xs text-secondary-pure font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-secondary-offwhite">
                  Texto Atenuado (muted)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.colors.secondary.muted}
                    onChange={(e) => updateColor("secondary", "muted", e.target.value)}
                    className="h-8 w-12 rounded cursor-pointer border border-secondary-border bg-transparent"
                    title="Seletor de cor de texto atenuado"
                  />
                  <input
                    type="text"
                    value={theme.colors.secondary.muted}
                    onChange={(e) => updateColor("secondary", "muted", e.target.value)}
                    className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-2.5 py-1 text-xs text-secondary-pure font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Bloco Accent (10%) */}
            <div className="rounded-xl border border-secondary-border bg-secondary-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-secondary-border pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover">
                  Destaque (10%)
                </h4>
                <span className="text-[10px] text-secondary-muted">Ações e Foco</span>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-secondary-offwhite">
                  Destaque Primário (primary)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.colors.accent.primary}
                    onChange={(e) => updateColor("accent", "primary", e.target.value)}
                    className="h-8 w-12 rounded cursor-pointer border border-secondary-border bg-transparent"
                    title="Seletor de cor de destaque primário"
                  />
                  <input
                    type="text"
                    value={theme.colors.accent.primary}
                    onChange={(e) => updateColor("accent", "primary", e.target.value)}
                    className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-2.5 py-1 text-xs text-secondary-pure font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-secondary-offwhite">
                  Destaque Vibrante / Foco
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.colors.accent.vibrant}
                    onChange={(e) => updateColor("accent", "vibrant", e.target.value)}
                    className="h-8 w-12 rounded cursor-pointer border border-secondary-border bg-transparent"
                    title="Seletor de cor de destaque vibrante"
                  />
                  <input
                    type="text"
                    value={theme.colors.accent.vibrant}
                    onChange={(e) => updateColor("accent", "vibrant", e.target.value)}
                    className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-2.5 py-1 text-xs text-secondary-pure font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-secondary-offwhite">
                  Hover Interativo
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.colors.accent.hover}
                    onChange={(e) => updateColor("accent", "hover", e.target.value)}
                    className="h-8 w-12 rounded cursor-pointer border border-secondary-border bg-transparent"
                    title="Seletor de cor de hover"
                  />
                  <input
                    type="text"
                    value={theme.colors.accent.hover}
                    onChange={(e) => updateColor("accent", "hover", e.target.value)}
                    className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-2.5 py-1 text-xs text-secondary-pure font-mono"
                  />
                </div>
              </div>
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover mb-2">
              Presets Tipográficos Oficiais
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.values(FONT_PRESETS).map((p) => {
                const isSelected = theme.fonts.presetId === p.id;

                return (
                  <div
                    key={p.id}
                    onClick={() => setFontPreset(p.id as FontPresetId)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all select-none ${
                      isSelected
                        ? "border-accent bg-accent/20 ring-1 ring-accent"
                        : "border-secondary-border bg-secondary-card hover:border-accent/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-secondary-pure">{p.label}</span>
                      {isSelected && (
                        <span className="h-2 w-2 rounded-full bg-accent" />
                      )}
                    </div>
                    <p className="text-[11px] text-secondary-muted mb-2">{p.description}</p>
                    <div className="text-[10px] text-accent-hover font-mono">
                      Títulos: {AVAILABLE_FONTS[p.headingId].label.split(" ")[0]} • Corpo:{" "}
                      {AVAILABLE_FONTS[p.bodyId].label.split(" ")[0]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-secondary-border bg-secondary-card p-4 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover">
              Seleção Manual de Fontes do Sistema
            </h4>

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
                  {Object.values(AVAILABLE_FONTS).map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.label}
                    </option>
                  ))}
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
                  {Object.values(AVAILABLE_FONTS).map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 4. LIVE PREVIEW INTERATIVO DA INTERFACE                                  */}
      {/* ======================================================================= */}
      <div className="rounded-xl border border-secondary-border bg-secondary-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover flex items-center gap-1.5">
            <span>👁️</span> Live Preview da Interface
          </h4>
          <span className="text-[10px] font-mono text-secondary-muted bg-dominant-deep px-2 py-0.5 rounded border border-secondary-border">
            Aplicação Imediata
          </span>
        </div>

        {/* Container Simulado com as Cores e Fontes Ativas */}
        <div
          className="rounded-xl border p-5 shadow-2xl transition-all"
          style={{
            backgroundColor: theme.colors.dominant.deep,
            borderColor: theme.colors.dominant.border,
            fontFamily: theme.fonts.body,
          }}
        >
          {/* Card Elevado Interno */}
          <div
            className="rounded-xl border p-4 shadow-lg space-y-3"
            style={{
              backgroundColor: theme.colors.secondary.card,
              borderColor: theme.colors.secondary.border,
            }}
          >
            <div className="flex items-center justify-between">
              <h3
                className="text-lg font-bold"
                style={{
                  color: theme.colors.secondary.pure,
                  fontFamily: theme.fonts.heading,
                }}
              >
                As Crônicas de Morkvold
              </h3>
              <span
                className="rounded-md border px-2 py-0.5 text-[10px] font-bold"
                style={{
                  backgroundColor: theme.colors.accent.dark,
                  borderColor: theme.colors.accent.vibrant,
                  color: theme.colors.secondary.pure,
                }}
              >
                Ativo
              </span>
            </div>

            <p
              className="text-xs line-clamp-2 leading-relaxed"
              style={{ color: theme.colors.secondary.offwhite }}
            >
              Sob o crepúsculo escarlate da torre arcanista, os aventureiros vasculham os manuscritos antigos em busca do selo de contenção abissal.
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: theme.colors.dominant.border }}>
              <span
                className="text-[11px]"
                style={{ color: theme.colors.secondary.muted }}
              >
                Nível 7 • 4 Jogadores Conectados
              </span>

              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs font-bold transition shadow"
                style={{
                  backgroundColor: theme.colors.accent.primary,
                  color: theme.colors.secondary.pure,
                  fontFamily: theme.fonts.heading,
                }}
              >
                Rolar Iniciativa
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
