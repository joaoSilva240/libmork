"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Character } from "@/types";
import { ATTRIBUTES } from "@/lib/utils/constants";
import type { Attribute } from "@/lib/utils/constants";
import { getDerivedStats } from "@/lib/engine/attributes";
import { ShareLink } from "@/components/characters/ShareLink";

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  forca: "Força",
  destreza: "Destreza",
  vigor: "Vigor",
  inteligencia: "Inteligência",
  empatia: "Empatia",
};

export function CharacterDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadCharacter() {
      try {
        const response = await fetch(`/api/characters/${params.id}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Erro ao carregar personagem");
          return;
        }

        setCharacter(data.data);
      } catch {
        setError("Erro de conexão. Tente novamente.");
      } finally {
        setIsLoading(false);
      }
    }

    loadCharacter();
  }, [params.id]);

  const handleDelete = async () => {
    if (!window.confirm("Tem certeza que deseja excluir este personagem?")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/characters/${params.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Erro ao excluir personagem");
        setIsDeleting(false);
        return;
      }

      router.push("/player");
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/30 p-4 text-red-300">
        {error}
      </div>
    );
  }

  if (!character) {
    return null;
  }

  const stats = getDerivedStats(character.attributes, character.level);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/player" className="text-sm text-blue-400 hover:text-blue-300">
          ← Voltar
        </Link>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isDeleting ? "Excluindo..." : "Excluir"}
        </button>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-center gap-4">
          {character.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.imageUrl}
              alt={character.name}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-800 text-3xl font-bold text-gray-400">
              {character.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-white">{character.name}</h2>
            <p className="text-gray-400">
              Nível {character.level} · {character.xp} XP
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-red-900/50 bg-red-900/20 p-3 text-center">
            <p className="text-xs text-red-300">HP</p>
            <p className="text-xl font-bold text-red-400">
              {character.hitPointsCurrent}/{character.hitPointsMax}
            </p>
          </div>
          <div className="rounded-lg border border-blue-900/50 bg-blue-900/20 p-3 text-center">
            <p className="text-xs text-blue-300">Mana</p>
            <p className="text-xl font-bold text-blue-400">
              {character.manaPointsCurrent}/{character.manaPointsMax}
            </p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 text-center">
            <p className="text-xs text-gray-400">Bloqueio</p>
            <p className="text-xl font-bold text-white">{stats.block}</p>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="mb-3 text-lg font-semibold text-white">Atributos</h3>
          <div className="space-y-2">
            {ATTRIBUTES.map((attr) => {
              const mod = stats.modifiers[attr];
              return (
                <div
                  key={attr}
                  className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 px-3 py-2"
                >
                  <span className="text-gray-300">{ATTRIBUTE_LABELS[attr]}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white">
                      {character.attributes[attr]}
                    </span>
                    <span
                      className={`w-8 text-center text-sm font-semibold ${
                        mod >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {mod >= 0 ? "+" : ""}
                      {mod}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm text-gray-400">
          <p>Perícias treinadas disponíveis: {stats.trainedSkillSlots}</p>
        </div>
      </div>

      <ShareLink characterId={character.id} />
    </div>
  );
}
