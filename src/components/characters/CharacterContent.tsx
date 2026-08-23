"use client";

import { useCallback, useEffect, useState } from "react";
import type { ContentType } from "@/lib/validators/content";

const TYPE_LABELS: Record<ContentType, string> = {
  skills: "Perícias",
  spells: "Magias",
  items: "Itens",
  conditions: "Condições",
};

const TYPE_ORDER: ContentType[] = ["skills", "spells", "items", "conditions"];

type LinkedRow = {
  junction: {
    id: string;
    trained?: boolean;
    quantity?: number;
    permanent?: boolean;
  };
  content: Record<string, unknown>;
};

type CharacterContentProps = {
  characterId: string;
  defaultType?: ContentType;
  allowedTypes?: ContentType[];
};

export function CharacterContent({ characterId, defaultType = "skills", allowedTypes }: CharacterContentProps) {
  const [activeType, setActiveType] = useState<ContentType>(defaultType);
  const [data, setData] = useState<{ linked: LinkedRow[]; available: Record<string, unknown>[] }>({
    linked: [],
    available: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const loadContent = useCallback(async () => {
    try {
      const response = await fetch(`/api/characters/${characterId}/content/${activeType}`);
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Erro ao carregar conteúdo");
        return;
      }

      setData(result.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [characterId, activeType]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/characters/${characterId}/content/${activeType}`);
        const result = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(result.error || "Erro ao carregar conteúdo");
          return;
        }

        setData(result.data);
      } catch {
        if (!cancelled) {
          setError("Erro de conexão. Tente novamente.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [characterId, activeType]);

  const handleUnlink = async (junctionId: string) => {
    setError(null);
    setIsBusy(true);
    try {
      const response = await fetch(
        `/api/characters/${characterId}/content/${activeType}/${junctionId}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Erro ao desvincular conteúdo");
        return;
      }

      await loadContent();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsBusy(false);
    }
  };

  const handlePatchJunction = async (junctionId: string, payload: Record<string, unknown>) => {
    setError(null);
    try {
      const response = await fetch(
        `/api/characters/${characterId}/content/${activeType}/${junctionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Erro ao atualizar");
        return;
      }

      await loadContent();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const displayTypes = allowedTypes ? TYPE_ORDER.filter((t) => allowedTypes.includes(t)) : TYPE_ORDER;

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
      {displayTypes.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5 border-b border-gray-800 pb-3">
          {displayTypes.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                activeType === type
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-700 border-t-purple-600" />
        </div>
      ) : (
        <div className="w-full">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
            Na ficha ({data.linked.length})
          </h4>
          {data.linked.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-500 italic">
              Nenhum item ou elemento vinculado nesta categoria.
            </p>
          ) : (
            <div className="space-y-2">
              {data.linked.map((row) => (
                <div
                  key={row.junction.id}
                  className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950 p-3 shadow-sm"
                >
                  <div>
                    <p className="text-xs font-bold text-white">
                      {row.content.name as string}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {activeType === "skills" && (
                        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-300">
                          <input
                            type="checkbox"
                            checked={!!row.junction.trained}
                            onChange={(e) =>
                              handlePatchJunction(row.junction.id, {
                                trained: e.target.checked,
                              })
                            }
                            className="h-4 w-4 accent-purple-600"
                          />
                          <span className={row.junction.trained ? "text-purple-400 font-bold" : "text-gray-400"}>
                            {row.junction.trained ? "Treinada" : "Não Treinada"}
                          </span>
                        </label>
                      )}
                      {activeType === "items" && (
                        <span className="text-[11px] text-gray-400 font-medium">
                          Quantidade: {row.junction.quantity || 1}
                        </span>
                      )}
                      {activeType === "conditions" && row.junction.permanent && (
                        <span className="rounded bg-red-950 px-2 py-0.5 text-[10px] font-bold text-red-300 border border-red-800/60">
                          Permanente
                        </span>
                      )}
                      {activeType === "spells" && (
                        <span className="text-[11px] text-purple-300 font-medium">
                          Círculo {String(row.content.circle)} · {String(row.content.manaCost)} Mana
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnlink(row.junction.id)}
                    disabled={isBusy}
                    className="ml-4 shrink-0 text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
