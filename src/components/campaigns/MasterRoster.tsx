"use client";

import { useCallback, useEffect, useState } from "react";
import type { Npc } from "@/types";
import { ActorOverlay } from "@/components/campaigns/ActorOverlay";
import type { RosterActor, RosterPlayer } from "@/components/campaigns/ActorOverlay";
import { InfiniteCanvas } from "@/components/campaigns/InfiniteCanvas";
import { CharacterCarousel } from "@/components/campaigns/CharacterCarousel";

type RosterData = {
  players: RosterPlayer[];
  npcs: Npc[];
};

export function MasterRoster({ campaignId }: { campaignId: string }) {
  const [roster, setRoster] = useState<RosterData>({ players: [], npcs: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RosterActor | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/roster`);
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(data.error || "Erro ao carregar personagens da campanha");
          return;
        }

        setRoster(data.data);
      } catch {
        if (!cancelled) {
          setError("Erro de conexão. Tente novamente.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

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

  const actors: RosterActor[] = [
    ...roster.players.map(toActor),
    ...roster.npcs.map((npc) => ({
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
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Mesa</h2>
        <span className="text-xs text-gray-400">
          {roster.players.length} jogadores · {roster.npcs.length} NPCs
        </span>
      </div>

      {error && (
        <div className="mb-2 rounded-lg border border-red-800 bg-red-900/30 p-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Canvas infinito com post-its */}
      <div className="mb-3 flex-1 overflow-hidden rounded-lg border border-gray-800">
        <InfiniteCanvas campaignId={campaignId} />
      </div>

      {/* Carrossel de personagens fixo na parte inferior */}
      <div className="h-48 rounded-lg border border-gray-800 bg-gray-900/50 p-2">
        <CharacterCarousel actors={actors} onSelect={setSelected} />
      </div>

      {selected && (
        <ActorOverlay
          campaignId={campaignId}
          actor={selected}
          onClose={() => setSelected(null)}
          onChanged={loadRoster}
        />
      )}
    </div>
  );
}
