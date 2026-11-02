"use client";

import { useState } from "react";
import { MasterScreenConfigPanel } from "@/components/campaigns/MasterScreenConfigPanel";
import { MasterScreenPreview } from "@/components/campaigns/MasterScreenPreview";
import { ThemeConfigPanel } from "@/components/theme/ThemeConfigPanel";
import { useMasterScreenConfig } from "@/hooks/useMasterScreenConfig";
import { Dice3DSettingsPanel } from "@/components/dice/Dice3DSettingsPanel";

type SettingsTab = "theme" | "screen" | "dice";

export default function MasterSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("theme");
  const [showAiKey, setShowAiKey] = useState<boolean>(false);
  const { config, updateConfig, resetConfig } = useMasterScreenConfig();

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto w-full pb-16 overflow-y-auto min-h-0 pr-2">
      {/* Cabeçalho da Página */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary-pure mb-2">Configurações do Mestre</h1>
        <p className="text-sm text-secondary-muted">
          Gerencie a identidade visual da aplicação e as preferências globais da mesa e do escudo.
        </p>
      </div>

      {/* Navegação entre Abas de Configuração */}
      <div className="flex items-center gap-2 border-b border-secondary-border mb-6" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "theme"}
          onClick={() => setActiveTab("theme")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition select-none ${
            activeTab === "theme"
              ? "border-accent text-secondary-pure"
              : "border-transparent text-secondary-muted hover:text-secondary-pure"
          }`}
        >
          <span>🎨</span> Tema e Aparência
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "screen"}
          onClick={() => setActiveTab("screen")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition select-none ${
            activeTab === "screen"
              ? "border-accent text-secondary-pure"
              : "border-transparent text-secondary-muted hover:text-secondary-pure"
          }`}
        >
          <span>🛡️</span> Tela do Mestre & Módulos
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "dice"}
          onClick={() => setActiveTab("dice")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition select-none ${
            activeTab === "dice"
              ? "border-accent text-secondary-pure"
              : "border-transparent text-secondary-muted hover:text-secondary-pure"
          }`}
        >
          <span>🎲</span> Dados 3D
        </button>
      </div>

      {/* Painel 1: Tema e Aparência (Cores, Contraste AAA, Modo Claro/Escuro, Fontes) */}
      <div className={activeTab === "theme" ? "block" : "hidden"} role="tabpanel">
        <ThemeConfigPanel />
      </div>

      <div className={activeTab === "dice" ? "block" : "hidden"} role="tabpanel">
        <Dice3DSettingsPanel />
      </div>

      {/* Painel 2: Configuração e Visibilidade dos Módulos do Escudo */}
      <div className={activeTab === "screen" ? "block" : "hidden"} role="tabpanel">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-secondary-border bg-secondary-card p-4">
            <h2 className="text-lg font-semibold text-secondary-pure mb-3">Preferências de Visibilidade</h2>
            <p className="text-xs text-secondary-muted mb-4">
              As alterações são salvas automaticamente e aplicadas a todas as campanhas.
            </p>
            <MasterScreenConfigPanel config={config} onUpdate={updateConfig} onReset={resetConfig} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-secondary-pure mb-3">Preview do Layout</h2>
            <MasterScreenPreview
              showRoster={config.showRoster}
              showSessionLog={config.showSessionLog}
              showCanvas={config.showCanvas}
              showMap={config.showMap}
            />
          </div>
        </div>

        {/* Seção 2: Configurações de API de IA para Tradução da Biblioteca */}
        <div className="rounded-lg border border-secondary-border bg-secondary-card p-5 mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-secondary-border pb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🤖</span>
              <div>
                <h2 className="text-base font-bold text-secondary-pure">
                  Inteligência Artificial & Tradução da Biblioteca
                </h2>
                <p className="text-xs text-secondary-muted">
                  Configure o endpoint e a chave da API de IA responsável pela tradução automática e localização de livros, documentos e conteúdos da Biblioteca.
                </p>
              </div>
            </div>

            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border self-start sm:self-auto ${
                config.aiApiKey && config.aiApiEndpoint
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-400 font-bold"
                  : "bg-dominant-deep border-secondary-border text-secondary-muted"
              }`}
            >
              {config.aiApiKey && config.aiApiEndpoint ? "✓ Configurado" : "Aguardando Dados"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Campo 1: Endpoint da API */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-secondary-offwhite">
                Endpoint da API de IA (Base URL)
              </label>
              <input
                type="text"
                value={config.aiApiEndpoint || ""}
                onChange={(e) => updateConfig({ aiApiEndpoint: e.target.value })}
                placeholder="https://api.openai.com/v1 ou http://localhost:11434/v1"
                className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-3 py-2 text-xs text-secondary-pure font-mono outline-none focus:ring-2 focus:ring-accent"
              />
              <span className="text-[11px] text-secondary-muted block">
                URL base da API (compatível com OpenAI, Gemini v1, Ollama, LM Studio ou LocalAI).
              </span>
            </div>

            {/* Campo 2: Chave da API de IA */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-secondary-offwhite">
                Chave da API de IA (API Key / Token)
              </label>
              <div className="relative">
                <input
                  type={showAiKey ? "text" : "password"}
                  value={config.aiApiKey || ""}
                  onChange={(e) => updateConfig({ aiApiKey: e.target.value })}
                  placeholder="sk-... ou sua chave de acesso"
                  className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-3 py-2 pr-10 text-xs text-secondary-pure font-mono outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowAiKey(!showAiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-secondary-muted hover:text-secondary-pure p-1"
                  title={showAiKey ? "Ocultar chave" : "Mostrar chave"}
                >
                  {showAiKey ? "🙈" : "👁️"}
                </button>
              </div>
              <span className="text-[11px] text-secondary-muted block">
                Armazenada de forma segura nas configurações do mestre para tradução de conteúdos.
              </span>
            </div>
          </div>

          {/* Campo Opcional: Modelo de Tradução */}
          <div className="pt-3 border-t border-secondary-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-secondary-offwhite whitespace-nowrap">
                Modelo de Tradução (Opcional):
              </label>
              <input
                type="text"
                value={config.aiModel || ""}
                onChange={(e) => updateConfig({ aiModel: e.target.value })}
                placeholder="gpt-4o-mini, gemini-1.5-flash, llama3"
                className="rounded-lg border border-secondary-border bg-dominant-deep px-2.5 py-1 text-xs text-secondary-pure font-mono outline-none focus:ring-1 focus:ring-accent w-56"
              />
            </div>

            <span className="text-[11px] text-accent-hover font-medium">
              {config.aiApiKey && config.aiApiEndpoint
                ? "Disponível para tradução de PDFs, regras e itens"
                : "Preencha o endpoint e a chave para habilitar a tradução"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
