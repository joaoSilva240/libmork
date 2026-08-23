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
    <div className="fixed bottom-[56px] left-0 right-0 z-30 mx-auto max-w-md px-2 pointer-events-none transition-all duration-300">
      <div className="flex items-center justify-between rounded-t-2xl rounded-b-none border border-b-0 border-purple-700/60 bg-gray-950/95 px-4 py-2.5 backdrop-blur-md shadow-2xl">
        {/* Fila de Avatares dos Combatentes */}
        <div className="flex items-center -space-x-1 overflow-x-auto scrollbar-hide max-w-[60%] py-1">
          {combatState.combatants.map((c, idx) => {
            const isCurrent = idx === combatState.currentTurnIndex;
            const isMe = c.id === myCombatant.id;

            return (
              <div
                key={c.id}
                title={`${c.name} (Ini: ${c.initiative})`}
                className={`relative shrink-0 transition-all duration-200 ${
                  isCurrent ? "scale-110 z-10" : "scale-90 opacity-75"
                }`}
              >
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.avatarUrl}
                    alt={c.name}
                    className={`h-9 w-9 rounded-full object-cover border-2 ${
                      isCurrent
                        ? "border-purple-400 ring-2 ring-purple-500 animate-pulse"
                        : isMe
                        ? "border-amber-400"
                        : "border-gray-800"
                    }`}
                  />
                ) : (
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white border-2 ${
                      isCurrent
                        ? "bg-purple-700 border-purple-400 ring-2 ring-purple-500 animate-pulse"
                        : isMe
                        ? "bg-amber-700 border-amber-400"
                        : "bg-gray-800 border-gray-700"
                    }`}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {isCurrent && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-purple-500 text-[9px] text-white font-black shadow border border-purple-300">
                    ⚡
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Status de Ações & Turno do Jogador */}
        <div className="flex items-center gap-3 pl-3 border-l border-gray-800">
          <div className="text-right">
            <span
              className={`block text-[11px] font-black uppercase tracking-wider ${
                isMyTurn ? "text-purple-300 animate-pulse" : "text-gray-400"
              }`}
            >
              {isMyTurn ? "SEU TURNO!" : `Turno: ${currentTurnCombatant?.name.split(" ")[0] || ""}`}
            </span>
            <span className="text-xs font-bold text-gray-200">
              Ações: <strong className="text-purple-400 text-sm">{actionsLeft}/3</strong>
            </span>
          </div>

          {/* Círculos dos Pontos de Ação (Aumentados) */}
          <div className="flex gap-1.5">
            {[1, 2, 3].map((num) => (
              <span
                key={num}
                className={`h-3.5 w-3.5 rounded-full border-2 transition-all ${
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
