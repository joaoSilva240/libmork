"use client";

import { MasterScreenConfigPanel } from "@/components/campaigns/MasterScreenConfigPanel";
import { MasterScreenPreview } from "@/components/campaigns/MasterScreenPreview";
import { useMasterScreenConfig } from "@/hooks/useMasterScreenConfig";

export default function MasterSettingsPage() {
  const { config, updateConfig, resetConfig } = useMasterScreenConfig();

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white mb-2">Configurações do Mestre</h1>
        <p className="text-sm text-gray-400">
          Gerencie as preferências globais de visibilidade dos módulos da tela de mestre.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h2 className="text-lg font-semibold text-white mb-3">Preferências de Visibilidade</h2>
          <p className="text-xs text-gray-400 mb-4">
            As alterações são salvas automaticamente e aplicadas a todas as campanhas.
          </p>
          <MasterScreenConfigPanel config={config} onUpdate={updateConfig} onReset={resetConfig} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Preview do Layout</h2>
          <MasterScreenPreview
            showRoster={config.showRoster}
            showSessionLog={config.showSessionLog}
            showCanvas={config.showCanvas}
            showMap={config.showMap}
          />
        </div>
      </div>
    </div>
  );
}
