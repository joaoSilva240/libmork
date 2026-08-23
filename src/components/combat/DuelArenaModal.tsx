// =============================================================================
// Libmork — Arena / Interface de Duelo P2P (RF-069, D-45)
// =============================================================================

"use client";

import React, { useState } from "react";
import { Swords, Heart, Zap, Sparkles, X, Award } from "lucide-react";
import { useSocket } from "@/context/SocketContext";
import {
  type DuelSessionState,
  spendDuelActions,
  advanceDuelTurn,
  applyDuelDamage,
  finishDuelSession,
} from "@/lib/engine/duel";

type DuelArenaModalProps = {
  duelState: DuelSessionState | null;
  myCharacterId: string;
  isOpen: boolean;
  onClose?: () => void;
};

export function DuelArenaModal({
  duelState,
  myCharacterId,
  isOpen,
}: DuelArenaModalProps) {
  const { updateDuelState, finishDuel, rollDice } = useSocket();
  const [localStateOverride, setLocalStateOverride] = useState<DuelSessionState | null>(null);

  const localState = localStateOverride ?? duelState;

  if (!isOpen || !localState) return null;

  const currentParticipant = localState.participants[localState.currentTurnIndex];
  const isMyTurn = currentParticipant?.characterId === myCharacterId;
  const myParticipant = localState.participants.find((p) => p.characterId === myCharacterId);
  const opponent = localState.participants.find((p) => p.characterId !== myCharacterId);

  const handleSpendAction = (actionName: string) => {
    if (!isMyTurn || !localState || localState.status !== "active") return;

    // Rolar dado e emitir no socket
    const mod = myParticipant ? Math.floor((myParticipant.vigor - 10) / 2) : 0;
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + mod;

    rollDice({
      campaignId: localState.campaignId,
      actorId: myCharacterId,
      actorName: myParticipant?.name || "Duelista",
      rollType: `Duelo: ${actionName}`,
      formula: `1d20 + ${mod}`,
      result: total,
      diceDetail: `Rolou [${d20}] + ${mod} = ${total}`,
    });

    const { session } = spendDuelActions(localState, myCharacterId, 1);
    setLocalStateOverride(session);
    updateDuelState(session);
  };

  const handleApplyDamageToOpponent = (damageAmount: number) => {
    if (!opponent || !localState) return;
    const updated = applyDuelDamage(localState, opponent.characterId, damageAmount);
    setLocalStateOverride(updated);
    updateDuelState(updated);

    if (updated.status === "finished") {
      handleFinish(updated.winnerId ?? undefined);
    }
  };

  const handlePassTurn = () => {
    if (!isMyTurn || !localState) return;
    const updated = advanceDuelTurn(localState);
    setLocalStateOverride(updated);
    updateDuelState(updated);
  };

  const handleFinish = (winnerId?: string) => {
    if (!localState) return;
    const { session } = finishDuelSession(localState, winnerId);
    setLocalStateOverride(session);
    finishDuel({
      campaignId: localState.campaignId,
      duelId: localState.id,
      winnerId,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-3xl border border-rose-900/60 bg-gray-950 p-6 text-gray-100 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-900/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-rose-950 p-3 text-rose-400 border border-rose-800/40">
              <Swords className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-rose-200">Arena de Duelo P2P</h3>
                <span className="rounded-full bg-rose-950/80 px-2.5 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-800/40">
                  Rodada {localState.round}
                </span>
              </div>
              <p className="text-xs text-rose-400/80">
                {localState.permanentResults ? "⚠️ Resultados Permanentes" : "✦ Resultados Temporários (Restaurados ao final)"}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleFinish()}
            className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-800 transition flex items-center gap-1.5"
          >
            <X className="h-4 w-4" />
            <span>Encerrar Duelo</span>
          </button>
        </div>

        {/* Status de Vitória */}
        {localState.status === "finished" && (
          <div className="rounded-2xl border border-amber-800 bg-amber-950/40 p-4 text-center space-y-2">
            <Award className="h-8 w-8 text-amber-400 mx-auto animate-bounce" />
            <h4 className="text-base font-bold text-amber-200">Duelo Encerrado!</h4>
            <p className="text-xs text-amber-300">
              {localState.winnerId === myCharacterId
                ? "🏆 Você venceu o duelo!"
                : localState.winnerId
                ? `Vencedor: ${localState.participants.find((p) => p.characterId === localState.winnerId)?.name}`
                : "Duelo finalizado por acordo."}
            </p>
            {!localState.permanentResults && (
              <p className="text-[11px] text-emerald-400 font-semibold">
                ✓ Todos os status (HP/Mana) foram restaurados ao valor original pré-duelo.
              </p>
            )}
          </div>
        )}

        {/* Combatentes na Arena */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {localState.participants.map((p, idx) => {
            const isTurn = idx === localState.currentTurnIndex;
            const isMe = p.characterId === myCharacterId;

            return (
              <div
                key={p.id || p.characterId}
                className={`rounded-2xl p-4 border transition-all ${
                  isTurn
                    ? "border-rose-500 bg-rose-950/30 shadow-lg shadow-rose-950/50 scale-[1.02]"
                    : "border-gray-800 bg-gray-900/60 opacity-85"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center font-bold text-xs text-gray-200 border border-gray-700 overflow-hidden">
                      {p.avatarUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={p.avatarUrl} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        p.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-100 flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {isMe && <span className="text-[10px] text-rose-400 font-semibold">(Você)</span>}
                      </div>
                      <span className="text-[10px] text-gray-400">Iniciativa: {p.initiative}</span>
                    </div>
                  </div>

                  {isTurn && (
                    <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
                      TURNO ATIVO
                    </span>
                  )}
                </div>

                {/* HP e Mana Bars */}
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between font-semibold mb-1 text-[11px]">
                      <span className="flex items-center gap-1 text-rose-400">
                        <Heart className="h-3 w-3" /> HP
                      </span>
                      <span className="text-gray-300">
                        {p.hpCurrent} / {p.hpMax}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className="h-full bg-rose-600 transition-all duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, (p.hpCurrent / p.hpMax) * 100))}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold mb-1 text-[11px]">
                      <span className="flex items-center gap-1 text-blue-400">
                        <Zap className="h-3 w-3" /> Mana
                      </span>
                      <span className="text-gray-300">
                        {p.manaCurrent} / {p.manaMax}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, (p.manaCurrent / p.manaMax) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Contador de Ações (3/3) */}
                  <div className="pt-2 flex items-center justify-between text-[11px] font-semibold border-t border-gray-800/80">
                    <span className="text-gray-400">Ações Restantes:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3].map((actionNum) => (
                        <div
                          key={actionNum}
                          className={`h-3 w-3 rounded-full border ${
                            actionNum <= p.actionsRemaining
                              ? "bg-rose-500 border-rose-400 shadow"
                              : "bg-gray-800 border-gray-700"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Controles de Ação no Turno */}
        {localState.status === "active" && isMyTurn && (
          <div className="rounded-2xl border border-rose-800/60 bg-rose-950/20 p-4 space-y-3">
            <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider">
              Sua Vez — Escolha sua Ação de Duelo
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSpendAction("Ataque Físico")}
                className="rounded-xl border border-rose-700/60 bg-rose-900/40 p-2.5 text-xs font-bold text-rose-200 hover:bg-rose-800/50 transition flex items-center justify-center gap-2"
              >
                <Swords className="h-4 w-4" />
                <span>Atacar (1 Ação)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSpendAction("Magia / Habilidade")}
                className="rounded-xl border border-blue-700/60 bg-blue-900/40 p-2.5 text-xs font-bold text-blue-200 hover:bg-blue-800/50 transition flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                <span>Magia (1 Ação)</span>
              </button>

              <button
                type="button"
                onClick={handlePassTurn}
                className="rounded-xl border border-gray-700 bg-gray-900 p-2.5 text-xs font-semibold text-gray-300 hover:bg-gray-800 transition"
              >
                Passar Turno
              </button>
            </div>

            {/* Teste Rápido de Dano no Oponente */}
            {opponent && (
              <div className="pt-2 flex items-center justify-between border-t border-rose-900/40 text-xs">
                <span className="text-gray-400">Causar Dano em {opponent.name}:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApplyDamageToOpponent(5)}
                    className="rounded-lg bg-rose-900/60 border border-rose-700 px-2.5 py-1 font-bold text-rose-200 hover:bg-rose-800"
                  >
                    -5 HP
                  </button>
                  <button
                    onClick={() => handleApplyDamageToOpponent(10)}
                    className="rounded-lg bg-rose-900/60 border border-rose-700 px-2.5 py-1 font-bold text-rose-200 hover:bg-rose-800"
                  >
                    -10 HP
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Log do Duelo */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-3.5 space-y-2 max-h-36 overflow-y-auto text-xs">
          <div className="font-bold text-gray-400 text-[11px] uppercase tracking-wider">
            Histórico do Duelo
          </div>
          {localState.logs.map((log) => (
            <div key={log.id} className="text-gray-300 text-[11px] flex gap-2">
              <span className="text-gray-500 font-mono">[{log.timestamp}]</span>
              <span>{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
