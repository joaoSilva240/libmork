"use client";

import { useCallback, useEffect, useState } from "react";
import type { Npc } from "@/types";
import { ActorOverlay } from "@/components/campaigns/ActorOverlay";
import type { RosterActor, RosterPlayer } from "@/components/campaigns/ActorOverlay";

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
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Mesa</h2>
        <span className="text-xs text-gray-400">
          {roster.players.length} jogadores · {roster.npcs.length} NPCs
        </span>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-800 bg-red-900/30 p-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {actors.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nenhum personagem na campanha ainda. Aprove fichas dos jogadores ou inclua NPCs.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {actors.map((actor) => {
            const hpPercent = Math.min(
              100,
              Math.max(0, (actor.hitPoints / Math.max(actor.hitPointsMax, 1)) * 100)
            );
            const manaPercent = Math.min(
              100,
              Math.max(0, (actor.manaPoints / Math.max(actor.manaPointsMax, 1)) * 100)
            );

            return (
              <button
                key={`${actor.kind}-${actor.id}`}
                onClick={() => setSelected(actor)}
                className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-gray-800 bg-gray-900 transition-colors hover:border-purple-600"
              >
                {actor.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={actor.imageUrl}
                    alt={actor.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950 text-4xl font-bold text-gray-600">
                    {actor.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40" />

                <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white">
                  Nv {actor.level}
                </span>

                {actor.kind === "npc" && (
                  <span
                    className={`absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      actor.npcType === "enemy"
                        ? "bg-red-900/80 text-red-200"
                        : "bg-gray-800/80 text-gray-300"
                    }`}
                  >
                    {actor.npcType === "enemy" ? "Inimigo" : "NPC"}
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 p-2">
                  <p className="truncate text-sm font-bold text-white drop-shadow">
                    {actor.name}
                  </p>
                  <div className="mt-1.5 space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-black/60">
                      <div
                        className="h-full rounded-full bg-red-500"
                        style={{ width: `${hpPercent}%` }}
                      />
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/60">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${manaPercent}%` }}
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-[10px] text-gray-300">
                    HP {actor.hitPoints}/{actor.hitPointsMax} · Mana {actor.manaPoints}/
                    {actor.manaPointsMax}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

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
