"use client";

import { useEffect, useState } from "react";
import type { Npc } from "@/types";
import type { RosterPlayer, RosterActor } from "@/components/campaigns/ActorOverlay";

type PlayerInviteData = {
  id: string;
  displayName: string;
  email: string;
  isInvited: boolean;
  inviteId: string | null;
  activeCharactersCount: number;
};

export function CampaignInvites({ campaignId }: { campaignId: string }) {
  const [players, setPlayers] = useState<PlayerInviteData[]>([]);
  const [actors, setActors] = useState<RosterActor[]>([]);
  const [actorSearchQuery, setActorSearchQuery] = useState("");
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const [invitesRes, rosterRes] = await Promise.all([
          fetch(`/api/campaigns/${campaignId}/invites`),
          fetch(`/api/campaigns/${campaignId}/roster`),
        ]);

        const invitesData = await invitesRes.json();
        const rosterData = await rosterRes.json();

        if (cancelled) return;

        if (invitesRes.ok && invitesData.data) {
          setPlayers(invitesData.data);
        } else if (!invitesRes.ok) {
          setError(invitesData.error || "Erro ao carregar jogadores");
        }

        if (rosterRes.ok && rosterData.data) {
          const playersList: RosterPlayer[] = rosterData.data.players || [];
          const npcsList: Npc[] = rosterData.data.npcs || [];

          const playerActors: RosterActor[] = playersList.map((player) => ({
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
          }));

          const npcActors: RosterActor[] = npcsList.map((npc) => ({
            kind: "npc",
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
          }));

          setActors([...playerActors, ...npcActors]);
        }
      } catch {
        if (!cancelled) {
          setError("Erro de conexão ao carregar convites/personagens.");
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
  }, [campaignId]);

  const handleInvite = async (userId: string) => {
    setError(null);
    setActionLoadingId(userId);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao convidar jogador");
        return;
      }

      setPlayers((prev) =>
        prev.map((player) =>
          player.id === userId
            ? { ...player, isInvited: true, inviteId: data.data.id }
            : player
        )
      );
    } catch {
      setError("Erro de conexão ao convidar jogador.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUninvite = async (player: PlayerInviteData) => {
    const targetId = player.inviteId || player.id;
    setError(null);
    setActionLoadingId(player.id);
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/invites/${targetId}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao remover convite");
        return;
      }

      setPlayers((prev) =>
        prev.map((p) =>
          p.id === player.id
            ? { ...p, isInvited: false, inviteId: null }
            : p
        )
      );
    } catch {
      setError("Erro de conexão ao remover convite.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDragStartActor = (e: React.DragEvent, actor: RosterActor) => {
    e.dataTransfer.setData("application/json", JSON.stringify(actor));
  };

  const filteredActors = actors.filter((actor) =>
    actor.name.toLowerCase().includes(actorSearchQuery.toLowerCase())
  );

  const filteredPlayers = players.filter(
    (player) =>
      player.displayName.toLowerCase().includes(playerSearchQuery.toLowerCase()) ||
      player.email.toLowerCase().includes(playerSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-3 rounded-lg border border-gray-800 bg-gray-900 p-3">
      {/* Seção Personagens e NPCs com Barra de Pesquisa */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">
            Personagens e NPCs ({actors.length})
          </h3>
        </div>

        <div className="mb-2">
          <input
            type="text"
            placeholder="Pesquisar personagem ou NPC..."
            value={actorSearchQuery}
            onChange={(e) => setActorSearchQuery(e.target.value)}
            className="w-full rounded border border-gray-800 bg-gray-950 px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-transparent focus:ring-1 focus:ring-purple-600"
          />
        </div>

        {isLoading ? (
          <p className="text-xs text-gray-500">Carregando personagens...</p>
        ) : filteredActors.length === 0 ? (
          <p className="text-xs text-gray-500">
            {actorSearchQuery ? "Nenhum personagem encontrado." : "Nenhum personagem ou NPC cadastrado."}
          </p>
        ) : (
          <div className="max-h-36 space-y-1.5 overflow-y-auto pr-0.5">
            {filteredActors.map((actor) => (
              <div
                key={`${actor.kind}-${actor.id}`}
                draggable
                onDragStart={(e) => handleDragStartActor(e, actor)}
                className="group flex cursor-grab items-center justify-between rounded-lg border border-gray-800 bg-gray-950 p-2 transition-colors hover:border-purple-600 hover:bg-gray-900 active:cursor-grabbing"
                title="Arraste para o carrossel na Mesa para ativar no combate"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-gray-500 group-hover:text-purple-400">⠿</span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">{actor.name}</p>
                    <p className="text-[10px] text-gray-400">Nível {actor.level}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    actor.kind === "character"
                      ? "bg-purple-900/50 text-purple-300 border border-purple-800/50"
                      : actor.npcType === "enemy"
                      ? "bg-red-900/50 text-red-300 border border-red-800/50"
                      : "bg-gray-800 text-gray-300"
                  }`}
                >
                  {actor.kind === "character"
                    ? "Jogador"
                    : actor.npcType === "enemy"
                    ? "Inimigo"
                    : "NPC"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção Convidar Jogadores Direto */}
      <div className="border-t border-gray-800 pt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">
            Jogadores ({players.filter((p) => p.isInvited).length}/{players.length})
          </h3>
        </div>

        <div className="mb-2">
          <input
            type="text"
            placeholder="Buscar jogador por nome ou email..."
            value={playerSearchQuery}
            onChange={(e) => setPlayerSearchQuery(e.target.value)}
            className="w-full rounded border border-gray-800 bg-gray-950 px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-transparent focus:ring-1 focus:ring-purple-600"
          />
        </div>

        {error && (
          <div className="mb-2 rounded-lg border border-red-800 bg-red-900/30 p-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {isLoading ? (
          <p className="text-xs text-gray-500">Carregando jogadores...</p>
        ) : filteredPlayers.length === 0 ? (
          <p className="text-xs text-gray-500">
            {playerSearchQuery ? "Nenhum jogador encontrado." : "Nenhum jogador cadastrado no sistema."}
          </p>
        ) : (
          <div className="max-h-48 space-y-1.5 overflow-y-auto pr-0.5">
            {filteredPlayers.map((player) => {
              const isActionLoading = actionLoadingId === player.id;
              return (
                <div
                  key={player.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-800 bg-gray-950 p-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs font-semibold text-white">
                        {player.displayName}
                      </p>
                      {player.isInvited && (
                        <span className="shrink-0 rounded border border-emerald-800/60 bg-emerald-950/80 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                          Convidado
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[10px] text-gray-400">{player.email}</p>
                    {player.activeCharactersCount > 0 && (
                      <p className="text-[10px] text-purple-400 font-medium">
                        {player.activeCharactersCount}{" "}
                        {player.activeCharactersCount === 1
                          ? "personagem ativo"
                          : "personagens ativos"}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {player.isInvited ? (
                      <button
                        onClick={() => handleUninvite(player)}
                        disabled={isActionLoading}
                        className="rounded px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50 transition-colors"
                        title="Remover convite"
                      >
                        {isActionLoading ? "..." : "Remover"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleInvite(player.id)}
                        disabled={isActionLoading}
                        className="rounded bg-purple-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-purple-500 disabled:opacity-50 transition-colors"
                      >
                        {isActionLoading ? "..." : "+ Convidar"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
