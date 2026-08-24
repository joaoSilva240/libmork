"use client";

import React, { useState } from "react";
import type { CombatSessionState, Combatant } from "@/lib/engine";
import { advanceCombatTurn, spendCombatActions, createCombatSession } from "@/lib/engine";
import { useSocket } from "@/context/SocketContext";

interface CombatTrackerModalProps {
  campaignId: string;
  combatState: CombatSessionState | null;
  availableActors: Array<{
    id: string;
    name: string;
    type: "character" | "npc";
    vigor: number;
    destreza: number;
    level: number;
    hpCurrent: number;
    hpMax: number;
    manaCurrent?: number;
    manaMax?: number;
    avatarUrl?: string | null;
  }>;
  onClose: () => void;
}

export function CombatTrackerModal({
  campaignId,
  combatState,
  availableActors,
  onClose,
}: CombatTrackerModalProps) {
  const { updateCombatState, requestInitiativeRoll } = useSocket();
  const [initiatives, setInitiatives] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    availableActors.forEach((actor) => {
      initial[actor.id] = Math.floor(Math.random() * 20) + 1;
    });
    return initial;
  });

  const handleStartCombat = () => {
    const rawCombatants = availableActors.map((actor) => ({
      id: actor.id,
      name: actor.name,
      type: actor.type,
      initiative: Number(initiatives[actor.id]) || 1,
      hpCurrent: actor.hpCurrent,
      hpMax: actor.hpMax,
      manaCurrent: actor.manaCurrent,
      manaMax: actor.manaMax,
      vigor: actor.vigor,
      destreza: actor.destreza,
      level: actor.level,
      avatarUrl: actor.avatarUrl,
    }));

    const newSession = createCombatSession(campaignId, rawCombatants);
    updateCombatState(newSession);
  };

  const handleAdvanceTurn = () => {
    if (!combatState) return;
    const nextState = advanceCombatTurn(combatState);
    updateCombatState(nextState);
  };

  const handleSpendAction = (combatantId: string, cost: number = 1) => {
    if (!combatState) return;
    const result = spendCombatActions(combatState, combatantId, cost);
    if (result.success) {
      updateCombatState(result.session);
    }
  };

  const handleEndCombat = () => {
    if (!combatState) return;
    updateCombatState({
      ...combatState,
      active: false,
      logs: [
        {
          id: `log_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          message: "Encontro de combate finalizado.",
        },
        ...combatState.logs,
      ],
    });
  };

  const handleRequestInitiative = () => {
    requestInitiativeRoll(campaignId);
  };

  const currentTurnCombatant: Combatant | undefined =
    combatState?.active && combatState.combatants.length > 0
      ? combatState.combatants[combatState.currentTurnIndex]
      : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-purple-800/60 bg-gray-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-900/60 bg-purple-950/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚔️</span>
            <div>
              <h2 className="text-lg font-bold text-white">Gerenciador de Combate (Iniciativa & Turnos)</h2>
              <p className="text-xs text-purple-300">
                {combatState?.active
                  ? `Rodada ${combatState.round} · Turno de ${currentTurnCombatant?.name || "Desconhecido"}`
                  : "Configure a iniciativa e inicie a rodada de combate"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!combatState || !combatState.active ? (
            /* Setup de Iniciativa */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-200">Definir Iniciativas dos Participantes</h3>
                <button
                  onClick={handleRequestInitiative}
                  className="rounded-lg border border-purple-600/60 bg-purple-900/40 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-800/60"
                >
                  📢 Requisitar aos Jogadores (Pop-up)
                </button>
              </div>

              <div className="space-y-2">
                {availableActors.map((actor) => (
                  <div
                    key={actor.id}
                    className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/80 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded font-bold uppercase bg-gray-800 text-gray-300">
                        {actor.type}
                      </span>
                      <span className="font-medium text-white">{actor.name}</span>
                      <span className="text-xs text-gray-400">
                        HP: {actor.hpCurrent}/{actor.hpMax}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-purple-400">Iniciativa:</span>
                      <input
                        type="number"
                        value={initiatives[actor.id] ?? 10}
                        onChange={(e) =>
                          setInitiatives({ ...initiatives, [actor.id]: Number(e.target.value) })
                        }
                        className="w-16 rounded-lg border border-gray-700 bg-gray-950 px-2 py-1 text-center text-sm font-bold text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleStartCombat}
                disabled={availableActors.length === 0}
                className="w-full rounded-xl bg-purple-600 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-purple-500 disabled:opacity-50"
              >
                ⚔️ Iniciar Combate com Fila Ordenada
              </button>
            </div>
          ) : (
            /* Painel de Combate Ativo */
            <div className="space-y-6">
              {/* Controle de Turno do Combatente Ativo */}
              {currentTurnCombatant && (
                <div className="rounded-2xl border border-purple-500/40 bg-purple-950/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                        Turno Ativo
                      </span>
                      <h3 className="text-xl font-bold text-white">{currentTurnCombatant.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Ações Restantes:</span>
                      <div className="flex gap-1">
                        {[1, 2, 3].map((num) => (
                          <span
                            key={num}
                            className={`h-4 w-4 rounded-full border border-purple-500 ${
                              num <= currentTurnCombatant.actionsRemaining
                                ? "bg-purple-500 shadow-md shadow-purple-500/50"
                                : "bg-gray-800"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-purple-900/40">
                    <button
                      onClick={() => handleSpendAction(currentTurnCombatant.id, 1)}
                      disabled={currentTurnCombatant.actionsRemaining < 1}
                      className="rounded-lg border border-purple-600/50 bg-purple-900/40 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-800 disabled:opacity-40"
                    >
                      ⚡ Gastar 1 Ação
                    </button>
                    <button
                      onClick={() => handleSpendAction(currentTurnCombatant.id, 2)}
                      disabled={currentTurnCombatant.actionsRemaining < 2}
                      className="rounded-lg border border-purple-600/50 bg-purple-900/40 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-800 disabled:opacity-40"
                    >
                      ⚡⚡ Gastar 2 Ações
                    </button>
                    <button
                      onClick={() => handleSpendAction(currentTurnCombatant.id, 3)}
                      disabled={currentTurnCombatant.actionsRemaining < 3}
                      className="rounded-lg border border-purple-600/50 bg-purple-900/40 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-800 disabled:opacity-40"
                    >
                      ⚡⚡⚡ Gastar 3 Ações (Turno Inteiro)
                    </button>
                  </div>
                </div>
              )}

              {/* Fila de Iniciativa */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Fila de Iniciativa (Rodada {combatState.round})
                </h4>
                <div className="space-y-2">
                  {combatState.combatants.map((c, idx) => {
                    const isCurrent = idx === combatState.currentTurnIndex;
                    return (
                      <div
                        key={c.id}
                        className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
                          isCurrent
                            ? "border-purple-500 bg-purple-950/60 shadow-lg shadow-purple-950/50"
                            : "border-gray-800 bg-gray-900/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              isCurrent ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-semibold text-white">{c.name}</span>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>HP: {c.hpCurrent}/{c.hpMax}</span>
                              <span>·</span>
                              <span>Ini: {c.initiative}</span>
                              {c.isFallen && <span className="text-amber-400 font-bold">☠️ Caído</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {[1, 2, 3].map((num) => (
                            <span
                              key={num}
                              className={`h-2.5 w-2.5 rounded-full ${
                                num <= c.actionsRemaining ? "bg-purple-400" : "bg-gray-700"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Log de Combate */}
              <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 space-y-1">
                <span className="text-xs font-bold text-gray-400">Histórico de Combate</span>
                <div className="max-h-32 overflow-y-auto space-y-1 text-xs text-gray-300">
                  {combatState.logs.map((log) => (
                    <div key={log.id} className="flex gap-2">
                      <span className="text-gray-500">[{log.timestamp}]</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-800 bg-gray-900/60 px-6 py-4">
          {combatState?.active ? (
            <>
              <button
                onClick={handleEndCombat}
                className="rounded-xl bg-red-900/80 px-4 py-2 text-xs font-bold text-red-200 hover:bg-red-800"
              >
                🏁 Encerrar Combate
              </button>
              <button
                onClick={handleAdvanceTurn}
                className="rounded-xl bg-purple-600 px-6 py-2 text-xs font-bold text-white shadow-lg hover:bg-purple-500"
              >
                Próximo Turno ⏩
              </button>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                onClick={onClose}
                className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
