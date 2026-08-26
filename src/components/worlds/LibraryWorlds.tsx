"use client";

import { useEffect, useState, useCallback } from "react";
import type { World, Encounter, Establishment, Npc } from "@/types";
import { Button, Form, Spinner } from "@/components/ui";
import { WorldImageUpload } from "@/components/worlds/WorldImageUpload";

type WorldFullDetails = World & {
  establishments?: Establishment[];
  encounters?: Encounter[];
  npcs?: Npc[];
};

type LibraryWorldsProps = {
  onRegisterActions?: (actions: { openCreate: () => void }) => void;
};

export function LibraryWorlds({ onRegisterActions }: LibraryWorldsProps = {}) {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [selectedWorld, setSelectedWorld] = useState<WorldFullDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Form de Criar Mundo
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorldName, setNewWorldName] = useState("");
  const [newWorldDescription, setNewWorldDescription] = useState("");
  const [newWorldCoverUrl, setNewWorldCoverUrl] = useState("");
  const [newWorldMapUrl, setNewWorldMapUrl] = useState("");
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [selectedMapFile, setSelectedMapFile] = useState<File | null>(null);

  // Formulários de sub-elementos do mundo selecionado
  const [activeSubTab, setActiveSubTab] = useState<"details" | "encounters" | "establishments" | "npcs">("details");

  // Form Estabelecimento
  const [estName, setEstName] = useState("");
  const [estType, setEstType] = useState("general");
  const [estDescription, setEstDescription] = useState("");
  const [isCreatingEst, setIsCreatingEst] = useState(false);

  // Form Encontro
  const [encName, setEncName] = useState("");
  const [encDescription, setEncDescription] = useState("");
  const [isCreatingEnc, setIsCreatingEnc] = useState(false);

  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        openCreate: () => setShowCreateModal(true),
      });
    }
  }, [onRegisterActions]);

  const loadWorlds = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/worlds", { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setWorlds(data.data || []);
      } else {
        setError(data.error || "Erro ao carregar mundos");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadWorldDetails = useCallback(async (worldId: string) => {
    setIsDetailsLoading(true);
    try {
      const res = await fetch(`/api/worlds/${worldId}`, {
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedWorld(data.data);
      }
    } catch {
      // ignore
    } finally {
      setIsDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/worlds", {
          credentials: "include"
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setWorlds(data.data || []);
        } else {
          setError(data.error || "Erro ao carregar mundos");
        }
      } catch {
        if (!cancelled) {
          setError("Erro de conexão. Tente novamente.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateWorld = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      // 1. Criar mundo primeiro
      const res = await fetch("/api/worlds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWorldName,
          description: newWorldDescription || null,
          coverUrl: newWorldCoverUrl || null,
          mapUrl: newWorldMapUrl || null,
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao criar mundo");
        return;
      }

      const worldId = data.data.id;

      // 2. Upload da capa (se selecionada)
      if (selectedCoverFile) {
        const formData = new FormData();
        formData.append("image", selectedCoverFile);
        formData.append("type", "cover");

        await fetch(`/api/worlds/${worldId}/image`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
      }

      // 3. Upload do mapa (se selecionado)
      if (selectedMapFile) {
        const formData = new FormData();
        formData.append("image", selectedMapFile);
        formData.append("type", "map");

        await fetch(`/api/worlds/${worldId}/image`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
      }

      // 4. Limpar formulário, fechar modal e recarregar
      setNewWorldName("");
      setNewWorldDescription("");
      setNewWorldCoverUrl("");
      setNewWorldMapUrl("");
      setSelectedCoverFile(null);
      setSelectedMapFile(null);
      setShowCreateModal(false);
      await loadWorlds();
      void loadWorldDetails(worldId);
    } catch {
      setError("Erro de conexão");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteWorld = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este mundo?")) return;

    try {
      const res = await fetch(`/api/worlds/${id}`, { 
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) {
        if (selectedWorld?.id === id) setSelectedWorld(null);
        await loadWorlds();
      }
    } catch {
      setError("Erro ao excluir mundo");
    }
  };

  const handleCreateEstablishment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorld) return;
    setIsCreatingEst(true);

    try {
      const res = await fetch(`/api/worlds/${selectedWorld.id}/establishments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: estName,
          type: estType,
          description: estDescription || null,
        }),
        credentials: "include",
      });

      if (res.ok) {
        setEstName("");
        setEstDescription("");
        void loadWorldDetails(selectedWorld.id);
      }
    } catch {
      setError("Erro ao criar estabelecimento");
    } finally {
      setIsCreatingEst(false);
    }
  };

  const handleDeleteEstablishment = async (estId: string) => {
    if (!selectedWorld) return;
    try {
      const res = await fetch(`/api/worlds/${selectedWorld.id}/establishments/${estId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        void loadWorldDetails(selectedWorld.id);
      }
    } catch {
      setError("Erro ao remover estabelecimento");
    }
  };

  const handleCreateEncounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorld) return;
    setIsCreatingEnc(true);

    try {
      const res = await fetch(`/api/campaigns/global/worlds/${selectedWorld.id}/encounters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: encName,
          description: encDescription || null,
        }),
        credentials: "include",
      });

      if (res.ok) {
        setEncName("");
        setEncDescription("");
        void loadWorldDetails(selectedWorld.id);
      }
    } catch {
      setError("Erro ao criar encontro");
    } finally {
      setIsCreatingEnc(false);
    }
  };

  const filteredWorlds = worlds.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPages = Math.ceil(filteredWorlds.length / pageSize) || 1;
  const paginatedWorlds = filteredWorlds.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Fechar modal ao pressionar ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCreateModal) setShowCreateModal(false);
        if (selectedWorld) setSelectedWorld(null);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showCreateModal, selectedWorld]);

  const inputClass =
    "w-full rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition disabled:bg-gray-950";

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Lista de mundos em Grid Full-Width */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-xl flex flex-col max-h-[calc(100vh-16rem)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <span>Mundos da Biblioteca</span>
          </h3>
          <div className="text-xs text-gray-400 font-semibold whitespace-nowrap">
            Total: <span className="text-xs text-purple-400 font-bold bg-purple-950/60 border border-purple-900/60 px-2.5 py-1 rounded-lg">{filteredWorlds.length}</span>
          </div>
        </div>

        <input
          type="text"
          placeholder="Pesquisar mundo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${inputClass} mb-4 shrink-0`}
        />

        {isLoading ? (
          <div className="flex items-center justify-center w-full min-h-[200px] flex-1">
            <Spinner size="md" />
          </div>
        ) : filteredWorlds.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-8 flex-1">Nenhum mundo encontrado.</p>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {paginatedWorlds.map((world) => (
                  <div
                    key={world.id}
                    className="group relative min-h-[120px] overflow-hidden rounded-xl border border-gray-800 bg-gray-950 p-3.5 cursor-pointer transition-all hover:border-purple-600/60 hover:shadow-lg flex flex-col justify-between"
                    style={
                      world.coverUrl
                        ? { backgroundImage: `url(${world.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                        : undefined
                    }
                    onClick={() => {
                      setSelectedWorld(world);
                      void loadWorldDetails(world.id);
                    }}
                  >
                    <div
                      className={`absolute inset-0 transition-colors ${
                        world.coverUrl
                          ? "bg-gradient-to-r from-gray-950/95 via-gray-950/85 to-gray-950/70 group-hover:from-gray-950/90"
                          : "bg-gray-950 group-hover:bg-gray-950/90"
                      }`}
                    />
                    <div className="relative z-10 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white text-base drop-shadow-sm truncate">{world.name}</h4>
                        {world.description && (
                          <p className="text-xs text-gray-400 line-clamp-2 mt-1 drop-shadow-sm">{world.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDeleteWorld(world.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors drop-shadow-sm p-1 rounded hover:bg-red-900/30"
                          title="Excluir Mundo"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                    <div className="relative z-10 mt-4 flex items-center justify-between text-[11px] text-gray-400">
                      <span>Clique para ver detalhes</span>
                      <span className="text-purple-400 font-medium group-hover:translate-x-0.5 transition-transform">Ver mais &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 pt-3 mt-3 shrink-0">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-1 text-xs font-semibold text-gray-300 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Anterior
              </button>
              <span className="text-xs text-gray-400 font-semibold">
                Página {currentPage} / {totalPages} ({filteredWorlds.length} Mundos)
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-1 text-xs font-semibold text-gray-300 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Próximo
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modal Overlay: Detalhes do Mundo selecionado */}
      {selectedWorld && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setSelectedWorld(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-purple-800 bg-gray-950 p-6 text-gray-100 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="flex items-start justify-between border-b border-purple-900/60 pb-3 gap-4">
              <div>
                <h3 className="text-xl font-bold text-purple-200">{selectedWorld.name}</h3>
                {selectedWorld.description && (
                  <p className="text-xs text-gray-400 mt-1">{selectedWorld.description}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedWorld(null)}
                className="text-gray-400 hover:text-white transition-colors text-2xl leading-none p-1"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Abas internas do mundo */}
            <div className="flex gap-2 border-b border-gray-800 pb-2 overflow-x-auto">
              <button
                onClick={() => setActiveSubTab("details")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  activeSubTab === "details" ? "bg-purple-600 text-white shadow" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                Geral
              </button>
              <button
                onClick={() => setActiveSubTab("establishments")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  activeSubTab === "establishments" ? "bg-purple-600 text-white shadow" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                🏬 Estabelecimentos ({selectedWorld.establishments?.length || 0})
              </button>
              <button
                onClick={() => setActiveSubTab("encounters")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  activeSubTab === "encounters" ? "bg-purple-600 text-white shadow" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                ⚔️ Encontros ({selectedWorld.encounters?.length || 0})
              </button>
              <button
                onClick={() => setActiveSubTab("npcs")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  activeSubTab === "npcs" ? "bg-purple-600 text-white shadow" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                👥 NPCs ({selectedWorld.npcs?.length || 0})
              </button>
            </div>

            {isDetailsLoading ? (
              <div className="flex items-center justify-center w-full min-h-[200px]">
                <Spinner size="md" />
              </div>
            ) : activeSubTab === "details" ? (
              <div className="space-y-4">
                <div className="space-y-3 text-xs text-gray-400">
                  <p><span className="font-semibold text-white">ID:</span> {selectedWorld.id}</p>
                  <p><span className="font-semibold text-white">Criado em:</span> {selectedWorld.createdAt ? new Date(selectedWorld.createdAt).toLocaleDateString("pt-BR") : "-"}</p>
                  <p><span className="font-semibold text-white">Total de Locais:</span> {selectedWorld.establishments?.length || 0}</p>
                  <p><span className="font-semibold text-white">Total de Encontros:</span> {selectedWorld.encounters?.length || 0}</p>
                  <p><span className="font-semibold text-white">Total de NPCs:</span> {selectedWorld.npcs?.length || 0}</p>
                </div>

                <div className="border-t border-gray-800 pt-3 space-y-4">
                  <h4 className="font-semibold text-xs text-white">Imagens do Mundo</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <WorldImageUpload
                      worldId={selectedWorld.id}
                      type="cover"
                      currentImageUrl={selectedWorld.coverUrl}
                      label="Imagem de Capa"
                      onUploaded={(url) => {
                        setSelectedWorld((prev) => prev ? { ...prev, coverUrl: url } : null);
                        setWorlds((prev) => prev.map((w) => w.id === selectedWorld.id ? { ...w, coverUrl: url } : w));
                      }}
                    />
                    <WorldImageUpload
                      worldId={selectedWorld.id}
                      type="map"
                      currentImageUrl={selectedWorld.mapUrl}
                      label="Imagem de Mapa"
                      onUploaded={(url) => {
                        setSelectedWorld((prev) => prev ? { ...prev, mapUrl: url } : null);
                        setWorlds((prev) => prev.map((w) => w.id === selectedWorld.id ? { ...w, mapUrl: url } : w));
                      }}
                    />
                  </div>

                  {selectedWorld.mapUrl && (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-semibold text-white">Preview do Mapa:</p>
                      <div className="relative max-h-60 overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedWorld.mapUrl}
                          alt={`Mapa de ${selectedWorld.name}`}
                          className="w-full object-contain max-h-60"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : activeSubTab === "establishments" ? (
              <div className="space-y-4">
                <Form onSubmit={handleCreateEstablishment} error={undefined}>
                  <div className="space-y-2 rounded-xl border border-gray-800 bg-gray-900 p-3">
                    <h4 className="font-semibold text-xs text-white">+ Novo Estabelecimento</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Nome (Ex.: Taverna do Javali)"
                        value={estName}
                        onChange={(e) => setEstName(e.target.value)}
                        required
                        disabled={isCreatingEst}
                        className={`${inputClass} text-xs`}
                      />
                      <select
                        value={estType}
                        onChange={(e) => setEstType(e.target.value)}
                        className={`${inputClass} text-xs`}
                      >
                        <option value="tavern">Taverna / Estalagem</option>
                        <option value="blacksmith">Ferreiro / Armaria</option>
                        <option value="magic_shop">Loja de Magia</option>
                        <option value="temple">Templo / Altar</option>
                        <option value="general">Geral / Mercante</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      placeholder="Descrição (opcional)"
                      value={estDescription}
                      onChange={(e) => setEstDescription(e.target.value)}
                      disabled={isCreatingEst}
                      className={`${inputClass} text-xs`}
                    />
                    <Button type="submit" variant="master" isLoading={isCreatingEst} className="w-full text-xs py-1">
                      Adicionar Estabelecimento
                    </Button>
                  </div>
                </Form>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedWorld.establishments?.map((est) => (
                    <div key={est.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-2.5 text-xs">
                      <div>
                        <p className="font-bold text-white">{est.name} <span className="text-[10px] text-purple-400 font-normal">({est.type})</span></p>
                        {est.description && <p className="text-[10px] text-gray-400">{est.description}</p>}
                      </div>
                      <button onClick={() => handleDeleteEstablishment(est.id)} className="text-[10px] text-red-400 hover:text-red-300 transition-colors">
                        Excluir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeSubTab === "encounters" ? (
              <div className="space-y-4">
                <Form onSubmit={handleCreateEncounter} error={undefined}>
                  <div className="space-y-2 rounded-xl border border-gray-800 bg-gray-900 p-3">
                    <h4 className="font-semibold text-xs text-white">+ Novo Encontro (Combate)</h4>
                    <input
                      type="text"
                      placeholder="Nome do Encontro (Ex.: Emboscada de Goblins)"
                      value={encName}
                      onChange={(e) => setEncName(e.target.value)}
                      required
                      disabled={isCreatingEnc}
                      className={`${inputClass} text-xs`}
                    />
                    <textarea
                      placeholder="Descrição ou Notas táticas..."
                      value={encDescription}
                      onChange={(e) => setEncDescription(e.target.value)}
                      disabled={isCreatingEnc}
                      rows={2}
                      className={`${inputClass} text-xs`}
                    />
                    <Button type="submit" variant="master" isLoading={isCreatingEnc} className="w-full text-xs py-1">
                      Cadastrar Encontro
                    </Button>
                  </div>
                </Form>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedWorld.encounters?.map((enc) => (
                    <div key={enc.id} className="rounded-xl border border-gray-800 bg-gray-900 p-2.5 text-xs">
                      <div className="flex justify-between items-center">
                        <p className="font-bold text-white">{enc.name}</p>
                        {enc.isActive && (
                          <span className="rounded-lg bg-purple-950/60 text-purple-300 text-[9px] px-2 py-0.5 border border-purple-900/60 font-semibold">
                            ATIVO
                          </span>
                        )}
                      </div>
                      {enc.description && <p className="text-[10px] text-gray-400 mt-1">{enc.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedWorld.npcs?.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Nenhum NPC vinculado a este mundo.</p>
                ) : (
                  selectedWorld.npcs?.map((npc) => (
                    <div key={npc.id} className="flex justify-between items-center rounded-xl border border-gray-800 bg-gray-900 p-2.5 text-xs">
                      <div>
                        <p className="font-bold text-white">{npc.name} <span className="text-[10px] text-gray-400 font-normal">Nv {npc.level}</span></p>
                        <p className="text-[10px] text-gray-400">HP {npc.hitPoints}/{npc.hitPointsMax} · Mana {npc.manaPoints}/{npc.manaPointsMax}</p>
                      </div>
                      <span className="rounded-lg bg-purple-950/60 px-2 py-0.5 text-[10px] text-purple-300 font-medium border border-purple-900/60">
                        {npc.npcType === "enemy" ? "Inimigo" : "NPC"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Criação de Mundo */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-purple-800 bg-gray-950 p-6 shadow-2xl space-y-4 text-gray-100 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do modal */}
            <div className="flex items-center justify-between border-b border-purple-900/60 pb-3">
              <h3 className="text-base font-bold text-purple-200">Criar Novo Mundo</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Formulário de criação */}
            <form onSubmit={handleCreateWorld} className="space-y-4">
              {/* Input: Nome */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Nome do Mundo *
                </label>
                <input
                  type="text"
                  value={newWorldName}
                  onChange={(e) => setNewWorldName(e.target.value)}
                  required
                  disabled={isCreating}
                  placeholder="Ex: Terras Sombrias de Valedor"
                  className={inputClass}
                />
              </div>

              {/* Input: Descrição */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Descrição
                </label>
                <textarea
                  value={newWorldDescription}
                  onChange={(e) => setNewWorldDescription(e.target.value)}
                  disabled={isCreating}
                  placeholder="Uma breve descrição do mundo..."
                  rows={3}
                  className={inputClass}
                />
              </div>

              {/* Input: URL da Capa + Upload */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Capa do Mundo
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newWorldCoverUrl}
                    onChange={(e) => setNewWorldCoverUrl(e.target.value)}
                    disabled={isCreating}
                    placeholder="https://exemplo.com/capa.jpg"
                    className={`${inputClass} flex-1`}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSelectedCoverFile(e.target.files?.[0] || null)}
                    disabled={isCreating}
                    className="hidden"
                    id="modal-cover-file-input"
                  />
                  <label
                    htmlFor="modal-cover-file-input"
                    className={`flex items-center gap-1.5 rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer transition-colors ${
                      isCreating ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {selectedCoverFile ? selectedCoverFile.name.slice(0, 15) : 'Upload'}
                  </label>
                </div>
                {selectedCoverFile && (
                  <p className="mt-1 text-xs text-purple-400 font-semibold">📎 {selectedCoverFile.name}</p>
                )}
              </div>

              {/* Input: URL do Mapa + Upload */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Mapa do Mundo
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newWorldMapUrl}
                    onChange={(e) => setNewWorldMapUrl(e.target.value)}
                    disabled={isCreating}
                    placeholder="https://exemplo.com/mapa.jpg"
                    className={`${inputClass} flex-1`}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSelectedMapFile(e.target.files?.[0] || null)}
                    disabled={isCreating}
                    className="hidden"
                    id="modal-map-file-input"
                  />
                  <label
                    htmlFor="modal-map-file-input"
                    className={`flex items-center gap-1.5 rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer transition-colors ${
                      isCreating ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {selectedMapFile ? selectedMapFile.name.slice(0, 15) : 'Upload'}
                  </label>
                </div>
                {selectedMapFile && (
                  <p className="mt-1 text-xs text-purple-400 font-semibold">📎 {selectedMapFile.name}</p>
                )}
              </div>

              {/* Botões de ação */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                  className="w-1/2 rounded-xl border border-purple-600 bg-purple-950/80 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-900 transition shadow-lg disabled:opacity-50"
                >
                  Cancelar
                </button>
                <Button
                  type="submit"
                  variant="master"
                  isLoading={isCreating}
                  className="w-1/2"
                >
                  Criar Mundo
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
