// =============================================================================
// Libmork — Modal de Criação / Convite de Duelo P2P (RF-069, D-45)
// =============================================================================

"use client";

import React, { useState } from "react";
import { Swords, ShieldAlert, X } from "lucide-react";
import { useSocket } from "@/context/SocketContext";

type DuelInviteModalProps = {
  campaignId: string;
  challengerId: string;
  challengerName: string;
  roster: Array<{ id: string; name: string; avatarUrl?: string | null }>;
  isOpen: boolean;
  onClose: () => void;
};

export function DuelInviteModal({
  campaignId,
  challengerId,
  challengerName,
  roster,
  isOpen,
  onClose,
}: DuelInviteModalProps) {
  const { requestDuelInvite } = useSocket();
  const [targetId, setTargetId] = useState<string>("");
  const [permanentResults, setPermanentResults] = useState<boolean>(false);

  if (!isOpen) return null;

  const availableTargets = roster.filter((c) => c.id !== challengerId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = availableTargets.find((t) => t.id === targetId);
    if (!target) return;

    requestDuelInvite({
      campaignId,
      challengerId,
      challengerName,
      targetCharacterId: target.id,
      targetCharacterName: target.name,
      permanentResults,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-rose-900/60 bg-gray-950 p-6 text-gray-100 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-rose-900/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-rose-950/80 p-3 text-rose-400 border border-rose-800/40">
              <Swords className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-rose-200">Duelo entre Jogadores</h3>
              <p className="text-xs text-rose-400/80">Modo P2P Independente do Mestre (D-45)</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Selecione o Oponente
            </label>
            {availableTargets.length === 0 ? (
              <p className="text-xs text-amber-400 bg-amber-950/30 border border-amber-900/40 rounded-xl p-3">
                Nenhum outro personagem aprovado nesta campanha para desafiar.
              </p>
            ) : (
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full rounded-xl border border-gray-800 bg-gray-900 p-2.5 text-xs text-gray-100 focus:border-rose-500 focus:outline-none"
              >
                <option value="">-- Escolha um oponente --</option>
                {availableTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Tipo de Resultado (Regra D-45)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPermanentResults(false)}
                className={`rounded-xl p-3 text-left transition border ${
                  !permanentResults
                    ? "bg-rose-950/60 border-rose-600 text-rose-200"
                    : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"
                }`}
              >
                <div className="text-xs font-bold">Temporário (Treino)</div>
                <div className="text-[10px] opacity-80 mt-0.5">
                  Dano e recursos são restaurados 100% ao final.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPermanentResults(true)}
                className={`rounded-xl p-3 text-left transition border ${
                  permanentResults
                    ? "bg-rose-950/60 border-rose-600 text-rose-200"
                    : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"
                }`}
              >
                <div className="text-xs font-bold text-red-400">Permanente (Honra)</div>
                <div className="text-[10px] opacity-80 mt-0.5">
                  Perda de HP e condições persistem após o duelo.
                </div>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3 text-rose-300/90 text-xs flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
            <span>O oponente receberá um convite em tempo real para aceitar ou recusar.</span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 rounded-xl border border-gray-800 bg-gray-900 px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-gray-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!targetId}
              className="w-1/2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Swords className="h-4 w-4" />
              <span>Enviar Desafio</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
