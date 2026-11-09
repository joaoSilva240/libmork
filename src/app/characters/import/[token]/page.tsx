"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { CharacterHeroCard } from "@/components/characters/CharacterHeroCard";
import type { AcquirePreview } from "@/lib/server/character-share-service";

export default function CharacterImportPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<AcquirePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acquiring, setAcquiring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/characters/import/${params.token}`, { credentials: "include" })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (response.status === 401) {
          setUnauthenticated(true);
          return;
        }
        if (!response.ok || !data.success) {
          setError(data.error || "Erro ao carregar personagem");
          return;
        }
        setPreview(data.data as AcquirePreview);
      })
      .catch(() => {
        if (!cancelled) setError("Erro de conexão. Tente novamente.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  const handleAcquire = useCallback(async () => {
    setError(null);
    setAcquiring(true);
    try {
      const response = await fetch(`/api/characters/import/${params.token}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "Erro ao adquirir personagem");
        return;
      }
      router.push(`/player/characters/${(data.data as { characterId: string }).characterId}`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setAcquiring(false);
    }
  }, [params.token, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-dominant-deep">
        <Spinner size="lg" />
      </div>
    );
  }

  if (unauthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dominant-deep px-4">
        <div className="w-full max-w-md rounded-lg border border-accent-vibrant/40 bg-accent-dark/30 p-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-secondary-pure">Entre para adquirir</h1>
          <p className="text-secondary-pure">
            Você precisa estar autenticado para adquirir uma cópia deste personagem.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover"
          >
            Fazer login
          </Link>
        </div>
      </div>
    );
  }

  if (error && !preview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dominant-deep px-4">
        <div className="w-full max-w-md rounded-lg border border-accent-vibrant/40 bg-accent-dark/30 p-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-secondary-pure">Link indisponível</h1>
          <p className="text-secondary-pure">{error}</p>
        </div>
      </div>
    );
  }

  if (!preview) {
    return null;
  }

  return (
    <div className="min-h-screen bg-dominant-deep py-8 text-secondary-pure">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-secondary-muted">
            Libmork — Personagem compartilhado por {preview.ownerName ?? "um jogador"}
          </p>
        </div>

        <CharacterHeroCard
          name={preview.name}
          imageUrl={preview.imageUrl}
          description={preview.description}
          level={preview.level}
          xp={preview.xp}
          raceName={preview.raceName}
          className={preview.className}
        />

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/80 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {preview.isOwn ? (
          <p className="rounded-lg border border-secondary-border bg-secondary-card p-4 text-center text-sm text-secondary-muted">
            Este personagem já é seu — o link de aquisição não pode ser usado pelo próprio dono.
          </p>
        ) : (
          <>
            <Button
              type="button"
              variant="primary"
              data-testid="acquire-character-button"
              onClick={handleAcquire}
              disabled={acquiring}
              className="w-full justify-center py-3"
            >
              <Sparkles className="h-4 w-4" />
              {acquiring ? "Adquirindo..." : "Adquirir Personagem"}
            </Button>
            <p className="text-center text-xs text-secondary-muted">
              Uma cópia independente será criada na sua conta, com atributos, moedas, itens,
              magias e proficiências. O personagem original não é alterado.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
