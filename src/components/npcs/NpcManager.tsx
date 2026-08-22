"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Npc } from "@/types";
import { Button, Form, Input } from "@/components/ui";
import { ATTRIBUTES } from "@/lib/utils/constants";
import { getModifier } from "@/lib/engine/attributes";

type NpcManagerProps = {
  worldId: string;
  worldName: string;
};

export function NpcManager({ worldId, worldName }: NpcManagerProps) {
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    npcType: "common",
    hitPoints: "10",
    hitPointsMax: "10",
    manaPoints: "0",
    manaPointsMax: "0",
    xpReward: "0",
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/worlds/${worldId}/npcs`);
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(data.error || "Erro ao carregar NPCs");
          return;
        }

        setNpcs(data.data);
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
  }, [worldId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch(`/api/worlds/${worldId}/npcs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          npcType: formData.npcType,
          hitPoints: Number(formData.hitPoints),
          hitPointsMax: Number(formData.hitPointsMax),
          manaPoints: Number(formData.manaPoints),
          manaPointsMax: Number(formData.manaPointsMax),
          xpReward: Number(formData.xpReward),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao criar NPC");
        return;
      }

      setFormData({
        name: "",
        npcType: "common",
        hitPoints: "10",
        hitPointsMax: "10",
        manaPoints: "0",
        manaPointsMax: "0",
        xpReward: "0",
      });
      setNpcs((prev) => [...prev, data.data]);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (npcId: string) => {
    if (!window.confirm("Excluir este NPC?")) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/worlds/${worldId}/npcs/${npcId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao excluir NPC");
        return;
      }

      setNpcs((prev) => prev.filter((npc) => npc.id !== npcId));
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/master`} className="text-sm text-purple-400 hover:text-purple-300">
          ← Voltar
        </Link>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-white">Mundo: {worldName}</h2>
          <p className="text-sm text-gray-400">NPCs</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 font-semibold text-white">Novo NPC</h3>
          <Form onSubmit={handleCreate} error={undefined}>
            <Input
              label="Nome"
              name="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
              disabled={isCreating}
              className="bg-gray-950 text-white"
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Tipo</label>
              <select
                value={formData.npcType}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, npcType: e.target.value }))
                }
                disabled={isCreating}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              >
                <option value="common">Comum</option>
                <option value="enemy">Inimigo</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="HP"
                name="hp"
                type="number"
                min={0}
                value={formData.hitPoints}
                onChange={(e) => setFormData((prev) => ({ ...prev, hitPoints: e.target.value }))}
                disabled={isCreating}
                className="bg-gray-950 text-white"
              />
              <Input
                label="HP Máximo"
                name="hpMax"
                type="number"
                min={0}
                value={formData.hitPointsMax}
                onChange={(e) => setFormData((prev) => ({ ...prev, hitPointsMax: e.target.value }))}
                disabled={isCreating}
                className="bg-gray-950 text-white"
              />
              <Input
                label="Mana"
                name="mana"
                type="number"
                min={0}
                value={formData.manaPoints}
                onChange={(e) => setFormData((prev) => ({ ...prev, manaPoints: e.target.value }))}
                disabled={isCreating}
                className="bg-gray-950 text-white"
              />
              <Input
                label="Mana Máximo"
                name="manaMax"
                type="number"
                min={0}
                value={formData.manaPointsMax}
                onChange={(e) => setFormData((prev) => ({ ...prev, manaPointsMax: e.target.value }))}
                disabled={isCreating}
                className="bg-gray-950 text-white"
              />
            </div>
            <Input
              label="XP de Recompensa"
              name="xpReward"
              type="number"
              min={0}
              value={formData.xpReward}
              onChange={(e) => setFormData((prev) => ({ ...prev, xpReward: e.target.value }))}
              disabled={isCreating}
              className="bg-gray-950 text-white"
            />
            <Button type="submit" variant="master" isLoading={isCreating}>
              Criar
            </Button>
          </Form>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 font-semibold text-white">NPCs ({npcs.length})</h3>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-700 border-t-purple-600" />
            </div>
          ) : npcs.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum NPC neste mundo.</p>
          ) : (
            <div className="space-y-2">
              {npcs.map((npc) => (
                <div
                  key={npc.id}
                  className="flex items-start justify-between rounded-lg border border-gray-800 bg-gray-950 p-3"
                >
                  <div>
                    <p className="font-semibold text-white">{npc.name}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-400">
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          npc.npcType === "enemy"
                            ? "bg-red-900/50 text-red-300"
                            : "bg-gray-800 text-gray-300"
                        }`}
                      >
                        {npc.npcType === "enemy" ? "Inimigo" : "Comum"}
                      </span>
                      <span>
                        HP {npc.hitPoints}/{npc.hitPointsMax}
                      </span>
                      <span>
                        Mana {npc.manaPoints}/{npc.manaPointsMax}
                      </span>
                      <span>XP +{npc.xpReward}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {ATTRIBUTES.map(
                        (attr) =>
                          ` ${attr.charAt(0).toUpperCase()}: ${npc.attributes[attr]} (${
                            getModifier(npc.attributes[attr]) >= 0 ? "+" : ""
                          }${getModifier(npc.attributes[attr])})`
                      ).join(" · ")}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(npc.id)}
                    className="ml-4 shrink-0 text-sm text-red-400 hover:text-red-300"
                  >
                    Excluir
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
