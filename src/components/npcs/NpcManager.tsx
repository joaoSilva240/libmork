"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Npc } from "@/types";
import { Button, Form, Input } from "@/components/ui";
import { ATTRIBUTES } from "@/lib/utils/constants";
import type { Attribute } from "@/lib/utils/constants";
import { getModifier } from "@/lib/engine/attributes";

type NpcManagerProps = {
  worldId: string;
  worldName: string;
};

type Pin = {
  id: string;
  npcId: string;
  pinType: "skill" | "spell" | "attack";
  contentId: string | null;
  label: string;
  rollExpression: string | null;
  manaCost: number | null;
  circle: number | null;
  createdAt: string;
};

type ContentOption = {
  id: string;
  name: string;
  rollExpression?: string | null;
  manaCost?: number | null;
  circle?: number | null;
};

const PIN_TYPE_LABELS: Record<Pin["pinType"], string> = {
  attack: "Ataque",
  skill: "Perícia",
  spell: "Magia",
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
    level: "1",
    xpReward: "0",
    attributes: {
      forca: "10",
      destreza: "10",
      vigor: "10",
      inteligencia: "10",
      empatia: "10",
    } as Record<Attribute, string>,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createImage, setCreateImage] = useState<File | null>(null);
  const [expandedNpcId, setExpandedNpcId] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinForm, setPinForm] = useState({
    pinType: "attack" as Pin["pinType"],
    label: "",
    rollExpression: "",
    contentId: "",
  });
  const [skillOptions, setSkillOptions] = useState<ContentOption[]>([]);
  const [spellOptions, setSpellOptions] = useState<ContentOption[]>([]);
  const [isPinBusy, setIsPinBusy] = useState(false);

  const [editForm, setEditForm] = useState<{
    name: string;
    npcType: string;
    hitPoints: string;
    hitPointsMax: string;
    manaPoints: string;
    manaPointsMax: string;
    level: string;
    xpReward: string;
    attributes: Record<Attribute, string>;
  } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const DEFAULT_ATTRIBUTES: Record<Attribute, string> = {
    forca: "10",
    destreza: "10",
    vigor: "10",
    inteligencia: "10",
    empatia: "10",
  };

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
          level: Number(formData.level),
          xpReward: Number(formData.xpReward),
          attributes: Object.fromEntries(
            ATTRIBUTES.map((attr) => [attr, Number(formData.attributes[attr]) || 0])
          ),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao criar NPC");
        return;
      }

      let created = data.data as Npc;

      if (createImage) {
        try {
          const imageForm = new FormData();
          imageForm.append("image", createImage);
          const imageResponse = await fetch(`/api/npcs/${created.id}/image`, {
            method: "POST",
            body: imageForm,
          });
          const imageData = await imageResponse.json();

          if (imageResponse.ok) {
            created = imageData.data as Npc;
          } else {
            setError(imageData.error || "Erro ao enviar imagem");
          }
        } catch {
          setError("Erro de conexão ao enviar imagem.");
        }
      }

      setFormData({
        name: "",
        npcType: "common",
        hitPoints: "10",
        hitPointsMax: "10",
        manaPoints: "0",
        manaPointsMax: "0",
        level: "1",
        xpReward: "0",
        attributes: { ...DEFAULT_ATTRIBUTES },
      });
      setCreateImage(null);
      setNpcs((prev) => [...prev, created]);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = (npc: Npc) => {
    setEditForm({
      name: npc.name,
      npcType: npc.npcType,
      hitPoints: String(npc.hitPoints),
      hitPointsMax: String(npc.hitPointsMax),
      manaPoints: String(npc.manaPoints),
      manaPointsMax: String(npc.manaPointsMax),
      level: String(npc.level),
      xpReward: String(npc.xpReward),
      attributes: {
        forca: String(npc.attributes.forca),
        destreza: String(npc.attributes.destreza),
        vigor: String(npc.attributes.vigor),
        inteligencia: String(npc.attributes.inteligencia),
        empatia: String(npc.attributes.empatia),
      },
    });
  };

  const handleSaveEdit = async (npcId: string) => {
    if (!editForm) return;

    setError(null);
    setIsSavingEdit(true);

    try {
      const response = await fetch(`/api/worlds/${worldId}/npcs/${npcId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          npcType: editForm.npcType,
          hitPoints: Number(editForm.hitPoints),
          hitPointsMax: Number(editForm.hitPointsMax),
          manaPoints: Number(editForm.manaPoints),
          manaPointsMax: Number(editForm.manaPointsMax),
          level: Number(editForm.level),
          xpReward: Number(editForm.xpReward),
          attributes: Object.fromEntries(
            ATTRIBUTES.map((attr) => [attr, Number(editForm.attributes[attr]) || 0])
          ),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao salvar NPC");
        return;
      }

      setEditForm(null);
      setNpcs((prev) => prev.map((npc) => (npc.id === npcId ? data.data : npc)));
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleEditImage = async (npcId: string, file: File) => {
    setError(null);
    try {
      const imageForm = new FormData();
      imageForm.append("image", file);
      const response = await fetch(`/api/npcs/${npcId}/image`, {
        method: "POST",
        body: imageForm,
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao enviar imagem");
        return;
      }

      setNpcs((prev) => prev.map((npc) => (npc.id === npcId ? data.data : npc)));
    } catch {
      setError("Erro de conexão. Tente novamente.");
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

  const loadPins = async (npcId: string) => {
    try {
      const response = await fetch(`/api/worlds/${worldId}/npcs/${npcId}/pins`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar pins");
        return;
      }

      setPins(data.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const loadContentOptions = async () => {
    try {
      const [skillsResponse, spellsResponse] = await Promise.all([
        fetch("/api/content/skills"),
        fetch("/api/content/spells"),
      ]);

      const skillsData = await skillsResponse.json();
      const spellsData = await spellsResponse.json();

      if (skillsResponse.ok) {
        setSkillOptions(skillsData.data);
      }
      if (spellsResponse.ok) {
        setSpellOptions(spellsData.data);
      }
    } catch {
      setError("Erro ao carregar conteúdo disponível.");
    }
  };

  const handleToggleNpc = async (npcId: string) => {
    if (expandedNpcId === npcId) {
      setExpandedNpcId(null);
      setEditForm(null);
      return;
    }

    setExpandedNpcId(npcId);
    setEditForm(null);
    setPinForm({ pinType: "attack", label: "", rollExpression: "", contentId: "" });
    await Promise.all([loadPins(npcId), loadContentOptions()]);
  };

  const handleAddPin = async (npcId: string) => {
    setError(null);
    setIsPinBusy(true);

    try {
      const payload: Record<string, unknown> = {
        pinType: pinForm.pinType,
      };

      if (pinForm.pinType === "attack") {
        payload.label = pinForm.label;
        if (pinForm.rollExpression) {
          payload.rollExpression = pinForm.rollExpression;
        }
      } else {
        if (!pinForm.contentId) {
          setError("Selecione um item do conteúdo");
          return;
        }
        payload.contentId = pinForm.contentId;
        payload.label = "placeholder";
      }

      const response = await fetch(`/api/worlds/${worldId}/npcs/${npcId}/pins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao adicionar pin");
        return;
      }

      setPinForm({ pinType: "attack", label: "", rollExpression: "", contentId: "" });
      await loadPins(npcId);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsPinBusy(false);
    }
  };

  const handleDeletePin = async (npcId: string, pinId: string) => {
    setError(null);
    try {
      const response = await fetch(
        `/api/worlds/${worldId}/npcs/${npcId}/pins/${pinId}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao remover pin");
        return;
      }

      await loadPins(npcId);
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
              <Input
                label="Nível"
                name="level"
                type="number"
                min={1}
                value={formData.level}
                onChange={(e) => setFormData((prev) => ({ ...prev, level: e.target.value }))}
                disabled={isCreating}
                className="bg-gray-950 text-white"
              />
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
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-gray-300">Atributos</p>
              <div className="grid grid-cols-2 gap-3">
                {ATTRIBUTES.map((attr) => (
                  <div key={attr} className="flex items-center gap-2">
                    <Input
                      label={attr.charAt(0).toUpperCase() + attr.slice(1)}
                      name={`attr-${attr}`}
                      type="number"
                      min={1}
                      max={30}
                      value={formData.attributes[attr]}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          attributes: { ...prev.attributes, [attr]: e.target.value },
                        }))
                      }
                      disabled={isCreating}
                      className="bg-gray-950 text-white"
                    />
                    <span className="mt-4 text-xs text-gray-400">
                      {getModifier(Number(formData.attributes[attr]) || 0) >= 0 ? "+" : ""}
                      {getModifier(Number(formData.attributes[attr]) || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Imagem (opcional)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setCreateImage(e.target.files?.[0] ?? null)}
                disabled={isCreating}
                className="block w-full text-sm text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-800 file:px-3 file:py-1.5 file:text-white"
              />
            </div>
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
                <div key={npc.id} className="rounded-lg border border-gray-800 bg-gray-950">
                  <div className="flex items-start gap-3 p-3">
                    {npc.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={npc.imageUrl}
                        alt={npc.name}
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-lg font-bold text-gray-400">
                        {npc.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleToggleNpc(npc.id)}
                          className="font-semibold text-white hover:text-purple-300"
                        >
                          {npc.name} {expandedNpcId === npc.id ? "−" : "+"}
                        </button>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs ${
                            npc.npcType === "enemy"
                              ? "bg-red-900/50 text-red-300"
                              : "bg-gray-800 text-gray-300"
                          }`}
                        >
                          {npc.npcType === "enemy" ? "Inimigo" : "Comum"}
                        </span>
                        <span className="rounded bg-purple-900/50 px-1.5 py-0.5 text-xs text-purple-300">
                          Nível {npc.level}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-400">
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
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <button
                        onClick={() =>
                          editForm ? setEditForm(null) : startEditing(npc)
                        }
                        className="text-xs text-purple-400 hover:text-purple-300"
                      >
                        {editForm ? "cancelar edição" : "Editar ficha"}
                      </button>
                      <button
                        onClick={() => handleDelete(npc.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>

                  {expandedNpcId === npc.id && (
                    <div className="border-t border-gray-800 p-3">
                      {editForm && (
                        <div className="mb-4 space-y-3 rounded border border-gray-800 p-3">
                          <p className="text-sm font-semibold text-gray-300">Editar ficha</p>
                          <Input
                            label="Nome"
                            name="editName"
                            type="text"
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm((prev) =>
                                prev ? { ...prev, name: e.target.value } : prev
                              )
                            }
                            required
                            disabled={isSavingEdit}
                            className="bg-gray-900 text-white"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              label="HP"
                              name="editHp"
                              type="number"
                              min={0}
                              value={editForm.hitPoints}
                              onChange={(e) =>
                                setEditForm((prev) =>
                                  prev ? { ...prev, hitPoints: e.target.value } : prev
                                )
                              }
                              disabled={isSavingEdit}
                              className="bg-gray-900 text-white"
                            />
                            <Input
                              label="HP Máximo"
                              name="editHpMax"
                              type="number"
                              min={0}
                              value={editForm.hitPointsMax}
                              onChange={(e) =>
                                setEditForm((prev) =>
                                  prev ? { ...prev, hitPointsMax: e.target.value } : prev
                                )
                              }
                              disabled={isSavingEdit}
                              className="bg-gray-900 text-white"
                            />
                            <Input
                              label="Mana"
                              name="editMana"
                              type="number"
                              min={0}
                              value={editForm.manaPoints}
                              onChange={(e) =>
                                setEditForm((prev) =>
                                  prev ? { ...prev, manaPoints: e.target.value } : prev
                                )
                              }
                              disabled={isSavingEdit}
                              className="bg-gray-900 text-white"
                            />
                            <Input
                              label="Mana Máxima"
                              name="editManaMax"
                              type="number"
                              min={0}
                              value={editForm.manaPointsMax}
                              onChange={(e) =>
                                setEditForm((prev) =>
                                  prev ? { ...prev, manaPointsMax: e.target.value } : prev
                                )
                              }
                              disabled={isSavingEdit}
                              className="bg-gray-900 text-white"
                            />
                            <Input
                              label="Nível"
                              name="editLevel"
                              type="number"
                              min={1}
                              value={editForm.level}
                              onChange={(e) =>
                                setEditForm((prev) =>
                                  prev ? { ...prev, level: e.target.value } : prev
                                )
                              }
                              disabled={isSavingEdit}
                              className="bg-gray-900 text-white"
                            />
                            <Input
                              label="XP de Recompensa"
                              name="editXpReward"
                              type="number"
                              min={0}
                              value={editForm.xpReward}
                              onChange={(e) =>
                                setEditForm((prev) =>
                                  prev ? { ...prev, xpReward: e.target.value } : prev
                                )
                              }
                              disabled={isSavingEdit}
                              className="bg-gray-900 text-white"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {ATTRIBUTES.map((attr) => (
                              <Input
                                key={attr}
                                label={attr.charAt(0).toUpperCase() + attr.slice(1)}
                                name={`editAttr-${attr}`}
                                type="number"
                                min={1}
                                max={30}
                                value={editForm.attributes[attr]}
                                onChange={(e) =>
                                  setEditForm((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          attributes: {
                                            ...prev.attributes,
                                            [attr]: e.target.value,
                                          },
                                        }
                                      : prev
                                  )
                                }
                                disabled={isSavingEdit}
                                className="bg-gray-900 text-white"
                              />
                            ))}
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-300">
                              Trocar imagem
                            </label>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  void handleEditImage(npc.id, file);
                                }
                              }}
                              disabled={isSavingEdit}
                              className="block w-full text-sm text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-800 file:px-3 file:py-1.5 file:text-white"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="master"
                            isLoading={isSavingEdit}
                            onClick={() => handleSaveEdit(npc.id)}
                          >
                            Salvar ficha
                          </Button>
                        </div>
                      )}

                      <h4 className="mb-2 text-sm font-semibold text-gray-300">
                        Atalhos (pins) — magias, perícias e ataques
                      </h4>

                      {pins.length === 0 ? (
                        <p className="mb-3 text-sm text-gray-500">
                          Nenhum atalho pinado neste NPC.
                        </p>
                      ) : (
                        <div className="mb-3 space-y-2">
                          {pins.map((pin) => (
                            <div
                              key={pin.id}
                              className="flex items-center justify-between rounded bg-gray-900 p-2"
                            >
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {PIN_TYPE_LABELS[pin.pinType]}: {pin.label}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {pin.rollExpression && `Rolagem: ${pin.rollExpression}`}
                                  {pin.manaCost !== null && pin.manaCost !== undefined && (
                                    <span> · {pin.manaCost} mana</span>
                                  )}
                                  {pin.circle !== null && pin.circle !== undefined && (
                                    <span> · Círculo {pin.circle}</span>
                                  )}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeletePin(npc.id, pin.id)}
                                className="ml-3 shrink-0 text-xs text-red-400 hover:text-red-300"
                              >
                                Remover
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-400">
                            Tipo
                          </label>
                          <select
                            value={pinForm.pinType}
                            onChange={(e) =>
                              setPinForm((prev) => ({
                                ...prev,
                                pinType: e.target.value as Pin["pinType"],
                                contentId: "",
                              }))
                            }
                            disabled={isPinBusy}
                            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                          >
                            <option value="attack">Ataque</option>
                            <option value="skill">Perícia</option>
                            <option value="spell">Magia</option>
                          </select>
                        </div>

                        {pinForm.pinType === "attack" ? (
                          <>
                            <input
                              type="text"
                              placeholder="Nome (ex.: Mordida)"
                              value={pinForm.label}
                              onChange={(e) =>
                                setPinForm((prev) => ({ ...prev, label: e.target.value }))
                              }
                              required
                              disabled={isPinBusy}
                              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                            />
                            <input
                              type="text"
                              placeholder="Rolagem (ex.: 1d8+3)"
                              value={pinForm.rollExpression}
                              onChange={(e) =>
                                setPinForm((prev) => ({
                                  ...prev,
                                  rollExpression: e.target.value,
                                }))
                              }
                              disabled={isPinBusy}
                              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                            />
                          </>
                        ) : (
                          <select
                            value={pinForm.contentId}
                            onChange={(e) =>
                              setPinForm((prev) => ({
                                ...prev,
                                contentId: e.target.value,
                              }))
                            }
                            required
                            disabled={isPinBusy}
                            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                          >
                            <option value="">Selecione</option>
                            {(pinForm.pinType === "skill"
                              ? skillOptions
                              : spellOptions
                            ).map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                        )}

                        <button
                          onClick={() => handleAddPin(npc.id)}
                          disabled={isPinBusy}
                          className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                        >
                          {isPinBusy ? "..." : "Pinar"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
