"use client";

import { useCallback, useEffect, useState } from "react";

export type CatalogPerk = {
  id: string;
  name: string;
  circle: number;
  useType: string;
  description: string | null;
  imageUrl: string | null;
  structuredEffects?: { requirements?: string | null; requirementsEx?: unknown } | null;
};

const CATALOG_URL = "/api/content/spells?ruleSystem=fallout_2d20";

/** Perks oficiais da Biblioteca Global: linhas de `spells` com useType='perk'. */
export function useFalloutPerkCatalog(enabled = true) {
  const [catalog, setCatalog] = useState<CatalogPerk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    (async () => {
      try {
        const response = await fetch(CATALOG_URL, { credentials: "include" });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Falha ao carregar o catálogo");
        }
        const perks = ((payload.data ?? []) as CatalogPerk[]).filter(
          (entry) => entry.useType === "perk",
        );
        if (active) setCatalog(perks);
      } catch {
        if (active) {
          setError("Não foi possível carregar o catálogo de perks da Biblioteca Global.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled, reload]);

  const retry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setReload((count) => count + 1);
  }, []);

  return { catalog, isLoading, error, retry };
}
