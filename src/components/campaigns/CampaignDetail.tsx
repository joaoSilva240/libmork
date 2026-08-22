"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Campaign, World } from "@/types";
import { Button, Form, Input } from "@/components/ui";

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

  const loadWorlds = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/${params.id}/worlds`);
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
        const response = await fetch(`/api/campaigns/${params.id}`);
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-purple-600" />
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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/master" className="text-sm text-purple-400 hover:text-purple-300">
          ← Voltar
        </Link>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isDeleting ? "Excluindo..." : "Excluir"}
        </button>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-2xl font-bold text-white">{campaign.name}</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded bg-gray-800 px-2 py-1 text-gray-300">
            Motor: {campaign.rulesEngine === "d20_mod" ? "d20 + modificador" : "2d20 somado"}
          </span>
          <span className="rounded bg-gray-800 px-2 py-1 text-gray-300">
            PvP: {campaign.pvpEnabled ? "ativado" : "desativado"}
          </span>
          <span className="rounded bg-gray-800 px-2 py-1 text-gray-300">
            Sombra: +{campaign.difficultyModifierShadowPoints}
          </span>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Mundos</h3>

        {worldError && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
            {worldError}
          </div>
        )}

        {worlds.length === 0 ? (
          <p className="mb-4 text-sm text-gray-400">Nenhum mundo criado ainda.</p>
        ) : (
          <div className="mb-6 space-y-3">
            {worlds.map((world) => (
              <div
                key={world.id}
                className="flex items-start justify-between rounded-lg border border-gray-800 bg-gray-950 p-3"
              >
                <div>
                  <p className="font-semibold text-white">{world.name}</p>
                  {world.description && (
                    <p className="mt-1 text-sm text-gray-400">{world.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteWorld(world.id)}
                  className="ml-4 shrink-0 text-sm text-red-400 hover:text-red-300"
                >
                  Excluir
                </button>
              </div>
            ))}
          </div>
        )}

        <Form onSubmit={handleCreateWorld} error={undefined}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              name="worldName"
              type="text"
              placeholder="Nome do mundo"
              value={newWorldName}
              onChange={(e) => setNewWorldName(e.target.value)}
              required
              disabled={isCreatingWorld}
              className="bg-gray-950 text-white"
            />
            <Button type="submit" variant="master" isLoading={isCreatingWorld}>
              Adicionar
            </Button>
          </div>
          <Input
            name="worldDescription"
            type="text"
            placeholder="Descrição (opcional)"
            value={newWorldDescription}
            onChange={(e) => setNewWorldDescription(e.target.value)}
            disabled={isCreatingWorld}
            className="bg-gray-950 text-white"
          />
        </Form>
      </div>
    </div>
  );
}
