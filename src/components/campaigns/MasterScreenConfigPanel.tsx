"use client";

import type { MasterScreenConfig } from "@/hooks/useMasterScreenConfig";

type MasterScreenConfigPanelProps = {
  config: MasterScreenConfig;
  onUpdate: (patch: Partial<MasterScreenConfig>) => void;
  onReset: () => void;
};

export function MasterScreenConfigPanel({ config, onUpdate, onReset }: MasterScreenConfigPanelProps) {
  return (
    <div className="rounded-lg border border-secondary-border bg-secondary-card p-4 space-y-4">
      <div className="border-b border-secondary-border pb-2">
        <h3 className="font-semibold text-secondary-pure text-sm flex items-center gap-2">
          <span>🛡️</span> Visibilidade do Escudo
        </h3>
        <p className="text-[11px] text-secondary-muted mt-0.5">
          Ative ou desative módulos individuais para personalizar seu fluxo de jogo.
        </p>
      </div>

      <div className="space-y-2.5">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-accent-hover">
          Mesa & Grid de Combate
        </h4>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Carrossel de Personagens
          </span>
          <input
            type="checkbox"
            checked={config.showRoster}
            onChange={(e) => onUpdate({ showRoster: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Rolagens da Mesa
          </span>
          <input
            type="checkbox"
            checked={config.showDiceRolls}
            onChange={(e) => onUpdate({ showDiceRolls: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Canvas Infinito
          </span>
          <input
            type="checkbox"
            checked={config.showCanvas}
            onChange={(e) => onUpdate({ showCanvas: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Mapa Tático
          </span>
          <input
            type="checkbox"
            checked={config.showMap}
            onChange={(e) => onUpdate({ showMap: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>
      </div>

      <div className="space-y-2.5 pt-2 border-t border-secondary-border/60">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-accent-hover">
          Painel de Gestão & Áudio
        </h4>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Jukebox de Áudio
          </span>
          <input
            type="checkbox"
            checked={config.showJukebox}
            onChange={(e) => onUpdate({ showJukebox: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Personagens e NPCs
          </span>
          <input
            type="checkbox"
            checked={config.showCharactersNpcs}
            onChange={(e) => onUpdate({ showCharactersNpcs: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Jogadores Conectados
          </span>
          <input
            type="checkbox"
            checked={config.showPlayers}
            onChange={(e) => onUpdate({ showPlayers: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>
      </div>

      <div className="space-y-2.5 pt-2 border-t border-secondary-border/60">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-accent-hover">
          Histórico da Sessão
        </h4>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Log da Sessão
          </span>
          <input
            type="checkbox"
            checked={config.showSessionLog}
            onChange={(e) => onUpdate({ showSessionLog: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-4 w-full rounded-lg border border-secondary-border bg-dominant-container px-3 py-1.5 text-xs font-semibold text-secondary-offwhite hover:bg-dominant-container/80 hover:text-secondary-pure transition-colors"
      >
        Restaurar Padrão
      </button>
    </div>
  );
}
