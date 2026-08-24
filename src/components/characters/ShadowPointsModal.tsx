// =============================================================================
// Libmork — Modal de Gasto de Pontos de Sombra (RF-045, RF-055, D-26)
// =============================================================================

"use client";

import React, { useState } from "react";
import { Skull, ShieldAlert, Sparkles } from "lucide-react";
import type { Attribute } from "@/lib/utils/constants";

type ShadowPointsModalProps = {
  characterId: string;
  campaignId: string;
  userShadowPoints: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (addedBonus: { bonus_type: string; target: string; bonus_value: number }) => void;
};

const ATTRIBUTE_OPTIONS: { value: Attribute; label: string }[] = [
  { value: "forca", label: "Força" },
  { value: "destreza", label: "Destreza" },
  { value: "vigor", label: "Vigor" },
  { value: "inteligencia", label: "Inteligência" },
  { value: "empatia", label: "Empatia" },
];

export function ShadowPointsModal({
  characterId,
  campaignId,
  userShadowPoints,
  isOpen,
  onClose,
  onSuccess,
}: ShadowPointsModalProps) {
  const [bonusType, setBonusType] = useState<"attribute" | "skill" | "spell">("attribute");
  const [targetAttribute, setTargetAttribute] = useState<Attribute>("forca");
  const [targetCustom, setTargetCustom] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const target = bonusType === "attribute" ? targetAttribute : targetCustom;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target.trim()) {
      setErrorMsg("Selecione ou digite um alvo válido para o bônus.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/spend-shadow-points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          pointsToSpend: 1,
          bonusType,
          target: target.trim(),
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao gastar Pontos de Sombra.");
      }

      onSuccess(data.data.addedBonus);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-purple-900/60 bg-gray-950 p-6 text-gray-100 shadow-2xl space-y-5">
        <div className="flex items-center gap-3 border-b border-purple-900/40 pb-4">
          <div className="rounded-xl bg-purple-950/80 p-3 text-purple-400 border border-purple-800/40">
            <Skull className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-purple-200">Pontos de Sombra</h3>
            <p className="text-xs text-purple-400/80">Meta-moeda de Caos & Poder (D-26)</p>
          </div>
        </div>

        <div className="rounded-xl border border-purple-900/40 bg-purple-950/30 p-3.5 text-xs text-purple-300 space-y-1">
          <div className="flex justify-between font-semibold">
            <span>Seus Pontos de Sombra Disponíveis:</span>
            <span className="text-purple-200 font-bold text-sm">{userShadowPoints}</span>
          </div>
          <p className="text-purple-400/90 text-[11px] leading-relaxed">
            Gastar 1 Ponto concede <strong className="text-amber-300">+2 em um teste</strong> por 3 campanhas, mas aumenta a <strong className="text-red-400">Dificuldade Global dos Inimigos (+1)</strong> na campanha atual!
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-800 bg-red-950/50 p-3 text-xs font-semibold text-red-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Tipo de Bônus (+2)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBonusType("attribute")}
                className={`rounded-xl px-3 py-2 text-xs font-bold transition border ${
                  bonusType === "attribute"
                    ? "bg-purple-600 text-white border-purple-400 shadow-md"
                    : "bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700"
                }`}
              >
                Atributo
              </button>
              <button
                type="button"
                onClick={() => setBonusType("skill")}
                className={`rounded-xl px-3 py-2 text-xs font-bold transition border ${
                  bonusType === "skill"
                    ? "bg-purple-600 text-white border-purple-400 shadow-md"
                    : "bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700"
                }`}
              >
                Perícia
              </button>
              <button
                type="button"
                onClick={() => setBonusType("spell")}
                className={`rounded-xl px-3 py-2 text-xs font-bold transition border ${
                  bonusType === "spell"
                    ? "bg-purple-600 text-white border-purple-400 shadow-md"
                    : "bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700"
                }`}
              >
                Magia
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Alvo do Bônus (+2)
            </label>
            {bonusType === "attribute" ? (
              <select
                value={targetAttribute}
                onChange={(e) => setTargetAttribute(e.target.value as Attribute)}
                className="w-full rounded-xl border border-gray-800 bg-gray-900 p-2.5 text-xs text-gray-100 focus:border-purple-500 focus:outline-none"
              >
                {ATTRIBUTE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} (+2)
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder={bonusType === "skill" ? "Ex: Atletismo, Percepção..." : "Ex: Bola de Fogo, Cura..."}
                value={targetCustom}
                onChange={(e) => setTargetCustom(e.target.value)}
                className="w-full rounded-xl border border-gray-800 bg-gray-900 p-2.5 text-xs text-gray-100 placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />
            )}
          </div>

          <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-3 text-amber-300/90 text-xs flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
            <span>Este efeito expira automaticamente após 3 campanhas jogadas.</span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-1/2 rounded-xl border border-gray-800 bg-gray-900 px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-gray-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || userShadowPoints < 1}
              className="w-1/2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <span>Invocando...</span>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Gastar 1 Ponto</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
