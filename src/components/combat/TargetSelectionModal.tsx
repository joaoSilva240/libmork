// =============================================================================
// Libmork — Modal de Seleção de Alvo em Combate (RF-047, RF-066, D-41)
// =============================================================================

"use client";

import React, { useState } from "react";
import { Crosshair, Heart, Sparkles, X } from "lucide-react";
import type { Combatant } from "@/lib/engine";

type TargetSelectionModalProps = {
  actionName: string;
  isHealing?: boolean;
  combatants: Combatant[];
  myCharacterId: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirmTarget: (targetCombatant: Combatant) => void;
};

export function TargetSelectionModal({
  actionName,
  isHealing = false,
  combatants,
  myCharacterId,
  isOpen,
  onClose,
  onConfirmTarget,
}: TargetSelectionModalProps) {
  const [selectedId, setSelectedId] = useState<string>("");

  if (!isOpen) return null;

  // Se for cura, mostra todos aliados/combatentes. Se for ataque, foca nos inimigos/outros combatentes.
  const targets = combatants.filter((c) => (isHealing ? true : c.id !== myCharacterId && c.characterId !== myCharacterId));

  const handleConfirm = () => {
    const target = targets.find((t) => t.id === selectedId || t.characterId === selectedId);
    if (target) {
      onConfirmTarget(target);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl border border-purple-800 bg-gray-950 p-6 text-gray-100 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-purple-900/60 pb-3">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2.5 border ${isHealing ? "bg-emerald-950 border-emerald-800 text-emerald-300" : "bg-rose-950 border-rose-800 text-rose-300"}`}>
              {isHealing ? <Heart className="h-5 w-5" /> : <Crosshair className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Selecione o Alvo</h3>
              <p className="text-xs text-purple-300">Ação: <strong>{actionName}</strong></p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {targets.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-4">Nenhum alvo válido encontrado no combate ativo.</p>
          ) : (
            targets.map((c) => {
              const isSelected = selectedId === c.id || selectedId === c.characterId;

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition ${
                    isSelected
                      ? isHealing
                        ? "border-emerald-500 bg-emerald-950/60 text-white"
                        : "border-rose-500 bg-rose-950/60 text-white"
                      : "border-gray-800 bg-gray-900/60 text-gray-300 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-bold text-xs overflow-hidden">
                      {c.avatarUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={c.avatarUrl} alt={c.name} className="h-full w-full object-cover" />
                      ) : (
                        c.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>{c.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${c.type === "npc" ? "bg-red-950 text-red-300" : "bg-purple-950 text-purple-300"}`}>
                          {c.type === "npc" ? "Inimigo" : "Jogador"}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-medium">
                        HP: {c.hpCurrent} / {c.hpMax}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <span className={`text-xs font-bold ${isHealing ? "text-emerald-400" : "text-rose-400"}`}>
                      ✓ Selecionado
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-1/2 rounded-xl border border-gray-800 bg-gray-900 py-2.5 text-xs font-semibold text-gray-300 hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedId}
            className={`w-1/2 rounded-xl py-2.5 text-xs font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-1.5 ${
              isHealing ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Confirmar Alvo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
