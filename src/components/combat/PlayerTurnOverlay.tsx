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
    <div className="fixed bottom-16 left-0 right-0 z-30 mx-auto max-w-md px-3 pointer-events-none transition-all duration-300">
      <div className="flex items-center justify-between rounded-full border border-purple-800/60 bg-gray-950/90 px-3 py-1.5 backdrop-blur-md shadow-2xl">
        {/* Mini Fila de Avatares dos Combatentes */}
        <div className="flex items-center -space-x-1.5 overflow-x-auto scrollbar-hide max-w-[55%] py-0.5">
          {combatState.combatants.map((c, idx) => {
            const isCurrent = idx === combatState.currentTurnIndex;
            const isMe = c.id === myCombatant.id;

            return (
              <div
                key={c.id}
                title={`${c.name} (Ini: ${c.initiative})`}
                className={`relative shrink-0 transition-transform ${
                  isCurrent ? "scale-110 z-10" : "scale-90 opacity-75"
                }`}
              >
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.avatarUrl}
                    alt={c.name}
                    className={`h-7 w-7 rounded-full object-cover border ${
                      isCurrent
                        ? "border-purple-400 ring-2 ring-purple-500 animate-pulse"
                        : isMe
                        ? "border-amber-400"
                        : "border-gray-800"
                    }`}
                  />
                ) : (
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white border ${
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
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-purple-500 text-[7px] text-white font-black">
                    ⚡
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Status de Ações & Turno do Jogador */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-800/80">
          <div className="text-right">
            <span
              className={`block text-[9px] font-black uppercase tracking-wider ${
                isMyTurn ? "text-purple-300 animate-pulse" : "text-gray-400"
              }`}
            >
              {isMyTurn ? "SEU TURNO!" : `Turno: ${currentTurnCombatant?.name.split(" ")[0] || ""}`}
            </span>
            <span className="text-[10px] font-bold text-gray-200">
              Ações: <strong className="text-purple-400">{actionsLeft}/3</strong>
            </span>
          </div>

          {/* Bolinhas dos Pontos de Ação */}
          <div className="flex gap-1">
            {[1, 2, 3].map((num) => (
              <span
                key={num}
                className={`h-2.5 w-2.5 rounded-full border transition-all ${
                  num <= actionsLeft
                    ? isMyTurn
                      ? "bg-purple-400 border-purple-300 shadow-sm shadow-purple-500"
                      : "bg-gray-400 border-gray-300"
                    : "bg-gray-900 border-gray-800 opacity-40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
