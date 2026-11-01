"use client";

import type { MasterScreenConfig } from "@/hooks/useMasterScreenConfig";

type MasterScreenConfigPanelProps = {
  config: MasterScreenConfig;
  onUpdate: (patch: Partial<MasterScreenConfig>) => void;
  onReset: () => void;
};

export function MasterScreenConfigPanel({ config, onUpdate, onReset }: MasterScreenConfigPanelProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
      <h3 className="mb-3 font-semibold text-white text-sm">
        Visibilidade do Escudo
      </h3>

      <div className="space-y-2.5">
        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group">
          <span className="text-gray-300 group-hover:text-white transition-colors">
            Carrossel de Personagens
          </span>
          <input
            type="checkbox"
            checked={config.showRoster}
            onChange={(e) => onUpdate({ showRoster: e.target.checked })}
            className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group">
          <span className="text-gray-300 group-hover:text-white transition-colors">
            Log da Sessão
          </span>
          <input
            type="checkbox"
            checked={config.showSessionLog}
            onChange={(e) => onUpdate({ showSessionLog: e.target.checked })}
            className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group">
          <span className="text-gray-300 group-hover:text-white transition-colors">
            Canvas Infinito
          </span>
          <input
            type="checkbox"
            checked={config.showCanvas}
            onChange={(e) => onUpdate({ showCanvas: e.target.checked })}
            className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group">
          <span className="text-gray-300 group-hover:text-white transition-colors">
            Mapa Tático
          </span>
          <input
            type="checkbox"
            checked={config.showMap}
            onChange={(e) => onUpdate({ showMap: e.target.checked })}
            className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-4 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-gray-700 transition-colors"
      >
        Restaurar Padrão
      </button>
    </div>
  );
}
