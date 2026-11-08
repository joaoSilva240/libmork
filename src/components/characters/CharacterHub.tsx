"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Pencil, ScrollText, Swords, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui";
import { CharacterHeroCard } from "./CharacterHeroCard";
import { ShareLink } from "./ShareLink";
import type { CharacterHub as CharacterHubData } from "@/lib/server/character-share-service";

/**
 * Hub off-session do personagem (Issue #79): imersão e narrativa antes da
 * ficha operacional. Rota primária de /player/characters/[id].
 */
export function CharacterHub() {
  const params = useParams<{ id: string }>();
  const [hub, setHub] = useState<CharacterHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/characters/${params.id}/hub`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setHub(data.data as CharacterHubData);
        } else {
          setError(data.error ?? "Erro ao carregar personagem");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Erro ao carregar personagem");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleSaveBio = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/characters/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description: bioDraft }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHub((prev) => (prev ? { ...prev, description: bioDraft } : prev));
        setEditingBio(false);
      } else {
        setError(data.error ?? "Erro ao salvar biografia");
      }
    } catch {
      setError("Erro ao salvar biografia");
    } finally {
      setSaving(false);
    }
  }, [params.id, bioDraft]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !hub) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-accent-vibrant/40 bg-accent-dark/30 p-6 text-center">
        <p className="text-secondary-pure">{error ?? "Personagem não encontrado"}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-8">
      <CharacterHeroCard
        name={hub.name}
        imageUrl={hub.imageUrl}
        description={hub.description}
        level={hub.level}
        xp={hub.xp}
        xpToNextLevel={hub.xpToNextLevel}
        raceName={hub.raceName}
        className={hub.className}
      />

      {hub.activeSession && (
        <Link
          href={`/player?tab=campaigns&campaign=${hub.activeSession.campaignId}`}
          data-testid="session-active-link"
          className="flex items-center justify-center gap-2 rounded-lg border border-accent/50 bg-accent/15 px-4 py-3 text-sm font-bold text-accent transition-colors hover:bg-accent/25"
        >
          <Swords className="h-4 w-4 animate-pulse" />
          Sessão Ativa — Entrar em {hub.activeSession.campaignName}
        </Link>
      )}

      {hub.isOwner && editingBio && (
        <div className="flex flex-col gap-2 rounded-lg border border-secondary-border bg-secondary-card p-4">
          <textarea
            data-testid="bio-textarea"
            rows={5}
            maxLength={2000}
            value={bioDraft}
            onChange={(e) => setBioDraft(e.target.value)}
            placeholder="Conte a história do seu personagem..."
            className="rounded-lg border border-secondary-border bg-secondary-input px-3 py-2 text-sm text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingBio(false)}
              disabled={saving}
            >
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              data-testid="save-bio-button"
              onClick={handleSaveBio}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar biografia"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Link href={`/player/characters/${hub.id}/sheet`} data-testid="ver-ficha-link">
          <Button type="button" variant="primary" className="w-full justify-center py-3">
            <ScrollText className="h-4 w-4" />
            Ver Ficha
          </Button>
        </Link>

        {hub.isOwner && (
          <div className="flex flex-col gap-3">
            {!editingBio && (
              <Button
                type="button"
                variant="secondary"
                data-testid="edit-bio-button"
                onClick={() => {
                  setBioDraft(hub.description ?? "");
                  setEditingBio(true);
                }}
                className="w-full justify-center"
              >
                <Pencil className="h-4 w-4" />
                Editar biografia
              </Button>
            )}
            <ShareLink characterId={hub.id} />
          </div>
        )}
      </div>
    </div>
  );
}
