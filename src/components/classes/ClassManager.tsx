"use client";

import { useCallback, useEffect, useState } from "react";
import type { RpgClass, InitialItem, Proficiencies } from "@/types";
import { ATTRIBUTES } from "@/lib/utils/constants";
import type { Attribute } from "@/lib/utils/constants";
import { Button, Form, Input, Spinner } from "@/components/ui";

type Benefit = {
  id: string;
  classId: string;
  level: number;
  benefits: {
    attribute_bonuses?: Partial<Record<Attribute, number>>;
    hp_bonus?: number;
    mana_bonus?: number;
    extra_trained_skills?: number;
    description?: string;
  };
};

const PROFICIENCY_CATEGORIES: { key: keyof Proficiencies; label: string }[] = [
  { key: "weapons", label: "Armas" },
  { key: "armor", label: "Armaduras" },
  { key: "languages", label: "Idiomas" },
  { key: "tools", label: "Ferramentas" },
];

type DraftItem = { name: string; quantity: string; description: string };

const EMPTY_PROFICIENCIES: Proficiencies = {};

export function ClassManager() {
  const [classes, setClasses] = useState<RpgClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [proficiencies, setProficiencies] = useState<Proficiencies>(EMPTY_PROFICIENCIES);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editItems, setEditItems] = useState<DraftItem[]>([]);
  const [editProficiencies, setEditProficiencies] = useState<Proficiencies>(EMPTY_PROFICIENCIES);
  const [isSaving, setIsSaving] = useState(false);

  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [benefitLevel, setBenefitLevel] = useState("2");
  const [benefitDescription, setBenefitDescription] = useState("");
  const [benefitAttribute, setBenefitAttribute] = useState<Attribute>("forca");
  const [benefitAttributeValue, setBenefitAttributeValue] = useState("1");
  const [benefitHpBonus, setBenefitHpBonus] = useState("0");
  const [benefitManaBonus, setBenefitManaBonus] = useState("0");
  const [benefitExtraSkills, setBenefitExtraSkills] = useState("0");
  const [isAddingBenefit, setIsAddingBenefit] = useState(false);

  const loadClasses = useCallback(async () => {
    try {
      const response = await fetch("/api/classes", { credentials: "include" });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar classes");
        return;
      }

      setClasses(data.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/classes", { credentials: "include" });
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(data.error || "Erro ao carregar classes");
          return;
        }

        setClasses(data.data);
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
  }, []);

  const loadBenefits = useCallback(async (classId: string) => {
    try {
      const response = await fetch(`/api/classes/${classId}/benefits`, { credentials: "include" });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar benefícios");
        return;
      }

      setBenefits(data.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  }, []);

  const toInitialItems = (draft: DraftItem[]): InitialItem[] =>
    draft
      .filter((item) => item.name.trim())
      .map((item) => ({
        item_id: null,
        name: item.name.trim(),
        quantity: Math.max(Number(item.quantity) || 1, 1),
        description: item.description.trim() || undefined,
      }));

  const fromInitialItems = (items: InitialItem[] | undefined): DraftItem[] =>
    (items ?? []).map((item) => ({
      name: item.name,
      quantity: String(item.quantity),
      description: item.description ?? "",
    }));

  const handleToggleClass = async (classId: string) => {
    if (expandedClassId === classId) {
      setExpandedClassId(null);
      return;
    }

    setExpandedClassId(classId);
    await loadBenefits(classId);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          initialItems: toInitialItems(draftItems),
          proficiencies,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao criar classe");
        return;
      }

      setName("");
      setDescription("");
      setDraftItems([]);
      setProficiencies(EMPTY_PROFICIENCIES);
      await loadClasses();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = (rpgClass: RpgClass) => {
    setEditingId(rpgClass.id);
    setEditName(rpgClass.name);
    setEditDescription(rpgClass.description ?? "");
    setEditItems(fromInitialItems(rpgClass.initialItems));
    setEditProficiencies(rpgClass.proficiencies ?? EMPTY_PROFICIENCIES);
  };

  const handleSaveEdit = async (classId: string) => {
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription || null,
          initialItems: toInitialItems(editItems),
          proficiencies: editProficiencies,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao salvar classe");
        return;
      }

      setEditingId(null);
      await loadClasses();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!window.confirm("Excluir esta classe?")) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/classes/${classId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao excluir classe");
        return;
      }

      if (expandedClassId === classId) {
        setExpandedClassId(null);
      }
      await loadClasses();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const handleAddBenefit = async (classId: string) => {
    setError(null);
    setIsAddingBenefit(true);

    try {
      const attributeBonus = Number(benefitAttributeValue) || 0;
      const response = await fetch(`/api/classes/${classId}/benefits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: Number(benefitLevel),
          benefits: {
            attribute_bonuses: attributeBonus !== 0 ? { [benefitAttribute]: attributeBonus } : undefined,
            hp_bonus: Number(benefitHpBonus) || 0,
            mana_bonus: Number(benefitManaBonus) || 0,
            extra_trained_skills: Number(benefitExtraSkills) || 0,
            description: benefitDescription || undefined,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao adicionar benefício");
        return;
      }

      setBenefitLevel("2");
      setBenefitDescription("");
      setBenefitAttributeValue("1");
      setBenefitHpBonus("0");
      setBenefitManaBonus("0");
      setBenefitExtraSkills("0");
      await loadBenefits(classId);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsAddingBenefit(false);
    }
  };

  const handleDeleteBenefit = async (classId: string, benefitId: string) => {
    if (!window.confirm("Excluir este benefício?")) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/classes/${classId}/benefits/${benefitId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao excluir benefício");
        return;
      }

      await loadBenefits(classId);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const renderItemsEditor = (
    items: DraftItem[],
    onChange: (items: DraftItem[]) => void,
    disabled: boolean,
    prefix: string
  ) => (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-300">Itens iniciais</p>
      {items.map((item, index) => (
        <div key={`${prefix}-item-${index}`} className="flex flex-wrap items-end gap-2">
          <Input
            label={index === 0 ? "Nome do item" : undefined}
            name={`${prefix}-item-name-${index}`}
            type="text"
            value={item.name}
            onChange={(e) =>
              onChange(items.map((it, i) => (i === index ? { ...it, name: e.target.value } : it)))
            }
            disabled={disabled}
            className="flex-1 bg-gray-950 text-white"
          />
          <Input
            label={index === 0 ? "Qtd" : undefined}
            name={`${prefix}-item-qty-${index}`}
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) =>
              onChange(items.map((it, i) => (i === index ? { ...it, quantity: e.target.value } : it)))
            }
            disabled={disabled}
            className="w-20 bg-gray-950 text-white"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            disabled={disabled}
            className="mb-2 text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            Remover
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { name: "", quantity: "1", description: "" }])}
        disabled={disabled}
        className="text-sm text-purple-400 hover:text-purple-300 disabled:opacity-50"
      >
        + Adicionar item
      </button>
    </div>
  );

  const renderProficienciesEditor = (
    proficiencies: Proficiencies,
    onChange: (value: Proficiencies) => void,
    disabled: boolean,
    prefix: string
  ) => (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-300">Proficiências</p>
      {PROFICIENCY_CATEGORIES.map((category) => (
        <Input
          key={`${prefix}-prof-${category.key}`}
          label={category.label}
          name={`${prefix}-prof-${category.key}`}
          type="text"
          placeholder="Separadas por vírgula (ex.: espadas, adagas)"
          value={(proficiencies[category.key] ?? []).join(", ")}
          onChange={(e) =>
            onChange({
              ...proficiencies,
              [category.key]: e.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            })
          }
          disabled={disabled}
          className="bg-gray-950 text-white"
        />
      ))}
    </div>
  );

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold text-white">Classes</h2>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 font-semibold text-white">Nova Classe</h3>
          <Form onSubmit={handleCreate} error={undefined}>
            <Input
              label="Nome"
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isCreating}
              className="bg-gray-950 text-white"
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Descrição</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isCreating}
                rows={2}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent disabled:bg-gray-900"
              />
            </div>
            {renderItemsEditor(draftItems, setDraftItems, isCreating, "create")}
            {renderProficienciesEditor(proficiencies, setProficiencies, isCreating, "create")}
            <Button type="submit" variant="master" isLoading={isCreating}>
              Criar
            </Button>
          </Form>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 font-semibold text-white">Classes ({classes.length})</h3>

          {isLoading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Spinner size="md" />
            </div>
          ) : classes.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma classe cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {classes.map((rpgClass) => (
                <div key={rpgClass.id} className="rounded-lg border border-gray-800 bg-gray-950">
                  <div className="flex items-start justify-between p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleToggleClass(rpgClass.id)}
                          className="font-semibold text-white hover:text-purple-300"
                        >
                          {rpgClass.name} {expandedClassId === rpgClass.id ? "−" : "+"}
                        </button>
                        <button
                          onClick={() =>
                            editingId === rpgClass.id
                              ? setEditingId(null)
                              : startEditing(rpgClass)
                          }
                          className="text-xs text-purple-400 hover:text-purple-300"
                        >
                          {editingId === rpgClass.id ? "cancelar edição" : "editar"}
                        </button>
                      </div>
                      {rpgClass.description && (
                        <p className="mt-0.5 text-xs text-gray-400">{rpgClass.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteClass(rpgClass.id)}
                      className="ml-4 shrink-0 text-sm text-red-400 hover:text-red-300"
                    >
                      Excluir
                    </button>
                  </div>

                  {editingId === rpgClass.id && (
                    <div className="space-y-3 border-t border-gray-800 p-3">
                      <p className="text-sm font-semibold text-gray-300">Editar classe</p>
                      <Input
                        label="Nome"
                        name="editName"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        disabled={isSaving}
                        className="bg-gray-950 text-white"
                      />
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-300">
                          Descrição
                        </label>
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          disabled={isSaving}
                          rows={2}
                          className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                        />
                      </div>
                      {renderItemsEditor(editItems, setEditItems, isSaving, "edit")}
                      {renderProficienciesEditor(
                        editProficiencies,
                        setEditProficiencies,
                        isSaving,
                        "edit"
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="master"
                          isLoading={isSaving}
                          onClick={() => handleSaveEdit(rpgClass.id)}
                        >
                          Salvar
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {expandedClassId === rpgClass.id && (
                    <div className="border-t border-gray-800 p-3">
                      <h4 className="mb-2 text-sm font-semibold text-gray-300">
                        Benefícios por nível
                      </h4>
                      {benefits.length === 0 ? (
                        <p className="mb-3 text-sm text-gray-500">Sem benefícios ainda.</p>
                      ) : (
                        <div className="mb-3 space-y-2">
                          {benefits.map((benefit) => (
                            <div
                              key={benefit.id}
                              className="flex items-start justify-between rounded bg-gray-900 p-2"
                            >
                              <div className="text-sm">
                                <p className="font-medium text-white">Nível {benefit.level}</p>
                                <div className="mt-0.5 space-y-0.5 text-xs text-gray-400">
                                  {benefit.benefits.attribute_bonuses &&
                                    Object.entries(benefit.benefits.attribute_bonuses).map(
                                      ([attr, value]) => (
                                        <p key={attr}>
                                          +{value} em {attr}
                                        </p>
                                      )
                                    )}
                                  {!!benefit.benefits.hp_bonus && (
                                    <p>+{benefit.benefits.hp_bonus} de HP máximo</p>
                                  )}
                                  {!!benefit.benefits.mana_bonus && (
                                    <p>+{benefit.benefits.mana_bonus} de Mana máxima</p>
                                  )}
                                  {!!benefit.benefits.extra_trained_skills && (
                                    <p>
                                      +{benefit.benefits.extra_trained_skills} perícia(s) treinada(s)
                                    </p>
                                  )}
                                  {benefit.benefits.description && (
                                    <p>{benefit.benefits.description}</p>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteBenefit(rpgClass.id, benefit.id)}
                                className="ml-3 shrink-0 text-xs text-red-400 hover:text-red-300"
                              >
                                Excluir
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2 rounded border border-gray-800 p-3">
                        <div className="flex flex-wrap items-end gap-2">
                          <Input
                            label="Nível"
                            name="benefitLevel"
                            type="number"
                            min={1}
                            max={20}
                            value={benefitLevel}
                            onChange={(e) => setBenefitLevel(e.target.value)}
                            disabled={isAddingBenefit}
                            className="w-24 bg-gray-900 text-white"
                          />
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-400">
                              Bônus de atributo
                            </label>
                            <select
                              value={benefitAttribute}
                              onChange={(e) => setBenefitAttribute(e.target.value as Attribute)}
                              disabled={isAddingBenefit}
                              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                            >
                              {ATTRIBUTES.map((attr) => (
                                <option key={attr} value={attr}>
                                  {attr}
                                </option>
                              ))}
                            </select>
                          </div>
                          <Input
                            label="Valor"
                            name="benefitAttributeValue"
                            type="number"
                            value={benefitAttributeValue}
                            onChange={(e) => setBenefitAttributeValue(e.target.value)}
                            disabled={isAddingBenefit}
                            className="w-20 bg-gray-900 text-white"
                          />
                          <Input
                            label="+HP"
                            name="benefitHpBonus"
                            type="number"
                            min={0}
                            value={benefitHpBonus}
                            onChange={(e) => setBenefitHpBonus(e.target.value)}
                            disabled={isAddingBenefit}
                            className="w-20 bg-gray-900 text-white"
                          />
                          <Input
                            label="+Mana"
                            name="benefitManaBonus"
                            type="number"
                            min={0}
                            value={benefitManaBonus}
                            onChange={(e) => setBenefitManaBonus(e.target.value)}
                            disabled={isAddingBenefit}
                            className="w-20 bg-gray-900 text-white"
                          />
                          <Input
                            label="+Perícias treinadas"
                            name="benefitExtraSkills"
                            type="number"
                            min={0}
                            value={benefitExtraSkills}
                            onChange={(e) => setBenefitExtraSkills(e.target.value)}
                            disabled={isAddingBenefit}
                            className="w-28 bg-gray-900 text-white"
                          />
                        </div>
                        <Input
                          label="Descrição"
                          name="benefitDescription"
                          type="text"
                          value={benefitDescription}
                          onChange={(e) => setBenefitDescription(e.target.value)}
                          disabled={isAddingBenefit}
                          className="bg-gray-900 text-white"
                        />
                        <Button
                          type="button"
                          variant="master"
                          isLoading={isAddingBenefit}
                          onClick={() => handleAddBenefit(rpgClass.id)}
                        >
                          Adicionar
                        </Button>
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
