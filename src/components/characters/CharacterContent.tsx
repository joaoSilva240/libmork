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
};

export function CharacterContent({ characterId }: CharacterContentProps) {
  const [activeType, setActiveType] = useState<ContentType>("skills");
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

  const handleLink = async (contentId: string) => {
    setError(null);
    setIsBusy(true);
    try {
      const response = await fetch(`/api/characters/${characterId}/content/${activeType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Erro ao vincular conteúdo");
        return;
      }

      await loadContent();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsBusy(false);
    }
  };

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

  const linkedIds = new Set(
    data.linked.map((row) => row.content.id as string)
  );
  const availableToAdd = data.available.filter(
    (content) => !linkedIds.has(content.id as string)
  );

  return (
    <div className="mt-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
      <h3 className="mb-3 text-lg font-semibold text-white">Conteúdo da Ficha</h3>

      <div className="mb-4 flex flex-wrap gap-2">
        {TYPE_ORDER.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeType === type
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-700 border-t-blue-600" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-300">
              Na ficha ({data.linked.length})
            </h4>
            {data.linked.length === 0 ? (
              <p className="text-sm text-gray-500">Nada vinculado.</p>
            ) : (
              <div className="space-y-2">
                {data.linked.map((row) => (
                  <div
                    key={row.junction.id}
                    className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 p-3"
                  >
                    <div>
                      <p className="font-semibold text-white">
                        {row.content.name as string}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {activeType === "skills" && (
                          <label className="flex items-center gap-1 text-xs text-gray-400">
                            <input
                              type="checkbox"
                              checked={!!row.junction.trained}
                              onChange={(e) =>
                                handlePatchJunction(row.junction.id, {
                                  trained: e.target.checked,
                                })
                              }
                              className="h-3.5 w-3.5 accent-blue-600"
                            />
                            Treinada
                          </label>
                        )}
                        {activeType === "items" && (
                          <span className="text-xs text-gray-400">
                            Qtd: {row.junction.quantity}
                          </span>
                        )}
                        {activeType === "conditions" && row.junction.permanent && (
                          <span className="rounded bg-red-900/50 px-1.5 py-0.5 text-xs text-red-300">
                            Permanente
                          </span>
                        )}
                        {activeType === "spells" && (
                          <span className="text-xs text-gray-400">
                            Círculo {String(row.content.circle)} · {String(row.content.manaCost)} mana
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlink(row.junction.id)}
                      disabled={isBusy}
                      className="ml-4 shrink-0 text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-300">
              Disponíveis ({availableToAdd.length})
            </h4>
            {availableToAdd.length === 0 ? (
              <p className="text-sm text-gray-500">Nada disponível para adicionar.</p>
            ) : (
              <div className="space-y-2">
                {availableToAdd.map((content) => (
                  <div
                    key={content.id as string}
                    className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 p-3"
                  >
                    <div>
                      <p className="font-semibold text-white">
                        {content.name as string}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {content.campaignId ? "Da campanha" : "Global"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleLink(content.id as string)}
                      disabled={isBusy}
                      className="ml-4 shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Adicionar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
