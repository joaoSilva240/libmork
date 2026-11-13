"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";
import { CharacterHeroCard } from "@/components/characters/CharacterHeroCard";
import type { PublicOffSessionSheet } from "@/lib/server/character-share-service";

export default function PublicSheetPage() {
  const params = useParams<{ token: string }>();
  const [sheet, setSheet] = useState<PublicOffSessionSheet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public-sheet/${params.token}`)
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok || !data.success) {
          setError(data.error || "Erro ao carregar ficha");
          return;
        }
        setSheet(data.data as PublicOffSessionSheet);
      })
      .catch(() => {
        if (!cancelled) setError("Erro de conexão. Tente novamente.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-dominant-deep">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !sheet) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dominant-deep px-4">
        <div className="w-full max-w-md rounded-lg border border-accent-vibrant/40 bg-accent-dark/30 p-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-secondary-pure">Ficha indisponível</h1>
          <p className="text-secondary-pure">{error}</p>
          <p className="mt-4 text-sm text-secondary-muted">
            O link pode ter sido revogado pelo dono do personagem.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dominant-deep py-8 text-secondary-pure">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-secondary-muted">
            Libmork — Personagem Compartilhado
          </p>
        </div>

        <CharacterHeroCard
          name={sheet.name}
          imageUrl={sheet.imageUrl}
          description={sheet.description}
          level={sheet.level}
          xp={sheet.xp}
          raceName={sheet.raceName}
          className={sheet.className}
        />

        <p className="mt-6 text-center text-sm text-secondary-muted">
          Visualização somente leitura — compartilhada via Libmork
        </p>
      </div>
    </div>
  );
}
