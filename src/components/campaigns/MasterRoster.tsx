"use client";

import { useCallback, useEffect, useState } from "react";
import type { Npc, World, Encounter } from "@/types";
import { ActorOverlay } from "@/components/campaigns/ActorOverlay";
import type { RosterActor, RosterPlayer } from "@/components/campaigns/ActorOverlay";
import { InfiniteCanvas } from "@/components/campaigns/InfiniteCanvas";
import { CharacterCarousel } from "@/components/campaigns/CharacterCarousel";
import { EncounterModal } from "@/components/campaigns/EncounterModal";

type RosterData = {
  players: RosterPlayer[];
  npcs: Npc[];
};

export function MasterRoster({ campaignId }: { campaignId: string }) {
  const [roster, setRoster] = useState<RosterData>({ players: [], npcs: [] });
  const [worlds, setWorlds] = useState<World[]>([]);
  const [selectedWorldId, setSelectedWorldId] = useState<string>("");
  const [activeEncounter, setActiveEncounter] = useState<Encounter | null>(null);
  const [showEncounterModal, setShowEncounterModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RosterActor | null>(null);
  const [deskActors, setDeskActors] = useState<RosterActor[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(`carousel-desk-${campaignId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveDeskActors = (newActors: RosterActor[]) => {
    setDeskActors(newActors);
    try {
      localStorage.setItem(`carousel-desk-${campaignId}`, JSON.stringify(newActors));
    } catch {}
  };

  const handleDropActor = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const actor: RosterActor = JSON.parse(dataStr);
      if (actor && actor.id) {
        if (!deskActors.some((a) => a.id === actor.id && a.kind === actor.kind)) {
          saveDeskActors([...deskActors, actor]);
        }
      }
    } catch {}
  };

  const handleRemoveDeskActor = (actorId: string, kind: string) => {
    const updated = deskActors.filter((a) => !(a.id === actorId && a.kind === kind));
    saveDeskActors(updated);
  };

  const loadRoster = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/roster`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar personagens da campanha");
        return;
      }

      setRoster(data.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  const checkActiveEncounter = useCallback(async () => {
    if (!selectedWorldId) {
      setActiveEncounter(null);
      return;
    }
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/worlds/${selectedWorldId}/encounters`);
      const data = await res.json();
      if (res.ok && data.data) {
        const active = (data.data as Encounter[]).find((e) => e.isActive);
        setActiveEncounter(active || null);
      }
    } catch {
      // ignore
    }
  }, [campaignId, selectedWorldId]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const [rosterRes, campaignWorldsRes, globalWorldsRes] = await Promise.all([
          fetch(`/api/campaigns/${campaignId}/roster`),
          fetch(`/api/campaigns/${campaignId}/worlds`),
          fetch(`/api/worlds`),
        ]);

        const rosterData = await rosterRes.json();
        const campaignWorldsData = await campaignWorldsRes.json();
        const globalWorldsData = await globalWorldsRes.json();

        if (cancelled) return;

        if (rosterRes.ok) {
          setRoster(rosterData.data);
        } else {
          setError(rosterData.error || "Erro ao carregar personagens da campanha");
        }

        const allWorldsMap = new Map<string, World>();
        if (campaignWorldsRes.ok && campaignWorldsData.data) {
          (campaignWorldsData.data as World[]).forEach((w) => allWorldsMap.set(w.id, w));
        }
        if (globalWorldsRes.ok && globalWorldsData.data) {
          (globalWorldsData.data as World[]).forEach((w) => allWorldsMap.set(w.id, w));
        }

        const combinedWorlds = Array.from(allWorldsMap.values());
        setWorlds(combinedWorlds);
        if (combinedWorlds.length > 0 && !selectedWorldId) {
          setSelectedWorldId(combinedWorlds[0].id);
        }
      } catch {
        if (!cancelled) {
          setError("Erro de conexão. Tente novamente.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [campaignId, selectedWorldId]);

  useEffect(() => {
    let cancelled = false;

    const checkActive = async () => {
      if (!selectedWorldId) {
        if (!cancelled) setActiveEncounter(null);
        return;
      }
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/worlds/${selectedWorldId}/encounters`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.data) {
          const active = (data.data as Encounter[]).find((e) => e.isActive);
          setActiveEncounter(active || null);
        }
      } catch {
        // ignore
      }
    };

    void checkActive();

    return () => {
      cancelled = true;
    };
  }, [campaignId, selectedWorldId]);

  const handleEndEncounter = async () => {
    if (!activeEncounter) return;
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/encounters/${activeEncounter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (res.ok) {
        setActiveEncounter(null);
      }
    } catch {
      setError("Erro ao encerrar encontro");
    }
  };

  const toActor = (player: RosterPlayer): RosterActor => ({
    kind: "character",
    id: player.id,
    name: player.name,
    imageUrl: player.imageUrl,
    level: player.level,
    xp: player.xp,
    hitPoints: player.hitPointsCurrent,
    hitPointsMax: player.hitPointsMax,
    manaPoints: player.manaPointsCurrent,
    manaPointsMax: player.manaPointsMax,
    conditions: player.conditions,
  });

  // Filtrar NPCs se houver mundo selecionado
  const filteredNpcs = selectedWorldId
    ? roster.npcs.filter((npc) => !npc.worldId || npc.worldId === selectedWorldId)
    : roster.npcs;

  const actors: RosterActor[] = [
    ...roster.players.map(toActor),
    ...filteredNpcs.map((npc) => ({
      kind: "npc" as const,
      id: npc.id,
      name: npc.name,
      imageUrl: npc.imageUrl,
      level: npc.level,
      xp: npc.xp,
      hitPoints: npc.hitPoints,
      hitPointsMax: npc.hitPointsMax,
      manaPoints: npc.manaPoints,
      manaPointsMax: npc.manaPointsMax,
      npcType: npc.npcType,
      xpReward: npc.xpReward,
    })),
  ];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-purple-600" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white">Mesa</h2>
          {worlds.length > 0 && (
            <select
              value={selectedWorldId}
              onChange={(e) => setSelectedWorldId(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-white focus:border-transparent focus:ring-1 focus:ring-purple-600"
            >
              {worlds.map((w) => (
                <option key={w.id} value={w.id}>
                  🌍 {w.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <span className="text-xs text-gray-400">
          {roster.players.length} jogadores · {filteredNpcs.length} NPCs
        </span>
      </div>

      {error && (
        <div className="mb-2 rounded-lg border border-red-800 bg-red-900/30 p-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Canvas infinito com post-its vinculados ao mundo/campanha */}
      <div className="mb-2 flex-1 overflow-hidden rounded-lg border border-gray-800">
        <InfiniteCanvas campaignId={selectedWorldId ? `${campaignId}-${selectedWorldId}` : campaignId} />
      </div>

      {/* Barra de Ações sobre o Carrossel (Combate/Encontros) */}
      <div className="mb-1 flex items-center justify-between rounded-t-lg bg-gray-900 px-3 py-1.5 border border-b-0 border-gray-800 text-xs">
        <div className="flex items-center gap-2">
          {activeEncounter ? (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
              </span>
              <span className="font-semibold text-red-400">
                COMBATE ATIVO: {activeEncounter.name}
              </span>
            </div>
          ) : (
            <span className="text-gray-400">Nenhum combate ativo</span>
          )}
        </div>

        <div className="flex gap-2">
          {activeEncounter ? (
            <button
              onClick={handleEndEncounter}
              className="rounded bg-red-900/80 px-2 py-1 text-xs font-semibold text-red-200 hover:bg-red-800"
            >
              🏁 Encerrar Encontro
            </button>
          ) : (
            <button
              onClick={() => setShowEncounterModal(true)}
              disabled={!selectedWorldId}
              className="rounded bg-purple-600 px-2 py-1 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              ⚔️ Iniciar Encontro
            </button>
          )}
        </div>
      </div>

      {/* Carrossel de personagens fixo na parte inferior */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropActor}
        className="h-48 rounded-b-lg border border-gray-800 bg-gray-900/50 p-2"
      >
        <CharacterCarousel
          actors={deskActors}
          onSelect={setSelected}
          onRemove={handleRemoveDeskActor}
        />
      </div>

      {selected && (
        <ActorOverlay
          campaignId={campaignId}
          actor={selected}
          onClose={() => setSelected(null)}
          onChanged={loadRoster}
        />
      )}

      {showEncounterModal && selectedWorldId && (
        <EncounterModal
          campaignId={campaignId}
          worldId={selectedWorldId}
          actors={deskActors.length > 0 ? deskActors : actors}
          onClose={() => setShowEncounterModal(false)}
          onEncounterStarted={() => {
            void checkActiveEncounter();
          }}
        />
      )}
    </div>
  );
}
