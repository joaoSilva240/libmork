"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Campaign, World } from "@/types";
import { Button, Form, Spinner } from "@/components/ui";
import { CampaignInvites } from "@/components/campaigns/CampaignInvites";
import { MasterRoster } from "@/components/campaigns/MasterRoster";
import { SessionLog } from "@/components/campaigns/SessionLog";
import { ContentOverlay } from "@/components/campaigns/ContentOverlay";
import { WorldOverlay } from "@/components/campaigns/WorldOverlay";

export function CampaignDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [newWorldName, setNewWorldName] = useState("");
  const [newWorldDescription, setNewWorldDescription] = useState("");
  const [isCreatingWorld, setIsCreatingWorld] = useState(false);
  const [worldError, setWorldError] = useState<string | null>(null);

  const [editingWorldId, setEditingWorldId] = useState<string | null>(null);
  const [editWorldName, setEditWorldName] = useState("");
  const [editWorldDescription, setEditWorldDescription] = useState("");
  const [isSavingWorld, setIsSavingWorld] = useState(false);

  const [showContentOverlay, setShowContentOverlay] = useState(false);
  const [selectedWorld, setSelectedWorld] = useState<{ id: string; name: string } | null>(null);
  const [rosterVersion, setRosterVersion] = useState(0);

  const loadWorlds = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/${params.id}/worlds`, {
        credentials: "include"
      });
      const data = await response.json();

      if (!response.ok) {
        setWorldError(data.error || "Erro ao carregar mundos");
        return;
      }

      setWorlds(data.data);
    } catch {
      setWorldError("Erro de conexão. Tente novamente.");
    }
  }, [params.id]);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`/api/campaigns/${params.id}`, {
          credentials: "include"
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Erro ao carregar campanha");
          return;
        }

        setCampaign(data.data);
        await loadWorlds();
      } catch {
        setError("Erro de conexão. Tente novamente.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [params.id, loadWorlds]);

  const handleDelete = async () => {
    if (!window.confirm("Tem certeza que deseja excluir esta campanha? Todos os mundos e vínculos serão removidos.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/campaigns/${params.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Erro ao excluir campanha");
        setIsDeleting(false);
        return;
      }

      router.push("/master");
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setIsDeleting(false);
    }
  };

  const handleCreateWorld = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorldError(null);
    setIsCreatingWorld(true);

    try {
      const response = await fetch(`/api/campaigns/${params.id}/worlds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWorldName,
          description: newWorldDescription || null,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setWorldError(data.error || "Erro ao criar mundo");
        return;
      }

      setNewWorldName("");
      setNewWorldDescription("");
      await loadWorlds();
    } catch {
      setWorldError("Erro de conexão. Tente novamente.");
    } finally {
      setIsCreatingWorld(false);
    }
  };

  const handleDeleteWorld = async (worldId: string) => {
    if (!window.confirm("Excluir este mundo?")) {
      return;
    }

    try {
      const response = await fetch(`/api/campaigns/${params.id}/worlds/${worldId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        setWorldError(data.error || "Erro ao excluir mundo");
        return;
      }

      await loadWorlds();
    } catch {
      setWorldError("Erro de conexão. Tente novamente.");
    }
  };

  const startEditingWorld = (world: World) => {
    setEditingWorldId(world.id);
    setEditWorldName(world.name);
    setEditWorldDescription(world.description ?? "");
  };

  const handleSaveWorld = async (worldId: string) => {
    setWorldError(null);
    setIsSavingWorld(true);

    try {
      const response = await fetch(`/api/campaigns/${params.id}/worlds/${worldId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editWorldName,
          description: editWorldDescription || null,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setWorldError(data.error || "Erro ao salvar mundo");
        return;
      }

      setEditingWorldId(null);
      await loadWorlds();
    } catch {
      setWorldError("Erro de conexão. Tente novamente.");
    } finally {
      setIsSavingWorld(false);
    }
  };

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

  if (!campaign) {
    return null;
  }

  const inputClass =
    "rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent disabled:opacity-50";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/master" className="text-sm text-purple-400 hover:text-purple-300">
          ← Voltar
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">{campaign.name}</span>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_240px] xl:grid-cols-[240px_minmax(0,1fr)_260px]">
        {/* ===== Coluna esquerda — Gestão ===== */}
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
            <button
              onClick={() => setShowContentOverlay(true)}
              className="w-full rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              Gerenciar Conteúdo
            </button>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
            <h3 className="mb-2 font-semibold text-white">Mundos</h3>

            {worldError && (
              <div className="mb-2 rounded-lg border border-red-800 bg-red-900/30 p-2 text-xs text-red-300">
                {worldError}
              </div>
            )}

            {worlds.length === 0 ? (
              <p className="mb-2 text-sm text-gray-400">Nenhum mundo criado ainda.</p>
            ) : (
              <div className="mb-3 space-y-2">
                {worlds.map((world) => (
                  <div
                    key={world.id}
                    className="rounded-lg border border-gray-800 bg-gray-950 p-2"
                  >
                    {editingWorldId === world.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editWorldName}
                          onChange={(e) => setEditWorldName(e.target.value)}
                          disabled={isSavingWorld}
                          className={`${inputClass} w-full`}
                        />
                        <input
                          type="text"
                          value={editWorldDescription}
                          onChange={(e) => setEditWorldDescription(e.target.value)}
                          disabled={isSavingWorld}
                          placeholder="Descrição (opcional)"
                          className={`${inputClass} w-full`}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveWorld(world.id)}
                            disabled={isSavingWorld}
                            className="rounded bg-purple-600 px-2 py-1 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                          >
                            {isSavingWorld ? "..." : "Salvar"}
                          </button>
                          <button
                            onClick={() => setEditingWorldId(null)}
                            disabled={isSavingWorld}
                            className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <button
                            onClick={() => setSelectedWorld({ id: world.id, name: world.name })}
                            className="text-left text-sm font-semibold text-white hover:text-purple-300"
                          >
                            {world.name}
                          </button>
                          {world.description && (
                            <p className="mt-0.5 text-xs text-gray-400">{world.description}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <button
                            onClick={() => startEditingWorld(world)}
                            className="text-xs text-purple-400 hover:text-purple-300"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteWorld(world.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Form onSubmit={handleCreateWorld} error={undefined}>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Nome do mundo"
                  value={newWorldName}
                  onChange={(e) => setNewWorldName(e.target.value)}
                  required
                  disabled={isCreatingWorld}
                  className={`${inputClass} w-full`}
                />
                <input
                  type="text"
                  placeholder="Descrição (opcional)"
                  value={newWorldDescription}
                  onChange={(e) => setNewWorldDescription(e.target.value)}
                  disabled={isCreatingWorld}
                  className={`${inputClass} w-full`}
                />
                <Button type="submit" variant="master" isLoading={isCreatingWorld} className="w-full">
                  Adicionar
                </Button>
              </div>
            </Form>
          </div>

          <CampaignInvites key={`invites-${rosterVersion}`} campaignId={campaign.id} />
        </div>

        {/* ===== Coluna central — Mesa (galeria de personagens) ===== */}
        <div className="flex h-[calc(100vh-12rem)] flex-col rounded-lg border border-gray-800 bg-gray-900 p-3">
          <MasterRoster key={`roster-${rosterVersion}`} campaignId={campaign.id} />
        </div>

        {/* ===== Coluna direita — Log da sessão ===== */}
        <SessionLog campaignId={campaign.id} />
      </div>

      {showContentOverlay && (
        <ContentOverlay
          campaignId={campaign.id}
          campaign={campaign}
          onClose={() => setShowContentOverlay(false)}
        />
      )}

      {selectedWorld && (
        <WorldOverlay
          campaignId={campaign.id}
          worldId={selectedWorld.id}
          worldName={selectedWorld.name}
          onClose={() => setSelectedWorld(null)}
          onChanged={() => setRosterVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}
