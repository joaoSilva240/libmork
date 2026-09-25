"use client";

import { useEffect, useState } from "react";
import type { Npc, World } from "@/types";
import { Spinner } from "@/components/ui/Spinner";

type InitialContentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedNpcIds: string[];
  onToggleNpc: (npcId: string) => void;
  onSelectMultipleNpcs?: (npcIds: string[]) => void;
  // Suporte opcional/retrocompatível para worlds
  selectedWorldIds?: string[];
  onToggleWorld?: (worldId: string) => void;
  onSelectMultipleWorlds?: (worldIds: string[]) => void;
  initialTab?: "npcs" | "worlds";
};

export function InitialContentModal({
  isOpen,
  onClose,
  selectedNpcIds,
  onToggleNpc,
  onSelectMultipleNpcs,
  selectedWorldIds = [],
  onToggleWorld,
  onSelectMultipleWorlds,
  initialTab = "npcs",
}: InitialContentModalProps) {
  const [activeTab, setActiveTab] = useState<"npcs" | "worlds">(initialTab);

  // Estados de NPCs
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [isLoadingNpcs, setIsLoadingNpcs] = useState(false);
  const [npcError, setNpcError] = useState<string | null>(null);
  const [npcSearchTerm, setNpcSearchTerm] = useState("");
  const [npcFilterType, setNpcFilterType] = useState<"all" | "common" | "enemy">("all");

  // Estados de Mundos
  const [worlds, setWorlds] = useState<World[]>([]);
  const [isLoadingWorlds, setIsLoadingWorlds] = useState(false);
  const [worldError, setWorldError] = useState<string | null>(null);
  const [worldSearchTerm, setWorldSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Carregar NPCs
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingNpcs(true);
    setNpcError(null);

    fetch("/api/npcs", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Erro ao carregar NPCs da biblioteca");
        }
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setNpcs(data.data || []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setNpcError(err.message || "Erro de conexão ao buscar NPCs");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingNpcs(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Carregar Mundos
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingWorlds(true);
    setWorldError(null);

    fetch("/api/worlds", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Erro ao carregar mundos da biblioteca");
        }
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setWorlds(data.data || []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setWorldError(err.message || "Erro de conexão ao buscar mundos");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingWorlds(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Filtragem de NPCs
  const filteredNpcs = npcs.filter((npc) => {
    const matchesSearch = npc.name.toLowerCase().includes(npcSearchTerm.toLowerCase());
    const matchesType = npcFilterType === "all" ? true : npc.npcType === npcFilterType;
    return matchesSearch && matchesType;
  });

  const handleSelectAllFilteredNpcs = () => {
    if (!onSelectMultipleNpcs) return;
    const combined = Array.from(new Set([...selectedNpcIds, ...filteredNpcs.map((n) => n.id)]));
    onSelectMultipleNpcs(combined);
  };

  const handleDeselectAllFilteredNpcs = () => {
    if (!onSelectMultipleNpcs) return;
    const filteredIdsSet = new Set(filteredNpcs.map((n) => n.id));
    const remaining = selectedNpcIds.filter((id) => !filteredIdsSet.has(id));
    onSelectMultipleNpcs(remaining);
  };

  // Filtragem de Mundos
  const filteredWorlds = worlds.filter((w) =>
    w.name.toLowerCase().includes(worldSearchTerm.toLowerCase())
  );

  const handleSelectAllFilteredWorlds = () => {
    if (!onSelectMultipleWorlds) return;
    const combined = Array.from(new Set([...selectedWorldIds, ...filteredWorlds.map((w) => w.id)]));
    onSelectMultipleWorlds(combined);
  };

  const handleDeselectAllFilteredWorlds = () => {
    if (!onSelectMultipleWorlds) return;
    const filteredIdsSet = new Set(filteredWorlds.map((w) => w.id));
    const remaining = selectedWorldIds.filter((id) => !filteredIdsSet.has(id));
    onSelectMultipleWorlds(remaining);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl flex flex-col max-h-[85vh] rounded-2xl border border-purple-800/60 bg-gray-950 p-6 shadow-2xl text-gray-100 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-purple-400">📦</span> Conteúdo Inicial da Campanha
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Selecione NPCs e Mundos da biblioteca central para já vincular à nova campanha.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition p-1 text-sm rounded-lg hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-gray-800 shrink-0 gap-2 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab("npcs")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === "npcs"
                ? "border-purple-500 text-purple-400 bg-purple-950/20 rounded-t-lg"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <span>👥</span> Biblioteca de NPCs
            {selectedNpcIds.length > 0 && (
              <span className="rounded-full bg-purple-900/80 px-1.5 py-0.2 text-[10px] text-purple-200">
                {selectedNpcIds.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("worlds")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === "worlds"
                ? "border-purple-500 text-purple-400 bg-purple-950/20 rounded-t-lg"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <span>🌍</span> Mundos da Biblioteca
            {selectedWorldIds.length > 0 && (
              <span className="rounded-full bg-purple-900/80 px-1.5 py-0.2 text-[10px] text-purple-200">
                {selectedWorldIds.length}
              </span>
            )}
          </button>
        </div>

        {/* Conteúdo da Aba NPCs */}
        {activeTab === "npcs" && (
          <>
            {/* Filtros e Busca */}
            <div className="py-3 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between border-b border-gray-800/80 shrink-0">
              <input
                type="text"
                placeholder="Buscar por nome do NPC..."
                value={npcSearchTerm}
                onChange={(e) => setNpcSearchTerm(e.target.value)}
                className="w-full sm:w-64 rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />

              <div className="flex items-center gap-2">
                <select
                  value={npcFilterType}
                  onChange={(e) => setNpcFilterType(e.target.value as "all" | "common" | "enemy")}
                  className="rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="all">Todos os Tipos</option>
                  <option value="common">Comuns (Aliados/Neutros)</option>
                  <option value="enemy">Inimigos</option>
                </select>

                {onSelectMultipleNpcs && (
                  <>
                    <button
                      type="button"
                      onClick={handleSelectAllFilteredNpcs}
                      className="rounded-lg bg-gray-900 border border-gray-700/60 px-2.5 py-1.5 text-[11px] text-gray-300 hover:text-white hover:bg-gray-800 transition"
                    >
                      Selecionar Visíveis
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllFilteredNpcs}
                      className="rounded-lg bg-gray-900 border border-gray-700/60 px-2.5 py-1.5 text-[11px] text-gray-400 hover:text-red-300 hover:bg-gray-800 transition"
                    >
                      Limpar
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Lista de NPCs */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1 min-h-[220px]">
              {isLoadingNpcs ? (
                <div className="flex h-48 items-center justify-center">
                  <Spinner size="md" />
                </div>
              ) : npcError ? (
                <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-center text-xs text-red-300">
                  {npcError}
                </div>
              ) : filteredNpcs.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500">
                  Nenhum NPC encontrado na biblioteca com os filtros informados.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {filteredNpcs.map((npc) => {
                    const isSelected = selectedNpcIds.includes(npc.id);
                    return (
                      <div
                        key={npc.id}
                        onClick={() => onToggleNpc(npc.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition select-none ${
                          isSelected
                            ? "border-purple-500 bg-purple-950/60 text-white shadow-sm ring-1 ring-purple-500/50"
                            : "border-gray-800/80 bg-gray-900/60 text-gray-300 hover:border-gray-700 hover:bg-gray-900"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                            {npc.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={npc.imageUrl}
                                alt={npc.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              npc.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{npc.name}</div>
                            <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                              <span
                                className={`px-1 rounded text-[9px] ${
                                  npc.npcType === "enemy"
                                    ? "bg-red-950/80 text-red-300 border border-red-900/50"
                                    : "bg-blue-950/80 text-blue-300 border border-blue-900/50"
                                }`}
                              >
                                {npc.npcType === "enemy" ? "Inimigo" : "Comum"}
                              </span>
                              <span>• Nvl {npc.level}</span>
                              <span>• HP {npc.hitPointsMax}</span>
                            </div>
                          </div>
                        </div>

                        <div className="ml-2 shrink-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="h-4 w-4 rounded border-gray-700 bg-gray-900 accent-purple-600 pointer-events-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Conteúdo da Aba Mundos */}
        {activeTab === "worlds" && (
          <>
            {/* Filtros e Busca */}
            <div className="py-3 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between border-b border-gray-800/80 shrink-0">
              <input
                type="text"
                placeholder="Buscar por nome do mundo..."
                value={worldSearchTerm}
                onChange={(e) => setWorldSearchTerm(e.target.value)}
                className="w-full sm:w-64 rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />

              <div className="flex items-center gap-2">
                {onSelectMultipleWorlds && (
                  <>
                    <button
                      type="button"
                      onClick={handleSelectAllFilteredWorlds}
                      className="rounded-lg bg-gray-900 border border-gray-700/60 px-2.5 py-1.5 text-[11px] text-gray-300 hover:text-white hover:bg-gray-800 transition"
                    >
                      Selecionar Visíveis
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllFilteredWorlds}
                      className="rounded-lg bg-gray-900 border border-gray-700/60 px-2.5 py-1.5 text-[11px] text-gray-400 hover:text-red-300 hover:bg-gray-800 transition"
                    >
                      Limpar
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Lista de Mundos */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1 min-h-[220px]">
              {isLoadingWorlds ? (
                <div className="flex h-48 items-center justify-center">
                  <Spinner size="md" />
                </div>
              ) : worldError ? (
                <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-center text-xs text-red-300">
                  {worldError}
                </div>
              ) : filteredWorlds.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500">
                  Nenhum mundo encontrado na biblioteca com o filtro informado.
                </div>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {filteredWorlds.map((world) => {
                    const isSelected = selectedWorldIds.includes(world.id);
                    return (
                      <div
                        key={world.id}
                        onClick={() => onToggleWorld && onToggleWorld(world.id)}
                        className={`relative overflow-hidden p-3 rounded-xl border cursor-pointer transition select-none flex items-center justify-between ${
                          isSelected
                            ? "border-purple-500 bg-purple-950/60 text-white shadow-sm ring-1 ring-purple-500/50"
                            : "border-gray-800/80 bg-gray-900/60 text-gray-300 hover:border-gray-700 hover:bg-gray-900"
                        }`}
                        style={
                          world.coverUrl
                            ? {
                                backgroundImage: `url(${world.coverUrl})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }
                            : undefined
                        }
                      >
                        {world.coverUrl && (
                          <div className="absolute inset-0 bg-gray-950/85 pointer-events-none" />
                        )}

                        <div className="relative z-10 flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-lg overflow-hidden shrink-0">
                            {world.coverUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={world.coverUrl}
                                alt={world.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              "🌍"
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate text-white">{world.name}</div>
                            {world.description && (
                              <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                                {world.description}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {world.mapUrl && (
                                <span className="text-[9px] rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 px-1 py-0.5">
                                  🗺️ Mapa
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="relative z-10 ml-2 shrink-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="h-4 w-4 rounded border-gray-700 bg-gray-900 accent-purple-600 pointer-events-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-gray-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-gray-400 flex items-center gap-3">
            <span>
              <span className="font-semibold text-purple-300">{selectedNpcIds.length}</span>{" "}
              {selectedNpcIds.length === 1 ? "NPC" : "NPCs"}
            </span>
            <span>•</span>
            <span>
              <span className="font-semibold text-purple-300">{selectedWorldIds.length}</span>{" "}
              {selectedWorldIds.length === 1 ? "Mundo" : "Mundos"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-2 text-xs font-bold text-white transition shadow-lg shadow-purple-900/30"
          >
            Confirmar Seleção
          </button>
        </div>
      </div>
    </div>
  );
}
