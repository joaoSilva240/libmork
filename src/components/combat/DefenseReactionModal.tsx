"use client";

import React, { useState } from "react";
import type { DefenseReactionRequestPayload } from "@/context/SocketContext";
import { getGameSystem } from "@/lib/engine";

interface DefenseReactionModalProps {
  requestPayload: DefenseReactionRequestPayload;
  targetVigor: number;
  targetDestreza: number;
  targetLevel: number;
  onRespond: (reaction: "dodge" | "block", resultDetails: string, damageTaken: number) => void;
  onClose: () => void;
}

type ReactionChoice = "dodge" | "block";

type ReactionResult = {
  reaction: ReactionChoice;
  details: string;
  damageTaken: number;
};

/**
 * Modal de reação defensiva (RF-066, issue #90).
 * A rolagem do ataque e o dano ficam ocultos ("???") até o jogador escolher
 * esquivar ou bloquear; o resultado só é revelado após a escolha.
 */
export function DefenseReactionModal({
  requestPayload,
  targetVigor,
  targetDestreza,
  targetLevel,
  onRespond,
  onClose,
}: DefenseReactionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ReactionResult | null>(null);
  const system = getGameSystem("libmork");

  const defenseStatic = system.getDefenseValue(targetDestreza);
  const blockValue = system.getBlockValue(targetVigor, targetLevel);

  const handleSelectReaction = (reaction: ReactionChoice) => {
    setIsSubmitting(true);

    const attackRes = system.resolveAttack({
      rawDamage: requestPayload.rawDamage,
      reaction,
      attackRoll: requestPayload.attackRoll,
      defenseValue: defenseStatic,
      vigor: targetVigor,
      level: targetLevel,
      isPhysical: requestPayload.isPhysical,
    });

    setIsSubmitting(false);
    setResult({
      reaction,
      details: attackRes.details,
      damageTaken: attackRes.damageTaken,
    });
  };

  const handleConfirmResult = () => {
    if (!result) return;
    onRespond(result.reaction, result.details, result.damageTaken);
  };

  // ===== Etapa 1: escolha (rolagem e dano ocultos) =====
  if (!result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in">
        <div className="flex w-full max-w-sm flex-col rounded-3xl border border-purple-500/60 bg-gray-950 p-6 shadow-2xl space-y-5 text-center">
          <div className="space-y-1">
            <span className="text-4xl animate-bounce inline-block">🛡️</span>
            <h3 className="text-xl font-black text-white">REAÇÃO DEFENSIVA!</h3>
            <p className="text-xs text-purple-300">
              <strong className="text-white">{requestPayload.attackerName}</strong> atacou você
              {requestPayload.actionName ? ` com ${requestPayload.actionName}` : ""}!
            </p>
          </div>

          {/* Rolagem e dano revelados apenas após a escolha (issue #90) */}
          <div
            className="rounded-2xl border border-purple-900/40 bg-purple-950/30 p-3 space-y-1 text-xs"
            data-testid="defense-hidden-values"
          >
            <div className="flex justify-between text-gray-300">
              <span>Rolagem do Ataque:</span>
              <strong className="text-gray-500 select-none">???</strong>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Dano Declarado:</span>
              <strong className="text-gray-500 select-none">???</strong>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Tipo de Ataque:</span>
              <strong className="text-amber-300">
                {requestPayload.isPhysical ? "Físico" : "Mágico / Especial"}
              </strong>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {/* Botão Esquiva */}
            <button
              onClick={() => handleSelectReaction("dodge")}
              disabled={isSubmitting}
              data-testid="defense-choose-dodge"
              className="w-full rounded-2xl border border-blue-500/60 bg-blue-950/60 p-4 text-left shadow-lg hover:bg-blue-900/60 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-blue-200 group-hover:text-white">
                  💨 Esquivar
                </span>
                <span className="rounded-lg bg-blue-900/80 px-2 py-0.5 text-xs font-bold text-blue-300">
                  Defesa: {defenseStatic}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-blue-300/80">
                Compara a rolagem do ataque contra sua defesa estática ({defenseStatic}). Se
                esquivar, sofre 0 dano!
              </p>
            </button>

            {/* Botão Bloqueio */}
            <button
              onClick={() => handleSelectReaction("block")}
              disabled={isSubmitting}
              data-testid="defense-choose-block"
              className="w-full rounded-2xl border border-emerald-500/60 bg-emerald-950/60 p-4 text-left shadow-lg hover:bg-emerald-900/60 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-emerald-200 group-hover:text-white">
                  🛡️ Bloquear
                </span>
                <span className="rounded-lg bg-emerald-900/80 px-2 py-0.5 text-xs font-bold text-emerald-300">
                  Redução: -{blockValue}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-emerald-300/80">
                {requestPayload.isPhysical
                  ? `Acerto automático, mas reduz ${blockValue} do dano recebido.`
                  : "Ineficaz contra dano não-físico (sofre dano total)."}
              </p>
            </button>
          </div>

          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 pt-2">
            Ignorar / Escolher depois
          </button>
        </div>
      </div>
    );
  }

  // ===== Etapa 2: revelação do resultado após a escolha =====
  const isDodge = result.reaction === "dodge";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in">
      <div className="flex w-full max-w-sm flex-col rounded-3xl border border-purple-500/60 bg-gray-950 p-6 shadow-2xl space-y-5 text-center">
        <div className="space-y-1">
          <span className="text-4xl inline-block">{isDodge ? "💨" : "🛡️"}</span>
          <h3 className="text-xl font-black text-white">
            {isDodge ? "VOCÊ ESQUIVOU!" : "VOCÊ BLOQUEOU!"}
          </h3>
          <p className="text-xs text-purple-300">
            Resultado da reação de {requestPayload.attackerName}:
          </p>
        </div>

        <div
          className="rounded-2xl border border-purple-900/40 bg-purple-950/30 p-3 space-y-1 text-xs"
          data-testid="defense-revealed-values"
        >
          <div className="flex justify-between text-gray-300">
            <span>Rolagem do Ataque:</span>
            <strong className="text-purple-300">{requestPayload.attackRoll}</strong>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>Dano Declarado:</span>
            <strong className="text-rose-400">{requestPayload.rawDamage}</strong>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>Dano Sofrido:</span>
            <strong
              className={result.damageTaken > 0 ? "text-rose-400" : "text-emerald-400"}
              data-testid="defense-damage-taken"
            >
              {result.damageTaken}
            </strong>
          </div>
        </div>

        <p className="text-xs text-gray-300" data-testid="defense-result-details">
          {result.details}
        </p>

        <button
          onClick={handleConfirmResult}
          data-testid="defense-confirm-result"
          className="w-full rounded-2xl bg-purple-600 p-3 text-sm font-bold text-white hover:bg-purple-500 transition-all"
        >
          Concluir
        </button>
      </div>
    </div>
  );
}
