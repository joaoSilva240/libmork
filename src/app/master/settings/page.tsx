"use client";

import { useState } from "react";
import { MasterScreenConfigPanel } from "@/components/campaigns/MasterScreenConfigPanel";
import { MasterScreenPreview } from "@/components/campaigns/MasterScreenPreview";
import { ThemeConfigPanel } from "@/components/theme/ThemeConfigPanel";
import { useMasterScreenConfig } from "@/hooks/useMasterScreenConfig";
import { useDice3D } from "@/context/Dice3DContext";

type SettingsTab = "theme" | "screen" | "dice3d";

export default function MasterSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("theme");
  const { config, updateConfig, resetConfig } = useMasterScreenConfig();
  const { isDice3DEnabled, toggleDice3D } = useDice3D();

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto w-full pb-8">
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
          aria-selected={activeTab === "dice3d"}
          onClick={() => setActiveTab("dice3d")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition select-none ${
            activeTab === "dice3d"
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

      {/* Painel 2: Configuração e Visibilidade dos Módulos do Escudo */}
      <div className={activeTab === "screen" ? "block" : "hidden"} role="tabpanel">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-secondary-border bg-secondary-card p-4">
            <h2 className="text-lg font-semibold text-secondary-pure mb-3">
              Preferências de Visibilidade
            </h2>
            <p className="text-xs text-secondary-muted mb-4">
              As alterações são salvas automaticamente e aplicadas a todas as campanhas.
            </p>
            <MasterScreenConfigPanel
              config={config}
              onUpdate={updateConfig}
              onReset={resetConfig}
            />
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
      </div>

      {/* Painel 3: Configurações de Dados 3D */}
      <div className={activeTab === "dice3d" ? "block" : "hidden"} role="tabpanel">
        <div className="max-w-xl rounded-lg border border-secondary-border bg-secondary-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-secondary-pure">Ferramentas de Dados 3D</h2>
              <p className="text-xs text-secondary-muted mt-1">
                Ativa ou desativa a simulação de dados 3D na tela durante as rolagens.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isDice3DEnabled}
              data-testid="toggle-master-dice-3d"
              onClick={() => toggleDice3D()}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isDice3DEnabled ? "bg-accent" : "bg-gray-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isDice3DEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
