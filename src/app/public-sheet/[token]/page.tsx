"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ATTRIBUTES } from "@/lib/utils/constants";
import type { Attribute } from "@/lib/utils/constants";
import type { AttributeMap } from "@/lib/engine/attributes";
import { getDerivedStats } from "@/lib/engine/attributes";
import { Spinner } from "@/components/ui/Spinner";

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  forca: "Força",
  destreza: "Destreza",
  vigor: "Vigor",
  inteligencia: "Inteligência",
  empatia: "Empatia",
};

const ATTRIBUTE_DINGS_LETTERS: Record<Attribute, string> = {
  forca: "F",
  destreza: "R",
  vigor: "J",
  inteligencia: "P",
  empatia: "K",
};

type PublicCharacter = {
  id: string;
  name: string;
  imageUrl: string | null;
  hitPointsMax: number;
  hitPointsCurrent: number;
  manaPointsMax: number;
  manaPointsCurrent: number;
  attributes: AttributeMap;
  level: number;
  xp: number;
  block: number;
  deathStatus: string;
};

export default function PublicSheetPage() {
  const params = useParams<{ token: string }>();
  const [character, setCharacter] = useState<PublicCharacter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCharacter() {
      try {
        const response = await fetch(`/api/public-sheet/${params.token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Erro ao carregar ficha");
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
  }, [params.token]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full min-h-screen bg-dominant-deep">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dominant-deep px-4">
        <div className="max-w-md w-full rounded-lg border border-accent-vibrant/40 bg-accent-dark/30 p-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-secondary-pure">Ficha indisponível</h1>
          <p className="text-secondary-pure">{error}</p>
          <p className="mt-4 text-sm text-secondary-muted">
            O link pode ter sido revogado pelo dono do personagem.
          </p>
        </div>
      </div>
    );
  }

  if (!character) {
    return null;
  }

  const stats = getDerivedStats(character.attributes, character.level);

  return (
    <div className="min-h-screen bg-dominant-deep py-8 text-secondary-pure">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-6 text-center">
          <p className="text-sm uppercase tracking-wider text-secondary-muted font-medium">
            Libmork — Ficha Pública
          </p>
        </div>

        <div className="rounded-lg border border-secondary-border bg-secondary-card p-6 shadow-xl">
          <div className="flex items-center gap-4">
            {character.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={character.imageUrl}
                alt={character.name}
                className="h-20 w-20 rounded-full object-cover border border-secondary-border"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-dominant-dark border border-secondary-border text-3xl font-bold text-accent-vibrant">
                {character.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-secondary-pure">{character.name}</h1>
              <p className="text-secondary-muted">
                Nível {character.level} · {character.xp} XP
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-accent-vibrant/40 bg-accent-dark/30 p-3 text-center">
              <p className="text-xs text-secondary-muted">HP</p>
              <p className="text-xl font-bold text-accent-vibrant">
                {character.hitPointsCurrent}/{character.hitPointsMax}
              </p>
            </div>
            <div className="rounded-lg border border-secondary-border bg-dominant-dark p-3 text-center">
              <p className="text-xs text-secondary-muted">Mana</p>
              <p className="text-xl font-bold text-accent-hover">
                {character.manaPointsCurrent}/{character.manaPointsMax}
              </p>
            </div>
            <div className="rounded-lg border border-secondary-border bg-dominant-dark p-3 text-center">
              <p className="text-xs text-secondary-muted">Bloqueio</p>
              <p className="text-xl font-bold text-secondary-pure">{stats.block}</p>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-lg font-semibold text-secondary-pure">Atributos</h2>
            <div className="space-y-2">
              {ATTRIBUTES.map((attr) => {
                const mod = stats.modifiers[attr];
                return (
                  <div
                    key={attr}
                    className="flex items-center justify-between rounded-lg border border-secondary-border bg-dominant-dark px-3 py-2"
                  >
                    <span className="text-secondary-muted">{ATTRIBUTE_LABELS[attr]}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-secondary-pure">
                        {character.attributes[attr]}
                      </span>
                      <span
                        className={`w-8 text-center text-sm font-semibold ${
                          mod >= 0 ? "text-accent-vibrant" : "text-secondary-muted"
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

          <div className="mt-6 rounded-lg border border-secondary-border bg-dominant-dark p-3 text-sm text-secondary-muted">
            <p>Perícias treinadas disponíveis: {stats.trainedSkillSlots}</p>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-secondary-muted">
          Ficha somente leitura — compartilhada via Libmork
        </p>
      </div>
    </div>
  );
}
