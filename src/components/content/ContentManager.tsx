"use client";

import { useEffect, useState } from "react";
import { ATTRIBUTES, SPELL_USE_TYPES } from "@/lib/utils/constants";
import type { ContentType } from "@/lib/validators/content";
import { Button, Form, Input } from "@/components/ui";

type FieldDef = {
  name: string;
  label: string;
  type: "text" | "number" | "textarea" | "select";
  required?: boolean;
  options?: readonly string[];
  min?: number;
  max?: number;
  placeholder?: string;
};

type TypeConfig = {
  label: string;
  fields: FieldDef[];
  showInList: string[];
};

const TYPE_CONFIGS: Record<ContentType, TypeConfig> = {
  skills: {
    label: "Perícias",
    fields: [
      { name: "name", label: "Nome", type: "text", required: true },
      { name: "description", label: "Descrição", type: "textarea" },
      { name: "rollExpression", label: "Expressão de Rolagem", type: "text", placeholder: "1d20 + destreza" },
      { name: "keyAttribute", label: "Atributo Chave", type: "select", options: ATTRIBUTES, required: true },
    ],
    showInList: ["keyAttribute", "rollExpression"],
  },
  spells: {
    label: "Magias",
    fields: [
      { name: "name", label: "Nome", type: "text", required: true },
      { name: "circle", label: "Círculo (1-9)", type: "number", min: 1, max: 9, required: true },
      { name: "manaCost", label: "Custo de Mana", type: "number", min: 0, required: true },
      { name: "useType", label: "Tipo de Uso", type: "select", options: SPELL_USE_TYPES },
      { name: "duration", label: "Duração", type: "text" },
      { name: "description", label: "Descrição", type: "textarea" },
      { name: "extraEffect", label: "Efeito Extra", type: "textarea" },
      { name: "actionCostOverride", label: "Custo de Ações (override, 0-3)", type: "number", min: 0, max: 3 },
    ],
    showInList: ["circle", "manaCost"],
  },
  items: {
    label: "Itens",
    fields: [
      { name: "name", label: "Nome", type: "text", required: true },
      { name: "description", label: "Descrição", type: "textarea" },
      { name: "qualityDescription", label: "Qualidade", type: "textarea" },
      { name: "counterpointDescription", label: "Contraponto", type: "textarea" },
    ],
    showInList: ["description"],
  },
  conditions: {
    label: "Condições",
    fields: [
      { name: "name", label: "Nome", type: "text", required: true },
      { name: "description", label: "Descrição", type: "textarea" },
    ],
    showInList: ["description"],
  },
};

const CONTENT_TYPE_ORDER: ContentType[] = ["skills", "spells", "items", "conditions"];

type ContentManagerProps = {
  basePath: string;
  title: string;
};

type Item = Record<string, unknown>;

function toFormValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function ContentManager({ basePath, title }: ContentManagerProps) {
  const [activeType, setActiveType] = useState<ContentType>("skills");
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Overlay de Criação, Busca e Importação D&D 5e
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchContent, setSearchContent] = useState("");
  const [isImportingDnd, setIsImportingDnd] = useState(false);

  const handleImportDndContent = async () => {
    setError(null);
    setIsImportingDnd(true);
    try {
      const response = await fetch("/api/content/import-dnd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: activeType }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Erro ao importar conteúdo D&D 5e");
        return;
      }
      await loadItems();
      alert(data.message || "Conteúdo D&D 5e importado com sucesso!");
    } catch {
      setError("Erro de conexão ao importar da API D&D 5e.");
    } finally {
      setIsImportingDnd(false);
    }
  };

  const config = TYPE_CONFIGS[activeType];

  const loadItems = async () => {
    try {
      const response = await fetch(`${basePath}/${activeType}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar conteúdo");
        return;
      }

      setItems(data.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${basePath}/${activeType}`);
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(data.error || "Erro ao carregar conteúdo");
          return;
        }

        setItems(data.data);
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
  }, [basePath, activeType]);

  const buildPayload = (source: Record<string, string>) => {
    const payload: Record<string, unknown> = {};

    for (const field of config.fields) {
      const value = source[field.name];
      if (field.type === "number") {
        if (value === "" || value === undefined) continue;
        payload[field.name] = Number(value);
      } else if (value !== "" && value !== undefined) {
        payload[field.name] = value;
      }
    }

    return payload;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch(`${basePath}/${activeType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(formData)),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao criar conteúdo");
        return;
      }

      setFormData({});
      setShowCreateModal(false);
      await loadItems();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = (item: Item) => {
    const initial: Record<string, string> = {};
    for (const field of config.fields) {
      initial[field.name] = toFormValue(item[field.name]);
    }
    setEditData(initial);
    setEditingId(item.id as string);
  };

  const handleSaveEdit = async (id: string) => {
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`${basePath}/${activeType}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(editData)),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao salvar alterações");
        return;
      }

      setEditingId(null);
      setEditData({});
      await loadItems();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Excluir esta ${config.label.toLowerCase().replace(/s$/, "")}?`)) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`${basePath}/${activeType}/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao excluir conteúdo");
        return;
      }

      if (editingId === id) {
        setEditingId(null);
      }
      await loadItems();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const renderFields = (
    data: Record<string, string>,
    onChange: (name: string, value: string) => void,
    disabled: boolean,
    prefix: string
  ) =>
    config.fields.map((field) => {
      const key = `${prefix}-${field.name}`;
      if (field.type === "textarea") {
        return (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              {field.label}
            </label>
            <textarea
              value={data[field.name] || ""}
              onChange={(e) => onChange(field.name, e.target.value)}
              required={field.required}
              placeholder={field.placeholder}
              disabled={disabled}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent disabled:bg-gray-900"
              rows={2}
            />
          </div>
        );
      }
      if (field.type === "select") {
        return (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              {field.label}
            </label>
            <select
              value={data[field.name] || ""}
              onChange={(e) => onChange(field.name, e.target.value)}
              required={field.required}
              disabled={disabled}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            >
              <option value="">Selecione</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );
      }
      return (
        <Input
          key={key}
          label={field.label}
          name={`${prefix}-${field.name}`}
          type={field.type}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          value={data[field.name] || ""}
          onChange={(e) => onChange(field.name, e.target.value)}
          required={field.required}
          disabled={disabled}
          className="bg-gray-950 text-white"
        />
      );
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">{title}</h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 transition shadow-lg flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Criar {config.label.replace(/s$/, "")}</span>
          </button>

          <button
            type="button"
            onClick={handleImportDndContent}
            disabled={isImportingDnd}
            className="rounded-xl border border-purple-600 bg-purple-950/80 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-900 transition shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            <span>🐉</span>
            <span>{isImportingDnd ? "Importando D&D 5e..." : `Alimentar ${config.label} (API D&D 5e)`}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-3">
        <div className="flex flex-wrap gap-2">
          {CONTENT_TYPE_ORDER.map((type) => (
            <button
              key={type}
              onClick={() => {
                setActiveType(type);
                setFormData({});
                setEditingId(null);
                setSearchContent("");
              }}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeType === type
                  ? "bg-purple-600 text-white shadow"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
            >
              {TYPE_CONFIGS[type].label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder={`Buscar ${config.label.toLowerCase()} por nome...`}
          value={searchContent}
          onChange={(e) => setSearchContent(e.target.value)}
          className="w-full sm:w-64 rounded-xl border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Área Principal de Conteúdo (Full Width) */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
        <h3 className="mb-3 font-semibold text-white text-sm flex items-center justify-between">
          <span>{config.label} Cadastradas</span>
          <span className="text-xs text-purple-400 font-bold">{items.length} itens</span>
        </h3>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-purple-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400 space-y-2">
            <p>Nenhuma {config.label.toLowerCase().replace(/s$/, "")} cadastrada ainda.</p>
            <p className="text-xs text-gray-500">
              Clique em <strong>+ Criar {config.label.replace(/s$/, "")}</strong> ou <strong>Alimentar (API D&D 5e)</strong> para popular.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items
              .filter((item) =>
                String(item.name || "")
                  .toLowerCase()
                  .includes(searchContent.toLowerCase())
              )
              .map((item) => (
                <div key={item.id as string} className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() =>
                          editingId === item.id ? setEditingId(null) : startEditing(item)
                        }
                        className="text-left font-bold text-sm text-white hover:text-purple-300 flex items-center gap-1.5"
                      >
                        <span>{item.name as string}</span>
                        <span className="text-xs text-purple-400 opacity-70">
                          {editingId === item.id ? "−" : "✎"}
                        </span>
                      </button>

                      <div className="mt-1 space-y-0.5 text-xs text-gray-400">
                        {config.showInList.map((field) => {
                          const value = item[field];
                          if (value === null || value === undefined || value === "") return null;
                          return (
                            <p key={field} className="text-gray-300">
                              <strong className="text-gray-400">{field}:</strong> {String(value)}
                            </p>
                          );
                        })}
                        {Boolean(item.description) && (
                          <p className="text-gray-400 text-[11px] line-clamp-2 mt-1">
                            {String(item.description)}
                          </p>
                        )}
                        {item.campaignId ? (
                          <p className="text-[10px] text-purple-400 font-semibold pt-1">
                            Privado da campanha
                          </p>
                        ) : (
                          <p className="text-[10px] text-gray-500 pt-1">Global</p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(item.id as string)}
                      className="ml-2 shrink-0 text-xs font-semibold text-red-400 hover:text-red-300"
                    >
                      Excluir
                    </button>
                  </div>

                  {editingId === item.id && (
                    <div className="space-y-3 border-t border-gray-800 mt-3 pt-3">
                      <p className="text-xs font-bold text-purple-300">
                        Editar {config.label.replace(/s$/, "")}
                      </p>
                      {renderFields(
                        editData,
                        (name, value) => setEditData((prev) => ({ ...prev, [name]: value })),
                        isSaving,
                        "edit"
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button
                          type="button"
                          variant="master"
                          isLoading={isSaving}
                          onClick={() => handleSaveEdit(item.id as string)}
                        >
                          Salvar
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Modal / Overlay de Criação de Conteúdo */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-purple-800 bg-gray-950 p-6 shadow-2xl space-y-4 text-gray-100 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-purple-900/60 pb-3">
              <h3 className="text-base font-bold text-purple-200">
                Criar Nova {config.label.replace(/s$/, "")}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <Form onSubmit={handleCreate} error={undefined}>
              {renderFields(
                formData,
                (name, value) => setFormData((prev) => ({ ...prev, [name]: value })),
                isCreating,
                "create"
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 rounded-xl border border-gray-800 bg-gray-900 py-2.5 text-xs font-semibold text-gray-300 hover:bg-gray-800"
                >
                  Cancelar
                </button>
                <Button type="submit" variant="master" isLoading={isCreating} className="w-1/2">
                  Criar
                </Button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}
