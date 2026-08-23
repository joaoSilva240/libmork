"use client";

import { useEffect, useState } from "react";
import type { Npc } from "@/types";
import type { RosterPlayer, RosterActor } from "@/components/campaigns/ActorOverlay";

type InviteData = {
  id: string;
  campaignId: string;
  token: string;
  revoked: boolean;
  createdAt: string;
  url: string;
};

export function CampaignInvites({ campaignId }: { campaignId: string }) {
  const [invites, setInvites] = useState<InviteData[]>([]);
  const [actors, setActors] = useState<RosterActor[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

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
          setInvites(invitesData.data.filter((invite: InviteData) => !invite.revoked));
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

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/invites`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao gerar convite");
        return;
      }

      setInvites((prev) => [...prev, data.data]);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (!window.confirm("Revogar este convite? O link deixará de funcionar.")) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/invites/${inviteId}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao revogar convite");
        return;
      }

      setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const handleCopy = async (invite: InviteData) => {
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopiedToken(invite.token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      setError("Não foi possível copiar. Copie manualmente.");
    }
  };

  const handleDragStartActor = (e: React.DragEvent, actor: RosterActor) => {
    e.dataTransfer.setData("application/json", JSON.stringify(actor));
  };

  const filteredActors = actors.filter((actor) =>
    actor.name.toLowerCase().includes(searchQuery.toLowerCase())
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded border border-gray-800 bg-gray-950 px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-transparent focus:ring-1 focus:ring-purple-600"
          />
        </div>

        {isLoading ? (
          <p className="text-xs text-gray-500">Carregando personagens...</p>
        ) : filteredActors.length === 0 ? (
          <p className="text-xs text-gray-500">
            {searchQuery ? "Nenhum personagem encontrado." : "Nenhum personagem ou NPC cadastrado."}
          </p>
        ) : (
          <div className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
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

      {/* Seção Convites de Jogadores */}
      <div className="border-t border-gray-800 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Links de Convite
          </h3>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="rounded bg-purple-600 px-2 py-1 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {isGenerating ? "..." : "+ Novo Convite"}
          </button>
        </div>

        {error && (
          <div className="mb-2 rounded-lg border border-red-800 bg-red-900/30 p-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {invites.length === 0 ? (
          <p className="text-xs text-gray-500">
            Nenhum convite pendente. Gere um link acima.
          </p>
        ) : (
          <div className="space-y-1.5">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-950 p-1.5"
              >
                <input
                  type="text"
                  readOnly
                  value={invite.url}
                  className="w-full truncate rounded border border-gray-800 bg-gray-900 px-2 py-1 text-[11px] text-gray-400"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={() => handleCopy(invite)}
                  className="shrink-0 rounded bg-gray-800 px-2 py-1 text-[11px] font-medium text-white hover:bg-gray-700"
                >
                  {copiedToken === invite.token ? "Copiado!" : "Copiar"}
                </button>
                <button
                  onClick={() => handleRevoke(invite.id)}
                  className="shrink-0 text-[11px] text-red-400 hover:text-red-300"
                >
                  Revogar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
