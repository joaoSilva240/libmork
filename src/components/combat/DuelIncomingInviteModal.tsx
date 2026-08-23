// =============================================================================
// Libmork — Modal de Convite de Duelo Recebido (RF-069, D-45)
// =============================================================================

"use client";

import React from "react";
import { Swords, Check, X } from "lucide-react";
import { useSocket, type DuelInviteRequestPayload } from "@/context/SocketContext";

type DuelIncomingInviteModalProps = {
  invite: DuelInviteRequestPayload | null;
  onRespond: (accepted: boolean) => void;
};

export function DuelIncomingInviteModal({ invite, onRespond }: DuelIncomingInviteModalProps) {
  const { respondDuelInvite } = useSocket();

  if (!invite) return null;

  const handleChoice = (accepted: boolean) => {
    respondDuelInvite({
      campaignId: invite.campaignId,
      challengerId: invite.challengerId,
      targetCharacterId: invite.targetCharacterId,
      accepted,
      permanentResults: invite.permanentResults,
    });
    onRespond(accepted);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl border border-rose-800 bg-gray-950 p-6 text-gray-100 shadow-2xl space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-950 border border-rose-800/60 text-rose-400">
          <Swords className="h-7 w-7 animate-pulse" />
        </div>

        <div>
          <h3 className="text-base font-bold text-rose-200">Desafio de Duelo!</h3>
          <p className="mt-1 text-xs text-gray-300">
            <strong className="text-white">{invite.challengerName}</strong> desafiou seu personagem{" "}
            <strong className="text-rose-300">{invite.targetCharacterName}</strong> para um duelo em tempo real!
          </p>
        </div>

        <div className="rounded-xl border border-rose-900/40 bg-rose-950/30 p-2.5 text-xs text-rose-300">
          Modalidade:{" "}
          <strong className={invite.permanentResults ? "text-red-400" : "text-emerald-400"}>
            {invite.permanentResults ? "Resultados Permanentes" : "Resultados Temporários (Treino)"}
          </strong>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleChoice(false)}
            className="w-1/2 rounded-xl border border-gray-800 bg-gray-900 px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-gray-800 transition flex items-center justify-center gap-1.5"
          >
            <X className="h-4 w-4" />
            <span>Recusar</span>
          </button>

          <button
            type="button"
            onClick={() => handleChoice(true)}
            className="w-1/2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950"
          >
            <Check className="h-4 w-4" />
            <span>Aceitar Duelo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
