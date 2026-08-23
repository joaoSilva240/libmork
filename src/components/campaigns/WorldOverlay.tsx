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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-gray-800 bg-gray-900 p-4"
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

        {error && (
          <div className="mb-3 rounded-lg border border-red-800 bg-red-900/30 p-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-700 border-t-purple-600" />
            </div>
          ) : npcs.length === 0 ? (
            <p className="text-sm text-gray-400">
              Nenhum NPC neste mundo ainda. Crie NPCs na página do mundo.
            </p>
          ) : (
            <div className="space-y-2">
              {npcs.map((npc) => {
                const isIncluded = npc.campaigns?.some((c) => c.campaignId === campaignId) ?? false;
                const isBusy = includeInCampaign[npc.id] ?? false;

                return (
                  <div
                    key={npc.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-800 bg-gray-950 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">{npc.name}</p>
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
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        HP {npc.hitPoints}/{npc.hitPointsMax} · Mana {npc.manaPoints}/{npc.manaPointsMax}
                      </p>
                    </div>

                    <button
                      onClick={() => toggleInclude(npc.id, isIncluded)}
                      disabled={isBusy}
                      className={`shrink-0 rounded px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                        isIncluded
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : "bg-purple-600 text-white hover:bg-purple-700"
                      }`}
                    >
                      {isBusy ? "..." : isIncluded ? "Remover da mesa" : "Incluir na mesa"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
