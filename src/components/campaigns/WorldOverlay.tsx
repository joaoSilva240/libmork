"use client";

import { useEffect, useState } from "react";
import type { Npc, Encounter } from "@/types";

type WorldOverlayProps = {
  campaignId: string;
  worldId: string;
  worldName: string;
  onClose: () => void;
  onChanged?: () => void;
};

type WorldTab = "npcs" | "encounters";

export function WorldOverlay({ campaignId, worldId, worldName, onClose, onChanged }: WorldOverlayProps) {
  const [activeTab, setActiveTab] = useState<WorldTab>("npcs");
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [campaignNpcIds, setCampaignNpcIds] = useState<string[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNpc, setSelectedNpc] = useState<Npc | null>(null);
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [includeInCampaign, setIncludeInCampaign] = useState<Record<string, boolean>>({});

  // Load NPCs and Campaign Included NPCs
  useEffect(() => {
    if (activeTab !== "npcs") return;
    
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [worldNpcsRes, campaignNpcsRes] = await Promise.all([
          fetch(`/api/worlds/${worldId}/npcs`),
          fetch(`/api/campaigns/${campaignId}/npcs`),
        ]);

        const worldNpcsData = await worldNpcsRes.json();
        const campaignNpcsData = await campaignNpcsRes.json();

        if (worldNpcsRes.ok && worldNpcsData.data) {
          setNpcs(worldNpcsData.data);
        } else {
          setError(worldNpcsData.error || "Erro ao carregar NPCs do mundo");
        }

        if (campaignNpcsRes.ok && Array.isArray(campaignNpcsData.data)) {
          setCampaignNpcIds(campaignNpcsData.data.map((n: { id: string }) => n.id));
        }
      } catch {
        setError("Erro de conexão. Tente novamente.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [worldId, campaignId, activeTab]);

  // Load Encounters
  useEffect(() => {
    if (activeTab !== "encounters") return;
    
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let response = await fetch(`/api/campaigns/${campaignId}/worlds/${worldId}/encounters`);
        let data = await response.json();

        if (!response.ok) {
          response = await fetch(`/api/worlds/${worldId}`);
          data = await response.json();
          if (response.ok && data.data) {
            setEncounters(data.data.encounters || []);
            return;
          }
          setError(data.error || "Erro ao carregar encontros");
          return;
        }

        setEncounters(data.data);
      } catch {
        setError("Erro de conexão. Tente novamente.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [campaignId, worldId, activeTab]);

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

        setCampaignNpcIds((prev) => prev.filter((id) => id !== npcId));
        onChanged?.();
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

        setCampaignNpcIds((prev) => [...prev, npcId]);
        onChanged?.();
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIncludeInCampaign((prev) => ({ ...prev, [npcId]: false }));
    }
  };

  const toggleEncounterActive = async (encounterId: string, currentlyActive: boolean) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/encounters/${encounterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentlyActive }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Erro ao atualizar encontro");
        return;
      }

      const result = await response.json();
      
      // Atualiza lista (apenas um pode estar ativo)
      setEncounters((prev) =>
        prev.map((enc) => ({
          ...enc,
          isActive: enc.id === encounterId ? result.data.isActive : false,
        }))
      );
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const filteredNpcs = npcs.filter((npc) =>
    npc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEncounters = encounters.filter((enc) =>
    enc.name.toLowerCase().includes(searchQuery.toLowerCase())
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

        <div className="mb-3 flex gap-2 border-b border-gray-800 pb-2">
          <button
            onClick={() => {
              setActiveTab("npcs");
              setSearchQuery("");
              setSelectedNpc(null);
              setSelectedEncounter(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              activeTab === "npcs"
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            NPCs
          </button>
          <button
            onClick={() => {
              setActiveTab("encounters");
              setSearchQuery("");
              setSelectedNpc(null);
              setSelectedEncounter(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              activeTab === "encounters"
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            Encontros
          </button>
        </div>

        <div className="mb-3">
          <input
            type="text"
            placeholder={activeTab === "npcs" ? "Pesquisar NPCs..." : "Pesquisar Encontros..."}
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
            ) : activeTab === "npcs" ? (
              filteredNpcs.length === 0 ? (
                <p className="text-center text-sm text-gray-500">Nenhum NPC neste mundo ainda.</p>
              ) : (
                <div className="space-y-1">
                  {filteredNpcs.map((npc) => {
                    const isIncluded = campaignNpcIds.includes(npc.id);
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
              )
            ) : (
              filteredEncounters.length === 0 ? (
                <p className="text-center text-sm text-gray-500">Nenhum encontro criado ainda.</p>
              ) : (
                <div className="space-y-1">
                  {filteredEncounters.map((encounter) => (
                    <div
                      key={encounter.id}
                      className={`flex items-center gap-2 rounded-lg border p-2 transition-colors ${
                        selectedEncounter?.id === encounter.id
                          ? "border-purple-600 bg-purple-900/20"
                          : "border-gray-800 bg-gray-900 hover:border-gray-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={encounter.isActive}
                        onChange={() => toggleEncounterActive(encounter.id, encounter.isActive)}
                        className="h-4 w-4 accent-purple-600"
                        title={encounter.isActive ? "Desativar" : "Ativar"}
                      />
                      <button
                        onClick={() => setSelectedEncounter(encounter)}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        <span className="text-sm font-semibold text-white">{encounter.name}</span>
                        {encounter.isActive && (
                          <span className="rounded bg-green-900/80 px-1.5 py-0.5 text-xs font-semibold text-green-200">
                            Ativo
                          </span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Detalhes */}
          <div className="w-1/2 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 p-3">
            {activeTab === "npcs" && selectedNpc ? (
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
            ) : activeTab === "encounters" && selectedEncounter ? (
              <div>
                <h3 className="mb-3 text-lg font-bold text-white">{selectedEncounter.name}</h3>
                {selectedEncounter.description && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-400">Descrição:</p>
                    <p className="mt-1 text-sm text-gray-300">{selectedEncounter.description}</p>
                  </div>
                )}
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-400">Status:</p>
                  <p className="mt-1 text-sm text-white">
                    {selectedEncounter.isActive ? "Ativo (em combate)" : "Inativo"}
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  Criado em {new Date(selectedEncounter.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ) : (
              <p className="text-center text-sm text-gray-500">
                Selecione um item para ver os detalhes
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
