"use client";

import { Settings } from "lucide-react";
import type { Establishment, World } from "@/types";
import { modulesForScene, type ActiveScene } from "@/lib/scenes/sceneConfig";

type MasterWorldsPanelProps = {
  isMissing: boolean;
  worlds: World[];
  worldError: string | null;
  selectedWorldId: string;
  onSelectWorld: (worldId: string) => void;
  onOpenWorld: (world: { id: string; name: string }) => void;
  establishments: Establishment[];
  isEstablishmentsExpanded: boolean;
  onToggleEstablishmentsExpanded: () => void;
  onToggleEstablishment: (establishment: Establishment) => void;
  className?: string;
  activeScene?: ActiveScene;
};

/**
 * Painel de Mundos & Cenas de Investigação do Escudo (aba "worlds" do
 * mediaPanel, issue #89). Extraído de CampaignDetail; o controle de altura
 * (flexBasis/handle) passou a ser responsabilidade do contêiner com abas.
 */
export function MasterWorldsPanel({
  isMissing,
  worlds,
  worldError,
  selectedWorldId,
  onSelectWorld,
  onOpenWorld,
  establishments,
  isEstablishmentsExpanded,
  onToggleEstablishmentsExpanded,
  onToggleEstablishment,
  className = "",
  activeScene = null,
}: MasterWorldsPanelProps) {
  const selectedWorldEstablishments = establishments;

  return (
    <div
      className={`relative h-full w-full overflow-y-auto p-3 ${
        isMissing ? "border-zinc-800 bg-[#0e0f12] font-mono" : "bg-gray-900"
      } ${className}`}
    >
      <h3 className="mb-2 font-semibold text-white">
        {isMissing ? "Cenas / Locais de Investigação" : "Mundos"}
      </h3>

      {worldError && (
        <div className="mb-2 rounded-lg border border-red-800 bg-red-900/30 p-2 text-xs text-red-300">
          {worldError}
        </div>
      )}

      {worlds.length === 0 ? (
        <p className="mb-2 text-sm text-gray-400">
          {isMissing ? "Nenhum local de investigação criado ainda." : "Nenhum mundo criado ainda."}
        </p>
      ) : (
        <div className="mb-3 space-y-2">
          {worlds.map((world) => (
            <div
              key={world.id}
              className={`relative overflow-hidden rounded-lg border p-2 bg-cover bg-center transition-colors ${
                selectedWorldId === world.id
                  ? isMissing
                    ? "border-rose-600 bg-rose-950/40 ring-1 ring-rose-500/50"
                    : "border-accent bg-accent/20 ring-1 ring-accent/60"
                  : isMissing
                    ? "border-zinc-800 bg-zinc-950"
                    : "border-secondary-border bg-secondary-card"
              }`}
              style={world.coverUrl ? { backgroundImage: `url(${world.coverUrl})` } : undefined}
            >
              {world.coverUrl && (
                <div className="absolute inset-0 bg-gradient-to-r from-gray-950/95 via-gray-950/85 to-gray-950/70" />
              )}
              <div className="relative z-10">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      onClick={() => onSelectWorld(world.id)}
                      className="text-left text-sm font-semibold text-secondary-pure hover:text-accent-hover drop-shadow-sm flex-1 truncate"
                    >
                      {world.name}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenWorld(world);
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded px-3 py-1.5 flex items-center gap-1 shrink-0"
                      title="Abrir Detalhes do Local (NPCs, Encontros)"
                      aria-label={
                        isMissing ? `Ver cena de ${world.name}` : `Ver detalhes de ${world.name}`
                      }
                    >
                      <Settings size={16} />
                    </button>
                  </div>
                  {selectedWorldId === world.id && (
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${
                        isMissing ? "bg-rose-700" : "bg-accent"
                      }`}
                    >
                      Selecionado
                    </span>
                  )}
                  {world.description && (
                    <p className="mt-0.5 text-xs text-secondary-muted drop-shadow-sm">
                      {world.description}
                    </p>
                  )}
                  {world.mapUrl && (
                    <p
                      className={`mt-1 text-[10px] ${isMissing ? "text-rose-400" : "text-accent-hover"}`}
                    >
                      🗺️ Possui mapa
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Estabelecimentos do Mundo Selecionado (apenas regras padrão d20) ===== */}
      {!isMissing &&
        selectedWorldId &&
        modulesForScene(activeScene).establishments !== "hidden" && (
          <div className="rounded-lg border border-secondary-border bg-secondary-card p-3 mt-3">
            <button
              type="button"
              onClick={onToggleEstablishmentsExpanded}
              className="mb-2 flex w-full items-center justify-between font-semibold text-xs text-secondary-pure"
            >
              <span className="flex items-center gap-1">
                <span>{isEstablishmentsExpanded ? "▼" : "►"}</span>
                <span>🏬 Estabelecimentos</span>
              </span>
              <span className="text-[10px] font-normal text-accent-hover">
                ({selectedWorldEstablishments.length})
              </span>
            </button>

            <div
              className={`grid transition-all duration-200 ${
                isEstablishmentsExpanded
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                {isEstablishmentsExpanded && (
                  <>
                    {selectedWorldEstablishments.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">
                        Nenhum estabelecimento neste mundo.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedWorldEstablishments.map((est) => (
                          <div
                            key={est.id}
                            className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 p-2 text-xs"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <span className="font-semibold text-white block truncate">
                                {est.name}
                              </span>
                              <span className="text-[10px] text-gray-400 block truncate">
                                {est.type || "Geral"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => onToggleEstablishment(est)}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                                est.isOpen
                                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 hover:bg-emerald-900"
                                  : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-white"
                              }`}
                            >
                              {est.isOpen ? "🟢 Aberto" : "⚪ Fechado"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
