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
            className="block rounded-lg border border-secondary-border bg-secondary-card p-4 transition-all hover:border-accent hover:shadow-[0_0_15px_rgba(147,51,234,0.2)]"
          >
            <h3 className="text-lg font-semibold text-secondary-pure">{campaign.name}</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-secondary-muted">
              <span className="rounded bg-dominant-dark border border-dominant-border px-2 py-1">
                {campaign.rulesEngine === "d20_mod" ? "d20 + mod" : "2d20 somado"}
              </span>
              {campaign.pvpEnabled && (
                <span className="rounded bg-accent-dark/60 border border-accent-vibrant/30 px-2 py-1 text-secondary-pure">PvP</span>
              )}
              {campaign.difficultyModifierShadowPoints > 0 && (
                <span className="rounded bg-accent/20 border border-accent/40 px-2 py-1 text-accent-hover">
                  Sombra +{campaign.difficultyModifierShadowPoints}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
