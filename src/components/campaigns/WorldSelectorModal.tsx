"use client";

import { useState, useEffect, useCallback } from "react";
import type { World } from "@/types";
import { Button, Spinner } from "@/components/ui";

type WorldSelectorModalProps = {
  campaignId: string;
  campaignWorldIds: Set<string>;
  onClose: () => void;
  onWorldSelected: (worldId: string) => void;
};

export function WorldSelectorModal({
  campaignId,
  campaignWorldIds,
  onClose,
  onWorldSelected,
}: WorldSelectorModalProps) {
  const [allWorlds, setAllWorlds] = useState<World[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadWorlds = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/worlds", { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setAllWorlds(data.data || []);
      } else {
        setError(data.error || "Erro ao carregar mundos");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorlds();
  }, [loadWorlds]);

  const filteredWorlds = allWorlds.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddWorld = async (worldId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/worlds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao adicionar mundo à campanha");
        return;
      }

      onWorldSelected(worldId);
      onClose();
    } catch {
      setError("Erro de conexão");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl border border-purple-800/80 bg-gray-950 shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-purple-900/60 p-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌍</span>
            <div>
              <h2 className="text-lg font-bold text-white">Selecionar Mundo</h2>
              <p className="text-xs text-purple-300">Escolha um mundo da biblioteca para adicionar à campanha</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="border-b border-red-800/50 bg-red-900/20 px-4 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Barra de Pesquisa */}
        <div className="p-4 border-b border-gray-800">
          <input
            type="text"
            placeholder="Pesquisar mundo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        {/* Lista de Mundos */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner size="md" />
            </div>
          ) : filteredWorlds.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-gray-400">
                {searchQuery ? "Nenhum mundo encontrado com este termo." : "Nenhum mundo na biblioteca."}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-2 text-xs text-purple-400 hover:underline"
                >
                  Limpar busca
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredWorlds.map((world) => {
                const isSelected = campaignWorldIds.has(world.id);
                return (
                  <div
                    key={world.id}
                    className={`relative overflow-hidden rounded-xl border p-3 transition-all ${
                      isSelected
                        ? "border-purple-500/50 bg-purple-900/10"
                        : "border-gray-700 bg-gray-900/50 hover:border-purple-500/50 hover:bg-gray-800"
                    }`}
                    style={
                      world.coverUrl
                        ? { backgroundImage: `url(${world.coverUrl})` }
                        : undefined
                    }
                  >
                    {/* Overlay de fundo com gradiente */}
                    <div
                      className={`absolute inset-0 transition-colors ${
                        world.coverUrl
                          ? "bg-gradient-to-br from-dominant-dark/95 via-dominant-dark/80 to-dominant-dark/60"
                          : isSelected
                          ? "bg-purple-900/20"
                          : "bg-gray-950/80"
                      }`}
                    />
                    
                    <div className="relative z-10 flex flex-col gap-2">
                      <div>
                        <h3 className="font-bold text-white text-sm drop-shadow-md">{world.name}</h3>
                        {world.description && (
                          <p className="text-xs text-gray-300/90 line-clamp-2 drop-shadow-sm mt-1">
                            {world.description}
                          </p>
                        )}
                      </div>

                      {world.coverUrl && (
                        <div className="mt-2">
                          <p className="text-[10px] text-gray-400">
                            Imagem de capa configurada
                          </p>
                        </div>
                      )}

                      <div className="pt-2">
                        {isSelected ? (
                          <div className="flex items-center justify-center gap-2 rounded-lg bg-purple-900/60 py-2 text-xs font-semibold text-purple-200">
                            ✅ Adicionado
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleAddWorld(world.id)}
                            variant="master"
                            className="w-full text-xs py-1.5"
                            disabled={isLoading}
                          >
                            + Adicionar à Campanha
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer com contagem */}
        <div className="border-t border-gray-800 bg-gray-900/50 px-4 py-3">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{filteredWorlds.length} mundo(s) encontrado(s)</span>
            <span>{campaignWorldIds.size} mundo(s) na campanha</span>
          </div>
        </div>
      </div>
    </div>
  );
}
