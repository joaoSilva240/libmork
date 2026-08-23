"use client";

import { useEffect, useState } from "react";
import type { Npc } from "@/types";

type WorldOverlayProps = {
  campaignId: string;
  worldId: string;
  worldName: string;
  onClose: () => void;
};

export function WorldOverlay({ campaignId, worldId, worldName, onClose }: WorldOverlayProps) {
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNpc, setSelectedNpc] = useState<Npc | null>(null);
  const [includeInCampaign, setIncludeInCampaign] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/worlds/${worldId}/npcs`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Erro ao carregar NPCs do mundo");
          return;
        }

        setNpcs(data.data);
      } catch {
        setError("Erro de conexão. Tente novamente.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [campaignId, worldId]);

  const toggleInclude = async (npcId: string, currentlyIncluded: boolean) => {
    setIncludeInCampaign((prev) => ({ ...prev, [npcId]: true }));

    try {
      if (currentlyIncluded) {
        const response = await fetch(`/api/campaigns/${campaignId}/npcs/${npcId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "Erro ao remover NPC da campanha");
          setIncludeInCampaign((prev) => ({ ...prev, [npcId]: false }));
          return;
        }

        setNpcs((prev) =>
          prev.map((npc) =>
            npc.id === npcId ? { ...npc, campaigns: npc.campaigns?.filter((c) => c.campaignId !== campaignId) } : npc
          )
        );
      } else {
        const response = await fetch(`/api/campaigns/${campaignId}/npcs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ npcId }),
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "Erro ao incluir NPC na campanha");
          setIncludeInCampaign((prev) => ({ ...prev, [npcId]: false }));
          return;
        }

        setNpcs((prev) =>
          prev.map((npc) =>
            npc.id === npcId
              ? { ...npc, campaigns: [...(npc.campaigns || []), { campaignId }] }
              : npc
          )
        );
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIncludeInCampaign((prev) => ({ ...prev, [npcId]: false }));
    }
  };

  const filteredNpcs = npcs.filter((npc) =>
    npc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-full max-w-4xl flex-col rounded-xl border border-gray-800 bg-gray-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{worldName}</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mb-3">
          <input
            type="text"
            placeholder="Pesquisar NPCs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-transparent focus:ring-2 focus:ring-purple-600"
          />
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-800 bg-red-900/30 p-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-1 gap-3 overflow-hidden">
          {/* Lista */}
          <div className="w-1/2 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 p-2">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-700 border-t-purple-600" />
              </div>
            ) : filteredNpcs.length === 0 ? (
              <p className="text-center text-sm text-gray-500">
                Nenhum NPC neste mundo ainda.
              </p>
            ) : (
              <div className="space-y-1">
                {filteredNpcs.map((npc) => {
                  const isIncluded = npc.campaigns?.some((c) => c.campaignId === campaignId) ?? false;
                  const isBusy = includeInCampaign[npc.id] ?? false;

                  return (
                    <div
                      key={npc.id}
                      className={`flex items-center gap-2 rounded-lg border p-2 transition-colors ${
                        selectedNpc?.id === npc.id
                          ? "border-purple-600 bg-purple-900/20"
                          : "border-gray-800 bg-gray-900 hover:border-gray-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isIncluded}
                        onChange={() => toggleInclude(npc.id, isIncluded)}
                        disabled={isBusy}
                        className="h-4 w-4 accent-purple-600 disabled:opacity-50"
                        title={isIncluded ? "Remover da mesa" : "Incluir na mesa"}
                      />
                      <button
                        onClick={() => setSelectedNpc(npc)}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        <span className="text-sm font-semibold text-white">{npc.name}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                            npc.npcType === "enemy"
                              ? "bg-red-900/80 text-red-200"
                              : "bg-gray-800 text-gray-300"
                          }`}
                        >
                          {npc.npcType === "enemy" ? "Inimigo" : "NPC"}
                        </span>
                        <span className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">
                          Nv {npc.level}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detalhes */}
          <div className="w-1/2 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 p-3">
            {selectedNpc ? (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  {selectedNpc.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedNpc.imageUrl}
                      alt={selectedNpc.name}
                      className="h-20 w-20 rounded-lg border border-gray-700 object-cover"
                    />
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedNpc.name}</h3>
                    <div className="flex gap-2 text-xs">
                      <span className="text-gray-400">Nível {selectedNpc.level}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-400">XP Recompensa: {selectedNpc.xpReward}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="font-semibold text-gray-400">HP:</span>{" "}
                      <span className="text-white">
                        {selectedNpc.hitPoints}/{selectedNpc.hitPointsMax}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-400">Mana:</span>{" "}
                      <span className="text-white">
                        {selectedNpc.manaPoints}/{selectedNpc.manaPointsMax}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-400">Bloqueio:</span>{" "}
                      <span className="text-white">{selectedNpc.block}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-400">XP Atual:</span>{" "}
                      <span className="text-white">{selectedNpc.xp}</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="mb-1 font-semibold text-gray-400">Atributos:</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div>Força: {selectedNpc.attributes.forca}</div>
                      <div>Vigor: {selectedNpc.attributes.vigor}</div>
                      <div>Destreza: {selectedNpc.attributes.destreza}</div>
                      <div>Inteligência: {selectedNpc.attributes.inteligencia}</div>
                      <div>Empatia: {selectedNpc.attributes.empatia}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-gray-500">
                Selecione um NPC para ver os detalhes
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
