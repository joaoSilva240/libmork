"use client";

import { useCallback, useEffect, useState } from "react";
import type { CatalogItem } from "@/lib/systems/fallout/itemCatalog";

const CATALOG_URL = "/api/content/items?ruleSystem=fallout_2d20";

/** Itens de equipamento oficiais da Biblioteca Global (regra Fallout 2d20). */
export function useFalloutItemCatalog(enabled = true) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
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
        if (active) setCatalog((payload.data ?? []) as CatalogItem[]);
      } catch {
        if (active) {
          setError("Não foi possível carregar o catálogo de itens da Biblioteca Global.");
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
