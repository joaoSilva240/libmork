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

export function LibraryWorlds() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [selectedWorld, setSelectedWorld] = useState<WorldFullDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form de Criar Mundo
  const [isCreating, setIsCreating] = useState(false);
  const [newWorldName, setNewWorldName] = useState("");
  const [newWorldDescription, setNewWorldDescription] = useState("");
  const [newWorldCoverUrl, setNewWorldCoverUrl] = useState("");
  const [newWorldMapUrl, setNewWorldMapUrl] = useState("");

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

      setNewWorldName("");
      setNewWorldDescription("");
      setNewWorldCoverUrl("");
      setNewWorldMapUrl("");
      await loadWorlds();
      void loadWorldDetails(data.data.id);
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

  const inputClass =
    "rounded-lg border border-secondary-border bg-dominant-dark px-3 py-2 text-sm text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent-vibrant disabled:opacity-50 placeholder-secondary-muted/60";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Coluna Esquerda: Form de criar e lista de mundos */}
      <div className="space-y-4">
        <div className="rounded-lg border border-secondary-border bg-secondary-card p-4 shadow-md">
          <h3 className="mb-3 font-semibold text-secondary-pure">Criar Novo Mundo</h3>
          <Form onSubmit={handleCreateWorld} error={undefined}>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-secondary-muted">Nome do Mundo</label>
                <input
                  type="text"
                  value={newWorldName}
                  onChange={(e) => setNewWorldName(e.target.value)}
                  placeholder="Ex.: Eldoria, Reinos Esquecidos..."
                  required
                  disabled={isCreating}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-secondary-muted">Descrição</label>
                <textarea
                  value={newWorldDescription}
                  onChange={(e) => setNewWorldDescription(e.target.value)}
                  placeholder="História, geografia, características..."
                  rows={2}
                  disabled={isCreating}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-secondary-muted">URL da Imagem de Capa (opcional)</label>
                <input
                  type="url"
                  value={newWorldCoverUrl}
                  onChange={(e) => setNewWorldCoverUrl(e.target.value)}
                  placeholder="https://exemplo.com/capa.jpg"
                  disabled={isCreating}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-secondary-muted">URL da Imagem de Mapa (opcional)</label>
                <input
                  type="url"
                  value={newWorldMapUrl}
                  onChange={(e) => setNewWorldMapUrl(e.target.value)}
                  placeholder="https://exemplo.com/mapa.jpg"
                  disabled={isCreating}
                  className={`${inputClass} w-full`}
                />
              </div>
              <Button type="submit" variant="master" isLoading={isCreating} className="w-full">
                Criar Mundo
              </Button>
            </div>
          </Form>
        </div>

        <div className="rounded-lg border border-secondary-border bg-secondary-card p-4 shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-secondary-pure">Mundos Criados</h3>
            <span className="text-xs text-secondary-muted">{filteredWorlds.length} mundos</span>
          </div>

          <input
            type="text"
            placeholder="Pesquisar mundo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${inputClass} mb-3 w-full`}
          />

          {error && (
            <div className="mb-3 rounded-lg border border-accent-vibrant/40 bg-accent-dark/30 p-2 text-xs text-secondary-pure">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center w-full min-h-[200px]">
              <Spinner size="md" />
            </div>
          ) : filteredWorlds.length === 0 ? (
            <p className="text-center text-sm text-secondary-muted py-4">Nenhum mundo encontrado.</p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {filteredWorlds.map((world) => (
                <div
                  key={world.id}
                  className={`relative overflow-hidden rounded-lg border p-3 cursor-pointer transition-all bg-cover bg-center ${
                    selectedWorld?.id === world.id
                      ? "border-accent shadow-[0_0_10px_rgba(147,51,234,0.2)]"
                      : "border-secondary-border hover:border-accent-vibrant/50"
                  }`}
                  style={
                    world.coverUrl
                      ? { backgroundImage: `url(${world.coverUrl})` }
                      : undefined
                  }
                  onClick={() => void loadWorldDetails(world.id)}
                >
                  <div
                    className={`absolute inset-0 transition-colors ${
                      world.coverUrl
                        ? "bg-gradient-to-r from-dominant-dark/95 via-dominant-dark/80 to-dominant-dark/60"
                        : selectedWorld?.id === world.id
                        ? "bg-accent-dark/30"
                        : "bg-dominant-dark"
                    }`}
                  />
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-secondary-pure text-sm drop-shadow-sm">{world.name}</h4>
                      {world.description && (
                        <p className="text-xs text-secondary-muted line-clamp-1 drop-shadow-sm">{world.description}</p>
                      )}
                    </div>

                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDeleteWorld(world.id)}
                        className="text-xs text-accent-vibrant hover:text-accent-hover transition-colors drop-shadow-sm"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Coluna Direita: Detalhes do Mundo selecionado (Encontros, Estabelecimentos, NPCs) */}
      <div className="rounded-lg border border-secondary-border bg-secondary-card p-4 shadow-md">
        {selectedWorld ? (
          <div>
            <div className="mb-3 border-b border-secondary-border pb-3">
              <h3 className="text-lg font-bold text-secondary-pure">{selectedWorld.name}</h3>
              {selectedWorld.description && (
                <p className="text-xs text-secondary-muted mt-1">{selectedWorld.description}</p>
              )}
            </div>

            {/* Abas internas do mundo */}
            <div className="mb-4 flex gap-2 border-b border-secondary-border pb-2">
              <button
                onClick={() => setActiveSubTab("details")}
                className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                  activeSubTab === "details" ? "bg-accent text-secondary-pure" : "bg-dominant-dark text-secondary-muted hover:text-secondary-pure"
                }`}
              >
                Geral
              </button>
              <button
                onClick={() => setActiveSubTab("establishments")}
                className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                  activeSubTab === "establishments" ? "bg-accent text-secondary-pure" : "bg-dominant-dark text-secondary-muted hover:text-secondary-pure"
                }`}
              >
                🏬 Estabelecimentos ({selectedWorld.establishments?.length || 0})
              </button>
              <button
                onClick={() => setActiveSubTab("encounters")}
                className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                  activeSubTab === "encounters" ? "bg-accent text-secondary-pure" : "bg-dominant-dark text-secondary-muted hover:text-secondary-pure"
                }`}
              >
                ⚔️ Encontros ({selectedWorld.encounters?.length || 0})
              </button>
              <button
                onClick={() => setActiveSubTab("npcs")}
                className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                  activeSubTab === "npcs" ? "bg-accent text-secondary-pure" : "bg-dominant-dark text-secondary-muted hover:text-secondary-pure"
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
                <div className="space-y-3 text-xs text-secondary-muted">
                  <p><span className="font-semibold text-secondary-pure">ID:</span> {selectedWorld.id}</p>
                  <p><span className="font-semibold text-secondary-pure">Criado em:</span> {new Date(selectedWorld.createdAt).toLocaleDateString("pt-BR")}</p>
                  <p><span className="font-semibold text-secondary-pure">Total de Locais:</span> {selectedWorld.establishments?.length || 0}</p>
                  <p><span className="font-semibold text-secondary-pure">Total de Encontros:</span> {selectedWorld.encounters?.length || 0}</p>
                  <p><span className="font-semibold text-secondary-pure">Total de NPCs:</span> {selectedWorld.npcs?.length || 0}</p>
                </div>

                <div className="border-t border-secondary-border pt-3 space-y-4">
                  <h4 className="font-semibold text-xs text-secondary-pure">Imagens do Mundo</h4>
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
                      <p className="mb-1 text-xs font-semibold text-secondary-pure">Preview do Mapa:</p>
                      <div className="relative max-h-60 overflow-hidden rounded-lg border border-secondary-border bg-dominant-dark">
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
                  <div className="space-y-2 rounded-lg border border-secondary-border bg-dominant-dark p-3">
                    <h4 className="font-semibold text-xs text-secondary-pure">+ Novo Estabelecimento</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Nome (Ex.: Taverna do Javali)"
                        value={estName}
                        onChange={(e) => setEstName(e.target.value)}
                        required
                        disabled={isCreatingEst}
                        className={`${inputClass} w-full text-xs`}
                      />
                      <select
                        value={estType}
                        onChange={(e) => setEstType(e.target.value)}
                        className={`${inputClass} w-full text-xs`}
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
                      className={`${inputClass} w-full text-xs`}
                    />
                    <Button type="submit" variant="master" isLoading={isCreatingEst} className="w-full text-xs py-1">
                      Adicionar Estabelecimento
                    </Button>
                  </div>
                </Form>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedWorld.establishments?.map((est) => (
                    <div key={est.id} className="flex items-center justify-between rounded border border-secondary-border bg-dominant-dark p-2 text-xs">
                      <div>
                        <p className="font-bold text-secondary-pure">{est.name} <span className="text-[10px] text-accent-vibrant font-normal">({est.type})</span></p>
                        {est.description && <p className="text-[10px] text-secondary-muted">{est.description}</p>}
                      </div>
                      <button onClick={() => handleDeleteEstablishment(est.id)} className="text-[10px] text-accent-vibrant hover:text-accent-hover transition-colors">
                        Excluir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeSubTab === "encounters" ? (
              <div className="space-y-4">
                <Form onSubmit={handleCreateEncounter} error={undefined}>
                  <div className="space-y-2 rounded-lg border border-secondary-border bg-dominant-dark p-3">
                    <h4 className="font-semibold text-xs text-secondary-pure">+ Novo Encontro (Combate)</h4>
                    <input
                      type="text"
                      placeholder="Nome do Encontro (Ex.: Emboscada de Goblins)"
                      value={encName}
                      onChange={(e) => setEncName(e.target.value)}
                      required
                      disabled={isCreatingEnc}
                      className={`${inputClass} w-full text-xs`}
                    />
                    <textarea
                      placeholder="Descrição ou Notas táticas..."
                      value={encDescription}
                      onChange={(e) => setEncDescription(e.target.value)}
                      disabled={isCreatingEnc}
                      rows={2}
                      className={`${inputClass} w-full text-xs`}
                    />
                    <Button type="submit" variant="master" isLoading={isCreatingEnc} className="w-full text-xs py-1">
                      Cadastrar Encontro
                    </Button>
                  </div>
                </Form>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedWorld.encounters?.map((enc) => (
                    <div key={enc.id} className="rounded border border-secondary-border bg-dominant-dark p-2 text-xs">
                      <div className="flex justify-between items-center">
                        <p className="font-bold text-secondary-pure">{enc.name}</p>
                        {enc.isActive && (
                          <span className="rounded bg-accent-dark/60 text-accent-hover text-[9px] px-1.5 py-0.5 border border-accent-vibrant/40 font-semibold">
                            ATIVO
                          </span>
                        )}
                      </div>
                      {enc.description && <p className="text-[10px] text-secondary-muted mt-1">{enc.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedWorld.npcs?.length === 0 ? (
                  <p className="text-xs text-secondary-muted text-center py-4">Nenhum NPC vinculado a este mundo.</p>
                ) : (
                  selectedWorld.npcs?.map((npc) => (
                    <div key={npc.id} className="flex justify-between items-center rounded border border-secondary-border bg-dominant-dark p-2 text-xs">
                      <div>
                        <p className="font-bold text-secondary-pure">{npc.name} <span className="text-[10px] text-secondary-muted font-normal">Nv {npc.level}</span></p>
                        <p className="text-[10px] text-secondary-muted">HP {npc.hitPoints}/{npc.hitPointsMax} · Mana {npc.manaPoints}/{npc.manaPointsMax}</p>
                      </div>
                      <span className="rounded bg-dominant-container px-1.5 py-0.5 text-[10px] text-accent-vibrant font-medium border border-accent-vibrant/30">
                        {npc.npcType === "enemy" ? "Inimigo" : "NPC"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center py-12 text-center text-secondary-muted">
            <p className="text-sm">Selecione um mundo da lista à esquerda para administrar seus encontros, estabelecimentos e NPCs.</p>
          </div>
        )}
      </div>
    </div>
  );
}
