"use client";

import { useEffect, useState } from "react";
import type { Character, Skill, Spell } from "@/types";
import { Spinner } from "@/components/ui";

type CombatSheetProps = {
  characterId: string;
  onClose?: () => void;
};

type CombatData = {
  character: Character;
  skills: Skill[];
  spells: Spell[];
};

export function CombatSheet({ characterId, onClose }: CombatSheetProps) {
  const [data, setData] = useState<CombatData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"attacks" | "skills" | "spells">("attacks");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/characters/${characterId}`, {
          credentials: "include"
        });
        const result = await response.json();

        if (!response.ok) {
          setError(result.error || "Erro ao carregar ficha em combate");
          return;
        }

        setData(result.data);
      } catch {
        setError("Erro de conexão");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [characterId]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner size="md" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/30 p-3 text-xs text-red-300">
        {error || "Dados não encontrados"}
      </div>
    );
  }

  const { character, skills, spells } = data;
  const hpPercent = Math.min(100, Math.max(0, (character.hitPointsCurrent / Math.max(character.hitPointsMax, 1)) * 100));
  const manaPercent = Math.min(100, Math.max(0, (character.manaPointsCurrent / Math.max(character.manaPointsMax, 1)) * 100));

  return (
    <div className="rounded-xl border border-red-900/50 bg-gray-950 p-4 shadow-2xl text-white">
      {/* Header com foto, nome e status de vida/mana */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center gap-3">
          {character.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.imageUrl}
              alt={character.name}
              className="h-12 w-12 rounded-full border-2 border-red-600 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-950 font-bold text-red-400 border border-red-700">
              {character.name.charAt(0)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base">{character.name}</h3>
              <span className="rounded bg-red-950 px-2 py-0.5 text-[10px] font-bold text-red-300 border border-red-800">
                MODO DE COMBATE
              </span>
            </div>
            <p className="text-xs text-gray-400">Nível {character.level}</p>
          </div>
        </div>

        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">
            ✕
          </button>
        )}
      </div>

      {/* Barras de HP e Mana resumidas e grandes para combate */}
      <div className="my-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-red-900/60 bg-red-950/20 p-2">
          <div className="flex justify-between text-xs font-semibold text-red-400 mb-1">
            <span>VIDA (HP)</span>
            <span>{character.hitPointsCurrent} / {character.hitPointsMax}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-900">
            <div className="h-full bg-red-600 transition-all" style={{ width: `${hpPercent}%` }} />
          </div>
        </div>

        <div className="rounded-lg border border-blue-900/60 bg-blue-950/20 p-2">
          <div className="flex justify-between text-xs font-semibold text-blue-400 mb-1">
            <span>MANA (MP)</span>
            <span>{character.manaPointsCurrent} / {character.manaPointsMax}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-900">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${manaPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Navegação entre Ataques, Habilidades e Magias */}
      <div className="flex gap-2 border-b border-gray-800 pb-2 mb-3">
        <button
          onClick={() => setActiveTab("attacks")}
          className={`rounded-lg px-3 py-1 text-xs font-semibold ${
            activeTab === "attacks"
              ? "bg-red-600 text-white"
              : "bg-gray-900 text-gray-400 hover:bg-gray-800"
          }`}
        >
          ⚔️ Ataques / Ações
        </button>
        <button
          onClick={() => setActiveTab("skills")}
          className={`rounded-lg px-3 py-1 text-xs font-semibold ${
            activeTab === "skills"
              ? "bg-red-600 text-white"
              : "bg-gray-900 text-gray-400 hover:bg-gray-800"
          }`}
        >
          📜 Habilidades ({skills.length})
        </button>
        <button
          onClick={() => setActiveTab("spells")}
          className={`rounded-lg px-3 py-1 text-xs font-semibold ${
            activeTab === "spells"
              ? "bg-red-600 text-white"
              : "bg-gray-900 text-gray-400 hover:bg-gray-800"
          }`}
        >
          ✨ Magias ({spells.length})
        </button>
      </div>

      {/* Conteúdo da Aba */}
      <div className="max-h-48 overflow-y-auto space-y-2 text-xs">
        {activeTab === "attacks" && (
          <div className="space-y-2">
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-2 flex justify-between items-center">
              <div>
                <p className="font-bold text-white">Ataque Básico / Cuerpo a Cuerpo</p>
                <p className="text-gray-400 text-[10px]">1d20 + Força</p>
              </div>
              <span className="rounded bg-red-900/60 px-2 py-1 font-bold text-red-300">
                1d20 + {character.attributes.forca}
              </span>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-2 flex justify-between items-center">
              <div>
                <p className="font-bold text-white">Ataque à Distância</p>
                <p className="text-gray-400 text-[10px]">1d20 + Destreza</p>
              </div>
              <span className="rounded bg-red-900/60 px-2 py-1 font-bold text-red-300">
                1d20 + {character.attributes.destreza}
              </span>
            </div>
          </div>
        )}

        {activeTab === "skills" && (
          skills.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhuma habilidade treinada</p>
          ) : (
            skills.map((s) => (
              <div key={s.id} className="rounded-lg border border-gray-800 bg-gray-900 p-2 flex justify-between items-center">
                <div>
                  <p className="font-bold text-white">{s.name}</p>
                  <p className="text-gray-400 text-[10px]">{s.keyAttribute}</p>
                </div>
                <span className="rounded bg-gray-800 px-2 py-1 text-gray-300">
                  {s.rollExpression || "1d20"}
                </span>
              </div>
            ))
          )
        )}

        {activeTab === "spells" && (
          spells.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhuma magia aprendida</p>
          ) : (
            spells.map((sp) => (
              <div key={sp.id} className="rounded-lg border border-gray-800 bg-gray-900 p-2 flex justify-between items-center">
                <div>
                  <p className="font-bold text-white">{sp.name}</p>
                  <p className="text-gray-400 text-[10px]">Custo: {sp.manaCost} Mana · Círculo {sp.circle}</p>
                </div>
                <span className="rounded bg-blue-900/60 px-2 py-1 font-semibold text-blue-300">
                  {sp.manaCost} MP
                </span>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
