"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Campaign } from "@/types";
import { Spinner } from "@/components/ui";

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
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
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

  if (campaigns.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-gray-400">Você ainda não tem campanhas.</p>
        <Link
          href="/master/campaigns/new"
          className="inline-block rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700"
        >
          Criar Campanha
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Minhas Campanhas</h2>
        <Link
          href="/master/campaigns/new"
          className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white hover:bg-purple-700"
        >
          + Nova
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((campaign) => (
          <Link
            key={campaign.id}
            href={`/master/campaigns/${campaign.id}`}
            className="block rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-purple-600"
          >
            <h3 className="text-lg font-semibold text-white">{campaign.name}</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
              <span className="rounded bg-gray-800 px-2 py-1">
                {campaign.rulesEngine === "d20_mod" ? "d20 + mod" : "2d20 somado"}
              </span>
              {campaign.pvpEnabled && (
                <span className="rounded bg-red-900/50 px-2 py-1 text-red-300">PvP</span>
              )}
              {campaign.difficultyModifierShadowPoints > 0 && (
                <span className="rounded bg-purple-900/50 px-2 py-1 text-purple-300">
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
