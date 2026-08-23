"use client";

import { useEffect, useState } from "react";
import type { Encounter } from "@/types";
import type { RosterActor } from "@/components/campaigns/ActorOverlay";
import { useSocket } from "@/context/SocketContext";
import { createCombatSession } from "@/lib/engine";

type EncounterModalProps = {
  campaignId: string;
  worldId: string;
  actors: RosterActor[];
  onClose: () => void;
  onEncounterStarted: () => void;
};

export function EncounterModal({
  campaignId,
  worldId,
  actors,
  onClose,
  onEncounterStarted,
}: EncounterModalProps) {
  const { requestInitiativeRoll, updateCombatState, subscribeDiceRoll } = useSocket();

  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string>("");
  const [selectedActorIds, setSelectedActorIds] = useState<Set<string>>(
    new Set(actors.map((a) => `${a.kind}:${a.id}`))
  );
  const [initiatives, setInitiatives] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    actors.forEach((a) => {
      // Valor randômico padrão para NPCs ou fallback (1-20)
      initial[`${a.kind}:${a.id}`] = Math.floor(Math.random() * 20) + 1;
    });
    return initial;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestedPrompt, setRequestedPrompt] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/worlds/${worldId}/encounters`);
        const data = await res.json();
        if (res.ok) {
          setEncounters(data.data || []);
          if (data.data && data.data.length > 0) {
            setSelectedEncounterId(data.data[0].id);
          }
        } else {
          setError(data.error || "Erro ao carregar encontros");
        }
      } catch {
        setError("Erro de conexão");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [campaignId, worldId]);

  // Escuta rolagens de dados ao vivo (para preencher automaticamente iniciativas de jogadores)
  useEffect(() => {
    const unsubscribe = subscribeDiceRoll((roll) => {
      if (roll.rollType === "iniciativa" && roll.actorId) {
        setInitiatives((prev) => ({
          ...prev,
          [`character:${roll.actorId}`]: roll.result,
        }));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [subscribeDiceRoll]);

  const toggleActor = (actorKey: string) => {
    const next = new Set(selectedActorIds);
    if (next.has(actorKey)) {
      next.delete(actorKey);
    } else {
      next.add(actorKey);
    }
    setSelectedActorIds(next);
  };

  const handleRequestPlayerInitiatives = () => {
    requestInitiativeRoll(campaignId);
    setRequestedPrompt(true);
  };

  const handleStartEncounter = async () => {
    if (!selectedEncounterId) {
      setError("Selecione um encontro");
      return;
    }

    if (selectedActorIds.size === 0) {
      setError("Selecione pelo menos 1 participante para o combate");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Ativar o encontro no banco de dados
      const res = await fetch(`/api/campaigns/${campaignId}/encounters/${selectedEncounterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao iniciar encontro");
        setIsSubmitting(false);
        return;
      }

      // 2. Adicionar participantes selecionados no banco de dados
      const promises = Array.from(selectedActorIds).map((key) => {
        const [kind, id] = key.split(":");
        return fetch(`/api/campaigns/${campaignId}/encounters/${selectedEncounterId}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actorType: kind,
            actorId: id,
          }),
        });
      });

      await Promise.all(promises);

      // 3. Montar combatentes ordenados por iniciativa e emitir via WebSocket
      const selectedActors = actors.filter((a) => selectedActorIds.has(`${a.kind}:${a.id}`));
      const rawCombatants = selectedActors.map((a) => {
        const key = `${a.kind}:${a.id}`;
        const iniValue = Number(initiatives[key]) || 1;
        return {
          id: a.id,
          name: a.name,
          type: a.kind === "npc" ? ("npc" as const) : ("character" as const),
          characterId: a.kind === "character" ? a.id : undefined,
          npcId: a.kind === "npc" ? a.id : undefined,
          initiative: iniValue,
          hpCurrent: a.hitPoints,
          hpMax: a.hitPointsMax,
          vigor: (a as unknown as { attributes?: { vigor?: number } }).attributes?.vigor ?? 10,
          destreza: (a as unknown as { attributes?: { destreza?: number } }).attributes?.destreza ?? 10,
          level: a.level || 1,
          avatarUrl: a.imageUrl,
        };
      });

      const session = createCombatSession(campaignId, rawCombatants);
      updateCombatState(session);

      onEncounterStarted();
      onClose();
    } catch {
      setError("Erro ao registrar participantes do encontro");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-purple-800/80 bg-gray-950 p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-purple-900/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚔️</span>
            <div>
              <h2 className="text-lg font-bold text-white">Iniciar Encontro & Fila de Iniciativa</h2>
              <p className="text-xs text-purple-300">Selecione o combate e defina as iniciativas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-900/30 p-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-gray-700 border-t-purple-600" />
          </div>
        ) : encounters.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400">
            Nenhum encontro cadastrado para este mundo. Crie um encontro na aba &quot;Mundos&quot;.
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-300">
                Selecione o Encontro
              </label>
              <select
                value={selectedEncounterId}
                onChange={(e) => setSelectedEncounterId(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
              >
                {encounters.map((enc) => (
                  <option key={enc.id} value={enc.id}>
                    {enc.name} {enc.isActive ? "(Ativo)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Seção de Iniciativa dos Participantes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-300">
                  Participantes & Rolagens de Iniciativa
                </label>
                <button
                  type="button"
                  onClick={handleRequestPlayerInitiatives}
                  className="rounded-lg border border-purple-600/60 bg-purple-950/60 px-2.5 py-1 text-[11px] font-bold text-purple-300 hover:bg-purple-900/60 shadow"
                >
                  📢 Requisitar dos Jogadores (Pop-up)
                </button>
              </div>

              {requestedPrompt && (
                <div className="rounded-lg bg-purple-950/40 p-2 text-[11px] text-purple-300 border border-purple-900/40">
                  ⚡ Pop-up enviado para os jogadores conectados! Conforme eles rolares, o valor da iniciativa atualizará aqui em tempo real.
                </div>
              )}

              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-gray-800 bg-gray-900/80 p-2.5">
                {actors.map((actor) => {
                  const key = `${actor.kind}:${actor.id}`;
                  const isChecked = selectedActorIds.has(key);

                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between rounded-lg p-2 transition-colors ${
                        isChecked ? "bg-gray-800/90 border border-purple-900/50" : "bg-gray-950/50 opacity-60"
                      }`}
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer text-xs text-white">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleActor(key)}
                          className="h-4 w-4 accent-purple-600"
                        />
                        <span className="font-semibold">{actor.name}</span>
                        <span className="text-[10px] text-gray-400">
                          ({actor.kind === "character" ? "Jogador" : "NPC"})
                        </span>
                      </label>

                      {isChecked && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-purple-400 font-semibold">Ini:</span>
                          <input
                            type="number"
                            value={initiatives[key] ?? 10}
                            onChange={(e) =>
                              setInitiatives({ ...initiatives, [key]: Number(e.target.value) })
                            }
                            className="w-14 rounded-lg border border-gray-700 bg-gray-950 px-2 py-1 text-center text-xs font-bold text-white focus:border-purple-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleStartEncounter}
                disabled={isSubmitting || selectedActorIds.size === 0}
                className="flex-1 rounded-xl bg-purple-600 py-3 text-sm font-bold text-white shadow-lg hover:bg-purple-500 disabled:opacity-50"
              >
                {isSubmitting ? "Iniciando..." : "⚔️ Iniciar Combate com Fila de Iniciativa"}
              </button>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-xs font-semibold text-gray-300 hover:bg-gray-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
