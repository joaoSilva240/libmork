"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Campaign } from "@/types";
import { Spinner, Button } from "@/components/ui";

export function CampaignList() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCampaigns() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch("/api/campaigns", {
          credentials: "include",
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));

          if (response.status === 401) {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
            window.location.href = '/login';
            return;
          }

          setError(data.error || "Erro ao carregar campanhas");
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setCampaigns(data.data);
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          setError("Tempo esgotado. Verifique sua conexão.");
        } else {
          setError("Erro de conexão. Tente novamente.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadCampaigns();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 min-h-[300px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-accent-vibrant/40 bg-accent-dark/30 p-4 text-secondary-pure">
        {error}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-secondary-muted">Você ainda não tem campanhas.</p>
        <Link href="/master/campaigns/new">
          <Button variant="master" className="px-6 py-3">
            Criar Campanha
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-secondary-pure">Minhas Campanhas</h2>
        <Link href="/master/campaigns/new">
          <Button variant="master">
            + Nova
          </Button>
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((campaign) => (
          <Link
            key={campaign.id}
            href={`/master/campaigns/${campaign.id}`}
            className="group relative overflow-hidden block rounded-xl border border-secondary-border bg-secondary-card p-5 transition-all hover:border-accent hover:shadow-[0_0_20px_rgba(147,51,234,0.25)]"
            style={
              campaign.coverImageUrl
                ? {
                    backgroundImage: `url(${campaign.coverImageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            {campaign.coverImageUrl && (
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/85 to-gray-950/65 group-hover:via-gray-950/75 transition-colors pointer-events-none" />
            )}

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-bold text-secondary-pure drop-shadow-md group-hover:text-purple-200 transition-colors">
                  {campaign.name}
                </h3>
                {campaign.worldMapUrl && (
                  <span className="shrink-0 rounded-full bg-emerald-950/90 border border-emerald-700/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 drop-shadow">
                    🗺️ Mapa
                  </span>
                )}
              </div>

              {campaign.description && (
                <p className="mt-1 text-xs text-gray-300 line-clamp-2 drop-shadow-sm">
                  {campaign.description}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-secondary-muted">
                <span className="inline-flex items-center gap-1 rounded bg-dominant-dark/90 border border-dominant-border px-2 py-1 text-white text-[11px] drop-shadow-sm">
                  {campaign.rulesEngine === "d20_mod" ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src="/DD-Logo.png"
                      alt="D&D"
                      className="h-4 w-auto object-contain inline-block"
                    />
                  ) : (
                    "2d20 somado"
                  )}
                </span>
                {campaign.pvpEnabled && (
                  <span className="rounded bg-accent-dark/80 border border-accent-vibrant/40 px-2 py-1 text-secondary-pure text-[11px] drop-shadow-sm">
                    PvP
                  </span>
                )}
                {campaign.difficultyModifierShadowPoints > 0 && (
                  <span className="rounded bg-accent/20 border border-accent/40 px-2 py-1 text-accent-hover text-[11px] drop-shadow-sm">
                    Sombra +{campaign.difficultyModifierShadowPoints}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
