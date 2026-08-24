"use client";

import { useCallback, useEffect, useState } from "react";
import type { Npc, World, Encounter } from "@/types";
import { ActorOverlay } from "@/components/campaigns/ActorOverlay";
import type { RosterActor, RosterPlayer } from "@/components/campaigns/ActorOverlay";
import { InfiniteCanvas } from "@/components/campaigns/InfiniteCanvas";
import { CharacterCarousel } from "@/components/campaigns/CharacterCarousel";
import { EncounterModal } from "@/components/campaigns/EncounterModal";
import { useSocket, type RollDataPayload } from "@/context/SocketContext";
import { CombatTrackerModal } from "@/components/combat/CombatTrackerModal";
import type { CombatSessionState } from "@/lib/engine";
import { advanceCombatTurn, spendCombatActions } from "@/lib/engine";

type RosterData = {
  players: RosterPlayer[];
  npcs: Npc[];
};

export function MasterRoster({ campaignId }: { campaignId: string }) {
  const { isConnected, presenceList, joinCampaign, subscribeActorStatus, subscribeDiceRoll, subscribeCombatState } = useSocket();
  const [roster, setRoster] = useState<RosterData>({ players: [], npcs: [] });
  const [worlds, setWorlds] = useState<World[]>([]);
  const [selectedWorldId, setSelectedWorldId] = useState<string>("");
  const [activeEncounter, setActiveEncounter] = useState<Encounter | null>(null);
  const [showEncounterModal, setShowEncounterModal] = useState(false);
  const [combatState, setCombatState] = useState<CombatSessionState | null>(null);
  const [showCombatTrackerModal, setShowCombatTrackerModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RosterActor | null>(null);
  const [recentRolls, setRecentRolls] = useState<RollDataPayload[]>([]);
  const [showRollFeed, setShowRollFeed] = useState(false);

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

  const handleRosterChanged = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/roster`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar personagens da campanha");
        return;
      }

      setRoster(data.data);

      const playersList: RosterPlayer[] = data.data.players || [];
      const npcsList: Npc[] = data.data.npcs || [];

      setDeskActors((prev) => {
        const updated = prev.map((actor) => {
          if (actor.kind === "character") {
            const freshPlayer = playersList.find((p) => p.id === actor.id);
            if (freshPlayer) {
              return {
                ...actor,
                level: freshPlayer.level,
                xp: freshPlayer.xp,
                hitPoints: freshPlayer.hitPointsCurrent,
                hitPointsMax: freshPlayer.hitPointsMax,
                manaPoints: freshPlayer.manaPointsCurrent,
                manaPointsMax: freshPlayer.manaPointsMax,
                conditions: freshPlayer.conditions,
              };
            }
          } else if (actor.kind === "npc") {
            const freshNpc = npcsList.find((n) => n.id === actor.id);
            if (freshNpc) {
              return {
                ...actor,
                level: freshNpc.level,
                xp: freshNpc.xp,
                hitPoints: freshNpc.hitPoints,
                hitPointsMax: freshNpc.hitPointsMax,
                manaPoints: freshNpc.manaPoints,
                manaPointsMax: freshNpc.manaPointsMax,
              };
            }
          }
          return actor;
        });

        try {
          localStorage.setItem(`carousel-desk-${campaignId}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  }, [campaignId]);

  // Entrar no Socket da campanha e escutar atualizações em tempo real
  useEffect(() => {
    joinCampaign({ campaignId, role: "master" });

    const unsubscribeStatus = subscribeActorStatus(() => {
      void handleRosterChanged();
    });

    const unsubscribeRoll = subscribeDiceRoll((roll) => {
      setRecentRolls((prev) => [roll, ...prev.slice(0, 49)]);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeRoll();
    };
  }, [campaignId, joinCampaign, subscribeActorStatus, subscribeDiceRoll, handleRosterChanged]);
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

    const unsubscribeCombat = subscribeCombatState((state) => {
      setCombatState(state);
    });

    return () => {
      cancelled = true;
      unsubscribeCombat();
    };
  }, [campaignId, selectedWorldId, subscribeCombatState]);

  const { updateCombatState } = useSocket();

  const handleNextTurn = () => {
    if (!combatState || !combatState.active) return;
    const nextState = advanceCombatTurn(combatState);
    updateCombatState(nextState);
  };

  const handleSpendAction = (cost: number = 1) => {
    if (!combatState || !combatState.active || combatState.combatants.length === 0) return;
    const current = combatState.combatants[combatState.currentTurnIndex];
    if (!current) return;
    const result = spendCombatActions(combatState, current.id, cost);
    if (result.success) {
      updateCombatState(result.session);
    }
  };

  const handleEndEncounter = async () => {
    if (!activeEncounter && !combatState?.active) return;
    try {
      if (activeEncounter) {
        await fetch(`/api/campaigns/${campaignId}/encounters/${activeEncounter.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        });
        setActiveEncounter(null);
      }

      if (combatState) {
        updateCombatState({
          ...combatState,
          active: false,
        });
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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-2">
        <div className="flex items-center gap-3">
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

          {/* Status Socket WebSocket em tempo real */}
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isConnected ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800" : "bg-rose-950/80 text-rose-400 border border-rose-800"
          }`}>
            <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            {isConnected ? "Ao Vivo" : "Conectando..."}
          </span>
        </div>

        {/* Presença de Participantes da Mesa (RF-026, D-37) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center -space-x-1 overflow-hidden">
            {presenceList.map((p) => (
              <div
                key={p.userId}
                title={`${p.userName} (${p.role === "master" ? "Mestre" : "Jogador"}) — ${p.online ? "Online" : "Offline"}`}
                className="relative"
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-full border border-gray-900 text-xs font-bold text-white ${
                  p.role === "master" ? "bg-purple-700" : "bg-blue-600"
                }`}>
                  {p.userName.slice(0, 2).toUpperCase()}
                </div>
                <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-gray-950 ${
                  p.online ? "bg-emerald-500" : "bg-gray-500"
                }`} />
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowRollFeed(!showRollFeed)}
            className="flex items-center gap-1.5 rounded-lg border border-purple-700/60 bg-purple-950/40 px-2.5 py-1 text-xs font-semibold text-purple-300 hover:bg-purple-900/50"
          >
            🎲 Rolagens {recentRolls.length > 0 && `(${recentRolls.length})`}
          </button>

          <span className="text-xs text-gray-400">
            {roster.players.length} jogadores · {filteredNpcs.length} NPCs
          </span>
        </div>
      </div>

      {/* Feed de Rolagens de Dados em Tempo Real (RF-041, RF-046) */}
      {showRollFeed && (
        <div className="mb-2 max-h-40 overflow-y-auto rounded-lg border border-purple-900/60 bg-purple-950/20 p-2.5 text-xs text-purple-200 shadow-inner">
          <div className="mb-1 flex items-center justify-between border-b border-purple-900/40 pb-1">
            <span className="font-bold text-purple-300">Feed de Rolagens ao Vivo</span>
            <button
              onClick={() => setRecentRolls([])}
              className="text-[10px] text-purple-400 hover:underline"
            >
              Limpar
            </button>
          </div>
          {recentRolls.length === 0 ? (
            <p className="py-2 text-center text-gray-400 italic">Nenhuma rolagem realizada na sessão ainda.</p>
          ) : (
            <div className="space-y-1">
              {recentRolls.map((roll, idx) => (
                <div key={idx} className="flex items-center justify-between rounded bg-gray-900/70 p-1.5 border border-purple-900/30">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{roll.actorName}</span>
                    <span className="rounded bg-purple-900/60 px-1.5 py-0.5 text-[10px] uppercase font-semibold text-purple-300">
                      {roll.rollType}
                    </span>
                    <span className="text-gray-300">{roll.formula}</span>
                    {roll.isManual && <span className="text-[10px] text-amber-400 font-semibold">[Físico]</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">{roll.diceDetail}</span>
                    <span className="rounded bg-emerald-950 px-2 py-0.5 text-sm font-black text-emerald-400 border border-emerald-800">
                      {roll.result}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
      <div className="mb-1 flex items-center justify-between rounded-t-lg bg-gray-900 px-3 py-2 border border-b-0 border-gray-800 text-xs flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {combatState?.active || activeEncounter ? (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
              </span>
              <span className="font-bold text-red-400">
                COMBATE ATIVO {activeEncounter ? `: ${activeEncounter.name}` : ""} {combatState?.active ? `(Rodada ${combatState.round})` : ""}
              </span>
            </div>
          ) : (
            <span className="text-gray-400">Nenhum combate ativo</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {combatState?.active ? (
            <>
              {/* Controles RÁPIDOS de Turno para o Mestre */}
              <button
                onClick={() => handleSpendAction(1)}
                className="rounded-lg border border-purple-600/60 bg-purple-950/60 px-2.5 py-1 text-xs font-bold text-purple-200 hover:bg-purple-900"
              >
                ⚡ Gastar 1 Ação
              </button>
              <button
                onClick={handleNextTurn}
                className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-bold text-white shadow hover:bg-purple-500"
              >
                Próximo Turno ⏩
              </button>
              <button
                onClick={() => setShowCombatTrackerModal(true)}
                className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs font-semibold text-gray-200 hover:bg-gray-700"
              >
                📋 Detalhes
              </button>
              <button
                onClick={handleEndEncounter}
                className="rounded-lg bg-red-900/80 px-2.5 py-1 text-xs font-bold text-red-200 hover:bg-red-800"
              >
                🏁 Encerrar
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowEncounterModal(true)}
              disabled={!selectedWorldId}
              className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-purple-500 disabled:opacity-50"
            >
              ⚔️ Iniciar Encontro (Combate)
            </button>
          )}
        </div>
      </div>

      {/* Carrossel de personagens fixo na parte inferior */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropActor}
        className="min-h-[220px] h-56 rounded-b-lg border border-gray-800 bg-gray-900/50 p-2 overflow-visible"
      >
        <CharacterCarousel
          actors={deskActors.length > 0 ? deskActors : actors}
          combatState={combatState}
          onSelect={setSelected}
          onRemove={handleRemoveDeskActor}
        />
      </div>

      {selected && (
        <ActorOverlay
          campaignId={campaignId}
          actor={selected}
          onClose={() => setSelected(null)}
          onChanged={handleRosterChanged}
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

      {showCombatTrackerModal && (
        <CombatTrackerModal
          campaignId={campaignId}
          combatState={combatState}
          availableActors={(deskActors.length > 0 ? deskActors : actors).map((a) => ({
            id: a.id,
            name: a.name,
            type: a.kind === "npc" ? "npc" : "character",
            vigor: (a as unknown as { attributes?: { vigor?: number } }).attributes?.vigor ?? 10,
            destreza: (a as unknown as { attributes?: { destreza?: number } }).attributes?.destreza ?? 10,
            level: a.level ?? 1,
            hpCurrent: a.hitPoints ?? 15,
            hpMax: a.hitPointsMax ?? 15,
            manaCurrent: Number.isFinite(a.manaPoints) ? Math.max(0, a.manaPoints) : undefined,
            manaMax: Number.isFinite(a.manaPointsMax) ? Math.max(0, a.manaPointsMax) : undefined,
            avatarUrl: a.imageUrl,
          }))}
          onClose={() => setShowCombatTrackerModal(false)}
        />
      )}
    </div>
  );
}
