"use client";

import React from "react";
import type { CombatSessionState, Combatant } from "@/lib/engine";

interface PlayerTurnOverlayProps {
  combatState: CombatSessionState;
  characterId: string;
}

export function PlayerTurnOverlay({ combatState, characterId }: PlayerTurnOverlayProps) {
  if (!combatState || !combatState.active || combatState.combatants.length === 0) {
    return null;
  }

  // Verifica se o personagem participa deste combate
  const myCombatant = combatState.combatants.find(
    (c) => c.id === characterId || c.characterId === characterId
  );

  if (!myCombatant) {
    return null; // Não exibe se o personagem não estiver no combate ativo
  }

  const currentTurnCombatant: Combatant | undefined =
    combatState.combatants[combatState.currentTurnIndex];

  const isMyTurn = currentTurnCombatant?.id === myCombatant.id;
  const actionsLeft = myCombatant.actionsRemaining ?? 3;

  return (
    <div className="fixed bottom-[54px] left-0 right-0 z-30 mx-auto max-w-md px-3 pointer-events-none transition-all duration-300">
      <div className="relative flex items-center justify-between rounded-t-3xl rounded-b-none border border-b-0 border-purple-600/70 bg-gray-950/95 px-5 pt-6 pb-3.5 backdrop-blur-lg shadow-2xl overflow-visible">
        {/* Avatares dos Combatentes em Posição Absoluta (Ancorados acima da borda superior) */}
        <div className="absolute -top-6 left-4 flex items-center -space-x-2 overflow-visible z-20 pointer-events-auto">
          {combatState.combatants.map((c, idx) => {
            const isCurrent = idx === combatState.currentTurnIndex;
            const isMe = c.id === myCombatant.id;

            return (
              <div
                key={c.id}
                title={`${c.name} (Ini: ${c.initiative})`}
                className={`relative shrink-0 transition-all duration-300 ${
                  isCurrent ? "scale-110 z-20" : "scale-90 opacity-80 hover:opacity-100"
                }`}
              >
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.avatarUrl}
                    alt={c.name}
                    className={`h-11 w-11 rounded-full object-cover shadow-lg border-2 ${
                      isCurrent
                        ? "border-purple-400 ring-4 ring-purple-500/50 animate-pulse"
                        : isMe
                        ? "border-amber-400 ring-2 ring-amber-500/30"
                        : "border-gray-800 bg-gray-900"
                    }`}
                  />
                ) : (
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-black text-white shadow-lg border-2 ${
                      isCurrent
                        ? "bg-purple-700 border-purple-400 ring-4 ring-purple-500/50 animate-pulse"
                        : isMe
                        ? "bg-amber-700 border-amber-400 ring-2 ring-amber-500/30"
                        : "bg-gray-800 border-gray-700"
                    }`}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Ícone de Raio no Turno Ativo */}
                {isCurrent && (
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-[10px] text-white font-black shadow-md border border-purple-300">
                    ⚡
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Informações do Turno Atual */}
        <div className="flex flex-col justify-end pt-1">
          <span
            className={`text-xs font-black uppercase tracking-wider ${
              isMyTurn ? "text-purple-300 animate-pulse" : "text-gray-400"
            }`}
          >
            {isMyTurn ? "⚡ SEU TURNO!" : `Turno: ${currentTurnCombatant?.name || ""}`}
          </span>
          <span className="text-[11px] text-gray-400 font-semibold">
            Rodada {combatState.round} · Ini {myCombatant.initiative}
          </span>
        </div>

        {/* Contador Pessoal de Ações de Combate */}
        <div className="flex items-center gap-3 pl-4 border-l border-gray-800">
          <div className="text-right">
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Ações
            </span>
            <span className="text-sm font-black text-purple-400">
              {actionsLeft}<span className="text-xs font-bold text-gray-500">/3</span>
            </span>
          </div>

          {/* Círculos Maiores dos Pontos de Ação */}
          <div className="flex gap-1.5">
            {[1, 2, 3].map((num) => (
              <span
                key={num}
                className={`h-4 w-4 rounded-full border-2 transition-all ${
                  num <= actionsLeft
                    ? isMyTurn
                      ? "bg-purple-400 border-purple-300 shadow-md shadow-purple-500"
                      : "bg-gray-300 border-gray-100"
                    : "bg-gray-900 border-gray-800 opacity-30"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
