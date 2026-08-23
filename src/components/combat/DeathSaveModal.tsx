"use client";

import React, { useState } from "react";
import { getGameSystem } from "@/lib/engine";

interface DeathSaveModalProps {
  characterName: string;
  level: number;
  vigor: number;
  inteligencia: number;
  onRollDeathSave: (success: boolean, die: number, dc: number, details: string) => void;
  onPhoenixRebirth: (newLevel: number, newHpMax: number, newManaMax: number) => void;
  onPermanentDeath: (shadowPointsGained: number) => void;
  onClose?: () => void;
}

export function DeathSaveModal({
  characterName,
  level,
  vigor,
  inteligencia,
  onRollDeathSave,
  onPhoenixRebirth,
  onPermanentDeath,
  onClose,
}: DeathSaveModalProps) {
  const [successes, setSuccesses] = useState(0);
  const [failures, setFailures] = useState(0);
  const [lastRollDetails, setLastRollDetails] = useState<string | null>(null);
  const [mode, setMode] = useState<"saves" | "phoenix" | "dead">("saves");

  const system = getGameSystem("libmork");
  const vigorMod = system.getModifier(vigor);
  const dc = system.getDeathSaveDifficulty(vigor);

  const handleRoll = () => {
    const die = Math.floor(Math.random() * 20) + 1;
    const res = system.processDeathSaveRoll(successes, failures, die, vigorMod);

    setSuccesses(res.newSuccesses);
    setFailures(res.newFailures);
    setLastRollDetails(res.details);

    onRollDeathSave(res.success, die, dc, res.details);

    if (res.isStabilized) {
      setLastRollDetails("🎉 Você teve 3 sucessos e ESTABILIZOU! O Caído se levantará.");
    } else if (res.isDead) {
      setLastRollDetails("☠️ Você acumulou 3 falhas. Seu personagem pereceu...");
      setMode("dead");
    }
  };

  const handleConfirmPhoenix = () => {
    const rebirth = system.calculatePhoenixRebirth(level, vigor, inteligencia);
    onPhoenixRebirth(rebirth.newLevel, rebirth.newHpMax, rebirth.newManaMax);
  };

  const handleConfirmDeath = () => {
    const shadowPoints = system.calculateShadowPointsGained(level);
    onPermanentDeath(shadowPoints);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-fade-in">
      <div className="flex w-full max-w-md flex-col rounded-3xl border border-rose-900/80 bg-gray-950 p-6 shadow-2xl space-y-6 text-center">
        {/* Header Dramático */}
        <div className="space-y-2">
          <div className="relative inline-block">
            <span className="text-6xl animate-pulse inline-block">💀</span>
            <span className="absolute -top-1 -right-2 text-2xl">🔥</span>
          </div>
          <h2 className="text-2xl font-black text-rose-500 tracking-wide uppercase">
            VOCÊ ESTÁ CAÍDO (0 HP)
          </h2>
          <p className="text-xs text-rose-300/80">
            <strong className="text-white">{characterName}</strong> precisa passar em 3 testes de salvaguarda de morte ou renascer das cinzas!
          </p>
        </div>

        {/* Indicadores de Sucessos / Falhas */}
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-rose-950 bg-rose-950/20 p-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-emerald-400 uppercase">Sucessos ({successes}/3)</span>
            <div className="flex justify-center gap-2">
              {[1, 2, 3].map((num) => (
                <span
                  key={num}
                  className={`h-4 w-4 rounded-full border border-emerald-500 ${
                    num <= successes ? "bg-emerald-500 shadow-md shadow-emerald-500/50" : "bg-gray-900"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-bold text-rose-400 uppercase">Falhas ({failures}/3)</span>
            <div className="flex justify-center gap-2">
              {[1, 2, 3].map((num) => (
                <span
                  key={num}
                  className={`h-4 w-4 rounded-full border border-rose-500 ${
                    num <= failures ? "bg-rose-500 shadow-md shadow-rose-500/50" : "bg-gray-900"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {lastRollDetails && (
          <div className="rounded-xl border border-rose-900/50 bg-gray-900/80 p-3 text-xs text-rose-200">
            {lastRollDetails}
          </div>
        )}

        {/* Modos e Ações */}
        {mode === "saves" && (
          <div className="space-y-3">
            <button
              onClick={handleRoll}
              disabled={successes >= 3 || failures >= 3}
              className="w-full rounded-2xl bg-gradient-to-r from-rose-600 to-purple-600 py-3.5 text-sm font-black text-white shadow-xl hover:from-rose-500 hover:to-purple-500 disabled:opacity-50"
            >
              🎲 Rolar Teste de Morte (1d20 vs CD {dc})
            </button>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setMode("phoenix")}
                className="rounded-xl border border-amber-600/60 bg-amber-950/40 p-2.5 text-xs font-bold text-amber-300 hover:bg-amber-900/50"
              >
                🔥 Segurar a Caveira (Fênix)
              </button>
              <button
                onClick={() => setMode("dead")}
                className="rounded-xl border border-gray-700 bg-gray-900 p-2.5 text-xs font-bold text-gray-300 hover:bg-gray-800"
              >
                💀 Aceitar a Morte Definitiva
              </button>
            </div>
          </div>
        )}

        {mode === "phoenix" && (
          <div className="space-y-4 rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4 text-left text-xs">
            <h3 className="font-bold text-amber-300 text-sm">🔥 Renascimento Fênix (RF-043)</h3>
            <p className="text-amber-200/80">
              Seu personagem renascerá imediatamente com a metade dos seus níveis (nível {Math.max(1, Math.floor(level / 2))}) e 50% dos pontos de vida/mana. A ficha, imagem e NFC serão mantidos, mas o Mestre aplicará sequelhas permanentes.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setMode("saves")}
                className="flex-1 rounded-xl border border-gray-700 bg-gray-900 py-2 font-bold text-gray-300 hover:bg-gray-800"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmPhoenix}
                className="flex-1 rounded-xl bg-amber-600 py-2 font-bold text-white shadow-lg hover:bg-amber-500"
              >
                Confirmar Fênix
              </button>
            </div>
          </div>
        )}

        {mode === "dead" && (
          <div className="space-y-4 rounded-2xl border border-rose-500/40 bg-rose-950/20 p-4 text-left text-xs">
            <h3 className="font-bold text-rose-300 text-sm">💀 Morte Definitiva & Pontos de Sombra (RF-044)</h3>
            <p className="text-rose-200/80">
              O personagem será inativado definitivamente. Sua conta receberá{" "}
              <strong className="text-amber-300 font-bold">{Math.floor(level / 2)} Pontos de Sombra</strong> para utilizar em novas campanhas ativando o caos narrativo e bônus de atributos!
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setMode("saves")}
                className="flex-1 rounded-xl border border-gray-700 bg-gray-900 py-2 font-bold text-gray-300 hover:bg-gray-800"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmDeath}
                className="flex-1 rounded-xl bg-rose-600 py-2 font-bold text-white shadow-lg hover:bg-rose-500"
              >
                Confirmar Morte
              </button>
            </div>
          </div>
        )}

        {onClose && (
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300">
            Minimizar / Fechar Overlay
          </button>
        )}
      </div>
    </div>
  );
}
